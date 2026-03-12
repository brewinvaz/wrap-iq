'use client';

import { useState, useRef, useEffect, useCallback, useId, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  id,
  className = '',
  error = false,
  disabled = false,
  size = 'md',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listboxId = useId();
  const typeAheadRef = useRef('');
  const typeAheadTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(typeAheadTimerRef.current);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption?.label ?? placeholder ?? '';
  const isPlaceholder = !selectedOption && placeholder;

  // Position the panel relative to the trigger
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
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
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      )
        return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  // Focus panel when opened, reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => panelRef.current?.focus());
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
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function selectOption(val: string) {
    onChange(val);
    close();
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open();
    }
  }

  function handlePanelKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) selectOption(options[activeIndex].value);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
      default:
        // Type-ahead: jump to first option starting with typed character
        if (e.key.length === 1) {
          clearTimeout(typeAheadTimerRef.current);
          typeAheadRef.current += e.key.toLowerCase();
          const match = options.findIndex((o) =>
            o.label.toLowerCase().startsWith(typeAheadRef.current),
          );
          if (match >= 0) setActiveIndex(match);
          typeAheadTimerRef.current = setTimeout(() => {
            typeAheadRef.current = '';
          }, 500);
        }
        break;
    }
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : 'px-3.5 py-2.5 text-sm';

  const borderClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
    : 'border-[var(--border)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]';

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
        className={`flex w-full items-center justify-between rounded-lg border bg-[var(--surface-raised)] ${sizeClasses} ${borderClasses} transition-colors outline-none ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${className}`}
      >
        <span
          className={
            isPlaceholder
              ? 'truncate text-[var(--text-muted)]'
              : 'truncate text-[var(--text-primary)]'
          }
        >
          {displayText}
        </span>
        <ChevronDown
          className={`ml-2 h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        isClient &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            id={listboxId}
            tabIndex={-1}
            aria-activedescendant={activeOptionId}
            onKeyDown={handlePanelKeyDown}
            style={panelStyle}
            className="z-50 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] shadow-lg outline-none animate-select-in"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <div
                  key={option.value}
                  ref={(el) => { optionRefs.current[index] = el; }}
                  role="option"
                  id={`${listboxId}-option-${index}`}
                  aria-selected={isSelected}
                  onClick={() => selectOption(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between ${
                    size === 'sm' ? 'px-3 py-1.5' : 'px-3.5 py-2'
                  } text-sm ${
                    isActive
                      ? 'bg-[var(--accent-primary)]/10'
                      : ''
                  } ${
                    isSelected
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="ml-2 h-4 w-4 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
