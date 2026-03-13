'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api-client';

interface WorkOrderOption {
  id: string;
  job_number: string;
  client_name: string | null;
  vehicles: { year: number | null; make: string | null; model: string | null }[];
  job_type: string;
  priority: string;
  status: { name: string; color: string } | null;
}

interface WorkOrderSearchProps {
  selectedId: string;
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
  onClear: () => void;
  isLocked: boolean;
}

function formatVehicle(v: { year: number | null; make: string | null; model: string | null }): string {
  return [v.year, v.make, v.model].filter(Boolean).join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WorkOrderSearch({
  selectedId,
  selectedLabel,
  onSelect,
  onClear,
  isLocked,
}: WorkOrderSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WorkOrderOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchWorkOrders = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await api.get<{ items: WorkOrderOption[] }>(
        `/api/work-orders?search=${encodeURIComponent(query)}&limit=10`
      );
      setSearchResults(data.items);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchWorkOrders(value), 300);
  }

  function handleSelectWorkOrder(wo: WorkOrderOption) {
    const label = wo.client_name
      ? `${wo.job_number} — ${wo.client_name}`
      : wo.job_number;
    onSelect(wo.id, label);
    setSearchQuery('');
    setShowDropdown(false);
    setSearchResults([]);
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showDropdown]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Reset search state when parent resets (modal re-open)
  useEffect(() => {
    if (!selectedId) {
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [selectedId]);

  if (isLocked) {
    return (
      <div className="flex w-full items-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]">
        <span className="font-mono">{selectedLabel}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {selectedId ? (
        <div className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm">
          <span className="text-[var(--text-primary)]">{selectedLabel}</span>
          <button
            type="button"
            onClick={onClear}
            className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          id="log-work-order"
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by job number, client, or vehicle..."
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
      )}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] shadow-lg">
          {searchResults.map((wo) => {
            const vehicleStr = wo.vehicles?.length
              ? formatVehicle(wo.vehicles[0])
              : null;
            const meta = [vehicleStr, capitalize(wo.job_type), capitalize(wo.priority)]
              .filter(Boolean)
              .join(' \u00b7 ');

            return (
              <button
                key={wo.id}
                type="button"
                onClick={() => handleSelectWorkOrder(wo)}
                className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-[var(--accent-primary)]/10"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-mono font-semibold text-[var(--accent-primary)]">
                      {wo.job_number}
                    </span>
                    {wo.client_name && (
                      <>
                        <span className="text-[var(--text-muted)]">&middot;</span>
                        <span className="text-[var(--text-primary)]">{wo.client_name}</span>
                      </>
                    )}
                  </div>
                  {wo.status && (
                    <span
                      className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${wo.status.color}20`,
                        color: wo.status.color,
                      }}
                    >
                      {wo.status.name}
                    </span>
                  )}
                </div>
                {meta && (
                  <span className="mt-0.5 text-xs text-[var(--text-muted)]">{meta}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {showDropdown && searchResults.length === 0 && !searchLoading && searchQuery.trim() && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3.5 py-2 shadow-lg">
          <span className="text-sm text-[var(--text-muted)]">No work orders found</span>
        </div>
      )}
    </div>
  );
}
