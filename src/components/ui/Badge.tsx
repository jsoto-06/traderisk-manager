import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'cyan',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  const variantStyles = {
    cyan: 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30',
    green: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
    red: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
    yellow: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
    blue: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30',
    purple: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30',
    gray: 'bg-[#1E2D4A] text-[#94A3B8] border-[#2D4370]',
  };

  const dotColors = {
    cyan: 'bg-[#00F0FF]',
    green: 'bg-[#10B981]',
    red: 'bg-[#EF4444]',
    yellow: 'bg-[#F59E0B]',
    blue: 'bg-[#3B82F6]',
    purple: 'bg-[#8B5CF6]',
    gray: 'bg-[#94A3B8]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotColors[variant]}`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
