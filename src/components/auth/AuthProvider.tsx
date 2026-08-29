"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  adminChecking: boolean;
  isAdmin: boolean;
  enabled: boolean;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [adminChecking, setAdminChecking] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const resolveAdmin = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setIsAdmin(false);
      setAdminChecking(false);
      return;
    }
    setAdminChecking(true);
    try {
      const token = await nextUser.getIdToken();
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      const payload = (await response.json().catch(() => null)) as
        | { isAdmin?: boolean }
        | null;
      setIsAdmin(Boolean(response.ok && payload?.isAdmin));
    } catch {
      setIsAdmin(false);
    } finally {
      setAdminChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseEnabled || !firebaseAuth) {
      setLoading(false);
      setAdminChecking(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      void resolveAdmin(nextUser);
    });

    return unsubscribe;
  }, [resolveAdmin]);

  const signOutUser = useCallback(async () => {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setIsAdmin(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      adminChecking,
      isAdmin,
      enabled: firebaseEnabled,
      signOutUser,
    }),
    [user, loading, adminChecking, isAdmin, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
