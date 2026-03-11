'use client';

import { KanbanColumn as KanbanColumnType } from '@/lib/types';
import KanbanCard from './KanbanCard';

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
}: KanbanColumnProps) {
  const isDragOver = dragOverColumnId === column.id;

  return (
    <div className="flex w-72 shrink-0 flex-col">
      {/* Column header */}
      <div className="mb-3 rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,.06)]">
        {/* Color stripe */}
        <div className="h-0.5 rounded-t-xl" style={{ backgroundColor: column.color }} />
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#18181b]">{column.title}</h3>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11px] font-medium text-[#60606a]">
              {column.cards.length}
            </span>
          </div>
          <button className="rounded-md p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#60606a]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cards area */}
      <div
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, column.id)}
        onDragEnter={(e) => onDragEnter(e, column.id)}
        onDragLeave={onDragLeave}
        className={`flex flex-1 flex-col gap-2.5 rounded-xl border-2 border-dashed p-1.5 transition-colors duration-200 ${
          isDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-transparent'
        }`}
      >
        {column.cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onDragStart={(e, cardId) => onDragStart(e, cardId, column.id)}
            onAdvance={!isLastColumn ? onAdvanceCard : undefined}
            isPending={pendingCards?.has(card.id)}
          />
        ))}

        {/* Add project button */}
        <button className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#e6e6eb] py-3 text-xs font-medium text-[#a8a8b4] transition-colors hover:border-[#60606a] hover:text-[#60606a]">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add project
        </button>
      </div>
    </div>
  );
}
