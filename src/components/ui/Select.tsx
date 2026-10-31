import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, helperText, options, children, className = '', id, ...props },
    ref,
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-[#94A3B8] tracking-wide"
          >
            {label}
            {props.required && <span className="text-[#EF4444] ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`w-full bg-[#0A1128] border ${
              error
                ? 'border-[#EF4444] focus:ring-[#EF4444]/30'
                : 'border-[#1E2D4A] focus:border-[#00F0FF] focus:ring-[#00F0FF]/20'
            } rounded-lg text-sm text-[#F5F7FA] appearance-none transition-all px-3 py-2 pr-9 outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-[#111C35] text-[#F5F7FA]">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#94A3B8]">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {error && <p className="text-xs text-[#EF4444] flex items-center gap-1 mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-[11px] text-[#64748B] mt-1">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
