'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface DatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string): string {
  const date = parseDate(iso);
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DatePicker({
  value,
  onChange,
  id,
  placeholder = 'Select date',
  min,
  max,
  disabled = false,
  className = '',
  size = 'md',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const parsed = parseDate(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 320 && rect.top > spaceBelow;

    setPanelStyle({
      position: 'fixed',
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)),
      width: 288,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  function open() {
    if (disabled) return;
    // Sync view to current value (or today) when opening
    const target = parseDate(value) ?? new Date();
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    updatePosition();
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function selectDay(day: number) {
    const date = new Date(viewYear, viewMonth, day);
    onChange(formatDate(date));
    close();
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goToToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onChange(formatDate(t));
    close();
  }

  function clearValue() {
    onChange('');
    close();
  }

  function isDayDisabled(day: number): boolean {
    const date = new Date(viewYear, viewMonth, day);
    const minD = parseDate(min ?? '');
    const maxD = parseDate(max ?? '');
    if (minD && date < minD) return true;
    if (maxD && date > maxD) return true;
    return false;
  }

  function isToday(day: number): boolean {
    return (
      viewYear === today.getFullYear() &&
      viewMonth === today.getMonth() &&
      day === today.getDate()
    );
  }

  function isSelected(day: number): boolean {
    if (!parsed) return false;
    return (
      viewYear === parsed.getFullYear() &&
      viewMonth === parsed.getMonth() &&
      day === parsed.getDate()
    );
  }

  // Handle keyboard in panel
  function handlePanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  // Build calendar grid
  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = startDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = daysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
  );

  const cells: { day: number; current: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, current: false });
  }
  // Current month
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, current: true });
  }
  // Next month leading days
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false });
  }

  const sizeClasses =
    size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-sm';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] ${sizeClasses} transition-colors outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${className}`}
      >
        <span
          className={
            value
              ? 'truncate text-[var(--text-primary)]'
              : 'truncate text-[var(--text-muted)]'
          }
        >
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Calendar className="ml-2 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
      </button>

      {isOpen &&
        isClient &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose date"
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
            style={panelStyle}
            className="z-50 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] p-3 shadow-xl outline-none animate-select-in"
          >
            {/* Month/Year header */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-md p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="mb-1 grid grid-cols-7 gap-0">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0">
              {cells.map((cell, i) => {
                if (!cell.current) {
                  return (
                    <div
                      key={`pad-${i}`}
                      className="flex h-8 items-center justify-center text-xs text-[var(--text-muted)]/40"
                    >
                      {cell.day}
                    </div>
                  );
                }

                const selected = isSelected(cell.day);
                const todayMark = isToday(cell.day);
                const dayDisabled = isDayDisabled(cell.day);

                return (
                  <button
                    key={`day-${cell.day}`}
                    type="button"
                    disabled={dayDisabled}
                    onClick={() => selectDay(cell.day)}
                    className={`flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      dayDisabled
                        ? 'cursor-not-allowed text-[var(--text-muted)]/40'
                        : selected
                          ? 'bg-[var(--accent-primary)] text-white shadow-sm shadow-[var(--accent-primary)]/25'
                          : todayMark
                            ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/25'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
              <button
                type="button"
                onClick={clearValue}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
