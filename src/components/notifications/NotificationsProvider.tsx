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
import { useAuth } from "@/components/auth/AuthProvider";
import type { NotificationItem } from "@/types";

type NotificationsContextValue = {
  items: NotificationItem[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<NotificationItem | null>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, enabled, isAdmin } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!enabled || !user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [enabled, user]);

  const refresh = useCallback(async () => {
    if (!enabled || !user || isAdmin) {
      setItems([]);
      setUnread(0);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as {
        items?: NotificationItem[];
        unread?: number;
      } | null;
      if (!response.ok) {
        throw new Error("Bildirimler alınamadı");
      }
      setItems(payload?.items ?? []);
      setUnread(payload?.unread ?? 0);
    } catch {
      setItems([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, enabled, user, isAdmin]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!enabled || !user || isAdmin) {
        setItems([]);
        setUnread(0);
        setLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        const payload = (await response.json().catch(() => null)) as {
          items?: NotificationItem[];
          unread?: number;
        } | null;
        if (cancelled) return;
        if (!response.ok) throw new Error("Bildirimler alınamadı");
        setItems(payload?.items ?? []);
        setUnread(payload?.unread ?? 0);
      } catch {
        if (!cancelled) {
          setItems([]);
          setUnread(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, enabled, user, isAdmin]);

  const markRead = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as {
        item?: NotificationItem;
      } | null;
      if (!response.ok || !payload?.item) return null;
      const nextItem = payload.item;
      setItems((current) => {
        const wasUnread = current.some((item) => item.id === id && !item.read);
        if (wasUnread && nextItem.read) {
          setUnread((count) => Math.max(0, count - 1));
        }
        return current.map((item) => (item.id === id ? nextItem : item));
      });
      return nextItem;
    },
    [authHeaders],
  );

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: await authHeaders(),
    });
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
  }, [authHeaders]);

  const remove = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!response.ok) return false;
      setItems((current) => {
        const target = current.find((item) => item.id === id);
        if (target && !target.read) {
          setUnread((count) => Math.max(0, count - 1));
        }
        return current.filter((item) => item.id !== id);
      });
      return true;
    },
    [authHeaders],
  );

  const value = useMemo(
    () => ({ items, unread, loading, refresh, markRead, markAllRead, remove }),
    [items, unread, loading, refresh, markRead, markAllRead, remove],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return value;
}
