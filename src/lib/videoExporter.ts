import type { CanvasSettings } from '@/types';
import { renderToCanvas } from '@/lib/canvasRenderer';

export type VideoExportFormat = 'mp4' | 'webm';

export interface VideoExportOptions {
  settings: CanvasSettings;
  video: HTMLVideoElement;
  format: VideoExportFormat;
  scale: number;
  fps?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Get the best supported MIME type for the desired format.
 */
function getMimeType(format: VideoExportFormat): string | null {
  if (format === 'mp4') {
    // Chrome 114+ supports MP4 muxing in MediaRecorder
    const mp4Types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
    for (const type of mp4Types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
  }

  // WebM fallback (universally supported in Chromium)
  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of webmTypes) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }

  return null;
}

/**
 * Get the file extension from the selected MIME type.
 */
function getFileExtension(mimeType: string): string {
  if (mimeType.startsWith('video/mp4')) return 'mp4';
  return 'webm';
}

/**
 * Check which export formats are supported by the browser.
 */
export function getSupportedFormats(): { mp4: boolean; webm: boolean } {
  return {
    mp4: getMimeType('mp4')?.startsWith('video/mp4') ?? false,
    webm: getMimeType('webm') !== null,
  };
}

/**
 * Export a beautified video by rendering each frame through the canvas pipeline
 * and recording the output via MediaRecorder.
 *
 * The export plays the video from start to end while painting each frame
 * onto a scaled offscreen canvas (identical to the live preview renderer),
 * then captures the canvas stream into the desired container format.
 *
 * Returns a Promise that resolves with a downloadable Blob.
 */
export function exportVideo(
  options: VideoExportOptions,
  abortSignal?: AbortSignal
): Promise<{ blob: Blob; extension: string }> {
  const { settings, video, format, scale, fps = 30, onProgress } = options;

  return new Promise((resolve, reject) => {
    // Determine MIME type
    const mimeType = getMimeType(format);
    if (!mimeType) {
      reject(new Error(`Video format "${format}" is not supported by your browser. Try WebM.`));
      return;
    }

    const extension = getFileExtension(mimeType);

    // Create offscreen canvas at export resolution
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(settings.width * scale);
    exportCanvas.height = Math.round(settings.height * scale);
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to create canvas context for video export.'));
      return;
    }

    // Capture stream from canvas
    const stream = exportCanvas.captureStream(fps);

    // If the source video has audio, try to add it to the stream
    try {
      const vidAny = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const captureFn = vidAny.captureStream || vidAny.mozCaptureStream;
      if (captureFn) {
        const sourceStream = captureFn.call(vidAny);
        const audioTracks = sourceStream.getAudioTracks();
        audioTracks.forEach((track: MediaStreamTrack) => stream.addTrack(track));
      }
    } catch {
      // Audio capture not supported — export without audio
    }

    // Create recorder
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000, // 8 Mbps for high quality
    });

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve({ blob, extension });
    };

    recorder.onerror = () => {
      reject(new Error('Video recording failed.'));
    };

    // Handle abort
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        try {
          recorder.stop();
        } catch {
          // Already stopped
        }
        video.pause();
        reject(new Error('Export cancelled.'));
      });
    }

    // Start recording
    recorder.start();

    // Reset video to beginning
    video.currentTime = 0;
    video.muted = true; // Prevent echo during export

    const totalDuration = video.duration;

    // Render loop: paint each frame through the ScreenCraft renderer
    const renderFrame = () => {
      if (abortSignal?.aborted) return;

      // Report progress
      if (onProgress && totalDuration > 0) {
        onProgress(Math.min(video.currentTime / totalDuration, 1));
      }

      // Render the current video frame with all device chrome & backgrounds
      ctx.save();
      ctx.scale(scale, scale);
      renderToCanvas(ctx, settings.width, settings.height, settings, null, video);
      ctx.restore();

      // Check if video has ended
      if (video.ended || video.currentTime >= totalDuration) {
        // Final progress
        if (onProgress) onProgress(1);

        // Stop recording after a short delay to flush the last frame
        setTimeout(() => {
          try {
            recorder.stop();
          } catch {
            // Already stopped
          }
        }, 100);
        return;
      }

      requestAnimationFrame(renderFrame);
    };

    // Start playback and rendering
    video.play().then(() => {
      requestAnimationFrame(renderFrame);
    }).catch((err) => {
      reject(new Error(`Failed to play video for export: ${err.message}`));
    });
  });
}

/**
 * Capture a high-resolution PNG snapshot of the current video frame.
 */
export function captureVideoFrame(
  settings: CanvasSettings,
  video: HTMLVideoElement,
  scale: number = settings.exportScale || 2
): string {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.round(settings.width * scale);
  exportCanvas.height = Math.round(settings.height * scale);
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context for frame capture.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.scale(scale, scale);
  renderToCanvas(ctx, settings.width, settings.height, settings, null, video);
  ctx.restore();

  return exportCanvas.toDataURL('image/png');
}
