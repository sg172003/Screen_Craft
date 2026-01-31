import { memo, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploaderProps {
  isDragging: boolean;
  error: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ImageUploader = memo(function ImageUploader({
  isDragging,
  error,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
}: ImageUploaderProps) {
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
        accept="image/png,image/jpeg,image/jpg"
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
          {isDragging ? (
            <ImageIcon className="w-7 h-7 sm:w-8 sm:h-8 text-[hsl(245,79%,55%)]" />
          ) : (
            <Upload className="w-7 h-7 sm:w-8 sm:h-8 text-white/40" />
          )}
        </div>
        
        <p className="text-base sm:text-lg font-medium text-white/80 mb-2">
          {isDragging ? 'Drop your screenshot here' : 'Drag and drop your screenshot'}
        </p>
        
        <p className="text-sm text-white/50">
          or click to browse <span className="text-white/40 hidden sm:inline">(PNG or JPG)</span>
        </p>
        
        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg inline-block">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});
