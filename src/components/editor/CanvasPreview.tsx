import { memo, useRef, useEffect, useState, useMemo } from 'react';
import type { CanvasSettings } from '@/types';
import { renderToCanvas } from '@/lib/canvasRenderer';

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

  // Render canvas whenever settings or image change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = settings.width;
    canvas.height = settings.height;

    renderToCanvas(ctx, settings.width, settings.height, settings, image);
  }, [settings, image]);

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
