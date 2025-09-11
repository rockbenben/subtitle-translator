"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name?: string } | null;

type AuthContextType = {
  user: User;
  token: string | null;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [token, setToken] = useState<string | null>(null);
  const [baseUrl, setBaseUrlState] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("serverUrl") || "http://localhost:4000" : "http://localhost:4000"));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("authToken");
    const u = localStorage.getItem("authUser");
    if (t) setToken(t);
    if (u) setUser(JSON.parse(u));
  }, []);

  const setBaseUrl = useCallback((url: string) => {
    setBaseUrlState(url);
    if (typeof window !== "undefined") localStorage.setItem("serverUrl", url);
  }, []);

  const saveAuth = (tk: string, u: any) => {
    setToken(tk);
    setUser(u);
    if (typeof window !== "undefined") {
      localStorage.setItem("authToken", tk);
      localStorage.setItem("authUser", JSON.stringify(u));
    }
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const resp = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) throw new Error("Login failed");
    const data = await resp.json();
    saveAuth(data.token, data.user);
  }, [baseUrl]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const resp = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!resp.ok) throw new Error("Register failed");
    const data = await resp.json();
    saveAuth(data.token, data.user);
  }, [baseUrl]);

  const logout = useCallback(() => clearAuth(), []);

  const value = useMemo(() => ({ user, token, baseUrl, setBaseUrl, login, register, logout }), [user, token, baseUrl, setBaseUrl, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

