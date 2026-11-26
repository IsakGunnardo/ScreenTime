export type ChoreStatus = 'Available' | 'InProgress' | 'Submitted' | 'Returned' | 'Approved' | 'Rejected';

export interface AiVerdict {
  complete: boolean;
  confidence: number;
  feedbackChild: string;
  feedbackParent: string;
}

export type Role = 'parent' | 'child';

export interface Me {
  role: Role;
  id: string;
  name: string;
  family: { id: string; name: string; joinCode?: string };
}

export interface AuthResponse {
  token: string;
  me: Me;
}

export interface FamilyKid {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface Chore {
  id: string;
  childId: string;
  title: string;
  emoji: string;
  hint?: string;
  status: ChoreStatus;
  minutes: number;
  xp: number;
  coins: number;
  requiresPhoto: boolean;
  aiCheck: boolean;
  photoUrl?: string;
  ai?: AiVerdict;
  parentComment?: string;
  submittedAt?: string;
}

export interface ChildSummary {
  id: string;
  name: string;
  avatar: string;
  color: string;
  minutes: number;
  coins: number;
  xp: number;
  level: number;
  levelXp: number;
  levelXpMax: number;
  streak: number;
}

export interface TodayResponse {
  child: ChildSummary;
  chores: Chore[];
}

export interface QueueItem {
  childName: string;
  childAvatar: string;
  chore: Chore;
}
