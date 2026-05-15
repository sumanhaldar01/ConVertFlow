import { ArrowRight } from 'lucide-react';
import { ConversionOption } from '@/types';

interface ConversionCardProps {
  option: ConversionOption;
  isSelected: boolean;
  onClick: () => void;
}

export default function ConversionCard({ option, isSelected, onClick }: ConversionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-300
        ${isSelected
          ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10 scale-[1.02]'
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:bg-gray-900/80 hover:shadow-lg hover:shadow-gray-900/50'
        }
      `}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
      )}

      {/* Icon */}
      <div className={`text-3xl mb-3 transition-transform duration-300 ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}>
        {option.icon}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-100 mb-1.5">
        {option.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-3 leading-relaxed">
        {option.description}
      </p>

      {/* Format badges */}
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${option.bgColor} ${option.color}`}>
          {option.fromFormat}
        </span>
        <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-violet-400' : 'text-gray-600'}`} />
        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400">
          {option.toFormat}
        </span>
      </div>
    </button>
  );
}
