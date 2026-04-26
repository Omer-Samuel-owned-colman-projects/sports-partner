import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  profileImageUrl: string | null;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, profileImageFile?: File | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchWithRefresh<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    return await api<T>(url, options);
  } catch (err) {
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
      // Try refreshing the access token
      const refreshRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshRes.ok) {
        return await api<T>(url, options);
      }
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWithRefresh<{ user: User }>('/api/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await api<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await api<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (name: string, profileImageFile?: File | null) => {
    const body = new FormData();
    body.append('name', name);
    if (profileImageFile) {
      body.append('profileImage', profileImageFile);
    }
    const { user } = await api<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body,
    });
    setUser(user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export type { User };
