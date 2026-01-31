import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Download, ArrowLeft, Image as ImageIcon, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ControlPanel } from '@/components/editor/ControlPanel';
import { CanvasPreview } from '@/components/editor/CanvasPreview';
import { ImageUploader } from '@/components/editor/ImageUploader';
import { useImageUpload } from '@/hooks/useImageUpload';
import type { CanvasSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface EditorPageProps {
  onBack: () => void;
}

export const EditorPage = memo(function EditorPage({ onBack }: EditorPageProps) {
  const [settings, setSettings] = useState<CanvasSettings>(DEFAULT_SETTINGS);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
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

  // Handle canvas ref from CanvasPreview
  const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  // Reset settings
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Export image
  const handleExport = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `screencraft-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

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

  // Close panel when clicking outside on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsPanelOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[hsl(220,20%,10%)] overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[hsl(220,15%,14%)] border-b border-[hsl(220,10%,20%)] flex items-center justify-between px-3 sm:px-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 sm:gap-2 text-white/60 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Back</span>
          </button>
          <div className="w-px h-6 bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="ScreenCraft" className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="font-medium text-white/90 text-sm sm:text-base truncate">ScreenCraft</span>
          </div>
          {fileName && (
            <>
              <div className="w-px h-6 bg-white/10 hidden md:block" />
              <span className="text-xs sm:text-sm text-white/50 hidden md:flex items-center gap-2 truncate max-w-[150px] sm:max-w-xs">
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{fileName}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPanelOpen(true)}
            className="md:hidden text-white/60 hover:text-white hover:bg-white/10 h-9 w-9 p-0"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={!image}
            className="hidden sm:flex text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            Reset
          </Button>
          
          <Button
            onClick={handleExport}
            disabled={!image}
            size="sm"
            className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Download High-Res PNG</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel */}
        <ControlPanel
          settings={settings}
          onSettingsChange={setSettings}
          onReset={handleReset}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* Right Canvas Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Canvas Resolution Display */}
          <div className="h-7 sm:h-8 bg-[hsl(220,12%,12%)] border-b border-[hsl(220,10%,20%)] flex items-center justify-center">
            <span className="text-xs text-white/40">
              {settings.width} × {settings.height}px
            </span>
          </div>

          {/* Canvas or Uploader */}
          {image ? (
            <CanvasPreview
              settings={settings}
              image={image}
              onCanvasRef={handleCanvasRef}
            />
          ) : (
            <div className="flex-1 p-4 sm:p-8">
              <ImageUploader
                isDragging={isDragging}
                error={error}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFileSelect={handleFileSelect}
              />
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcut Hint */}
      {image && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 text-[10px] sm:text-xs text-white/30 bg-black/50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg pointer-events-none">
          Ctrl+S to export
        </div>
      )}
    </div>
  );
});
