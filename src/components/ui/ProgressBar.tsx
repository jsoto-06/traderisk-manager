import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  sublabel?: string;
  variant?: 'cyan' | 'green' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  sublabel,
  variant = 'cyan',
  size = 'md',
  showPercentage = true,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const variantGradients = {
    cyan: 'bg-gradient-to-r from-[#00F0FF]/80 to-[#00F0FF]',
    green: 'bg-gradient-to-r from-[#10B981]/80 to-[#10B981]',
    red: 'bg-gradient-to-r from-[#EF4444]/80 to-[#EF4444]',
    yellow: 'bg-gradient-to-r from-[#F59E0B]/80 to-[#F59E0B]',
  };

  const sizeHeights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs">
          {label && <span className="font-medium text-[#94A3B8]">{label}</span>}
          <div className="flex items-center gap-2">
            {sublabel && <span className="text-[#64748B] text-[11px]">{sublabel}</span>}
            {showPercentage && (
              <span className="font-semibold text-[#F5F7FA]">
                {percentage.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={`w-full bg-[#0A1128] rounded-full overflow-hidden border border-[#1E2D4A] ${sizeHeights[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${variantGradients[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
