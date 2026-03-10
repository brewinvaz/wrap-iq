export type Priority = 'high' | 'medium' | 'low';

export type JobTag =
  | 'full-wrap'
  | 'partial'
  | 'commercial'
  | 'fleet'
  | 'rush'
  | 'design'
  | 'print'
  | 'install';

export interface TeamMember {
  initials: string;
  color: string;
}

export interface ProjectCard {
  id: string;
  name: string;
  vehicle: string;
  client: string;
  value: number;
  date: string;
  priority: Priority;
  tags: JobTag[];
  team: TeamMember[];
  progress?: number;
  tasks?: { label: string; done: boolean }[];
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  cards: ProjectCard[];
}
