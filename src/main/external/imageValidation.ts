/**
 * Content sniffing for remote images. The server's Content-Type is not
 * trusted: the bytes must start with the signature of one of the raster
 * formats we are willing to hand to the renderer. SVG is deliberately absent
 * because it can carry script.
 */

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0): boolean =>
  bytes.length >= offset + sig.length && sig.every((b, i) => bytes[offset + i] === b);

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

export function sniffImageType(bytes: Uint8Array): ImageMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) {
    return 'image/gif';
  }
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return 'image/webp';
  }
  return null;
}
