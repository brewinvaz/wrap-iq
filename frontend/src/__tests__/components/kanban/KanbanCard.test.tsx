import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import KanbanCard from '@/components/kanban/KanbanCard';
import { ProjectCard } from '@/lib/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeCard(overrides: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: 'WO-0001',
    name: 'WO-0001',
    vehicle: '2024 Ford Transit',
    client: 'Acme Logistics',
    value: 2450,
    date: '2026-03-12',
    priority: 'medium' as const,
    tags: [],
    team: [],
    ...overrides,
  };
}

describe('KanbanCard title fallback', () => {
  const noop = vi.fn();

  it('shows client name as title when client is set', () => {
    render(<KanbanCard card={makeCard()} onDragStart={noop} />);
    expect(screen.getByRole('heading').textContent).toBe('Acme Logistics');
  });

  it('shows vehicle as title when no client', () => {
    render(<KanbanCard card={makeCard({ client: '' })} onDragStart={noop} />);
    expect(screen.getByRole('heading').textContent).toBe('2024 Ford Transit');
  });

  it('shows WO number as title when no client and no vehicle', () => {
    render(<KanbanCard card={makeCard({ client: '', vehicle: '' })} onDragStart={noop} />);
    expect(screen.getByRole('heading').textContent).toBe('WO-0001');
  });
});

describe('KanbanCard empty field hiding', () => {
  const noop = vi.fn();

  it('hides vehicle line when vehicle is empty', () => {
    const { container } = render(
      <KanbanCard card={makeCard({ vehicle: '' })} onDragStart={noop} />
    );
    expect(container.querySelector('[data-testid="vehicle-line"]')).toBeNull();
  });

  it('hides value when $0', () => {
    const { container } = render(
      <KanbanCard card={makeCard({ value: 0 })} onDragStart={noop} />
    );
    expect(container.querySelector('[data-testid="card-value"]')).toBeNull();
  });

  it('shows vehicle line when vehicle exists', () => {
    const { container } = render(
      <KanbanCard card={makeCard()} onDragStart={noop} />
    );
    expect(container.querySelector('[data-testid="vehicle-line"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="vehicle-line"]')?.textContent).toContain('2024 Ford Transit');
  });
});

describe('KanbanCard priority badge', () => {
  const noop = vi.fn();

  it('shows priority label text', () => {
    render(<KanbanCard card={makeCard({ priority: 'high' })} onDragStart={noop} />);
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('shows medium priority label', () => {
    render(<KanbanCard card={makeCard({ priority: 'medium' })} onDragStart={noop} />);
    expect(screen.getByText('Medium')).toBeTruthy();
  });
});
