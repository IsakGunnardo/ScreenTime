import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  AuthResponse, ChildSummary, Chore, FamilyKid, Me, QueueItem, TodayResponse,
} from './types';

/**
 * Backend-adress. Sätt EXPO_PUBLIC_API_URL för att styra den manuellt.
 * Annars används samma IP som Expo-servern (din Mac) på port 5080 — funkar direkt i Expo Go på telefonen.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:5080`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:5080' : 'http://localhost:5080';
}

export const API_URL = resolveBaseUrl();

/** Foto-URL:er är signerade av servern och behöver ingen inloggningsheader. */
export const photoSrc = (photoUrl?: string) => (photoUrl ? `${API_URL}${photoUrl}` : undefined);

// ---------- Token ----------

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(t: string | null) {
  token = t;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Får ingen kontakt med servern (${API_URL})`, 0);
  }

  if (res.status === 401 && token) {
    // Utgången eller ogiltig session — logga ut.
    onUnauthorized?.();
  }
  if (!res.ok) {
    let message = res.status === 429 ? 'För många försök. Vänta en minut.' : `Något gick fel (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body === 'string') message = body;
      else if (body?.error) message = body.error;
    } catch {
      /* ingen JSON-body */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body);

export const api = {
  // Inloggning
  register: (b: { name: string; email: string; password: string; familyName?: string; joinCode?: string }) =>
    post<AuthResponse>('/api/auth/register', b),
  login: (email: string, password: string) => post<AuthResponse>('/api/auth/login', { email, password }),
  familyKids: (code: string) =>
    request<{ familyName: string; children: FamilyKid[] }>(`/api/auth/family/${encodeURIComponent(code)}/children`),
  childLogin: (familyCode: string, childId: string, pin: string) =>
    post<AuthResponse>('/api/auth/child-login', { familyCode, childId, pin }),
  me: () => request<Me>('/api/me'),

  // Förälder: familj
  children: () => request<ChildSummary[]>('/api/family/children'),
  addChild: (b: { name: string; avatar: string; color: string; pin: string }) =>
    post<ChildSummary>('/api/family/children', b),
  setPin: (childId: string, pin: string) => send<void>('PUT', `/api/family/children/${childId}/pin`, { pin }),

  // Uppdrag
  config: () => request<{ aiEnabled: boolean }>('/api/config'),
  today: (childId: string) => request<TodayResponse>(`/api/children/${childId}/today`),
  chore: (id: string) => request<Chore>(`/api/instances/${id}`),
  start: (id: string) => post<Chore>(`/api/instances/${id}/start`),
  submit: (id: string) => post<Chore>(`/api/instances/${id}/submit`),
  queue: () => request<QueueItem[]>('/api/parent/queue'),
  approve: (id: string) => post<Chore>(`/api/instances/${id}/approve`),
  sendBack: (id: string, comment?: string) => post<Chore>(`/api/instances/${id}/return`, { comment }),
  reject: (id: string, comment?: string) => post<Chore>(`/api/instances/${id}/reject`, { comment }),

  async uploadPhoto(id: string, uri: string): Promise<Chore> {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      form.append('photo', blob, 'photo.jpg');
    } else {
      // React Natives FormData tar emot { uri, name, type } för filer.
      form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    return request<Chore>(`/api/instances/${id}/photo`, { method: 'POST', body: form });
  },
};
