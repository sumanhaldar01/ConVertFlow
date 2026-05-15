import { Download, RotateCcw } from 'lucide-react';
import { downloadBlob } from '@/utils/fileHelpers';

interface DownloadButtonProps {
  blob: Blob;
  fileName: string;
  onReset: () => void;
}

export default function DownloadButton({ blob, fileName, onReset }: DownloadButtonProps) {
  const handleDownload = () => {
    downloadBlob(blob, fileName);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 animate-fade-in-up">
      <button
        onClick={handleDownload}
        className="
          w-full sm:w-auto flex items-center justify-center gap-2.5
          px-8 py-3.5 rounded-xl font-semibold text-white
          bg-gradient-to-r from-violet-600 to-cyan-600
          hover:from-violet-500 hover:to-cyan-500
          shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40
          transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
        "
      >
        <Download className="w-5 h-5" />
        Download {fileName}
      </button>

      <button
        onClick={onReset}
        className="
          w-full sm:w-auto flex items-center justify-center gap-2
          px-6 py-3.5 rounded-xl font-medium
          text-gray-300 bg-gray-800/60 border border-gray-700
          hover:bg-gray-800 hover:border-gray-600 hover:text-white
          transition-all duration-300
        "
      >
        <RotateCcw className="w-4 h-4" />
        Convert Another
      </button>
    </div>
  );
}
