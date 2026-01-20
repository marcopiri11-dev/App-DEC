import React from 'react';
import { Grade } from '../types';
import { Circle, Square, Triangle } from 'lucide-react';

interface TrafficLightInputProps {
  label: string;
  value: Grade;
  onChange: (value: Grade) => void;
}

export const TrafficLightInput: React.FC<TrafficLightInputProps> = ({ label, value, onChange }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors px-4 rounded-lg">
      <span className="text-gray-700 font-medium mb-2 sm:mb-0 text-sm sm:text-base">{label}</span>
      
      <div className="flex gap-3 sm:gap-4">
        {/* Green - Good (Circle) - Automatismo */}
        <button
          onClick={() => onChange(Grade.GOOD)}
          className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm
            ${value === Grade.GOOD 
              ? 'bg-green-500 text-white ring-4 ring-green-200 scale-110' 
              : 'bg-gray-200 text-gray-400 hover:bg-green-100 hover:text-green-600'}
          `}
          title="Automatismo"
          aria-label="Automatismo"
        >
          <Circle size={20} fill={value === Grade.GOOD ? "currentColor" : "none"} strokeWidth={3} />
        </button>

        {/* Yellow - Warning (Square) - Competenza Cosciente */}
        <button
          onClick={() => onChange(Grade.WARNING)}
          className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm
            ${value === Grade.WARNING 
              ? 'bg-amber-400 text-white ring-4 ring-amber-200 scale-110' 
              : 'bg-gray-200 text-gray-400 hover:bg-amber-100 hover:text-amber-500'}
          `}
          title="Competenza Cosciente"
          aria-label="Competenza Cosciente"
        >
          <Square size={20} fill={value === Grade.WARNING ? "currentColor" : "none"} strokeWidth={3} />
        </button>

        {/* Red - Critical (Triangle) - Incompetenza Incosciente */}
        <button
          onClick={() => onChange(Grade.CRITICAL)}
          className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm
            ${value === Grade.CRITICAL 
              ? 'bg-red-500 text-white ring-4 ring-red-200 scale-110' 
              : 'bg-gray-200 text-gray-400 hover:bg-red-100 hover:text-red-600'}
          `}
          title="Incompetenza Incosciente"
          aria-label="Incompetenza Incosciente"
        >
          <Triangle size={20} fill={value === Grade.CRITICAL ? "currentColor" : "none"} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};