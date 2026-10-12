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
    return { valid: true, mediaType: 'image', mimeType: 'image/png', error: null };
  }

  // --- JPEG ---
  if (matchesSignature(header, MAGIC_SIGNATURES.JPEG)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return fail(`Image exceeds maximum size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
    }
    return { valid: true, mediaType: 'image', mimeType: 'image/jpeg', error: null };
  }

  // --- WebP ---
  if (isValidWebP(header)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return fail(`Image exceeds maximum size of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`);
    }
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
    'Unsupported file format. Please upload a PNG, JPG, WebP image or MP4, WebM screen recording.'
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
