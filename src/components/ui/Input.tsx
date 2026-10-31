import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixText?: string;
  suffixText?: string;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      prefixText,
      suffixText,
      prefixIcon,
      suffixIcon,
      className = '',
      id,
      ...props
    },
    ref,
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[#94A3B8] tracking-wide"
          >
            {label}
            {props.required && <span className="text-[#EF4444] ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {(prefixIcon || prefixText) && (
            <div className="absolute left-3 flex items-center pointer-events-none text-[#94A3B8] text-sm">
              {prefixIcon}
              {prefixText && <span className="font-medium text-xs">{prefixText}</span>}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-[#0A1128] border ${
              error ? 'border-[#EF4444] focus:ring-[#EF4444]/30' : 'border-[#1E2D4A] focus:border-[#00F0FF] focus:ring-[#00F0FF]/20'
            } rounded-lg text-sm text-[#F5F7FA] placeholder-[#475569] transition-all px-3 py-2 outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              prefixIcon || prefixText ? 'pl-8' : ''
            } ${suffixIcon || suffixText ? 'pr-9' : ''} ${className}`}
            {...props}
          />

          {(suffixIcon || suffixText) && (
            <div className="absolute right-3 flex items-center pointer-events-none text-[#94A3B8] text-xs">
              {suffixText && <span className="font-medium">{suffixText}</span>}
              {suffixIcon}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[#EF4444] flex items-center gap-1 mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-[11px] text-[#64748B] mt-1">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
