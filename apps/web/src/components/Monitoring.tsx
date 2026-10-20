import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

/** 上报前去掉查询参数与锚点：邮件验证、重置密码链接里带有一次性令牌 */
const stripQuery = <T extends { url: string }>(event: T): T => ({ ...event, url: event.url.split(/[?#]/)[0]! });

/**
 * 访问统计与真实用户性能（Vercel Web Analytics / Speed Insights，不使用 Cookie）。
 * 需要在 Vercel 项目的 Analytics、Speed Insights 页面中启用；本地开发时不上报。
 */
export default function Monitoring() {
  if (import.meta.env.DEV) return null;
  return (
    <>
      <Analytics beforeSend={stripQuery} />
      <SpeedInsights beforeSend={stripQuery} />
    </>
  );
}
