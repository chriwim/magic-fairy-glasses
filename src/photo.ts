export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function coverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Crop {
  if ([sourceWidth, sourceHeight, targetWidth, targetHeight].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("The camera or viewfinder has no valid dimensions.");
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = targetWidth / scale;
  const height = targetHeight / scale;
  return { x: (sourceWidth - width) / 2, y: (sourceHeight - height) / 2, width, height };
}

export async function makePhoto(video: HTMLVideoElement, sceneCanvas: HTMLCanvasElement, render: () => void): Promise<Blob> {
  const bounds = sceneCanvas.getBoundingClientRect();
  const width = Math.round(sceneCanvas.width);
  const height = Math.round(sceneCanvas.height);
  const crop = coverCrop(video.videoWidth, video.videoHeight, bounds.width, bounds.height);
  if (width <= 0 || height <= 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error("The camera is not ready yet. Please try again.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the photo.");
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  render();
  context.drawImage(sceneCanvas, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare the photo.")), "image/png");
  });
}

export function downloadPhoto(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `fairy-glasses-${new Date().toISOString().replaceAll(":", "-")}.png`;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
