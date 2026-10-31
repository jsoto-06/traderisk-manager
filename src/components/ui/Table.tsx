import React from 'react';

interface TableProps {
  headers: React.ReactNode[];
  children: React.ReactNode;
  emptyText?: string;
  isEmpty?: boolean;
  className?: string;
}

export function Table({
  headers,
  children,
  emptyText = 'No hay datos disponibles',
  isEmpty = false,
  className = '',
}: TableProps) {
  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-[#1E2D4A] ${className}`}>
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#1E2D4A] bg-[#0A1128]/70 text-[#94A3B8] text-xs uppercase tracking-wider">
            {headers.map((header, idx) => (
              <th key={idx} className="px-4 py-3 font-semibold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1E2D4A]/50 bg-[#111C35]">
          {isEmpty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-4 py-8 text-center text-sm text-[#94A3B8]"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableRow({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-150 ${
        onClick ? 'cursor-pointer hover:bg-[#1A2744]/70' : 'hover:bg-[#1A2744]/40'
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-sm text-[#F5F7FA] whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
}
