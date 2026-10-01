import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import pb from "./pocketbase";
import type { UserRecord } from "./types";

interface AuthState {
  user: UserRecord | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserRecord>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(
    (pb.authStore.record as unknown as UserRecord) ?? null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setUser((pb.authStore.record as unknown as UserRecord) ?? null);
    });
    (async () => {
      try {
        if (pb.authStore.isValid) {
          await pb.collection("users").authRefresh();
        }
      } catch {
        pb.authStore.clear();
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await pb.collection("users").authWithPassword(email, password);
    return res.record as unknown as UserRecord;
  };

  const logout = () => {
    pb.authStore.clear();
  };

  const refresh = async () => {
    if (pb.authStore.isValid) {
      await pb.collection("users").authRefresh();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
