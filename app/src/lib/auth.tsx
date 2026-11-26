import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from './api';
import { storage } from './storage';
import type { AuthResponse, Me } from './types';

const TOKEN_KEY = 'screentime.token';
const ME_KEY = 'screentime.me';
export const FAMILY_CODE_KEY = 'screentime.familyCode';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; me: Me };

interface AuthContextValue {
  state: AuthState;
  signIn: (res: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const queryClient = useQueryClient();

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(ME_KEY)]);
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [queryClient]);

  const signIn = useCallback(async (res: AuthResponse) => {
    setAuthToken(res.token);
    await Promise.all([storage.set(TOKEN_KEY, res.token), storage.set(ME_KEY, JSON.stringify(res.me))]);
    queryClient.clear();
    setState({ status: 'signedIn', me: res.me });
  }, [queryClient]);

  // Återställ sessionen vid appstart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, meJson] = await Promise.all([storage.get(TOKEN_KEY), storage.get(ME_KEY)]);
      if (!token || !meJson) {
        if (!cancelled) setState({ status: 'signedOut' });
        return;
      }
      setAuthToken(token);
      let me: Me;
      try {
        me = JSON.parse(meJson) as Me;
      } catch {
        if (!cancelled) await signOut();
        return;
      }
      if (!cancelled) setState({ status: 'signedIn', me });

      // Uppdatera i bakgrunden. Är servern nere behåller vi den sparade sessionen.
      try {
        const fresh = await api.me();
        await storage.set(ME_KEY, JSON.stringify(fresh));
        if (!cancelled) setState({ status: 'signedIn', me: fresh });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && !cancelled) await signOut();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth måste användas inuti <AuthProvider>');
  return ctx;
}

/** Inloggad användare. Får bara användas i skärmar som ligger bakom en rollvakt. */
export function useMe(): Me {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('Inte inloggad');
  return state.me;
}
