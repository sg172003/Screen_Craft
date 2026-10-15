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
  if (typeof MediaRecorder === 'undefined') return null;

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

  // Try commonly supported WebM codecs in order.
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
    const mimeType = getMimeType(format);
    if (!mimeType) {
      reject(new Error(`Video format "${format}" is not supported by your browser. Try another available format.`));
      return;
    }

    const extension = getFileExtension(mimeType);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(settings.width * scale);
    exportCanvas.height = Math.round(settings.height * scale);
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to create canvas context for video export.'));
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const chunks: Blob[] = [];
    const totalDuration = video.duration;
    if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
      reject(new Error('The video duration could not be read.'));
      return;
    }

    const originalState = {
      currentTime: video.currentTime,
      loop: video.loop,
      muted: video.muted,
      playbackRate: video.playbackRate,
      wasPaused: video.paused,
    };
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let frameCallbackId: number | undefined;
    let animationFrameId: number | undefined;
    let watchdogId: number | undefined;
    let finished = false;
    let settled = false;
    let lastProgress = -1;
    let lastProgressTime = video.currentTime;
    let lastProgressAt = performance.now();

    const videoWithFrameCallback = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };

    const drawFrame = () => {
      ctx.save();
      try {
        ctx.scale(scale, scale);
        renderToCanvas(ctx, settings.width, settings.height, settings, null, video);
      } finally {
        ctx.restore();
      }
    };

    const reportProgress = () => {
      const currentProgress = Math.min(video.currentTime / totalDuration, 1);
      const percent = Math.floor(currentProgress * 100);
      if (onProgress && percent !== lastProgress) {
        lastProgress = percent;
        onProgress(currentProgress);
      }
      if (video.currentTime > lastProgressTime + 0.01) {
        lastProgressTime = video.currentTime;
        lastProgressAt = performance.now();
      }
    };

    const cleanup = () => {
      abortSignal?.removeEventListener('abort', handleAbort);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleVideoError);
      if (frameCallbackId !== undefined) {
        videoWithFrameCallback.cancelVideoFrameCallback?.(frameCallbackId);
      }
      if (animationFrameId !== undefined) cancelAnimationFrame(animationFrameId);
      if (watchdogId !== undefined) window.clearInterval(watchdogId);
      stream?.getTracks().forEach((track) => track.stop());

      video.pause();
      video.loop = originalState.loop;
      video.muted = originalState.muted;
      video.playbackRate = originalState.playbackRate;
      if (Number.isFinite(originalState.currentTime) && Math.abs(video.currentTime - originalState.currentTime) > 0.05) {
        try {
          video.currentTime = originalState.currentTime;
        } catch {
          // Some media sources cannot seek during teardown.
        }
      }
      if (!originalState.wasPaused) {
        video.play().catch(() => undefined);
      }
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        try { recorder.stop(); } catch { /* Recorder may already be stopping. */ }
      }
      cleanup();
      reject(error);
    };

    const stopRecording = () => {
      if (finished || settled) return;
      finished = true;
      onProgress?.(1);
      if (recorder?.state === 'recording') {
        recorder.stop();
      } else {
        fail(new Error('The video recorder stopped before export completed.'));
      }
    };

    const handleEnded = () => {
      try {
        drawFrame();
      } catch {
        fail(new Error('A video frame could not be rendered during export.'));
        return;
      }
      stopRecording();
    };

    const handleVideoError = () => fail(new Error('The source video stopped decoding during export.'));
    const handleAbort = () => fail(new Error('Export cancelled.'));

    const renderNextFrame = () => {
      if (settled || finished) return;
      try {
        drawFrame();
      } catch {
        fail(new Error('A video frame could not be rendered during export.'));
        return;
      }
      reportProgress();
      if (video.ended) {
        stopRecording();
        return;
      }

      if (videoWithFrameCallback.requestVideoFrameCallback) {
        frameCallbackId = videoWithFrameCallback.requestVideoFrameCallback(renderNextFrame);
      } else {
        animationFrameId = requestAnimationFrame(renderNextFrame);
      }
    };

    const waitForSeek = () => new Promise<void>((resolveSeek, rejectSeek) => {
      if (Math.abs(video.currentTime) < 0.001 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolveSeek();
        return;
      }

      const timeoutId = window.setTimeout(() => {
        video.removeEventListener('seeked', handleSeeked);
        abortSignal?.removeEventListener('abort', handleWaitAbort);
        rejectSeek(new Error('The video could not seek to its first frame.'));
      }, 10000);
      const handleSeeked = () => {
        window.clearTimeout(timeoutId);
        video.removeEventListener('seeked', handleSeeked);
        abortSignal?.removeEventListener('abort', handleWaitAbort);
        resolveSeek();
      };
      const handleWaitAbort = () => {
        window.clearTimeout(timeoutId);
        video.removeEventListener('seeked', handleSeeked);
        rejectSeek(new Error('Export cancelled.'));
      };
      abortSignal?.addEventListener('abort', handleWaitAbort, { once: true });
      video.addEventListener('seeked', handleSeeked, { once: true });
      if (abortSignal?.aborted) {
        handleWaitAbort();
        return;
      }
      video.currentTime = 0;
    });

    const start = async () => {
      abortSignal?.addEventListener('abort', handleAbort, { once: true });
      if (abortSignal?.aborted) throw new Error('Export cancelled.');
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((ready, failReady) => {
          const timeoutId = window.setTimeout(() => {
            video.removeEventListener('loadeddata', handleReady);
            video.removeEventListener('error', handleReadyError);
            abortSignal?.removeEventListener('abort', handleReadyAbort);
            failReady(new Error('The video is not ready to export yet.'));
          }, 10000);
          const handleReady = () => {
            window.clearTimeout(timeoutId);
            video.removeEventListener('loadeddata', handleReady);
            video.removeEventListener('error', handleReadyError);
            abortSignal?.removeEventListener('abort', handleReadyAbort);
            ready();
          };
          const handleReadyError = () => {
            window.clearTimeout(timeoutId);
            video.removeEventListener('loadeddata', handleReady);
            abortSignal?.removeEventListener('abort', handleReadyAbort);
            failReady(new Error('The source video could not be decoded.'));
          };
          const handleReadyAbort = () => {
            window.clearTimeout(timeoutId);
            video.removeEventListener('loadeddata', handleReady);
            video.removeEventListener('error', handleReadyError);
            failReady(new Error('Export cancelled.'));
          };
          video.addEventListener('loadeddata', handleReady, { once: true });
          video.addEventListener('error', handleReadyError, { once: true });
          abortSignal?.addEventListener('abort', handleReadyAbort, { once: true });
          if (abortSignal?.aborted) handleReadyAbort();
        });
      }

      video.pause();
      video.loop = false;
      await waitForSeek();
      if (abortSignal?.aborted) throw new Error('Export cancelled.');

      stream = exportCanvas.captureStream(fps);
      try {
        const captureSource = videoWithFrameCallback.captureStream || videoWithFrameCallback.mozCaptureStream;
        if (captureSource) {
          captureSource.call(videoWithFrameCallback).getAudioTracks().forEach((track) => stream?.addTrack(track));
        }
      } catch {
        // Browsers without media-element audio capture export a silent video.
      }

      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: Math.min(
          16_000_000,
          Math.max(5_000_000, exportCanvas.width * exportCanvas.height * fps * 0.06)
        ),
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (settled) return;
        settled = true;
        const blob = new Blob(chunks, { type: mimeType });
        cleanup();
        if (blob.size === 0) {
          reject(new Error('The browser produced an empty video export.'));
          return;
        }
        resolve({ blob, extension });
      };
      recorder.onerror = () => fail(new Error('Video recording failed.'));
      video.addEventListener('ended', handleEnded, { once: true });
      video.addEventListener('error', handleVideoError, { once: true });

      drawFrame();
      recorder.start(1000);
      await video.play();
      if (settled || finished) return;
      if (videoWithFrameCallback.requestVideoFrameCallback) {
        frameCallbackId = videoWithFrameCallback.requestVideoFrameCallback(renderNextFrame);
      } else {
        animationFrameId = requestAnimationFrame(renderNextFrame);
      }

      watchdogId = window.setInterval(() => {
        if (performance.now() - lastProgressAt > 15000 && video.currentTime < totalDuration) {
          fail(new Error('Video playback stalled during export. Try another video file or a lower export resolution.'));
        }
      }, 1000);
    };

    void start().catch((err: unknown) => {
      fail(err instanceof Error ? err : new Error('Video export failed.'));
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
