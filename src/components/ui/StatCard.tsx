import React from 'react';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  change?: {
    value: string | number;
    isPositive?: boolean;
    isNegative?: boolean;
    label?: string;
  };
  trend?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  className?: string;
  badge?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  change,
  className = '',
  badge,
}: StatCardProps) {
  return (
    <div
      className={`bg-[#111C35] border border-[#1E2D4A] hover:border-[#00F0FF]/40 transition-colors duration-200 rounded-xl p-5 shadow-lg relative group ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-medium text-[#94A3B8] tracking-wider uppercase">
            {title}
          </span>
          <div className="text-2xl font-bold text-[#F5F7FA] tracking-tight">{value}</div>
        </div>

        {icon && (
          <div className="p-2.5 rounded-lg bg-[#0A1128] border border-[#1E2D4A] text-[#00F0FF] group-hover:border-[#00F0FF]/50 transition-colors">
            {icon}
          </div>
        )}
      </div>

      {(subtitle || change || badge) && (
        <div className="mt-3.5 pt-3 border-t border-[#1E2D4A]/50 flex items-center justify-between text-xs">
          {change && (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                  change.isPositive
                    ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                    : change.isNegative
                    ? 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                    : 'bg-[#1E2D4A] text-[#94A3B8]'
                }`}
              >
                {change.value}
              </span>
              {change.label && <span className="text-[#94A3B8]">{change.label}</span>}
            </div>
          )}

          {subtitle && !change && (
            <span className="text-[#94A3B8] truncate">{subtitle}</span>
          )}

          {badge && <div>{badge}</div>}
        </div>
      )}
    </div>
  );
}
