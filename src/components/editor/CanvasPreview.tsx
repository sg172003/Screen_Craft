import { memo, useRef, useEffect, useCallback } from 'react';
import type { CanvasSettings } from '@/types';

interface CanvasPreviewProps {
  settings: CanvasSettings;
  image: HTMLImageElement | null;
  onCanvasRef: (canvas: HTMLCanvasElement | null) => void;
}

export const CanvasPreview = memo(function CanvasPreview({
  settings,
  image,
  onCanvasRef,
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pass canvas ref to parent
  useEffect(() => {
    onCanvasRef(canvasRef.current);
  }, [onCanvasRef]);

  // Draw browser frame
  const drawBrowserFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    darkMode: boolean
  ) => {
    const headerHeight = 32;
    
    // Frame background
    ctx.fillStyle = darkMode ? '#1e1e1e' : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();

    // Header
    ctx.fillStyle = darkMode ? '#2d2d2d' : '#f5f5f5';
    ctx.beginPath();
    ctx.roundRect(x, y, width, headerHeight, [radius, radius, 0, 0]);
    ctx.fill();

    // Traffic lights
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
  }, []);

  // Draw desktop frame
  const drawDesktopFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    darkMode: boolean
  ) => {
    const titleBarHeight = 28;
    
    // Window shadow
    if (settings.shadowEnabled) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = settings.shadowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = settings.shadowIntensity / 2;
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

    // Window controls
    const controls = ['#ff5f56', '#ffbd2e', '#27c93f'];
    controls.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 14 + i * 14, y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    return titleBarHeight;
  }, [settings.shadowEnabled, settings.shadowIntensity]);

  // Draw mobile frame
  const drawMobileFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    darkMode: boolean
  ) => {
    const bezelWidth = 12;
    
    // Outer bezel with shadow
    if (settings.shadowEnabled) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = settings.shadowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = settings.shadowIntensity / 2;
    }

    // Phone bezel
    ctx.fillStyle = darkMode ? '#1a1a1a' : '#f0f0f0';
    ctx.beginPath();
    ctx.roundRect(x - bezelWidth, y - bezelWidth, width + bezelWidth * 2, height + bezelWidth * 2, radius + bezelWidth);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Notch
    ctx.fillStyle = darkMode ? '#1a1a1a' : '#f0f0f0';
    const notchWidth = 80;
    const notchHeight = 24;
    ctx.beginPath();
    ctx.roundRect(x + (width - notchWidth) / 2, y - bezelWidth, notchWidth, notchHeight, 12);
    ctx.fill();

    return 0;
  }, [settings.shadowEnabled, settings.shadowIntensity]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = settings.width;
    canvas.height = settings.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (settings.backgroundType === 'solid') {
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (settings.backgroundType === 'gradient') {
      const gradient = ctx.createLinearGradient(
        0, 0,
        canvas.width * Math.cos(settings.gradientDirection * Math.PI / 180),
        canvas.height * Math.sin(settings.gradientDirection * Math.PI / 180)
      );
      gradient.addColorStop(0, settings.gradientStart);
      gradient.addColorStop(1, settings.gradientEnd);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (settings.backgroundType === 'blurred' && image) {
      // Draw blurred background
      ctx.save();
      ctx.filter = `blur(${settings.blurAmount}px)`;
      const scale = Math.max(
        canvas.width / image.naturalWidth,
        canvas.height / image.naturalHeight
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(
        image,
        (canvas.width - drawWidth) / 2,
        (canvas.height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();
      
      // Add overlay for better contrast
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Default gradient if no image for blurred mode
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, settings.gradientStart);
      gradient.addColorStop(1, settings.gradientEnd);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw screenshot with frame
    if (image) {
      const padding = settings.padding;
      const maxContentWidth = canvas.width - padding * 2;
      const maxContentHeight = canvas.height - padding * 2;
      
      // Calculate frame dimensions
      let frameOffset = 0;
      if (settings.frameType === 'browser') frameOffset = 32;
      else if (settings.frameType === 'desktop') frameOffset = 28;
      
      const availableHeight = maxContentHeight - frameOffset;
      
      // Calculate image scale to fit
      const scale = Math.min(
        maxContentWidth / image.naturalWidth,
        availableHeight / image.naturalHeight
      );
      
      const imageWidth = image.naturalWidth * scale;
      const imageHeight = image.naturalHeight * scale;
      
      const frameWidth = imageWidth;
      const frameHeight = imageHeight + frameOffset;
      
      const frameX = (canvas.width - frameWidth) / 2;
      const frameY = (canvas.height - frameHeight) / 2;

      // Draw shadow if enabled
      if (settings.shadowEnabled && settings.frameType !== 'desktop' && settings.frameType !== 'mobile') {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = settings.shadowIntensity;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = settings.shadowIntensity / 2;
        ctx.fillStyle = 'transparent';
        ctx.beginPath();
        ctx.roundRect(frameX, frameY, frameWidth, frameHeight, settings.cornerRadius);
        ctx.fill();
        ctx.restore();
      }

      // Draw frame
      let contentOffset = 0;
      switch (settings.frameType) {
        case 'browser':
          contentOffset = drawBrowserFrame(ctx, frameX, frameY, frameWidth, frameHeight, settings.cornerRadius, settings.frameDarkMode);
          break;
        case 'desktop':
          contentOffset = drawDesktopFrame(ctx, frameX, frameY, frameWidth, frameHeight, settings.cornerRadius, settings.frameDarkMode);
          break;
        case 'mobile':
          drawMobileFrame(ctx, frameX, frameY, frameWidth, frameHeight, settings.cornerRadius, settings.frameDarkMode);
          break;
      }

      // Draw image
      const imageX = frameX + (frameWidth - imageWidth) / 2;
      const imageY = frameY + contentOffset + (frameHeight - contentOffset - imageHeight) / 2;
      
      if (settings.frameType === 'none') {
        // No frame, just draw image with rounded corners
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(imageX, imageY, imageWidth, imageHeight, settings.cornerRadius);
        ctx.clip();
        ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
        ctx.restore();
      } else {
        ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
      }
    }
  }, [settings, image, drawBrowserFrame, drawDesktopFrame, drawMobileFrame]);

  // Calculate scale to fit preview
  const getPreviewScale = () => {
    if (!containerRef.current) return 1;
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;
    
    const scaleX = containerWidth / settings.width;
    const scaleY = containerHeight / settings.height;
    
    return Math.min(scaleX, scaleY, 1);
  };

  const scale = getPreviewScale();

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-[hsl(220,10%,8%)] flex items-center justify-center overflow-auto checkerboard p-4 sm:p-6 md:p-8 lg:p-10"
    >
      <div
        className="relative canvas-container"
        style={{
          width: settings.width * scale,
          height: settings.height * scale,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{
            width: settings.width * scale,
            height: settings.height * scale,
          }}
        />
      </div>
    </div>
  );
});
