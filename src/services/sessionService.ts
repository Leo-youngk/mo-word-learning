import { backendPost } from '../lib/backend';
import type { StudyPhase, BookId } from '../types';

export interface SessionData {
  id?: string;
  date: string;
  bookId: BookId;
  sessionType: 'daily' | 'extra';
  batchIndex: number;
  status: 'active' | 'completed';
  phase: StudyPhase;
  currentIndex: number;
  reviewWordIds: string[];
  newWordIds: string[];
  completedWordIds: string[];
  wordResults: Record<string, 'mastered' | 'fuzzy'>;
  plannedNextWordIndex: number;
}

export async function getActiveSession(date: string): Promise<SessionData | null> {
  const data = await backendPost<{ session: SessionData | null }>('/api/data', {
    scope: 'session',
    action: 'getActive',
    payload: { date },
  });
  return data.session;
}

export async function getAllActiveSessions(date: string): Promise<SessionData[]> {
  const data = await backendPost<{ sessions: SessionData[] }>('/api/data', {
    scope: 'session',
    action: 'getAllActive',
    payload: { date },
  });
  return data.sessions;
}

export async function saveSession(session: SessionData): Promise<SessionData> {
  const data = await backendPost<{ session: SessionData }>('/api/data', {
    scope: 'session',
    action: 'save',
    payload: { session },
  });
  return data.session;
}

export async function completeSession(sessionId: string): Promise<void> {
  await backendPost<{ ok: boolean }>('/api/data', {
    scope: 'session',
    action: 'complete',
    payload: { sessionId },
  });
}

export async function createExtraSession(
  date: string,
  bookId: BookId,
  reviewWordIds: string[],
  newWordIds: string[],
  plannedNextWordIndex: number,
): Promise<SessionData> {
  const data = await backendPost<{ session: SessionData }>('/api/data', {
    scope: 'session',
    action: 'createExtra',
    payload: {
      date,
      bookId,
      reviewWordIds,
      newWordIds,
      plannedNextWordIndex,
    },
  });
  return data.session;
}
