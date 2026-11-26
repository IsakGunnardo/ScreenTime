import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ChildSummary, Chore, QueueItem, TodayResponse } from './types';

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

export const photoSrc = (photoUrl?: string) => (photoUrl ? `${API_URL}${photoUrl}` : undefined);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    let message = `Något gick fel (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body === 'string') message = body;
      else if (body?.error) message = body.error;
    } catch {
      /* ingen JSON-body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

export const api = {
  config: () => request<{ aiEnabled: boolean }>('/api/config'),
  children: () => request<ChildSummary[]>('/api/children'),
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
