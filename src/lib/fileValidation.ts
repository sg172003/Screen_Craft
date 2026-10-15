/**
 * Deep binary file validation using magic number (file signature) inspection.
 * Prevents extension spoofing, polyglot attacks, and decompression bombs.
 */

export type ValidatedMediaType = 'image' | 'video';

export interface ValidationResult {
  valid: boolean;
  mediaType: ValidatedMediaType | null;
  mimeType: string | null;
  error: string | null;
}

// Image size limits
const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_IMAGE_DIMENSION = 8192; // 8192px

// Video size limits
const MAX_VIDEO_SIZE = 150 * 1024 * 1024; // 150MB
const MAX_VIDEO_DURATION = 600; // 10 minutes in seconds

// Known magic bytes for supported file types
const MAGIC_SIGNATURES = {
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPEG: [0xff, 0xd8, 0xff],
  WEBP_RIFF: [0x52, 0x49, 0x46, 0x46], // 'RIFF'
  WEBP_MARKER: [0x57, 0x45, 0x42, 0x50], // 'WEBP' at offset 8
  WEBM: [0x1a, 0x45, 0xdf, 0xa3], // EBML header
} as const;

// Valid MP4 ftyp brands
const VALID_FTYP_BRANDS = [
  'isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6',
  'mp41', 'mp42', 'mp71',
  'avc1', 'avc2', 'avc3', 'avc4',
  'hev1', 'hvc1',
  'qt  ', 'M4V ', 'M4A ', 'M4VP',
  'dash', 'msdh', 'msix',
  'f4v ', 'f4p ',
];

/**
 * Read the first N bytes of a File as a Uint8Array.
 */
async function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(bytes, file.size));
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

async function readFileRange(file: File, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

interface ImageDimensions {
  width: number;
  height: number;
}

/** Read image dimensions from bounded container metadata before decoding pixels. */
async function readImageDimensions(
  file: File,
  format: 'png' | 'jpeg' | 'webp'
): Promise<ImageDimensions | null> {
  if (format === 'png') {
    const header = await readFileHeader(file, 24);
    if (header.length < 24 || readAscii4(header, 12) !== 'IHDR') return null;
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (format === 'webp') {
    const header = await readFileHeader(file, 30);
    const chunk = readAscii4(header, 12);

    if (chunk === 'VP8X' && header.length >= 30) {
      const width = 1 + header[24] + (header[25] << 8) + (header[26] << 16);
      const height = 1 + header[27] + (header[28] << 8) + (header[29] << 16);
      return { width, height };
    }

    if (chunk === 'VP8 ' && header.length >= 30 &&
      header[23] === 0x9d && header[24] === 0x01 && header[25] === 0x2a) {
      const width = (header[26] | (header[27] << 8)) & 0x3fff;
      const height = (header[28] | (header[29] << 8)) & 0x3fff;
      return { width, height };
    }

    if (chunk === 'VP8L' && header.length >= 25 && header[20] === 0x2f) {
      const width = 1 + ((header[22] & 0x3f) << 8) + header[21];
      const height = 1 + ((header[22] & 0xc0) >> 6) + (header[23] << 2) + ((header[24] & 0x0f) << 10);
      return { width, height };
    }

    return null;
  }

  // JPEG dimensions are stored in a Start Of Frame segment. Only inspect a
  // bounded metadata prefix, and cap segment count to avoid pathological files.
  let offset = 2;
  const scanLimit = Math.min(file.size, 1024 * 1024);
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  for (let segmentCount = 0; segmentCount < 128 && offset + 4 <= scanLimit; segmentCount++) {
    const prefix = await readFileRange(file, offset, offset + 1);
    if (prefix[0] !== 0xff) return null;

    while (offset < scanLimit) {
      const fillByte = await readFileRange(file, offset, offset + 1);
      if (fillByte[0] !== 0xff) break;
      offset++;
    }

    const markerByte = await readFileRange(file, offset, offset + 1);
    if (markerByte.length !== 1) return null;
    const marker = markerByte[0];
    offset++;

    // Standalone markers have no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda || marker === 0x00) return null;

    const lengthBytes = await readFileRange(file, offset, offset + 2);
    if (lengthBytes.length !== 2) return null;
    const segmentLength = (lengthBytes[0] << 8) | lengthBytes[1];
    if (segmentLength < 2 || offset + segmentLength > scanLimit) return null;

    if (startOfFrameMarkers.has(marker)) {
      const frame = await readFileRange(file, offset + 2, offset + 7);
      if (frame.length !== 5) return null;
      return {
        height: (frame[1] << 8) | frame[2],
        width: (frame[3] << 8) | frame[4],
      };
    }

    offset += segmentLength;
  }

  return null;
}

async function validateImageFileDimensions(
  file: File,
  format: 'png' | 'jpeg' | 'webp'
): Promise<string | null> {
  const dimensions = await readImageDimensions(file, format);
  if (!dimensions) return 'Image metadata is invalid or unsupported.';
  return validateImageDimensions(dimensions.width, dimensions.height);
}

/**
 * Check if header bytes match a given signature at offset.
 */
function matchesSignature(header: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (header.length < offset + signature.length) return false;
  return signature.every((byte, i) => header[offset + i] === byte);
}

/**
 * Decode 4 ASCII characters from a Uint8Array at the given offset.
 */
function readAscii4(header: Uint8Array, offset: number): string {
  if (header.length < offset + 4) return '';
  return String.fromCharCode(
    header[offset],
    header[offset + 1],
    header[offset + 2],
    header[offset + 3]
  );
}

/**
 * Detect if file has a valid MP4 ftyp box.
 * MP4 files contain 'ftyp' at byte offset 4, followed by a brand string.
 */
function isValidMP4(header: Uint8Array): boolean {
  // 'ftyp' at offset 4
  if (readAscii4(header, 4) !== 'ftyp') return false;

  // Brand at offset 8
  const brand = readAscii4(header, 8);
  return VALID_FTYP_BRANDS.includes(brand);
}

/**
 * Detect if file is a valid WebP (RIFF header + WEBP marker at offset 8).
 */
function isValidWebP(header: Uint8Array): boolean {
  return (
    matchesSignature(header, MAGIC_SIGNATURES.WEBP_RIFF, 0) &&
    matchesSignature(header, MAGIC_SIGNATURES.WEBP_MARKER, 8)
  );
}

/**
 * Sanitize a filename: strip directory traversal, control chars, and dangerous characters.
 */
export function sanitizeFileName(name: string): string {
  return name
    // Remove directory traversal sequences
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    // Remove path separators
    .replace(/[/\\]/g, '')
    // Remove control characters (U+0000 - U+001F, U+007F)
    .replace(/[\x00-\x1f\x7f]/g, '')
    // Remove potentially dangerous characters
    .replace(/[<>:"|?*]/g, '_')
    // Trim leading/trailing whitespace and dots
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // Collapse multiple underscores
    .replace(/_+/g, '_')
    // Fallback if name is empty after sanitization
    || 'untitled';
}

/**
 * Validate a file's binary signature and metadata.
 * Returns a ValidationResult with mediaType, mimeType, or error details.
 */
export async function validateFile(file: File): Promise<ValidationResult> {
  const fail = (error: string): ValidationResult => ({
    valid: false,
    mediaType: null,
    mimeType: null,
    error,
  });

  if (!file || file.size === 0) {
    return fail('File is empty or missing.');
  }

  // Read first 32 bytes for magic number inspection
  const header = await readFileHeader(file, 32);

  // --- PNG ---
  if (matchesSignature(header, MAGIC_SIGNATURES.PNG)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return fail(`Image exceeds maximum size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
    }
    const dimensionError = await validateImageFileDimensions(file, 'png');
    if (dimensionError) return fail(dimensionError);
    return { valid: true, mediaType: 'image', mimeType: 'image/png', error: null };
  }

  // --- JPEG ---
  if (matchesSignature(header, MAGIC_SIGNATURES.JPEG)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return fail(`Image exceeds maximum size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
    }
    const dimensionError = await validateImageFileDimensions(file, 'jpeg');
    if (dimensionError) return fail(dimensionError);
    return { valid: true, mediaType: 'image', mimeType: 'image/jpeg', error: null };
  }

  // --- WebP ---
  if (isValidWebP(header)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return fail(`Image exceeds maximum size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
    }
    const dimensionError = await validateImageFileDimensions(file, 'webp');
    if (dimensionError) return fail(dimensionError);
    return { valid: true, mediaType: 'image', mimeType: 'image/webp', error: null };
  }

  // --- MP4 ---
  if (isValidMP4(header)) {
    if (file.size > MAX_VIDEO_SIZE) {
      return fail(`Video exceeds maximum size of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`);
    }
    return { valid: true, mediaType: 'video', mimeType: 'video/mp4', error: null };
  }

  // --- WebM (EBML) ---
  if (matchesSignature(header, MAGIC_SIGNATURES.WEBM)) {
    if (file.size > MAX_VIDEO_SIZE) {
      return fail(`Video exceeds maximum size of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`);
    }
    return { valid: true, mediaType: 'video', mimeType: 'video/webm', error: null };
  }

  // --- QuickTime MOV (also uses ftyp box with 'qt  ' brand) ---
  if (readAscii4(header, 4) === 'ftyp') {
    const brand = readAscii4(header, 8);
    if (brand === 'qt  ') {
      if (file.size > MAX_VIDEO_SIZE) {
        return fail(`Video exceeds maximum size of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`);
      }
      return { valid: true, mediaType: 'video', mimeType: 'video/quicktime', error: null };
    }
  }

  return fail(
    'Unsupported file format. Upload a PNG, JPG, or WebP image, or an MP4, WebM, or MOV video.'
  );
}

/**
 * Validate image dimensions after loading.
 */
export function validateImageDimensions(
  width: number,
  height: number
): string | null {
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return `Image dimensions (${width}×${height}) exceed the maximum of ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION}px.`;
  }
  if (width <= 0 || height <= 0) {
    return 'Image has invalid dimensions.';
  }
  return null;
}

/**
 * Validate video duration after metadata loads.
 */
export function validateVideoDuration(duration: number): string | null {
  if (!isFinite(duration) || duration <= 0) {
    return 'Video has an invalid or unreadable duration.';
  }
  if (duration > MAX_VIDEO_DURATION) {
    return `Video duration (${Math.round(duration)}s) exceeds the maximum of ${MAX_VIDEO_DURATION / 60} minutes.`;
  }
  return null;
}
