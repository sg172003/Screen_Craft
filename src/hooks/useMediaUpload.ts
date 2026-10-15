import { useState, useCallback, useEffect, useRef } from 'react';
import { validateFile, validateImageDimensions, validateVideoDuration, sanitizeFileName } from '@/lib/fileValidation';
import type { ValidatedMediaType } from '@/lib/fileValidation';

export type MediaType = ValidatedMediaType; // 'image' | 'video'

export interface UseMediaUploadReturn {
  // Media state
  image: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  mediaType: MediaType | null;
  fileName: string;
  isDragging: boolean;
  error: string | null;
  isLoading: boolean;

  // Video playback controls
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isLooping: boolean;
  togglePlay: () => void;
  seek: (time: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;

  // Handlers
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearMedia: () => void;
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isLooping, setIsLooping] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoObjectUrlRef = useRef<string | null>(null);

  // Clean up video element on unmount or media change
  const cleanupVideo = useCallback(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
      videoRef.current = null;
    }
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current);
      videoObjectUrlRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const loadImage = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const dimError = validateImageDimensions(img.naturalWidth, img.naturalHeight);
          if (dimError) {
            reject(new Error(dimError));
            return;
          }
          cleanupVideo();
          setImage(img);
          setVideo(null);
          setMediaType('image');
          setFileName(sanitizeFileName(file.name));
          setError(null);
          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }, [cleanupVideo]);

  const loadVideo = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      cleanupVideo();

      const vid = document.createElement('video');
      vid.playsInline = true;
      vid.muted = true;
      vid.loop = true;
      vid.preload = 'auto';
      vid.crossOrigin = 'anonymous';

      const objectUrl = URL.createObjectURL(file);
      videoRef.current = vid;
      videoObjectUrlRef.current = objectUrl;

      vid.onloadedmetadata = () => {
        const durError = validateVideoDuration(vid.duration);
        if (durError) {
          URL.revokeObjectURL(objectUrl);
          if (videoObjectUrlRef.current === objectUrl) videoObjectUrlRef.current = null;
          videoRef.current = null;
          reject(new Error(durError));
          return;
        }

        videoRef.current = vid;
        setImage(null);
        setVideo(vid);
        setMediaType('video');
        setFileName(sanitizeFileName(file.name));
        setDuration(vid.duration);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsMuted(true);
        setIsLooping(true);
        setError(null);
        vid.onerror = () => {
          setIsPlaying(false);
          setError('The video could not be decoded further. Try a browser-supported MP4 or WebM file.');
        };
        resolve();
      };

      vid.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        if (videoObjectUrlRef.current === objectUrl) videoObjectUrlRef.current = null;
        videoRef.current = null;
        reject(new Error('Failed to load video. The format may not be supported by your browser.'));
      };

      vid.src = objectUrl;
    });
  }, [cleanupVideo]);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Deep binary validation
      const validation = await validateFile(file);
      if (!validation.valid) {
        setError(validation.error);
        setIsLoading(false);
        return;
      }

      if (validation.mediaType === 'image') {
        await loadImage(file);
      } else if (validation.mediaType === 'video') {
        await loadVideo(file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file.');
    } finally {
      setIsLoading(false);
    }
  }, [loadImage, loadVideo]);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    processFile(files[0]);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFile(files[0]);

    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [processFile]);

  const clearMedia = useCallback(() => {
    cleanupVideo();
    setImage(null);
    setVideo(null);
    setMediaType(null);
    setFileName('');
    setError(null);
  }, [cleanupVideo]);

  // Video playback controls
  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (vid.paused) {
      vid.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      vid.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(time, vid.duration || 0));
    setCurrentTime(vid.currentTime);
  }, []);

  const toggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  }, []);

  const toggleLoop = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.loop = !vid.loop;
    setIsLooping(vid.loop);
  }, []);

  // Follow native media events instead of forcing React renders on every display frame.
  useEffect(() => {
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const handlePlaying = () => setIsPlaying(true);
    const handlePaused = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      updateTime();
    };

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('seeking', updateTime);
    video.addEventListener('seeked', updateTime);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePaused);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('seeking', updateTime);
      video.removeEventListener('seeked', updateTime);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePaused);
      video.removeEventListener('ended', handleEnded);
    };
  }, [video]);

  useEffect(() => () => {
    videoRef.current?.pause();
    videoRef.current?.removeAttribute('src');
    videoRef.current?.load();
    if (videoObjectUrlRef.current) URL.revokeObjectURL(videoObjectUrlRef.current);
    videoObjectUrlRef.current = null;
    videoRef.current = null;
  }, []);

  // Clipboard paste support (Ctrl+V / Cmd+V) — images only via clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]);

  return {
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
    clearMedia,
  };
}
