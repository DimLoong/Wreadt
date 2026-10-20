/**
 * 前端报错上报：只有配置了 VITE_SENTRY_DSN 才加载 Sentry（不配置时不增加任何体积）。
 * 只上报错误本身：不收集请求头 / 请求体（自带 Key 的 AI 请求头里有用户的 API Key）、Cookie、查询参数与用户信息。
 */
export function initErrorReporting() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || import.meta.env.DEV) return;
  void import("@sentry/react").then((Sentry) =>
    Sentry.init({
      dsn,
      environment: (import.meta.env.VITE_VERCEL_ENV as string | undefined) ?? "production",
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        genAI: { inputs: false, outputs: false },
      },
    }),
  );
}
