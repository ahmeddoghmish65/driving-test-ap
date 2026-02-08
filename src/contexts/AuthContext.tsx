import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService, type AuthResponse } from '../services/auth';
import type { User } from '../db/database';

interface AuthContextType {
  user: Omit<User, 'password'> | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string) => Promise<AuthResponse>;
  logout: () => void;
  updateProfile: (data: { name?: string; password?: string }) => Promise<AuthResponse>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin' || user?.email === 'admin@patente.com';

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem('auth_token');
    if (savedToken) {
      authService.getCurrentUser(savedToken).then(res => {
        if (res.success && res.user) {
          setUser(res.user);
          setToken(savedToken);
        } else {
          window.sessionStorage.removeItem('auth_token');
          window.sessionStorage.removeItem('refresh_token');
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      window.sessionStorage.setItem('auth_token', res.token);
      if (res.refreshToken) window.sessionStorage.setItem('refresh_token', res.refreshToken);
    }
    return res;
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const res = await authService.register(email, password, name);
    if (res.success && res.user && res.token) {
      setUser(res.user);
      setToken(res.token);
      window.sessionStorage.setItem('auth_token', res.token);
      if (res.refreshToken) window.sessionStorage.setItem('refresh_token', res.refreshToken);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    window.sessionStorage.removeItem('auth_token');
    window.sessionStorage.removeItem('refresh_token');
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; password?: string }) => {
    if (!user) return { success: false, message: 'غير مسجل' };
    const res = await authService.updateProfile(user.id, data);
    if (res.success && res.user) setUser(res.user);
    return res;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
