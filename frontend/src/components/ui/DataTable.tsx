import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  emptyState?: React.ReactNode;
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  stickyHeader = false,
  emptyState,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-card)]">
      <table className="w-full text-sm">
        <thead>
          <tr
            className={`border-b border-[var(--border)] bg-[var(--surface-raised)] ${
              stickyHeader ? 'sticky top-0 z-10' : ''
            }`}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && emptyState ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                {emptyState}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-b border-[var(--border-subtle)] last:border-0 transition-colors hover:bg-[var(--surface-raised)] ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
