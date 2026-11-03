import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { downloadPhoto, makePhoto } from "./photo";
import { createScene, placeWorldOnFirstPose, resetWorld } from "./scene";

type Mode = "home" | "loading" | "camera" | "garden" | "xr";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App container is missing.");

app.innerHTML = `
  <main class="app-shell" data-mode="home">
    <div class="backdrop" aria-hidden="true"><div class="glow glow-one"></div><div class="glow glow-two"></div><div class="hills"></div></div>
    <video id="camera-feed" autoplay muted playsinline aria-hidden="true"></video>
    <div id="scene-host" aria-hidden="true"></div>
    <div class="viewfinder" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div id="xr-overlay">
      <header class="topbar">
        <button id="home-button" class="icon-button" aria-label="Leave the fairy view" title="Leave">×</button>
        <span class="mode-pill"><span class="status-dot"></span><span id="mode-label">FAIRY VIEW</span></span>
        <button id="help-button" class="icon-button" aria-label="Show help" title="Help">?</button>
      </header>
      <section id="home" class="home-panel" aria-labelledby="title">
        <div class="brand-mark" aria-hidden="true"><span>✦</span></div>
        <p class="eyebrow">A LITTLE WINDOW INTO WONDER</p>
        <h1 id="title">Magic Fairy<br><em>Glasses</em></h1>
        <p class="intro">Look a little closer.<br>There may be magic all around you.</p>
        <div class="divider"><span>✦</span></div>
        <div class="actions">
          <button id="xr-button" class="button button-primary"><span class="button-icon">✧</span><span>Find fairies in AR<small>Fairies stay in your world</small></span><span class="arrow">→</span></button>
          <button id="camera-button" class="button button-secondary"><span class="button-icon">◉</span><span>Open magic camera<small>See fairies &amp; take a photo</small></span><span class="arrow">→</span></button>
          <button id="garden-button" class="text-button">Explore without a camera <span>→</span></button>
        </div>
        <p class="grownup-note">Camera access is only used for the viewfinder.<br>Made for little explorers &amp; their grown-ups.<br>Stay together and watch your surroundings.</p>
      </section>
      <section id="loading" class="loading-panel" hidden><span class="loading-star">✦</span><p>Opening a little magic...</p><button id="cancel-button" class="text-button">Cancel</button></section>
      <div id="bottom-bar" class="bottom-bar" hidden>
        <p id="hint">Tap a fairy to say hello <span>✦</span></p>
        <button id="photo-button" class="shutter" aria-label="Take a photo" title="Take a photo"><span></span></button>
        <button id="xr-photo-button" class="photo-switch" hidden>Photos in camera mode <span>→</span></button>
      </div>
      <div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
      <dialog id="help-dialog">
        <div class="dialog-content">
          <p class="eyebrow">A NOTE FOR GROWN-UPS</p>
          <h2>A little help <span>✦</span></h2>
          <p>Tap the fairies to see them flutter. In AR, move your phone to look around; the fairies stay where they appeared.</p>
          <p>Photos are available in magic camera mode. Switching from AR changes where the fairies appear. In AR, use the × and camera symbols to leave or switch views.</p>
          <p>Camera images stay on your device. Please play together in a safe, clear space.</p>
          <p>To install, open your browser menu and choose “Add to Home screen” or “Install app”.</p>
          <button id="close-help" class="button button-primary">Got it</button>
        </div>
      </dialog>
    </div>
    <aside id="offline-banner" class="offline-banner" role="status" hidden><span id="offline-message"></span><button id="update-button" hidden>Update</button></aside>
  </main>`;

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing app element: ${selector}`);
  return element;
}

const shell = required<HTMLElement>(".app-shell");
const home = required<HTMLElement>("#home");
const loading = required<HTMLElement>("#loading");
const bottom = required<HTMLElement>("#bottom-bar");
const video = required<HTMLVideoElement>("#camera-feed");
const notice = required<HTMLElement>("#notice");
const photoButton = required<HTMLButtonElement>("#photo-button");
const xrPhotoButton = required<HTMLButtonElement>("#xr-photo-button");
const xrButton = required<HTMLButtonElement>("#xr-button");
const cameraButton = required<HTMLButtonElement>("#camera-button");
const gardenButton = required<HTMLButtonElement>("#garden-button");
const modeLabel = required<HTMLElement>("#mode-label");
const hint = required<HTMLElement>("#hint");
const dialog = required<HTMLDialogElement>("#help-dialog");
const scene = createScene(required<HTMLElement>("#scene-host"));
const xrControls = required<HTMLElement>("#xr-controls");
let mode: Mode = "home";
let stream: MediaStream | undefined;
let requestId = 0;
let removePoseListener: (() => void) | undefined;
let noticeTimer: number | undefined;
let returningFromXR = false;
let pendingKind: "camera" | "xr" | undefined;

xrButton.disabled = true;
cameraButton.disabled = true;
gardenButton.disabled = true;
scene.addEventListener("renderstart", () => {
  xrButton.disabled = false;
  cameraButton.disabled = false;
  gardenButton.disabled = false;
}, { once: true });
window.setTimeout(() => {
  if (cameraButton.disabled) showNotice("The fairy scene could not start. Check that your browser supports WebGL and reload.", 15000);
}, 12000);

function showNotice(message: string, duration = 8000): void {
  window.clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = window.setTimeout(() => { notice.hidden = true; }, duration);
}

function setMode(next: Mode): void {
  mode = next;
  shell.dataset.mode = next;
  home.hidden = next !== "home";
  loading.hidden = next !== "loading";
  bottom.hidden = next !== "camera" && next !== "garden" && next !== "xr";
  photoButton.hidden = next !== "camera";
  xrPhotoButton.hidden = next !== "xr";
  modeLabel.textContent = next === "xr" ? "WORLD AR" : next === "camera" ? "MAGIC CAMERA" : "FAIRY GARDEN";
  hint.innerHTML = "Tap a fairy to say hello <span>✦</span>";
  xrControls.setAttribute("visible", next === "xr" ? "true" : "false");
}

function stopCamera(): void {
  requestId++;
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = undefined;
  }
  video.pause();
  video.srcObject = null;
}

function resetToHome(message?: string): void {
  stopCamera();
  pendingKind = undefined;
  removePoseListener?.();
  removePoseListener = undefined;
  resetWorld(scene);
  setMode("home");
  if (message) showNotice(message);
}

function describeError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Camera permission was not granted. You can try again or explore without a camera.";
    if (error.name === "NotFoundError" || error.name === "NotReadableError") return "The camera is unavailable or in use. Try again or explore without a camera.";
  }
  console.error("Fairy Glasses:", error);
  return "Could not open the camera. Try again or explore without a camera.";
}

async function startCamera(): Promise<void> {
  stopCamera();
  const currentRequest = requestId;
  pendingKind = "camera";
  resetWorld(scene);
  setMode("loading");
  if (!navigator.mediaDevices?.getUserMedia) {
    resetToHome("This browser cannot access a camera. Try a secure HTTPS page or explore without a camera.");
    return;
  }
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
    if (currentRequest !== requestId || document.hidden) {
      newStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = newStream;
    video.srcObject = newStream;
    await video.play();
    if (currentRequest !== requestId || document.hidden) {
      newStream.getTracks().forEach((track) => track.stop());
      if (stream === newStream) {
        stream = undefined;
        video.srcObject = null;
      }
      return;
    }
    newStream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
      if (mode === "camera") resetToHome("The camera stopped. Please try again.");
    }, { once: true }));
    pendingKind = undefined;
    setMode("camera");
  } catch (error) {
    if (currentRequest !== requestId) return;
    resetToHome(describeError(error));
  }
}

async function startXR(): Promise<void> {
  stopCamera();
  const currentRequest = requestId;
  pendingKind = "xr";
  resetWorld(scene);
  removePoseListener?.();
  removePoseListener = placeWorldOnFirstPose(scene);
  setMode("loading");
  try {
    // Keep requestSession in the button's activation, without awaiting capability checks.
    const request = scene.enterAR();
    await request;
    if (currentRequest !== requestId) {
      await scene.xrSession?.end();
      return;
    }
    pendingKind = undefined;
    setMode("xr");
    showNotice("Tap fairies to say hello. Use the × or camera buttons below to leave AR.", 7000);
  } catch (error) {
    if (currentRequest !== requestId) return;
    console.error("Could not start tracked AR:", error);
    resetToHome("Tracked AR could not start on this device. Try the magic camera or explore without a camera.");
  }
}

async function leaveXR(forPhoto: boolean): Promise<void> {
  if (returningFromXR) return;
  returningFromXR = true;
  try {
    const session = scene.xrSession;
    if (session) await session.end();
    resetToHome(forPhoto
      ? "Photos need magic camera mode. Tap “Open magic camera” to continue; fairies will move."
      : undefined);
  } catch (error) {
    console.error("Could not end the AR session:", error);
    showNotice("Could not leave AR. Please use your browser's exit control.");
  } finally {
    returningFromXR = false;
  }
}

xrButton.addEventListener("click", () => { void startXR(); });
cameraButton.addEventListener("click", () => { void startCamera(); });
gardenButton.addEventListener("click", () => {
  stopCamera();
  resetWorld(scene);
  setMode("garden");
});
required<HTMLButtonElement>("#cancel-button").addEventListener("click", () => resetToHome());
required<HTMLButtonElement>("#home-button").addEventListener("click", () => {
  if (mode === "xr") void leaveXR(false);
  else resetToHome();
});
xrPhotoButton.addEventListener("click", () => { void leaveXR(true); });
required<HTMLElement>(".xr-exit").addEventListener("click", () => { void leaveXR(false); });
required<HTMLElement>(".xr-photo").addEventListener("click", () => { void leaveXR(true); });
scene.addEventListener("exit-vr", () => {
  if (mode === "xr" && !returningFromXR) resetToHome("AR ended. Choose a view to continue.");
});
photoButton.addEventListener("click", async () => {
  if (mode !== "camera") return;
  photoButton.disabled = true;
  try {
    const blob = await makePhoto(video, scene.canvas, () => scene.renderer.render(scene.object3D, scene.camera));
    downloadPhoto(blob);
    showNotice("Photo download started. Check your device's downloads.");
  } catch (error) {
    console.error("Could not save photo:", error);
    showNotice("Could not make a photo. Please try again.");
  } finally {
    photoButton.disabled = false;
  }
});
required<HTMLButtonElement>("#help-button").addEventListener("click", () => dialog.showModal());
required<HTMLButtonElement>("#close-help").addEventListener("click", () => dialog.close());
required<HTMLElement>("#xr-overlay").addEventListener("beforexrselect", (event) => {
  if ((event.target as Element).closest("button, dialog")) event.preventDefault();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (mode === "camera" || (mode === "loading" && pendingKind === "camera"))) {
    resetToHome("The camera was paused. Open it again when you're ready.");
  }
});
window.addEventListener("pagehide", () => {
  if (mode === "camera" || pendingKind === "camera") {
    resetToHome("The camera was paused. Open it again when you're ready.");
  } else {
    stopCamera();
  }
});

const offlineBanner = required<HTMLElement>("#offline-banner");
const offlineMessage = required<HTMLElement>("#offline-message");
const updateButton = required<HTMLButtonElement>("#update-button");
let offlineTimer: number | undefined;
function offlineError(): void {
  window.clearTimeout(offlineTimer);
  offlineMessage.textContent = "Offline setup failed. Reconnect and reload to try again.";
  offlineBanner.hidden = false;
}
const updateSW = registerSW({
  onOfflineReady() {
    offlineMessage.textContent = "Ready to explore offline ✦";
    offlineBanner.hidden = false;
    offlineTimer = window.setTimeout(() => { if (updateButton.hidden) offlineBanner.hidden = true; }, 6000);
  },
  onNeedRefresh() {
    window.clearTimeout(offlineTimer);
    offlineMessage.textContent = "A new version is ready.";
    updateButton.hidden = false;
    offlineBanner.hidden = false;
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const watchInstall = () => {
      const installing = registration.installing;
      if (!installing) return;
      const stateChanged = () => {
        if (installing.state === "redundant") offlineError();
        if (installing.state === "activated" || installing.state === "redundant") {
          installing.removeEventListener("statechange", stateChanged);
        }
      };
      installing.addEventListener("statechange", stateChanged);
    };
    watchInstall();
    registration.addEventListener("updatefound", watchInstall);
  },
  onRegisterError(error) {
    console.error("Offline setup failed:", error);
    offlineError();
  }
});
if (!("serviceWorker" in navigator)) {
  offlineMessage.textContent = "Offline use is unavailable in this browser.";
  offlineBanner.hidden = false;
}
updateButton.addEventListener("click", () => {
  void updateSW(true).catch((error: unknown) => {
    console.error("Update failed:", error);
    offlineMessage.textContent = "Update failed. Please reconnect and try again.";
  });
});
