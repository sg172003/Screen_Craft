import { useRef, useCallback, useEffect } from 'react';
import type { CanvasSettings } from '@/types';

interface RenderState {
  image: HTMLImageElement | null;
  settings: CanvasSettings;
}

export function useCanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderStateRef = useRef<RenderState>({
    image: null,
    settings: { ...DEFAULT_SETTINGS },
  });
  const animationFrameRef = useRef<number | null>(null);

  const setImage = useCallback((image: HTMLImageElement | null) => {
    renderStateRef.current.image = image;
  }, []);

  const setSettings = useCallback((settings: CanvasSettings) => {
    renderStateRef.current.settings = settings;
  }, []);

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
    const lights = darkMode 
      ? ['#ff5f56', '#ffbd2e', '#27c93f']
      : ['#ff5f56', '#ffbd2e', '#27c93f'];
    
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
    if (renderStateRef.current.settings.shadowEnabled) {
      const shadowIntensity = renderStateRef.current.settings.shadowIntensity;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
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

    // Window controls
    const controls = ['#ff5f56', '#ffbd2e', '#27c93f'];
    controls.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 14 + i * 14, y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    return titleBarHeight;
  }, []);

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
    if (renderStateRef.current.settings.shadowEnabled) {
      const shadowIntensity = renderStateRef.current.settings.shadowIntensity;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = shadowIntensity;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowIntensity / 2;
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
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { image, settings } = renderStateRef.current;

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
  }, [drawBrowserFrame, drawDesktopFrame, drawMobileFrame]);

  // Schedule render with requestAnimationFrame for performance
  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Export high-res image
  const exportImage = useCallback(async (): Promise<string | null> => {
    const { image, settings } = renderStateRef.current;
    if (!image) return null;

    // Create offscreen canvas for export
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = settings.width;
    offscreenCanvas.height = settings.height;
    const ctx = offscreenCanvas.getContext('2d');
    if (!ctx) return null;

    // Draw background
    if (settings.backgroundType === 'solid') {
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    } else if (settings.backgroundType === 'gradient') {
      const gradient = ctx.createLinearGradient(
        0, 0,
        offscreenCanvas.width * Math.cos(settings.gradientDirection * Math.PI / 180),
        offscreenCanvas.height * Math.sin(settings.gradientDirection * Math.PI / 180)
      );
      gradient.addColorStop(0, settings.gradientStart);
      gradient.addColorStop(1, settings.gradientEnd);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    } else if (settings.backgroundType === 'blurred') {
      ctx.save();
      ctx.filter = `blur(${settings.blurAmount}px)`;
      const scale = Math.max(
        offscreenCanvas.width / image.naturalWidth,
        offscreenCanvas.height / image.naturalHeight
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(
        image,
        (offscreenCanvas.width - drawWidth) / 2,
        (offscreenCanvas.height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    }

    // Draw screenshot with frame
    const padding = settings.padding;
    const maxContentWidth = offscreenCanvas.width - padding * 2;
    const maxContentHeight = offscreenCanvas.height - padding * 2;
    
    let frameOffset = 0;
    if (settings.frameType === 'browser') frameOffset = 32;
    else if (settings.frameType === 'desktop') frameOffset = 28;
    
    const availableHeight = maxContentHeight - frameOffset;
    
    const scale = Math.min(
      maxContentWidth / image.naturalWidth,
      availableHeight / image.naturalHeight
    );
    
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    
    const frameWidth = imageWidth;
    const frameHeight = imageHeight + frameOffset;
    
    const frameX = (offscreenCanvas.width - frameWidth) / 2;
    const frameY = (offscreenCanvas.height - frameHeight) / 2;

    // Draw shadow
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
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imageX, imageY, imageWidth, imageHeight, settings.cornerRadius);
      ctx.clip();
      ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
      ctx.restore();
    } else {
      ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    }

    return offscreenCanvas.toDataURL('image/png');
  }, [drawBrowserFrame, drawDesktopFrame, drawMobileFrame]);

  return {
    canvasRef,
    setImage,
    setSettings,
    render: scheduleRender,
    exportImage,
  };
}

import { DEFAULT_SETTINGS } from '@/types';
