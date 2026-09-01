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
import {
  readLastBrandSession,
  writeLastBrandSession,
} from "@/lib/session/lastBrandSession";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  adminChecking: boolean;
  isAdmin: boolean;
  brandName: string | null;
  enabled: boolean;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function brandNameFromUser(
  user: User,
  claims?: Record<string, unknown>,
): string | null {
  const claimed = claims?.brandName;
  if (typeof claimed === "string" && claimed.trim()) return claimed.trim();
  const display = user.displayName?.replace(/\s+Yetkili$/i, "").trim();
  return display || null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [adminChecking, setAdminChecking] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [brandName, setBrandName] = useState<string | null>(null);

  const resolveAdmin = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setIsAdmin(false);
      setAdminChecking(false);
      setBrandName(null);
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
      if (nextUser) {
        const tokenResult = await nextUser.getIdTokenResult();
        writeLastBrandSession({
          uid: nextUser.uid,
          isAdmin: Boolean(response.ok && payload?.isAdmin),
          brandName:
            brandNameFromUser(nextUser, tokenResult.claims as Record<string, unknown>) ??
            undefined,
        });
      }
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
      if (nextUser) {
        const previous = readLastBrandSession();
        const name =
          brandNameFromUser(nextUser) ??
          (previous?.uid === nextUser.uid ? previous.brandName : undefined) ??
          null;
        setBrandName(name);
        writeLastBrandSession({
          uid: nextUser.uid,
          isAdmin: previous?.uid === nextUser.uid ? previous.isAdmin : false,
          brandName: name ?? undefined,
        });
        void nextUser.getIdTokenResult().then((token) => {
          const fromToken = brandNameFromUser(
            nextUser,
            token.claims as Record<string, unknown>,
          );
          if (fromToken) {
            setBrandName(fromToken);
            writeLastBrandSession({
              uid: nextUser.uid,
              isAdmin: previous?.uid === nextUser.uid ? previous.isAdmin : false,
              brandName: fromToken,
            });
          }
        });
      } else {
        setBrandName(null);
        writeLastBrandSession(null);
      }
      void resolveAdmin(nextUser);
    });

    return unsubscribe;
  }, [resolveAdmin]);

  const signOutUser = useCallback(async () => {
    if (!firebaseAuth) return;
    await signOut(firebaseAuth);
    setIsAdmin(false);
    setBrandName(null);
    writeLastBrandSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      adminChecking,
      isAdmin,
      brandName,
      enabled: firebaseEnabled,
      signOutUser,
    }),
    [user, loading, adminChecking, isAdmin, brandName, signOutUser],
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
