import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Download, ArrowLeft, Image as ImageIcon, SlidersHorizontal, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ControlPanel } from '@/components/editor/ControlPanel';
import { CanvasPreview } from '@/components/editor/CanvasPreview';
import { ImageUploader } from '@/components/editor/ImageUploader';
import { useImageUpload } from '@/hooks/useImageUpload';
import { exportHighResImage, copyHighResToClipboard } from '@/lib/canvasRenderer';
import type { CanvasSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface EditorPageProps {
  onBack: () => void;
}

export const EditorPage = memo(function EditorPage({ onBack }: EditorPageProps) {
  const [settings, setSettings] = useState<CanvasSettings>(DEFAULT_SETTINGS);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    image,
    fileName,
    isDragging,
    error,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
  } = useImageUpload();

  // Automatically adjust canvas size to screenshot native resolution when image is imported
  // This guarantees 0% downscaling and preserves 100% native resolution
  const lastLoadedImageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (image && image !== lastLoadedImageRef.current) {
      lastLoadedImageRef.current = image;
      const isPortrait = image.naturalHeight > image.naturalWidth;
      const recommendedFrame = isPortrait ? 'mobile' : 'browser';
      const frameOffset = recommendedFrame === 'browser' ? 32 : 0;

      const padding = 40;
      const optimalWidth = Math.round(image.naturalWidth + padding * 2);
      const optimalHeight = Math.round(image.naturalHeight + padding * 2 + frameOffset);

      setSettings((prev) => ({
        ...prev,
        width: optimalWidth,
        height: optimalHeight,
        frameType: isPortrait && prev.frameType === 'browser' ? 'mobile' : prev.frameType,
      }));
    }
  }, [image]);

  // Handle canvas ref from CanvasPreview
  const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  // Reset settings
  const handleReset = useCallback(() => {
    if (image) {
      const isPortrait = image.naturalHeight > image.naturalWidth;
      let frameOffset = 0;
      if (isPortrait) frameOffset = 0;
      else frameOffset = 32;

      setSettings({
        ...DEFAULT_SETTINGS,
        width: image.naturalWidth + 80,
        height: image.naturalHeight + 80 + frameOffset,
        frameType: isPortrait ? 'mobile' : 'browser',
      });
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [image]);

  // Export high-resolution image using offscreen canvas scaled by exportScale (e.g. 2x, 3x)
  const handleExport = useCallback(async () => {
    if (!image) return;
    setIsExporting(true);

    try {
      const scale = settings.exportScale || 2;
      const dataUrl = exportHighResImage(settings, image, scale);
      const link = document.createElement('a');
      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'screencraft';
      link.download = `${baseName}-${scale}x.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [image, settings, fileName]);

  // Copy high-resolution image to clipboard
  const handleCopy = useCallback(async () => {
    if (!image) return;

    try {
      const scale = settings.exportScale || 2;
      await copyHighResToClipboard(settings, image, scale);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
    }
  }, [image, settings]);

  // Keyboard shortcut for export (Ctrl/Cmd + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (image) {
          handleExport();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExport, image]);

  // Close mobile panel on wide resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsPanelOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const exportScale = settings.exportScale || 2;
  const exportWidth = settings.width * exportScale;
  const exportHeight = settings.height * exportScale;

  return (
    <div className="h-screen flex flex-col bg-[hsl(220,20%,10%)] overflow-hidden">
      {/* Top Header */}
      <header className="h-14 bg-[hsl(220,15%,14%)] border-b border-[hsl(220,10%,20%)] flex items-center justify-between px-3 sm:px-4 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 sm:gap-2 text-white/60 hover:text-white transition-colors shrink-0 p-1 rounded-md"
            title="Go back to home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Back</span>
          </button>
          <div className="w-px h-6 bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="ScreenCraft" className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="font-semibold text-white/95 text-sm sm:text-base tracking-tight truncate">
              ScreenCraft
            </span>
          </div>
          {fileName && (
            <>
              <div className="w-px h-6 bg-white/10 hidden md:block" />
              <span className="text-xs text-white/50 hidden md:flex items-center gap-1.5 truncate max-w-[140px] lg:max-w-xs">
                <ImageIcon className="w-3.5 h-3.5 shrink-0 text-white/40" />
                <span className="truncate">{fileName}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Edit Controls trigger button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPanelOpen(true)}
            className="md:hidden text-white/80 hover:text-white bg-white/5 hover:bg-white/10 h-8 px-2.5 text-xs flex items-center gap-1.5 border border-white/10"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[hsl(245,79%,65%)]" />
            <span>Controls</span>
          </Button>

          {/* Reset button on desktop */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!image}
            className="hidden sm:flex text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 h-8 text-xs"
          >
            Reset
          </Button>

          {/* Copy to clipboard button */}
          {image && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2 sm:px-3 text-xs"
              title="Copy High-Res PNG to Clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                  <span className="hidden sm:inline text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </Button>
          )}

          {/* High-Res PNG Export Button */}
          <Button
            onClick={handleExport}
            disabled={!image || isExporting}
            size="sm"
            className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 font-medium shadow-md shadow-[hsl(245,79%,55%)]/20"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
            <span className="hidden sm:inline">
              {isExporting ? 'Exporting...' : `Download ${exportScale}x PNG`}
            </span>
            <span className="sm:hidden">{isExporting ? '...' : `Export ${exportScale}x`}</span>
          </Button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Control Panel (Desktop sidebar & Mobile bottom sheet) */}
        <ControlPanel
          settings={settings}
          onSettingsChange={setSettings}
          onReset={handleReset}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          image={image}
        />

        {/* Center / Right Canvas Workspace */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Resolution & Quality Status Bar */}
          <div className="h-8 bg-[hsl(220,15%,12%)] border-b border-[hsl(220,10%,18%)] flex items-center justify-between px-3 sm:px-6 shrink-0 text-[11px] sm:text-xs text-white/50">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-white/70">
                {settings.width} × {settings.height}px
              </span>
              <span className="text-white/20 hidden sm:inline">•</span>
              <span className="text-white/40 hidden sm:inline">
                Exporting at <span className="text-white/70 font-mono">{exportWidth} × {exportHeight}px</span> ({exportScale}x Retina HD)
              </span>
            </div>

            {image && (
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium shrink-0">
                <Sparkles className="w-3 h-3" />
                <span className="text-[10px] sm:text-xs">100% Native Resolution</span>
              </div>
            )}
          </div>

          {/* Canvas or Uploader */}
          {image ? (
            <CanvasPreview
              settings={settings}
              image={image}
              onCanvasRef={handleCanvasRef}
            />
          ) : (
            <div className="flex-1 p-4 sm:p-8 flex items-center justify-center">
              <div className="w-full max-w-2xl">
                <ImageUploader
                  isDragging={isDragging}
                  error={error}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onFileSelect={handleFileSelect}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcut Hint on Desktop */}
      {image && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 text-[10px] sm:text-xs text-white/40 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md pointer-events-none hidden md:block border border-white/5">
          Press <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[9px]">Ctrl+S</kbd> to export high-res
        </div>
      )}
    </div>
  );
});
