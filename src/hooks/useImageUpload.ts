import { useState, useCallback } from 'react';

interface UseImageUploadReturn {
  image: HTMLImageElement | null;
  fileName: string;
  isDragging: boolean;
  error: string | null;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearImage: () => void;
}

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function useImageUpload(): UseImageUploadReturn {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImage = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!VALID_TYPES.includes(file.type)) {
        reject(new Error('Please upload a PNG or JPG image'));
        return;
      }

      // Validate file size
      if (file.size > MAX_SIZE) {
        reject(new Error('Image must be smaller than 10MB'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setFileName(file.name);
          setError(null);
          resolve();
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }, []);

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

    const file = files[0];
    loadImage(file).catch((err) => {
      setError(err.message);
    });
  }, [loadImage]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    loadImage(file).catch((err) => {
      setError(err.message);
    });
  }, [loadImage]);

  const clearImage = useCallback(() => {
    setImage(null);
    setFileName('');
    setError(null);
  }, []);

  return {
    image,
    fileName,
    isDragging,
    error,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    clearImage,
  };
}
