import { backendPost, backendRequest } from './backend';

export interface User {
  id: string;
  email?: string | null;
}

let currentUser: User | null = null;
const listeners = new Set<(user: User | null) => void>();

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getCurrentUserId(): string {
  if (!currentUser) throw new Error('未登录');
  return currentUser.id;
}

export async function signIn(email: string, password: string): Promise<User> {
  const data = await backendPost<{ user: User }>('/api/auth', {
    action: 'login',
    email,
    password,
  });
  currentUser = data.user;
  emit(currentUser);
  return data.user;
}

export async function signUp(email: string, password: string): Promise<User> {
  const data = await backendPost<{ user: User }>('/api/auth', {
    action: 'signup',
    email,
    password,
  });
  currentUser = data.user;
  emit(currentUser);
  return data.user;
}

export async function signOut(): Promise<void> {
  await backendPost<{ ok: boolean }>('/api/auth', { action: 'logout' });
  currentUser = null;
  emit(null);
}

export async function restoreSession(): Promise<User | null> {
  const data = await backendRequest<{ user: User | null }>('/api/auth');
  currentUser = data.user ?? null;
  emit(currentUser);
  return currentUser;
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit(user: User | null) {
  for (const listener of listeners) {
    listener(user);
  }
}
