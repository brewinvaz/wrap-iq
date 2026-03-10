'use client';

import { useState, useCallback } from 'react';
import { KanbanColumn as KanbanColumnType } from '@/lib/types';
import { kanbanColumns as mockColumns } from '@/lib/mock-data';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardProps {
  /** If provided, uses these columns instead of mock data. */
  columns?: KanbanColumnType[];
  /** Called after a card is moved to a new column (drag-drop or advance). */
  onStatusChange?: (cardId: string, targetColumnId: string) => void;
}

export default function KanbanBoard({ columns: externalColumns, onStatusChange }: KanbanBoardProps = {}) {
  const isControlled = externalColumns !== undefined;

  const [internalColumns, setInternalColumns] = useState<KanbanColumnType[]>(mockColumns);

  const columns = isControlled ? externalColumns : internalColumns;

  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [dragSourceColumnId, setDragSourceColumnId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, cardId: string, sourceColumnId: string) => {
      e.dataTransfer.setData('text/plain', cardId);
      e.dataTransfer.effectAllowed = 'move';
      setDragSourceColumnId(sourceColumnId);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      if (columnId !== dragSourceColumnId) {
        setDragOverColumnId(columnId);
      }
    },
    [dragSourceColumnId]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumnId(null);
    }
  }, []);

  const moveCard = useCallback(
    (cardId: string, targetColumnId: string) => {
      // Notify parent for API persistence
      onStatusChange?.(cardId, targetColumnId);

      if (!isControlled) {
        // Only mutate local state when in uncontrolled (mock) mode
        setInternalColumns((prev) => {
          let movedCard = null;
          let sourceFound = false;

          for (const col of prev) {
            const card = col.cards.find((c) => c.id === cardId);
            if (card) {
              movedCard = card;
              sourceFound = true;
              break;
            }
          }

          if (!movedCard || !sourceFound) return prev;

          return prev.map((col) => {
            if (col.cards.some((c) => c.id === cardId)) {
              return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
            }
            if (col.id === targetColumnId) {
              return { ...col, cards: [...col.cards, movedCard!] };
            }
            return col;
          });
        });
      }
    },
    [onStatusChange, isControlled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnId: string) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData('text/plain');
      if (cardId) {
        moveCard(cardId, targetColumnId);
      }
      setDragOverColumnId(null);
      setDragSourceColumnId(null);
    },
    [moveCard]
  );

  const handleAdvanceCard = useCallback(
    (cardId: string) => {
      const currentColumnIndex = columns.findIndex((col) =>
        col.cards.some((c) => c.id === cardId)
      );
      if (currentColumnIndex >= 0 && currentColumnIndex < columns.length - 1) {
        const nextColumnId = columns[currentColumnIndex + 1].id;
        moveCard(cardId, nextColumnId);
      }
    },
    [columns, moveCard]
  );

  return (
    <div className="flex gap-5 overflow-x-auto pb-4">
      {columns.map((column, index) => (
        <KanbanColumn
          key={column.id}
          column={column}
          isLastColumn={index === columns.length - 1}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          dragOverColumnId={dragOverColumnId}
          onAdvanceCard={handleAdvanceCard}
        />
      ))}
    </div>
  );
}
