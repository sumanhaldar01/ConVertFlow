import { ConversionStatus } from '@/types';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ProgressBarProps {
  status: ConversionStatus;
  progress: number;
  error?: string;
}

export default function ProgressBar({ status, progress, error }: ProgressBarProps) {
  const getStatusText = () => {
    switch (status) {
      case 'validating':
        return 'Validating file...';
      case 'converting':
        return `Converting... ${Math.round(progress)}%`;
      case 'completed':
        return 'Conversion complete!';
      case 'error':
        return error || 'An error occurred';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'from-emerald-500 to-green-500';
      case 'error':
        return 'from-red-500 to-red-600';
      default:
        return 'from-violet-500 to-cyan-500';
    }
  };

  if (status === 'idle' || status === 'uploading') return null;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-3">
        {status === 'converting' || status === 'validating' ? (
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        ) : status === 'completed' ? (
          <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : status === 'error' ? (
          <AlertCircle className="w-5 h-5 text-red-400" />
        ) : null}

        <span
          className={`text-sm font-medium ${
            status === 'completed'
              ? 'text-emerald-400'
              : status === 'error'
              ? 'text-red-400'
              : 'text-gray-300'
          }`}
        >
          {getStatusText()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`
            h-full rounded-full bg-gradient-to-r ${getStatusColor()}
            transition-all duration-500 ease-out relative
            ${status === 'converting' ? 'progress-shimmer' : ''}
          `}
          style={{ width: `${status === 'error' ? 100 : progress}%` }}
        />
      </div>

      {/* Error details */}
      {status === 'error' && error && (
        <p className="mt-2 text-xs text-red-400/80">{error}</p>
      )}
    </div>
  );
}
