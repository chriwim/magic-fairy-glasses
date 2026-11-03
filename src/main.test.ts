// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("virtual:pwa-register", () => ({ registerSW: () => async () => {} }));
vi.mock("./scene", () => ({
  createScene(host: HTMLElement) {
    host.innerHTML = `<a-scene><div id="xr-controls"></div><div class="xr-exit"></div><div class="xr-photo"></div></a-scene>`;
    const scene = host.querySelector("a-scene");
    if (!scene) throw new Error("Missing test scene");
    Object.assign(scene, { enterAR: vi.fn(), renderer: { render: vi.fn() }, object3D: {}, camera: {}, canvas: document.createElement("canvas") });
    return scene;
  },
  resetWorld: vi.fn(),
  placeWorldOnFirstPose: vi.fn(() => vi.fn())
}));

type TestScene = HTMLElement & { enterAR: ReturnType<typeof vi.fn>; xrSession?: { end(): Promise<void> } };

function button(id: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(id);
  if (!element) throw new Error(`Missing ${id}`);
  return element;
}

function mode(): string | undefined {
  return document.querySelector<HTMLElement>(".app-shell")?.dataset.mode;
}

function cameraStream(): { stream: MediaStream; track: { stop: ReturnType<typeof vi.fn>; addEventListener: ReturnType<typeof vi.fn> } } {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = new MediaStream();
  Object.defineProperties(stream, {
    getTracks: { value: () => [track] },
    getVideoTracks: { value: () => [track] }
  });
  return { stream, track };
}

async function setup(): Promise<TestScene> {
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "srcObject", "set").mockImplementation(() => {});
  await import("./main");
  const scene = document.querySelector<TestScene>("a-scene");
  if (!scene) throw new Error("Missing test scene");
  scene.dispatchEvent(new Event("renderstart"));
  return scene;
}

describe("view lifecycle", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("offers a garden after camera denial, and stops the camera when leaving", async () => {
    await setup();
    const getUserMedia = vi.fn().mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    button("#camera-button").click();
    await vi.waitFor(() => expect(mode()).toBe("home"));
    expect(document.querySelector("#notice")?.textContent).toContain("permission was not granted");
    button("#garden-button").click();
    expect(mode()).toBe("garden");
    button("#home-button").click();
    const { stream, track } = cameraStream();
    getUserMedia.mockResolvedValueOnce(stream);
    button("#camera-button").click();
    await vi.waitFor(() => expect(mode()).toBe("camera"));
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: { facingMode: { ideal: "environment" } } });
    button("#home-button").click();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(mode()).toBe("home");
  });

  it("stops a camera stream that arrives after cancellation", async () => {
    await setup();
    const { stream, track } = cameraStream();
    let resolveCamera: (stream: MediaStream) => void = () => { throw new Error("Camera not requested"); };
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((resolve) => { resolveCamera = resolve; }));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    button("#camera-button").click();
    expect(mode()).toBe("loading");
    button("#cancel-button").click();
    resolveCamera(stream);
    await vi.waitFor(() => expect(track.stop).toHaveBeenCalledOnce());
    expect(mode()).toBe("home");
  });

  it("does not stop a newer camera when an older video start finishes late", async () => {
    await setup();
    const oldCamera = cameraStream();
    const newCamera = cameraStream();
    let finishOldPlay: () => void = () => { throw new Error("Video not started"); };
    vi.mocked(HTMLMediaElement.prototype.play)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishOldPlay = resolve; }))
      .mockResolvedValueOnce();
    const getUserMedia = vi.fn().mockResolvedValueOnce(oldCamera.stream).mockResolvedValueOnce(newCamera.stream);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    button("#camera-button").click();
    await vi.waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce());
    button("#cancel-button").click();
    button("#camera-button").click();
    await vi.waitFor(() => expect(mode()).toBe("camera"));
    finishOldPlay();
    await Promise.resolve();
    expect(newCamera.track.stop).not.toHaveBeenCalled();
    expect(mode()).toBe("camera");
    button("#home-button").click();
    expect(newCamera.track.stop).toHaveBeenCalledOnce();
  });

  it("stops the camera and returns home on page hide", async () => {
    await setup();
    const { stream, track } = cameraStream();
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    button("#camera-button").click();
    await vi.waitFor(() => expect(mode()).toBe("camera"));
    window.dispatchEvent(new Event("pagehide"));
    expect(track.stop).toHaveBeenCalledOnce();
    expect(mode()).toBe("home");
  });

  it("handles AR failure and explicitly ends AR before offering the camera", async () => {
    const scene = await setup();
    scene.enterAR.mockRejectedValueOnce(new Error("Unsupported"));
    button("#xr-button").click();
    await vi.waitFor(() => expect(mode()).toBe("home"));
    expect(document.querySelector("#notice")?.textContent).toContain("Tracked AR could not start");
    const end = vi.fn().mockResolvedValue(undefined);
    scene.xrSession = { end };
    scene.enterAR.mockResolvedValueOnce(undefined);
    button("#xr-button").click();
    await vi.waitFor(() => expect(mode()).toBe("xr"));
    button("#xr-photo-button").click();
    await vi.waitFor(() => expect(mode()).toBe("home"));
    expect(end).toHaveBeenCalledOnce();
    expect(document.querySelector("#notice")?.textContent).toContain("Tap “Open magic camera”");
  });
});
