import { afterEach, describe, expect, it, vi } from "vitest";
import { coverCrop, downloadPhoto, makePhoto } from "./photo";

describe("coverCrop", () => {
  it("crops a landscape camera frame for a portrait viewfinder", () => {
    expect(coverCrop(1920, 1080, 360, 640)).toEqual({ x: 656.25, y: 0, width: 607.5, height: 1080 });
  });

  it("crops a portrait camera frame for a landscape viewfinder", () => {
    expect(coverCrop(1080, 1920, 640, 360)).toEqual({ x: 0, y: 656.25, width: 1080, height: 607.5 });
  });

  it("keeps the entire frame when aspect ratios match", () => {
    expect(coverCrop(640, 480, 1280, 960)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid dimensions (%s)", (value) => {
    expect(() => coverCrop(640, 480, value, 100)).toThrow("valid dimensions");
  });
});

describe("photo capture", () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(blob: Blob | null = new Blob(["photo"], { type: "image/png" })) {
    const calls: string[] = [];
    const drawImage = vi.fn(() => calls.push("draw"));
    const output = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: (callback: BlobCallback) => callback(blob)
    };
    vi.stubGlobal("document", { createElement: vi.fn(() => output) });
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const video = { videoWidth: 1920, videoHeight: 1080, readyState: 2 } as HTMLVideoElement;
    const scene = {
      width: 720,
      height: 1280,
      getBoundingClientRect: () => ({ width: 360, height: 640 })
    } as HTMLCanvasElement;
    const render = vi.fn(() => calls.push("render"));
    return { calls, drawImage, video, scene, render, output };
  }

  it("composites the cropped camera before the freshly rendered fairy layer", async () => {
    const { calls, drawImage, video, scene, render, output } = setup();
    const photo = await makePhoto(video, scene, render);
    expect(photo.type).toBe("image/png");
    expect([output.width, output.height]).toEqual([720, 1280]);
    expect(calls).toEqual(["draw", "render", "draw"]);
    expect(drawImage).toHaveBeenNthCalledWith(1, video, 656.25, 0, 607.5, 1080, 0, 0, 720, 1280);
    expect(drawImage).toHaveBeenNthCalledWith(2, scene, 0, 0, 720, 1280);
  });

  it("reports a camera that has no frame", async () => {
    const { video, scene, render } = setup();
    Object.defineProperty(video, "readyState", { value: 1 });
    await expect(makePhoto(video, scene, render)).rejects.toThrow("not ready");
    expect(render).not.toHaveBeenCalled();
  });

  it("reports export failure", async () => {
    const { video, scene, render } = setup(null);
    await expect(makePhoto(video, scene, render)).rejects.toThrow("Could not prepare");
  });

  it("starts a local download and schedules object URL cleanup", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const link = { href: "", download: "", click, remove };
    const revokeObjectURL = vi.fn();
    const setTimeout = vi.fn((callback: () => void) => callback());
    vi.stubGlobal("document", { createElement: () => link, body: { append } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:local", revokeObjectURL });
    vi.stubGlobal("window", { setTimeout });
    downloadPhoto(new Blob(["photo"]));
    expect(link.href).toBe("blob:local");
    expect(link.download).toMatch(/^fairy-glasses-.*\.png$/);
    expect(append).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local");
  });
});
