import React from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AlertProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  className = '',
}: AlertProps) {
  const variantStyles = {
    info: {
      container: 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]',
      icon: <Info className="w-5 h-5 flex-shrink-0 text-[#00F0FF]" />,
    },
    warning: {
      container: 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]',
      icon: <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[#F59E0B]" />,
    },
    error: {
      container: 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]',
      icon: <AlertCircle className="w-5 h-5 flex-shrink-0 text-[#EF4444]" />,
    },
    success: {
      container: 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]',
      icon: <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#10B981]" />,
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm ${style.container} ${className}`}
      role="alert"
    >
      {style.icon}

      <div className="flex-1 text-sm text-[#F5F7FA]">
        {title && <h5 className="font-semibold text-sm mb-0.5">{title}</h5>}
        <div className="text-xs text-[#94A3B8] leading-relaxed">{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-[#94A3B8] hover:text-[#F5F7FA] p-1 rounded-lg transition-colors"
          aria-label="Cerrar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
