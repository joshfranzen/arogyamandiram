'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/apiClient';
import type { SafeUser } from '@/types';

interface UserContextValue {
  user: SafeUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUser();
      if (res.success && res.data) {
        setUser(res.data as SafeUser);
      } else {
        setError(res.error || 'Failed to fetch user');
      }
    } catch {
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  return (
    <UserContext.Provider value={{ user, loading, error, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUserContext must be used inside UserProvider');
  return ctx;
}
