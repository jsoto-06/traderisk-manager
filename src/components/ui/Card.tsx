import React from 'react';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({
  title,
  subtitle,
  action,
  footer,
  children,
  className = '',
  noPadding = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-[#111C35] border border-[#1E2D4A] rounded-xl shadow-lg relative overflow-hidden ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2D4A]/60">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-base font-semibold text-[#F5F7FA] tracking-wide">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-[#94A3B8] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div className={noPadding ? '' : 'p-5'}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-[#1E2D4A]/60 bg-[#0A1128]/40">
          {footer}
        </div>
      )}
    </div>
  );
}
