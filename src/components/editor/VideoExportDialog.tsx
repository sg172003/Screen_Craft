import { memo, useState, useCallback, useRef } from 'react';
import { X, Download, Film, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { exportVideo, captureVideoFrame, getSupportedFormats, type VideoExportFormat } from '@/lib/videoExporter';
import { trackVideoExport, trackImageExport } from '@/lib/analytics';
import type { CanvasSettings } from '@/types';

interface VideoExportDialogProps {
  settings: CanvasSettings;
  video: HTMLVideoElement;
  fileName: string;
  onClose: () => void;
}

export const VideoExportDialog = memo(function VideoExportDialog({
  settings,
  video,
  fileName,
  onClose,
}: VideoExportDialogProps) {
  const [format, setFormat] = useState<VideoExportFormat>('mp4');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const supported = getSupportedFormats();
  const scale = settings.exportScale || 2;
  const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'screencraft';

  const handleExportVideo = useCallback(async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { blob, extension } = await exportVideo(
        {
          settings,
          video,
          format,
          scale,
          fps: 30,
          onProgress: (p) => setProgress(Math.round(p * 100)),
        },
        controller.signal
      );

      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}-beautified.${extension}`;
      link.click();
      URL.revokeObjectURL(url);

      trackVideoExport(extension, video.duration);
      onClose();
    } catch (err) {
      if ((err as Error).message !== 'Export cancelled.') {
        setError((err as Error).message || 'Export failed.');
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [settings, video, format, scale, baseName, onClose]);

  const handleSnapFrame = useCallback(() => {
    try {
      const dataUrl = captureVideoFrame(settings, video, scale);
      const link = document.createElement('a');
      link.download = `${baseName}-frame-${scale}x.png`;
      link.href = dataUrl;
      link.click();
      trackImageExport(scale, 'png');
    } catch (err) {
      setError((err as Error).message || 'Frame capture failed.');
    }
  }, [settings, video, scale, baseName]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={!isExporting ? handleCancel : undefined}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="
            pointer-events-auto w-full max-w-md
            bg-[hsl(220,15%,13%)] border border-white/10
            rounded-2xl shadow-2xl shadow-black/40
            animate-fade-in overflow-hidden
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={handleCancel}
              disabled={isExporting}
              className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5 disabled:opacity-30"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(245,79%,55%)] to-[hsl(280,70%,55%)] flex items-center justify-center">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Export Video</h2>
                <p className="text-xs text-white/50">
                  {Math.round(video.duration)}s • {settings.width * scale}×{settings.height * scale}px
                </p>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div className="px-6 pb-4">
            <label className="text-xs font-medium text-white/60 mb-2 block">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormat('mp4')}
                disabled={isExporting || !supported.mp4}
                className={`
                  p-3 rounded-xl border text-sm font-medium transition-all text-left
                  ${format === 'mp4'
                    ? 'bg-[hsl(245,79%,55%)]/15 border-[hsl(245,79%,55%)]/50 text-white'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20'
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                <div className="font-semibold">MP4</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {supported.mp4 ? 'H.264 • Universal' : 'Not supported'}
                </div>
              </button>

              <button
                onClick={() => setFormat('webm')}
                disabled={isExporting || !supported.webm}
                className={`
                  p-3 rounded-xl border text-sm font-medium transition-all text-left
                  ${format === 'webm'
                    ? 'bg-[hsl(245,79%,55%)]/15 border-[hsl(245,79%,55%)]/50 text-white'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20'
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                <div className="font-semibold">WebM</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {supported.webm ? 'VP9 • High Quality' : 'Not supported'}
                </div>
              </button>
            </div>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                <span>Rendering video...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-6 pb-4">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                {error}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-4 pt-2 flex gap-2">
            <Button
              onClick={handleSnapFrame}
              disabled={isExporting}
              variant="ghost"
              className="flex-1 text-white/60 hover:text-white hover:bg-white/5 h-10 text-sm rounded-xl border border-white/10"
            >
              <Camera className="w-4 h-4 mr-1.5" />
              Snap Frame
            </Button>

            <Button
              onClick={handleExportVideo}
              disabled={isExporting}
              className="flex-1 bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white h-10 text-sm font-medium shadow-lg shadow-[hsl(245,79%,55%)]/25 rounded-xl"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {isExporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
            </Button>
          </div>

          {/* Cancel during export */}
          {isExporting && (
            <div className="px-6 pb-5">
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="w-full text-white/40 hover:text-white/70 hover:bg-white/5 h-9 text-xs rounded-xl"
              >
                Cancel Export
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
});
