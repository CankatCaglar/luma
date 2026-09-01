"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import type { JobLists } from "@/types";

const MIN_REVALIDATE_MS = 20_000;
const POLL_MS = 60_000;
const FOCUS_STALE_MS = 45_000;
const MAX_STORED_AGE_MS = 24 * 60 * 60 * 1000;

type JobsStatus = "loading" | "ready";

type JobsContextValue = {
  data: JobLists | null;
  status: JobsStatus;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const JobsContext = createContext<JobsContextValue | null>(null);

function isJobLists(value: unknown): value is JobLists {
  const tenant = (value as JobLists | null)?.tenant;
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as JobLists).completedJobs) &&
      tenant &&
      typeof tenant.brandName === "string",
  );
}

function readStoredJobs(storageKey: string): JobLists | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;

    if (isJobLists(parsed)) return omitHiddenJobs(parsed);
    if (!parsed || typeof parsed !== "object") return null;

    const wrapped = parsed as { savedAt?: unknown; data?: unknown };
    const list = wrapped.data;
    if (!isJobLists(list)) return null;

    const savedAt = Number(wrapped.savedAt ?? 0);
    if (Number.isFinite(savedAt) && savedAt > 0 && Date.now() - savedAt > MAX_STORED_AGE_MS) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return omitHiddenJobs(list);
  } catch {
    return null;
  }
}

function storeJobs(storageKey: string, data: JobLists) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        savedAt: Date.now(),
        data,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

function titleLooksHidden(title: string): boolean {
  return title.includes("**") || /[＊∗✱﹡]{2,}/.test(title);
}

function omitHiddenJobs(data: JobLists): JobLists {
  const visible = <T extends { title: string }>(items: T[]) =>
    items.filter((item) => !titleLooksHidden(item.title));
  return {
    ...data,
    jobs: visible(data.jobs),
    activeJobs: visible(data.activeJobs),
    pendingJobs: visible(data.pendingJobs),
    completedJobs: visible(data.completedJobs),
    approvalItems: visible(data.approvalItems),
    contentPlans: visible(data.contentPlans),
    monthlyReports: visible(data.monthlyReports),
  };
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { enabled, user } = useAuth();
  const storageKey = useMemo(
    () => `luma-jobs-v2:${enabled ? user?.uid ?? "guest" : "public"}`,
    [enabled, user?.uid],
  );
  const [data, setData] = useState<JobLists | null>(() => readStoredJobs(storageKey));
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const lastFetchAt = useRef(0);
  const hasDataRef = useRef(Boolean(data));

  const status: JobsStatus = data ? "ready" : "loading";

  useEffect(() => {
    hasDataRef.current = Boolean(data);
  }, [data]);

  useEffect(() => {
    const stored = readStoredJobs(storageKey);
    if (stored) setData(stored);
  }, [storageKey]);

  const refresh = useCallback(async (force = false) => {
    if (enabled && !user) {
      setData(null);
      return;
    }
    if (inflight.current) return inflight.current;
    if (!force && Date.now() - lastFetchAt.current < MIN_REVALIDATE_MS) {
      return;
    }

    const run = (async () => {
      setRefreshing(true);
      try {
        async function load(fresh: boolean, tokenRefresh: boolean) {
          const headers: HeadersInit = {};
          if (enabled && user) {
            headers.Authorization = `Bearer ${await user.getIdToken(tokenRefresh)}`;
          }
          const endpoint = fresh ? "/api/jobs?fresh=1" : "/api/jobs";
          return fetch(endpoint, {
            cache: "no-store",
            headers,
          });
        }

        let response = await load(force, false);
        if (response.status === 403 && enabled && user) {
          response = await load(false, true);
        }
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "jobs request failed");
        }
        const next = omitHiddenJobs((await response.json()) as JobLists);
        lastFetchAt.current = Date.now();
        setData(next);
        storeJobs(storageKey, next);
      } catch (error) {
        const message = error instanceof Error ? error.message : "jobs request failed";
        console.warn(`[jobs] ${message}`);
      } finally {
        setRefreshing(false);
        inflight.current = null;
      }
    })();

    inflight.current = run;
    return run;
  }, [enabled, storageKey, user]);

  useEffect(() => {
    if (enabled && !user) return;
    const kickoff = window.setTimeout(() => {
      void refresh(false);
    }, 0);

    function refreshIfStale() {
      if (Date.now() - lastFetchAt.current < FOCUS_STALE_MS) return;
      void refresh(true);
    }

    function onVisible() {
      if (document.visibilityState === "visible") refreshIfStale();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshIfStale);
    window.addEventListener("online", refreshIfStale);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(false);
    }, POLL_MS);

    return () => {
      window.clearTimeout(kickoff);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshIfStale);
      window.removeEventListener("online", refreshIfStale);
      window.clearInterval(timer);
    };
  }, [enabled, refresh, user]);

  const value = useMemo(
    () => ({
      data,
      status,
      refreshing,
      refresh: () => refresh(true),
    }),
    [data, status, refreshing, refresh],
  );

  return (
    <JobsContext.Provider value={value}>
      {refreshing && data ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
          role="status"
          aria-live="polite"
          aria-label={t("header.updating")}
        >
          <div className="h-0.5 w-full max-w-md overflow-hidden bg-luma-soft">
            <div className="h-full w-1/3 animate-pulse bg-luma" />
          </div>
        </div>
      ) : null}
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs(): JobsContextValue {
  const context = useContext(JobsContext);
  if (!context) {
    throw new Error("useJobs must be used within JobsProvider");
  }
  return context;
}
