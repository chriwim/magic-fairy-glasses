import AFRAME from "aframe";

interface Matrix {
  copy(matrix: Matrix): Matrix;
  fromArray(array: ArrayLike<number>): Matrix;
  identity(): Matrix;
}

interface XRFrameLike {
  getViewerPose(space: unknown): { transform: { matrix: Float32Array } } | null;
}

interface SceneRenderer {
  xr: {
    getFrame(): XRFrameLike | null;
    getReferenceSpace(): unknown;
  };
  render(scene: unknown, camera: unknown): void;
}

export interface AEntity extends HTMLElement {
  sceneEl: AScene;
  object3D: { matrixAutoUpdate: boolean; matrix: Matrix; matrixWorldNeedsUpdate: boolean };
}

export interface AScene extends AEntity {
  hasLoaded: boolean;
  canvas: HTMLCanvasElement;
  camera: unknown;
  renderer: SceneRenderer;
  xrSession?: EventTarget & { end(): Promise<void> };
  enterAR(): Promise<void>;
  is(state: string): boolean;
}

const fairies = [
  { position: "-0.4 0.12 -2.2", color: "#ef9ccc", wings: "#b1d6ff", delay: 0 },
  { position: "0.4 0.2 -2.35", color: "#b5a2ec", wings: "#ffd9ad", delay: 700 },
  { position: "0 -0.35 -1.8", color: "#f7bf8a", wings: "#c5e8cf", delay: 1400 }
];

function fairyMarkup(fairy: typeof fairies[number]): string {
  return `
    <a-entity position="${fairy.position}">
      <a-entity class="fairy" animation="property: position; from: 0 -0.06 0; to: 0 0.06 0; dur: 2300; delay: ${fairy.delay}; dir: alternate; loop: true; easing: easeInOutSine"
        animation__reaction="property: scale; from: 1 1 1; to: 1.3 1.3 1.3; dur: 300; dir: alternate; loop: 2; easing: easeInOutSine; startEvents: fairy-tap">
        <a-sphere class="interactive fairy-hit" radius="0.28" material="transparent: true; opacity: 0; depthWrite: false"></a-sphere>
        <a-entity position="0 0.02 0">
          <a-sphere position="-0.14 0.02 -0.05" scale="0.11 0.19 0.025" color="${fairy.wings}" material="transparent: true; opacity: 0.85"
            animation="property: rotation; from: 0 -20 -20; to: 0 25 -20; dur: 700; dir: alternate; loop: true; easing: easeInOutSine"></a-sphere>
          <a-sphere position="0.14 0.02 -0.05" scale="0.11 0.19 0.025" color="${fairy.wings}" material="transparent: true; opacity: 0.85"
            animation="property: rotation; from: 0 20 20; to: 0 -25 20; dur: 700; dir: alternate; loop: true; easing: easeInOutSine"></a-sphere>
          <a-cone position="0 -0.1 0" radius-bottom="0.11" radius-top="0.035" height="0.2" color="${fairy.color}"></a-cone>
          <a-sphere position="0 0.1 0" radius="0.075" color="#f8d4b8"></a-sphere>
          <a-sphere position="0 0.16 -0.015" scale="0.076 0.04 0.07" color="#7b4e67"></a-sphere>
          <a-sphere position="-0.023 0.105 0.069" radius="0.006" color="#553c50"></a-sphere>
          <a-sphere position="0.023 0.105 0.069" radius="0.006" color="#553c50"></a-sphere>
          <a-sphere position="0 0.235 0" radius="0.018" color="#ffe7a4" material="shader: flat"></a-sphere>
        </a-entity>
      </a-entity>
    </a-entity>`;
}

export function createScene(host: HTMLElement): AScene {
  host.innerHTML = `
    <a-scene embedded fairy-frame xr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
      renderer="alpha: true; antialias: true; maxCanvasWidth: 1600; maxCanvasHeight: 1600"
      webxr="referenceSpaceType: local; requiredFeatures: ; optionalFeatures: dom-overlay; overlayElement: #xr-overlay">
      <a-entity light="type: ambient; color: #ffffff; intensity: 1.2"></a-entity>
      <a-entity light="type: directional; color: #ffffff; intensity: 0.7" position="1 2 3"></a-entity>
      <a-entity id="fairy-world">
        ${fairies.map(fairyMarkup).join("")}
        <a-entity id="xr-controls" visible="false" position="0 -0.65 -1.5">
          <a-plane class="interactive xr-exit" position="-0.24 0 0" width="0.32" height="0.19" color="#44365d" material="shader: flat"></a-plane>
          <a-entity position="-0.24 0 0.01">
            <a-box width="0.11" height="0.012" depth="0.006" rotation="0 0 45" color="#ffffff"></a-box>
            <a-box width="0.11" height="0.012" depth="0.006" rotation="0 0 -45" color="#ffffff"></a-box>
          </a-entity>
          <a-plane class="interactive xr-photo" position="0.24 0 0" width="0.32" height="0.19" color="#805b86" material="shader: flat"></a-plane>
          <a-box position="0.24 0 0.01" width="0.13" height="0.08" depth="0.006" color="#ffffff"></a-box>
          <a-circle position="0.24 0 0.02" radius="0.025" color="#805b86"></a-circle>
        </a-entity>
      </a-entity>
      <a-entity camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false">
        <a-entity cursor="rayOrigin: mouse; fuse: false" raycaster="objects: .interactive"></a-entity>
        <a-entity cursor="rayOrigin: xrselect; fuse: false" raycaster="objects: .interactive"></a-entity>
      </a-entity>
    </a-scene>`;
  const scene = host.querySelector("a-scene") as AScene;
  scene.querySelectorAll<HTMLElement>(".fairy-hit").forEach((hit) => {
    hit.addEventListener("click", () => {
      hit.parentElement?.dispatchEvent(new Event("fairy-tap"));
    });
  });
  return scene;
}

export function resetWorld(scene: AScene): void {
  const world = scene.querySelector<AEntity>("#fairy-world");
  if (!world) throw new Error("The fairy scene is missing.");
  world.object3D.matrixAutoUpdate = false;
  world.object3D.matrix.identity();
  world.object3D.matrixWorldNeedsUpdate = true;
}

export function placeWorldOnFirstPose(scene: AScene): () => void {
  let placed = false;
  const world = scene.querySelector<AEntity>("#fairy-world");
  if (!world) throw new Error("The fairy scene is missing.");
  const onFrame = () => {
    if (placed || !scene.is("ar-mode")) return;
    const frame = scene.renderer.xr.getFrame();
    const space = scene.renderer.xr.getReferenceSpace();
    if (!frame || !space) return;
    const pose = frame.getViewerPose(space);
    if (!pose) return;
    world.object3D.matrixAutoUpdate = false;
    world.object3D.matrix.fromArray(pose.transform.matrix);
    world.object3D.matrixWorldNeedsUpdate = true;
    placed = true;
    scene.removeEventListener("tick", onFrame);
  };
  // A-Frame components receive a tick every render frame; the event is emitted below.
  scene.addEventListener("tick", onFrame);
  return () => scene.removeEventListener("tick", onFrame);
}

AFRAME.registerComponent("fairy-frame", {
  tick() {
    this.el.dispatchEvent(new Event("tick"));
  }
});
