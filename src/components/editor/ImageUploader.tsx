import { memo, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Film } from 'lucide-react';

interface MediaUploaderProps {
  isDragging: boolean;
  error: string | null;
  isLoading: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ImageUploader = memo(function ImageUploader({
  isDragging,
  error,
  isLoading,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      onClick={handleClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        flex-1 flex items-center justify-center p-6 sm:p-8 cursor-pointer
        border-2 border-dashed rounded-xl transition-all duration-200 min-h-[300px] sm:min-h-0
        ${isDragging 
          ? 'border-[hsl(245,79%,55%)] bg-[hsl(245,79%,55%)]/5' 
          : 'border-white/20 hover:border-white/40 bg-white/[0.02]'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={onFileSelect}
        className="hidden"
      />
      
      <div className="text-center">
        <div className={`
          w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
          transition-all duration-200
          ${isDragging 
            ? 'bg-[hsl(245,79%,55%)]/20' 
            : 'bg-white/5'
          }
        `}>
          {isLoading ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-white/20 border-t-[hsl(245,79%,55%)] rounded-full animate-spin" />
          ) : isDragging ? (
            <ImageIcon className="w-7 h-7 sm:w-8 sm:h-8 text-[hsl(245,79%,55%)]" />
          ) : (
            <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-white/40" />
          )}
        </div>
        
        <p className="text-base sm:text-lg font-medium text-white/80 mb-2">
          {isLoading
            ? 'Loading media...'
            : isDragging
              ? 'Drop your file here'
              : 'Drag and drop your screenshot or recording'}
        </p>
        
        <p className="text-sm text-white/50 mb-3">
          or click to browse
        </p>

        {/* Format badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/40 border border-white/5">
            <ImageIcon className="w-2.5 h-2.5" /> PNG
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/40 border border-white/5">
            <ImageIcon className="w-2.5 h-2.5" /> JPG
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-white/40 border border-white/5">
            <ImageIcon className="w-2.5 h-2.5" /> WebP
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-[10px] text-emerald-400/70 border border-emerald-500/10">
            <Film className="w-2.5 h-2.5" /> MP4
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-[10px] text-emerald-400/70 border border-emerald-500/10">
            <Film className="w-2.5 h-2.5" /> WebM
          </span>
        </div>
        
        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg inline-block">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});
