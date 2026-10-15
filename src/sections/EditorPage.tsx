import { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Download,
  ArrowLeft,
  Image as ImageIcon,
  Film,
  SlidersHorizontal,
  Copy,
  Check,
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ControlPanel } from '@/components/editor/ControlPanel';
import { CanvasPreview } from '@/components/editor/CanvasPreview';
import { ImageUploader } from '@/components/editor/ImageUploader';
import { VideoExportDialog } from '@/components/editor/VideoExportDialog';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { exportHighResImage, copyHighResToClipboard } from '@/lib/canvasRenderer';
import { captureVideoFrame } from '@/lib/videoExporter';
import { trackImageExport, trackMediaUpload } from '@/lib/analytics';
import type { CanvasSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

interface EditorPageProps {
  onBack: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const EditorPage = memo(function EditorPage({ onBack }: EditorPageProps) {
  const [settings, setSettings] = useState<CanvasSettings>(DEFAULT_SETTINGS);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isVideoExportOpen, setIsVideoExportOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    image,
    video,
    mediaType,
    fileName,
    isDragging,
    error,
    isLoading,
    isPlaying,
    currentTime,
    duration,
    isMuted,
    isLooping,
    togglePlay,
    seek,
    toggleMute,
    toggleLoop,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
  } = useMediaUpload();

  // Size the canvas around the source dimensions, padding, and selected frame.
  const lastLoadedMediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  useEffect(() => {
    const media = image || video;
    if (media && media !== lastLoadedMediaRef.current) {
      lastLoadedMediaRef.current = media;
      const mediaWidth = 'naturalWidth' in media ? media.naturalWidth : media.videoWidth;
      const mediaHeight = 'naturalHeight' in media ? media.naturalHeight : media.videoHeight;

      if (mediaWidth > 0 && mediaHeight > 0) {
        const isPortrait = mediaHeight > mediaWidth;
        const recommendedFrame = isPortrait ? 'mobile' : 'browser';
        const frameOffset = recommendedFrame === 'browser' ? 32 : 0;

        const padding = 40;
        const optimalWidth = Math.round(mediaWidth + padding * 2);
        const optimalHeight = Math.round(mediaHeight + padding * 2 + frameOffset);

        setSettings((prev) => ({
          ...prev,
          width: optimalWidth,
          height: optimalHeight,
          frameType: isPortrait && prev.frameType === 'browser' ? 'mobile' : prev.frameType,
        }));

        // Track upload event
        trackMediaUpload(
          mediaType || 'image',
          0,
          `${mediaWidth}x${mediaHeight}`
        );
      }
    }
  }, [image, video, mediaType]);

  // Handle canvas ref from CanvasPreview
  const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
  }, []);

  // Reset settings
  const handleReset = useCallback(() => {
    const media = image || video;
    if (media) {
      const mediaWidth = 'naturalWidth' in media ? media.naturalWidth : media.videoWidth;
      const mediaHeight = 'naturalHeight' in media ? media.naturalHeight : media.videoHeight;
      const isPortrait = mediaHeight > mediaWidth;
      const frameOffset = isPortrait ? 0 : 32;

      setSettings({
        ...DEFAULT_SETTINGS,
        width: mediaWidth + 80,
        height: mediaHeight + 80 + frameOffset,
        frameType: isPortrait ? 'mobile' : 'browser',
      });
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [image, video]);

  // Export high-resolution image using offscreen canvas scaled by exportScale (e.g. 2x, 3x)
  const handleExport = useCallback(async () => {
    if (mediaType === 'video' && video) {
      setIsVideoExportOpen(true);
      return;
    }

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
      trackImageExport(scale, 'png');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [image, video, mediaType, settings, fileName]);

  // Capture video frame as PNG snapshot
  const handleCaptureVideoSnapshot = useCallback(() => {
    if (!video) return;
    try {
      const scale = settings.exportScale || 2;
      const dataUrl = captureVideoFrame(settings, video, scale);
      const link = document.createElement('a');
      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'screen-recording';
      link.download = `${baseName}-snapshot-${Math.round(currentTime)}s-${scale}x.png`;
      link.href = dataUrl;
      link.click();
      trackImageExport(scale, 'video-frame-snapshot');
    } catch (err) {
      console.error('Frame capture failed:', err);
    }
  }, [video, settings, fileName, currentTime]);

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

  // Keyboard shortcuts (Ctrl/Cmd + S for export, Space for video play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (image || video) {
          handleExport();
        }
      } else if (e.code === 'Space' && video) {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExport, togglePlay, image, video]);

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
  const hasMedia = Boolean(image || video);

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
                {mediaType === 'video' ? (
                  <Film className="w-3.5 h-3.5 shrink-0 text-violet-400" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 shrink-0 text-white/40" />
                )}
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
            disabled={!hasMedia}
            className="hidden sm:flex text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 h-8 text-xs"
          >
            Reset
          </Button>

          {/* Video snapshot button */}
          {mediaType === 'video' && video && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCaptureVideoSnapshot}
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2 sm:px-3 text-xs"
              title="Capture Current Video Frame as PNG"
            >
              <Camera className="w-3.5 h-3.5 mr-1 text-violet-400" />
              <span className="hidden sm:inline">Capture Frame</span>
            </Button>
          )}

          {/* Copy to clipboard button (for images) */}
          {mediaType === 'image' && image && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2 sm:px-3 text-xs"
              title="Copy PNG to Clipboard"
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

          {/* Export Button (PNG for images, MP4/WebM Dialog for video) */}
          {mediaType === 'video' ? (
            <Button
              onClick={() => setIsVideoExportOpen(true)}
              disabled={!video}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 font-medium shadow-md shadow-violet-600/20"
            >
              <Film className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              <span>Export Video</span>
            </Button>
          ) : (
            <Button
              onClick={handleExport}
              disabled={!image || isExporting}
              size="sm"
              className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 font-medium shadow-md shadow-[hsl(245,79%,55%)]/20"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              <span className="hidden sm:inline">
                {isExporting ? 'Exporting…' : `Download ${exportScale}× PNG`}
              </span>
              <span className="sm:hidden">{isExporting ? '…' : `Export ${exportScale}×`}</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Control Panel */}
        <ControlPanel
          settings={settings}
          onSettingsChange={setSettings}
          onReset={handleReset}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          image={image || video}
        />

        {/* Center / Right Canvas Workspace */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          {/* Resolution & Quality Status Bar */}
          <div className="h-8 bg-[hsl(220,15%,12%)] border-b border-[hsl(220,10%,18%)] flex items-center justify-between px-3 sm:px-6 shrink-0 text-[11px] sm:text-xs text-white/50">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-white/70">
                {settings.width} × {settings.height}px
              </span>
              <span className="text-white/20 hidden sm:inline">•</span>
              <span className="text-white/40 hidden sm:inline">
                Exporting at <span className="text-white/70 font-mono">{exportWidth} × {exportHeight}px</span> ({exportScale}× export scale)
              </span>
            </div>

            {hasMedia && (
              <div className="flex items-center gap-2 shrink-0">
                {mediaType === 'video' ? (
                  <div className="flex items-center gap-1.5 text-violet-400 font-medium">
                    <Film className="w-3 h-3" />
                    <span className="text-[10px] sm:text-xs">Video Screen Recording</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[10px] sm:text-xs">Source Aspect Ratio Preserved</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Canvas or Uploader */}
          {hasMedia ? (
            <div className="flex-1 flex flex-col min-h-0 relative">
              <CanvasPreview
                settings={settings}
                image={image}
                video={video}
                isPlaying={isPlaying}
                onCanvasRef={handleCanvasRef}
              />

              {/* Floating Video Playback Controller */}
              {mediaType === 'video' && video && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-xl bg-gray-950/85 backdrop-blur-md border border-white/10 rounded-xl p-2.5 sm:p-3 shadow-2xl flex flex-col gap-2 z-10 transition-all">
                  {/* Scrubber slider */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-white/60 min-w-[36px]">
                      {formatTime(currentTime)}
                    </span>
                    <Slider
                      value={[currentTime]}
                      max={duration || 1}
                      step={0.05}
                      onValueChange={([val]) => seek(val)}
                      className="flex-1 cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-white/40 min-w-[36px] text-right">
                      {formatTime(duration)}
                    </span>
                  </div>

                  {/* Playback Controls Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={togglePlay}
                        className="h-8 w-8 p-0 text-white hover:bg-white/10 rounded-full"
                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="h-8 w-8 p-0 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleLoop}
                        className={`h-8 w-8 p-0 hover:bg-white/10 rounded-full ${isLooping ? 'text-violet-400' : 'text-white/40'}`}
                        title={isLooping ? 'Looping enabled' : 'Looping disabled'}
                      >
                        <Repeat className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCaptureVideoSnapshot}
                        className="h-7 text-xs text-white/70 hover:text-white px-2.5 rounded-lg border border-white/10"
                        title="Capture current video frame as PNG"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1 text-violet-400" />
                        <span>Snapshot</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => setIsVideoExportOpen(true)}
                        className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 rounded-lg shadow-sm"
                      >
                        <Film className="w-3.5 h-3.5 mr-1" />
                        <span>Export</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 p-4 sm:p-8 flex items-center justify-center">
              <div className="w-full max-w-2xl">
                <ImageUploader
                  isDragging={isDragging}
                  error={error}
                  isLoading={isLoading}
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

      {/* Video Export Dialog Modal */}
      {isVideoExportOpen && video && (
        <VideoExportDialog
          settings={settings}
          video={video}
          fileName={fileName}
          onClose={() => setIsVideoExportOpen(false)}
        />
      )}

      {/* Keyboard Shortcut Hint on Desktop */}
      {hasMedia && !isVideoExportOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 text-[10px] sm:text-xs text-white/40 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-md pointer-events-none hidden md:flex items-center gap-2 border border-white/5 z-20">
          {mediaType === 'video' ? (
            <span>Press <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[9px]">Space</kbd> to play/pause • <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[9px]">Ctrl/Cmd+S</kbd> to export</span>
          ) : (
            <span>Press <kbd className="px-1 py-0.5 bg-white/10 rounded font-mono text-[9px]">Ctrl/Cmd+S</kbd> to export PNG</span>
          )}
        </div>
      )}
    </div>
  );
});
