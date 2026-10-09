import type { CanvasSettings } from '@/types';

/**
 * Draw a macOS-style browser window chrome (traffic lights + URL bar).
 * Returns the header height in pixels to offset image content.
 */
export function drawBrowserFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  darkMode: boolean
): number {
  const headerHeight = 32;

  // Frame background
  ctx.fillStyle = darkMode ? '#1e1e1e' : '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  // Header bar
  ctx.fillStyle = darkMode ? '#2d2d2d' : '#f5f5f5';
  ctx.beginPath();
  ctx.roundRect(x, y, width, headerHeight, [radius, radius, 0, 0]);
  ctx.fill();

  // Traffic light buttons
  const lightY = y + 10;
  const lights = ['#ff5f56', '#ffbd2e', '#27c93f'];
  lights.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 16 + i * 16, lightY, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // URL bar
  ctx.fillStyle = darkMode ? '#1e1e1e' : '#e5e5e5';
  ctx.beginPath();
  ctx.roundRect(x + 80, y + 6, width - 160, 20, 4);
  ctx.fill();

  return headerHeight;
}

/**
 * Draw a macOS-style desktop window chrome (title bar + controls).
 * Returns the title bar height in pixels.
 */
export function drawDesktopFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  darkMode: boolean,
  shadowEnabled: boolean,
  shadowIntensity: number
): number {
  const titleBarHeight = 28;

  if (shadowEnabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = shadowIntensity;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadowIntensity / 2;
  }

  // Window background
  ctx.fillStyle = darkMode ? '#2d2d2d' : '#ffffff';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Title bar
  ctx.fillStyle = darkMode ? '#3d3d3d' : '#e8e8e8';
  ctx.beginPath();
  ctx.roundRect(x, y, width, titleBarHeight, [radius, radius, 0, 0]);
  ctx.fill();

  // Window controls (traffic lights)
  const controls = ['#ff5f56', '#ffbd2e', '#27c93f'];
  controls.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 14 + i * 14, y + 14, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  return titleBarHeight;
}

/**
 * Draw a smartphone bezel with notch.
 * Returns 0 since the bezel extends outside the content area.
 */
export function drawMobileFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  darkMode: boolean,
  shadowEnabled: boolean,
  shadowIntensity: number
): number {
  const bezelWidth = 12;

  if (shadowEnabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = shadowIntensity;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = shadowIntensity / 2;
  }

  // Phone bezel
  ctx.fillStyle = darkMode ? '#1a1a1a' : '#f0f0f0';
  ctx.beginPath();
  ctx.roundRect(
    x - bezelWidth,
    y - bezelWidth,
    width + bezelWidth * 2,
    height + bezelWidth * 2,
    radius + bezelWidth
  );
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Notch
  ctx.fillStyle = darkMode ? '#1a1a1a' : '#f0f0f0';
  const notchWidth = Math.min(80, width * 0.4);
  const notchHeight = 22;
  ctx.beginPath();
  ctx.roundRect(
    x + (width - notchWidth) / 2,
    y - bezelWidth,
    notchWidth,
    notchHeight,
    11
  );
  ctx.fill();

  return 0;
}

/**
 * Main rendering function — draws background, device frame, and screenshot
 * onto any 2D canvas context.
 *
 * For high-res export, apply `ctx.scale(factor, factor)` before calling
 * and pass the logical (unscaled) canvas dimensions.
 */
export function renderToCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  settings: CanvasSettings,
  image: HTMLImageElement | null
): void {
  // Enable high-quality image interpolation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Clear
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // --- Background -----------------------------------------------------------
  if (settings.backgroundType === 'solid') {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'gradient') {
    const angle = (settings.gradientDirection * Math.PI) / 180;
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvasWidth * Math.cos(angle),
      canvasHeight * Math.sin(angle)
    );
    gradient.addColorStop(0, settings.gradientStart);
    gradient.addColorStop(1, settings.gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else if (settings.backgroundType === 'blurred' && image) {
    ctx.save();
    ctx.filter = `blur(${settings.blurAmount}px)`;
    const bgScale = Math.max(
      canvasWidth / image.naturalWidth,
      canvasHeight / image.naturalHeight
    );
    const drawWidth = image.naturalWidth * bgScale;
    const drawHeight = image.naturalHeight * bgScale;
    ctx.drawImage(
      image,
      (canvasWidth - drawWidth) / 2,
      (canvasHeight - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    ctx.restore();

    // Dark overlay for contrast
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else {
    // Fallback gradient (blurred mode without image)
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    gradient.addColorStop(0, settings.gradientStart);
    gradient.addColorStop(1, settings.gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // --- Screenshot + Frame ----------------------------------------------------
  if (!image) return;

  const padding = settings.padding;
  const maxContentWidth = Math.max(10, canvasWidth - padding * 2);
  const maxContentHeight = Math.max(10, canvasHeight - padding * 2);

  // Header offset contributed by the frame type
  let frameOffset = 0;
  if (settings.frameType === 'browser') frameOffset = 32;
  else if (settings.frameType === 'desktop') frameOffset = 28;

  const availableHeight = Math.max(10, maxContentHeight - frameOffset);

  // Scale image to fit within available area (preserving aspect ratio)
  const imgScale = Math.min(
    maxContentWidth / image.naturalWidth,
    availableHeight / image.naturalHeight
  );

  const imageWidth = Math.round(image.naturalWidth * imgScale);
  const imageHeight = Math.round(image.naturalHeight * imgScale);

  const frameWidth = imageWidth;
  const frameHeight = imageHeight + frameOffset;

  const frameX = Math.round((canvasWidth - frameWidth) / 2);
  const frameY = Math.round((canvasHeight - frameHeight) / 2);

  // Drop shadow (for none / browser frames — desktop & mobile draw their own)
  if (
    settings.shadowEnabled &&
    settings.frameType !== 'desktop' &&
    settings.frameType !== 'mobile'
  ) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = settings.shadowIntensity;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = settings.shadowIntensity / 2;
    // Opaque background so shadow actually projects
    ctx.fillStyle = settings.frameDarkMode ? '#1e1e1e' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      settings.cornerRadius
    );
    ctx.fill();
    ctx.restore();
  }

  // Device frame
  let contentOffset = 0;
  switch (settings.frameType) {
    case 'browser':
      contentOffset = drawBrowserFrame(
        ctx,
        frameX,
        frameY,
        frameWidth,
        frameHeight,
        settings.cornerRadius,
        settings.frameDarkMode
      );
      break;
    case 'desktop':
      contentOffset = drawDesktopFrame(
        ctx,
        frameX,
        frameY,
        frameWidth,
        frameHeight,
        settings.cornerRadius,
        settings.frameDarkMode,
        settings.shadowEnabled,
        settings.shadowIntensity
      );
      break;
    case 'mobile':
      drawMobileFrame(
        ctx,
        frameX,
        frameY,
        frameWidth,
        frameHeight,
        settings.cornerRadius,
        settings.frameDarkMode,
        settings.shadowEnabled,
        settings.shadowIntensity
      );
      break;
  }

  // Screenshot image
  const imageX = frameX + (frameWidth - imageWidth) / 2;
  const imageY =
    frameY + contentOffset + (frameHeight - contentOffset - imageHeight) / 2;

  if (settings.frameType === 'none') {
    // No frame — apply rounded corners via clip path
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      imageX,
      imageY,
      imageWidth,
      imageHeight,
      settings.cornerRadius
    );
    ctx.clip();
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    ctx.restore();
  } else {
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
  }
}

/**
 * Generates a high-resolution PNG data URL from the current settings and image.
 * Uses an offscreen canvas scaled by `scale` (e.g. 2x, 3x) for crisp Retina output.
 */
export function exportHighResImage(
  settings: CanvasSettings,
  image: HTMLImageElement,
  scale: number = settings.exportScale || 2
): string {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.round(settings.width * scale);
  exportCanvas.height = Math.round(settings.height * scale);
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context for export');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.scale(scale, scale);
  renderToCanvas(ctx, settings.width, settings.height, settings, image);
  ctx.restore();

  return exportCanvas.toDataURL('image/png');
}

/**
 * Copies the high-resolution rendered screenshot directly to the system clipboard as a PNG.
 */
export async function copyHighResToClipboard(
  settings: CanvasSettings,
  image: HTMLImageElement,
  scale: number = settings.exportScale || 2
): Promise<void> {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.round(settings.width * scale);
  exportCanvas.height = Math.round(settings.height * scale);
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.scale(scale, scale);
  renderToCanvas(ctx, settings.width, settings.height, settings, image);
  ctx.restore();

  return new Promise((resolve, reject) => {
    exportCanvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create PNG blob for clipboard'));
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 'image/png');
  });
}
