// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { placeWorldOnFirstPose, resetWorld, type AScene } from "./scene";

vi.mock("aframe", () => ({ default: { registerComponent: vi.fn() } }));

function setup() {
  const scene = document.createElement("a-scene") as AScene;
  const world = document.createElement("a-entity");
  world.id = "fairy-world";
  const matrix = { identity: vi.fn(), fromArray: vi.fn() };
  const object3D = { matrixAutoUpdate: true, matrixWorldNeedsUpdate: false, matrix };
  Object.assign(world, { object3D });
  scene.append(world);
  const space = {};
  const pose = vi.fn();
  const frame = { getViewerPose: pose };
  const getFrame = vi.fn(() => frame);
  const is = vi.fn(() => true);
  Object.assign(scene, { renderer: { xr: { getFrame, getReferenceSpace: () => space } }, is });
  return { scene, object3D, matrix, pose, getFrame, is, space };
}

describe("fairy world placement", () => {
  it("uses the first valid viewer pose only, keeping the world fixed on later frames", () => {
    const { scene, object3D, matrix, pose, is, space } = setup();
    const first = new Float32Array([1, 2, 3]);
    pose.mockReturnValueOnce(null).mockReturnValueOnce({ transform: { matrix: first } });
    const stop = placeWorldOnFirstPose(scene);
    is.mockReturnValueOnce(false);
    scene.dispatchEvent(new Event("tick"));
    expect(pose).not.toHaveBeenCalled();
    scene.dispatchEvent(new Event("tick"));
    expect(matrix.fromArray).not.toHaveBeenCalled();
    scene.dispatchEvent(new Event("tick"));
    expect(pose).toHaveBeenLastCalledWith(space);
    expect(matrix.fromArray).toHaveBeenCalledOnce();
    expect(matrix.fromArray).toHaveBeenCalledWith(first);
    expect(object3D.matrixAutoUpdate).toBe(false);
    expect(object3D.matrixWorldNeedsUpdate).toBe(true);
    scene.dispatchEvent(new Event("tick"));
    expect(matrix.fromArray).toHaveBeenCalledOnce();
    stop();
  });

  it("stops waiting for a pose when the session is cancelled", () => {
    const { scene, pose } = setup();
    const stop = placeWorldOnFirstPose(scene);
    stop();
    scene.dispatchEvent(new Event("tick"));
    expect(pose).not.toHaveBeenCalled();
  });

  it("resets the world transform for the camera and garden views", () => {
    const { scene, object3D, matrix } = setup();
    resetWorld(scene);
    expect(matrix.identity).toHaveBeenCalledOnce();
    expect(object3D.matrixAutoUpdate).toBe(false);
    expect(object3D.matrixWorldNeedsUpdate).toBe(true);
  });
});
