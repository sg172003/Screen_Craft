import { useRef, useCallback, useEffect } from 'react';
import type { CanvasSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { renderToCanvas, exportHighResImage } from '@/lib/canvasRenderer';

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

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { image, settings } = renderStateRef.current;
    canvas.width = settings.width;
    canvas.height = settings.height;

    renderToCanvas(ctx, settings.width, settings.height, settings, image);
  }, []);

  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const exportImage = useCallback(async (): Promise<string | null> => {
    const { image, settings } = renderStateRef.current;
    if (!image) return null;
    return exportHighResImage(settings, image, settings.exportScale || 2);
  }, []);

  return {
    canvasRef,
    setImage,
    setSettings,
    render: scheduleRender,
    exportImage,
  };
}
