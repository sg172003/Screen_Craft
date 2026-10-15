import { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { CanvasSettings } from '@/types';
import { renderToCanvas } from '@/lib/canvasRenderer';

interface CanvasPreviewProps {
  settings: CanvasSettings;
  image?: HTMLImageElement | null;
  video?: HTMLVideoElement | null;
  isPlaying?: boolean;
  onCanvasRef: (canvas: HTMLCanvasElement | null) => void;
}

type VideoFrameCallbackElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export const CanvasPreview = memo(function CanvasPreview({
  settings,
  image = null,
  video = null,
  isPlaying = false,
  onCanvasRef,
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Pass canvas ref to parent
  useEffect(() => {
    onCanvasRef(canvasRef.current);
  }, [onCanvasRef]);

  // Track container size with ResizeObserver for fluid responsiveness on mobile & desktop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Compute preview fit scale
  const scale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return 0.5;
    const paddingX = containerSize.width < 640 ? 16 : 40;
    const paddingY = containerSize.height < 640 ? 16 : 40;
    const availableWidth = Math.max(50, containerSize.width - paddingX * 2);
    const availableHeight = Math.max(50, containerSize.height - paddingY * 2);

    const scaleX = availableWidth / settings.width;
    const scaleY = availableHeight / settings.height;

    return Math.min(scaleX, scaleY, 1);
  }, [containerSize, settings.width, settings.height]);

  const renderCurrent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== settings.width) canvas.width = settings.width;
    if (canvas.height !== settings.height) canvas.height = settings.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderToCanvas(ctx, settings.width, settings.height, settings, image, video);
  }, [settings, image, video]);

  // Render canvas whenever settings, image, or video change
  useEffect(() => {
    renderCurrent();
  }, [renderCurrent]);

  // When video is playing, repainting every animation frame
  useEffect(() => {
    if (!video || !isPlaying) return;

    const videoWithFrameCallback = video as VideoFrameCallbackElement;
    let active = true;
    let callbackId: number | undefined;
    let animId: number | undefined;

    if (videoWithFrameCallback.requestVideoFrameCallback) {
      const renderVideoFrame = () => {
        if (!active) return;
        renderCurrent();
        callbackId = videoWithFrameCallback.requestVideoFrameCallback!(renderVideoFrame);
      };

      callbackId = videoWithFrameCallback.requestVideoFrameCallback(renderVideoFrame);
      return () => {
        active = false;
        if (callbackId !== undefined) {
          videoWithFrameCallback.cancelVideoFrameCallback?.(callbackId);
        }
      };
    }

    let lastFrameAt = 0;
    const loop = () => {
      const now = performance.now();
      if (now - lastFrameAt >= 1000 / 30) {
        renderCurrent();
        lastFrameAt = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animId !== undefined) cancelAnimationFrame(animId);
    };
  }, [video, isPlaying, renderCurrent]);

  // When video is paused but scrubbed/seeked, re-render current video frame
  useEffect(() => {
    if (!video) return;

    const handleUpdate = () => {
      if (!isPlaying) {
        renderCurrent();
      }
    };

    video.addEventListener('seeked', handleUpdate);
    video.addEventListener('timeupdate', handleUpdate);

    return () => {
      video.removeEventListener('seeked', handleUpdate);
      video.removeEventListener('timeupdate', handleUpdate);
    };
  }, [video, isPlaying, renderCurrent]);

  const displayWidth = Math.round(settings.width * scale);
  const displayHeight = Math.round(settings.height * scale);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full h-full bg-[hsl(220,10%,8%)] flex items-center justify-center overflow-hidden checkerboard p-2 sm:p-4 md:p-6"
    >
      <div
        className="relative shadow-2xl transition-all duration-150 ease-out flex items-center justify-center"
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      >
        <canvas
          ref={canvasRef}
          className="rounded-sm block"
          style={{
            width: displayWidth,
            height: displayHeight,
          }}
        />
      </div>
    </div>
  );
});
