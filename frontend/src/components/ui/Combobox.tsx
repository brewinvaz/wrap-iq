'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import type { SelectOption } from './Select';

export type { SelectOption };

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => Promise<SelectOption[]>;
  placeholder?: string;
  id?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  debounceMs?: number;
  selectedLabel?: string;
}

export default function Combobox({
  value,
  onChange,
  onSearch,
  placeholder,
  id,
  className = '',
  error = false,
  disabled = false,
  size = 'md',
  debounceMs = 300,
  selectedLabel,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Derive display label from options or selectedLabel prop
  const displayLabel =
    options.find((o) => o.value === value)?.label ??
    selectedLabel ??
    '';

  const doSearch = useCallback(
    (searchQuery: string) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setErrorMsg('');
      onSearch(searchQuery)
        .then((results) => {
          if (requestId !== requestIdRef.current) return;
          setOptions(results);
          setActiveIndex(results.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setErrorMsg('Failed to load');
          setOptions([]);
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setIsLoading(false);
        });
    },
    [onSearch],
  );

  // Panel positioning (same as Select)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 240 && rect.top > spaceBelow;
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
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
        inputRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
      // Reset query to show selected label
      setQuery('');
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

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, activeIndex]);

  function open() {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setQuery('');
    doSearch('');
  }

  function close() {
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  }

  function selectOption(opt: SelectOption) {
    onChange(opt.value);
    close();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), debounceMs);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          open();
        } else if (options.length > 0) {
          setActiveIndex((i) => (i + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (options.length > 0) {
          setActiveIndex((i) => (i - 1 + options.length) % options.length);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && activeIndex >= 0 && options[activeIndex]) {
          selectOption(options[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  }

  const sizeClasses =
    size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-sm';

  const borderClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
    : 'border-[var(--border)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]';

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const inputValue = isOpen ? query : (value ? displayLabel : '');

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          id={id}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          aria-autocomplete="list"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={() => { if (!isOpen) open(); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className={`w-full rounded-lg border bg-[var(--surface-raised)] ${sizeClasses} ${borderClasses} pr-10 transition-colors outline-none ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          } ${!isOpen && !value && placeholder ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'} ${className}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          )}
        </div>
      </div>

      {isOpen &&
        isClient &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            id={listboxId}
            tabIndex={-1}
            style={panelStyle}
            className="z-50 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] shadow-lg outline-none animate-select-in"
          >
            {isLoading && options.length === 0 && (
              <div className="px-3.5 py-2 text-sm text-[var(--text-muted)]">
                Searching...
              </div>
            )}
            {errorMsg && (
              <div className="px-3.5 py-2 text-sm text-red-400">
                {errorMsg}
              </div>
            )}
            {!isLoading && !errorMsg && options.length === 0 && (
              <div className="px-3.5 py-2 text-sm text-[var(--text-muted)]">
                No results found
              </div>
            )}
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={option.value}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  role="option"
                  id={`${listboxId}-option-${index}`}
                  aria-selected={isSelected}
                  onClick={() => selectOption(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between ${
                    size === 'sm' ? 'px-3 py-1.5' : 'px-3.5 py-2'
                  } text-sm ${
                    isActive ? 'bg-[var(--accent-primary)]/10' : ''
                  } ${
                    isSelected
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check className="ml-2 h-4 w-4 shrink-0" />}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
