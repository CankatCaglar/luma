"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { JobLists } from "@/types";

const STORAGE_KEY = "luma-jobs-v1";
const MIN_REVALIDATE_MS = 12_000;
const POLL_MS = 45_000;

type JobsStatus = "loading" | "ready" | "error";

type JobsContextValue = {
  data: JobLists | null;
  status: JobsStatus;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const JobsContext = createContext<JobsContextValue | null>(null);

function readStoredJobs(): JobLists | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobLists;
    if (!parsed || !Array.isArray(parsed.completedJobs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

let storedSnapshot: JobLists | null = null;
let storedSnapshotRead = false;

function getClientSnapshot(): JobLists | null {
  if (!storedSnapshotRead) {
    storedSnapshotRead = true;
    storedSnapshot = readStoredJobs();
  }
  return storedSnapshot;
}

function storeJobs(data: JobLists) {
  storedSnapshot = data;
  storedSnapshotRead = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function subscribe() {
  return () => {};
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const cached = useSyncExternalStore(subscribe, getClientSnapshot, () => null);
  const [data, setData] = useState<JobLists | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const lastFetchAt = useRef(0);

  const resolved = data ?? cached;
  const status: JobsStatus = resolved ? "ready" : "loading";

  const refresh = useCallback(async (force = false) => {
    if (inflight.current) return inflight.current;
    if (!force && Date.now() - lastFetchAt.current < MIN_REVALIDATE_MS) {
      return;
    }

    const run = (async () => {
      setRefreshing(true);
      try {
        const response = await fetch("/api/jobs?fresh=1", { cache: "no-store" });
        if (!response.ok) throw new Error("jobs request failed");
        const next = (await response.json()) as JobLists;
        lastFetchAt.current = Date.now();
        setData(next);
        storeJobs(next);
      } catch {
        /* keep cached list */
      } finally {
        setRefreshing(false);
        inflight.current = null;
      }
    })();

    inflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    void refresh(true);

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      data: resolved,
      status,
      refreshing,
      refresh: () => refresh(true),
    }),
    [resolved, status, refreshing, refresh],
  );

  return (
    <JobsContext.Provider value={value}>
      {refreshing && resolved ? (
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
