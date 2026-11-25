export const sampleSize = 32;
const channels = 4;
const blocks = 4;
const blockSize = sampleSize / blocks;

export function imageDescriptor(pixels: Uint8ClampedArray) {
  if (pixels.length !== sampleSize ** 2 * channels)
    throw new Error("Unexpected image size");
  const color = Array<number>(64).fill(0);
  const layout = Array<number>(blocks ** 2 * 3).fill(0);
  const luminance = (offset: number) =>
    (pixels[offset] * 0.2126 +
      pixels[offset + 1] * 0.7152 +
      pixels[offset + 2] * 0.0722) /
    255;
  let edges = 0;
  for (let y = 0; y < sampleSize; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const offset = (y * sampleSize + x) * channels;
      const block =
        (Math.floor(y / blockSize) * blocks + Math.floor(x / blockSize)) * 3;
      const [r, g, b] = [
        pixels[offset],
        pixels[offset + 1],
        pixels[offset + 2],
      ];
      color[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)] += 1 / sampleSize ** 2;
      for (let channel = 0; channel < 3; channel++)
        layout[block + channel] +=
          pixels[offset + channel] / (255 * blockSize ** 2);
      if (x > 0)
        edges += Math.abs(luminance(offset) - luminance(offset - channels));
    }
  }
  return { color, layout, edge: edges / (sampleSize * (sampleSize - 1)) };
}
export type Descriptor = ReturnType<typeof imageDescriptor>;

export function compareImages(left: Descriptor, right: Descriptor) {
  const histogram =
    left.color.reduce(
      (sum, value, index) => sum + Math.abs(value - right.color[index]),
      0,
    ) / 2;
  const layout =
    left.layout.reduce(
      (sum, value, index) => sum + Math.abs(value - right.layout[index]),
      0,
    ) / left.layout.length;
  return (
    0.5 * histogram + 0.4 * layout + 0.1 * Math.abs(left.edge - right.edge)
  );
}

export async function validateVisualFile(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Choose an image up to 5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder("ascii").decode(bytes);
  const allowed =
    (file.type === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (file.type === "image/png" &&
      bytes[0] === 137 &&
      text.slice(1, 4) === "PNG") ||
    (file.type === "image/webp" &&
      text.startsWith("RIFF") &&
      text.slice(8, 12) === "WEBP");
  if (!allowed) throw new Error("Choose a valid JPEG, PNG, or WebP image.");
}
