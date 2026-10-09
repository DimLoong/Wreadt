import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../store/db";
import { getMeta, setMeta } from "../store/repo";
import { ApiError, auth, getSession, onSessionChange, type Session } from "../services/api";
import { LAST_SYNC_KEY, prepareForNewAccount, syncNow } from "../services/sync";

type Status = "idle" | "syncing" | "error" | "offline";

interface SyncContextValue {
  session: Session | null;
  status: Status;
  error: string | null;
  pending: number;
  lastSyncAt: number | null;
  sync: () => Promise<void>;
  login: (email: string, password: string, register?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);
const AUTO_SYNC_MS = 2 * 60_000;
const DEBOUNCE_MS = 5_000;
const ACCOUNT_KEY = "syncUserId";

export function SyncProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const lastSyncAt = useLiveQuery(() => getMeta<number>(LAST_SYNC_KEY), [status]) ?? null;
  const loggedIn = Boolean(session);
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    void getSession().then((s) => setSession(s ?? null));
    const off = onSessionChange(setSession);
    return () => {
      off();
    };
  }, []);

  const sync = useCallback(async () => {
    if (!(await getSession())) return;
    setStatus("syncing");
    try {
      await syncNow();
      setStatus("idle");
      setError(null);
    } catch (err) {
      const e = err as ApiError;
      setStatus(e.code === "NETWORK" ? "offline" : "error");
      setError(e.message);
    }
  }, []);

  // 登录后：定时、回到页面、本地有新变更（防抖）时自动同步
  useEffect(() => {
    if (!loggedIn) return;
    const first = window.setTimeout(() => void sync(), 0);
    const timer = window.setInterval(() => void sync(), AUTO_SYNC_MS);
    const onVisible = () => document.visibilityState === "visible" && void sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [loggedIn, sync]);

  useEffect(() => {
    if (!loggedIn || pending === 0) return;
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => void sync(), DEBOUNCE_MS);
    return () => {
      if (debounce.current !== null) window.clearTimeout(debounce.current);
    };
  }, [loggedIn, pending, sync]);

  const login = useCallback(async (email: string, password: string, register = false) => {
    const s = register ? await auth.register(email, password) : await auth.login(email, password);
    // 本设备第一次登录该账号：把本地已有进度全部推送，并从头拉取
    if ((await getMeta<string>(ACCOUNT_KEY)) !== s.user.id) {
      await prepareForNewAccount();
      await setMeta(ACCOUNT_KEY, s.user.id);
    }
    await auth.saveSession(s);
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setStatus("idle");
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ session, status, error, pending, lastSyncAt, sync, login, logout }),
    [session, status, error, pending, lastSyncAt, sync, login, logout],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync 必须在 SyncProvider 内使用");
  return ctx;
}
