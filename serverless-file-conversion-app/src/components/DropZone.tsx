import { useCallback, useState, useRef } from 'react';
import { Upload, FileUp, AlertCircle, X } from 'lucide-react';
import { ConversionOption, MAX_FILE_SIZE } from '@/types';
import { formatFileSize, validateFileSize, validateFileType } from '@/utils/fileHelpers';

interface DropZoneProps {
  option: ConversionOption;
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

export default function DropZone({ option, files, onFilesAdded, onRemoveFile, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMultiple = option.id === 'pdf-merge';

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(newFiles);
      const validFiles: File[] = [];

      for (const file of fileArray) {
        // Validate size
        const sizeValidation = validateFileSize(file);
        if (!sizeValidation.valid) {
          setError(sizeValidation.error!);
          return;
        }

        // Validate type
        const typeValidation = validateFileType(file, option);
        if (!typeValidation.valid) {
          setError(typeValidation.error!);
          return;
        }

        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        if (isMultiple) {
          onFilesAdded(validFiles);
        } else {
          onFilesAdded([validFiles[0]]);
        }
      }
    },
    [option, isMultiple, onFilesAdded]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleClick = () => {
    if (!disabled) fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const acceptString = option.acceptedTypes.filter(t => t.startsWith('.')).join(',');

  return (
    <div className="animate-fade-in-up">
      {/* Drop zone area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12
          transition-all duration-300 text-center
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isDragging
            ? 'drop-zone-active border-violet-400 bg-violet-500/10 scale-[1.01]'
            : 'border-gray-700 bg-gray-900/30 hover:border-gray-600 hover:bg-gray-900/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptString}
          multiple={isMultiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
          {isDragging ? (
            <FileUp className="w-16 h-16 mx-auto mb-4 text-violet-400 animate-bounce" />
          ) : (
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          )}
        </div>

        <p className="text-lg font-medium text-gray-200 mb-2">
          {isDragging ? 'Drop your file here!' : 'Drag & drop your file here'}
        </p>
        <p className="text-sm text-gray-400 mb-4">
          or <span className="text-violet-400 underline underline-offset-2">browse</span> to choose a file
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 rounded-md bg-gray-800/80">
            {option.fromFormat} files
          </span>
          <span>•</span>
          <span className="px-2 py-1 rounded-md bg-gray-800/80">
            Max {formatFileSize(MAX_FILE_SIZE)}
          </span>
          {isMultiple && (
            <>
              <span>•</span>
              <span className="px-2 py-1 rounded-md bg-gray-800/80">
                Multiple files supported
              </span>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in-up">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2 animate-fade-in-up">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/50 border border-gray-700/50"
            >
              <div className="text-2xl">{option.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(index);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
