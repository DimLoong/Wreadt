import { getMeta, setMeta } from "../store/repo";

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** access token 过期时间（毫秒） */
  expiresAt: number;
  user: User;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const SESSION_KEY = "session";
const listeners = new Set<(s: Session | null) => void>();

export const getSession = () => getMeta<Session>(SESSION_KEY);

async function saveSession(session: Session | null) {
  await setMeta(SESSION_KEY, session);
  listeners.forEach((fn) => fn(session));
}

export function onSessionChange(fn: (s: Session | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  } catch {
    throw new ApiError(0, "NETWORK", "网络不可用");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "HTTP_ERROR", body.message ?? res.statusText);
  return body as T;
}

function toSession(r: AuthResponse): Session {
  return { accessToken: r.accessToken, refreshToken: r.refreshToken, expiresAt: Date.now() + r.expiresIn * 1000, user: r.user };
}

let refreshing: Promise<Session | null> | null = null;

/** 刷新 access token；refresh token 失效时清除登录态 */
function refreshSession(session: Session): Promise<Session | null> {
  refreshing ??= request<AuthResponse>("/auth/refresh", { method: "POST", json: { refreshToken: session.refreshToken } })
    .then(async (r) => {
      const next = toSession(r);
      await saveSession(next);
      return next;
    })
    .catch(async (err: ApiError) => {
      if (err.status === 401) await saveSession(null);
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** 需要登录的请求：过期前 30 秒主动刷新，401 时刷新后重试一次 */
export async function authed<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  let session: Session | null | undefined = await getSession();
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "未登录");
  if (session.expiresAt - Date.now() < 30_000) session = await refreshSession(session);
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "未登录");
  try {
    return await request<T>(path, init, session.accessToken);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const next = await refreshSession(session);
    if (!next) throw err;
    return request<T>(path, init, next.accessToken);
  }
}

export const auth = {
  /** 只换取令牌，由调用方在准备好本地数据后 saveSession，避免与自动同步竞争 */
  async login(email: string, password: string) {
    return toSession(await request<AuthResponse>("/auth/login", { method: "POST", json: { email, password } }));
  },
  async register(email: string, password: string) {
    return toSession(await request<AuthResponse>("/auth/register", { method: "POST", json: { email, password } }));
  },
  saveSession,
  async logout() {
    const session = await getSession();
    await saveSession(null);
    if (session) await request("/auth/logout", { method: "POST", json: { refreshToken: session.refreshToken } }).catch(() => undefined);
  },
  async refreshUser() {
    const session = await getSession();
    if (!session) return null;
    const me = await authed<User>("/me");
    const next = { ...session, user: { id: me.id, email: me.email, emailVerified: me.emailVerified } };
    await saveSession(next);
    return next;
  },
  verifyEmail: (token: string) => request<void>("/auth/verify-email", { method: "POST", json: { token } }),
  forgotPassword: (email: string) => request<void>("/auth/forgot-password", { method: "POST", json: { email } }),
  resetPassword: (token: string, password: string) =>
    request<void>("/auth/reset-password", { method: "POST", json: { token, password } }),
};
