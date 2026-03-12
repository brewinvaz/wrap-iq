'use client';

import { useState, useRef, useEffect } from 'react';
import { KanbanColumn as KanbanColumnType } from '@/lib/types';
import KanbanCard from './KanbanCard';
import { Button } from '@/components/ui/Button';

type SortMode = 'default' | 'priority';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface KanbanColumnProps {
  column: KanbanColumnType;
  isLastColumn: boolean;
  onDragStart: (e: React.DragEvent, cardId: string, sourceColumnId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetColumnId: string) => void;
  onDragEnter: (e: React.DragEvent, columnId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  dragOverColumnId: string | null;
  onAdvanceCard?: (cardId: string) => void;
  pendingCards?: Set<string>;
  onAddProject?: () => void;
}

export default function KanbanColumn({
  column,
  isLastColumn,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnter,
  onDragLeave,
  dragOverColumnId,
  onAdvanceCard,
  pendingCards,
  onAddProject,
}: KanbanColumnProps) {
  const isDragOver = dragOverColumnId === column.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuOpen &&
        menuRef.current &&
        menuBtnRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const sortedCards = sortMode === 'priority'
    ? [...column.cards].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    : column.cards;

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-3 rounded-xl bg-[var(--surface-card)] shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        {/* Color stripe */}
        <div className="h-0.5 rounded-t-xl" style={{ backgroundColor: column.color }} />
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{column.title}</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface-raised)] px-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
              {column.cards.length}
            </span>
          </div>
          <div className="relative">
            <Button
              ref={menuBtnRef}
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </Button>
            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] py-1 shadow-lg"
              >
                <button
                  onClick={() => { setCollapsed((c) => !c); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                >
                  <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {collapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    )}
                  </svg>
                  {collapsed ? 'Expand' : 'Collapse'}
                </button>
                <button
                  onClick={() => {
                    setSortMode((s) => s === 'priority' ? 'default' : 'priority');
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                >
                  <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-4.5L16.5 16.5m0 0L12 12m4.5 4.5V7.5" />
                  </svg>
                  {sortMode === 'priority' ? 'Default order' : 'Sort by priority'}
                </button>
                {onAddProject && (
                  <button
                    onClick={() => { onAddProject(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                  >
                    <svg className="h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add work order
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards area */}
      {!collapsed && (
        <div
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, column.id)}
          onDragEnter={(e) => onDragEnter(e, column.id)}
          onDragLeave={onDragLeave}
          className={`flex flex-1 flex-col gap-2.5 rounded-xl border-2 border-dashed p-1.5 transition-colors duration-200 ${
            isDragOver ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5' : 'border-transparent'
          }`}
        >
          {sortedCards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDragStart={(e, cardId) => onDragStart(e, cardId, column.id)}
              onAdvance={!isLastColumn ? onAdvanceCard : undefined}
              isPending={pendingCards?.has(card.id)}
            />
          ))}

          {/* Add project button */}
          {onAddProject && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddProject}
              className="flex w-full items-center justify-center gap-1.5 border-2 border-dashed border-[var(--border)] py-3 hover:border-[var(--accent-primary)]/40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add project
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
