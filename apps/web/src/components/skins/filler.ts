import type { SkinDensity } from "../../context/settings";

// 伪装页面的假内容：固定文本，按密度取用（不随单词变化，避免画面跳动引人注意）

/** 文档：当前词前后各放几段 */
export const WORD_PARAS: Record<SkinDensity, [number, number]> = { low: [1, 1], medium: [3, 4], high: [6, 9] };

export const DOC_PARAGRAPHS = [
  "一、会议背景：本次会议主要回顾第三季度各项目的推进情况，对照年初制定的目标逐项核对完成度，并就下一阶段的资源安排与风险应对达成一致意见。",
  "二、进度概述：核心模块已完成联调，测试覆盖率较上月提升约 12 个百分点；数据迁移方案已通过评审，预计下周二开始灰度，周五前完成全部切换。",
  "三、存在问题：部分接口响应时间在高峰期仍超出预期，需要与基础架构组共同排查；第三方服务的合同续签尚未完成，采购流程预计还需两周。",
  "四、下一步计划：由产品组牵头整理需求优先级清单，设计组同步更新交互稿，研发组在周四前给出排期评估，项目经理负责跟进各方的交付节点。",
  "五、预算情况：本季度实际支出控制在预算的 93% 以内，外包费用略有超出，主要原因是临时增加了两轮可用性测试，下季度将相应调整预留比例。",
  "六、人员安排：新入职的两位同事已完成岗前培训，将分别加入数据组和客户端组；实习生的转正评估请各组长在月底前提交书面意见。",
  "七、客户反馈：近期共收到有效反馈 146 条，其中约四成集中在导出功能与权限设置，建议在下个版本中优先处理，并在帮助文档中补充说明。",
  "八、风险提示：年底前将有多个系统同时进行升级，各组需提前确认依赖关系，避免在同一时间窗口内发布；重要变更需提前三个工作日报备。",
  "九、其他事项：下月初组织一次跨部门的复盘会议，请各组准备十分钟以内的分享，重点说明经验教训与可复用的做法，会议纪要将同步至共享目录。",
  "十、附件说明：本纪要附有项目甘特图、预算明细表及风险登记册，如有疑问请在本周内反馈，逾期视为无异议，后续以此版本作为执行依据。",
  "参会人员：项目管理办公室、产品部、设计部、研发一组、研发二组、测试组、运维组、财务部代表。记录人：综合办公室。",
  "补充说明：上述时间节点如需调整，请提前与项目经理沟通，并在协同平台上更新对应任务的截止日期和负责人信息。",
];

/** 表格：显示的行数与列数 */
/** 表格总共显示的列数（有数据的列之外留空，铺满宽度） */
export const EXCEL_COLUMNS = 14;

export const EXCEL_SIZE: Record<SkinDensity, { rows: number; filled: number; cols: number }> = {
  low: { rows: 24, filled: 6, cols: 6 },
  medium: { rows: 30, filled: 22, cols: 8 },
  high: { rows: 48, filled: 44, cols: 11 },
};

const PROJECTS = ["华东渠道拓展", "官网改版", "会员体系升级", "数据中台", "供应链优化", "客服系统", "移动端重构", "品牌活动", "海外市场调研", "财务共享中心"];
const OWNERS = ["王磊", "李娜", "张伟", "刘洋", "陈静", "杨帆", "赵敏", "黄涛", "周婷", "吴昊"];
const STATUS = ["进行中", "已完成", "待评审", "进行中", "已延期", "进行中", "已完成"];
const DEPTS = ["市场部", "产品部", "研发部", "运营部", "财务部"];

/** 第 n 行（从 1 开始，第 1 行为表头）的假数据，按列返回；列数由密度决定 */
export function excelRow(n: number, cols: number): string[] {
  if (n === 1) return ["序号", "项目", "负责人", "说明", "状态", "预算(万元)", "完成率", "截止日期", "部门", "备注", "更新时间"].slice(0, cols);
  const i = n - 2;
  const pick = <T,>(list: T[], k: number) => list[(i * k + 3) % list.length]!;
  const budget = ((i * 37) % 90) + 10 + ((i * 7) % 10) / 10;
  const rate = (i * 23) % 101;
  const month = (i % 3) + 10;
  const day = ((i * 5) % 28) + 1;
  return [String(i + 1), pick(PROJECTS, 3), pick(OWNERS, 7), "", pick(STATUS, 5), budget.toFixed(1), `${rate}%`, `2026/${month}/${day}`, pick(DEPTS, 2), i % 4 === 0 ? "需复核" : "", `10/${(i % 20) + 1} 14:${String((i * 13) % 60).padStart(2, "0")}`].slice(0, cols);
}

/** 代码：当前词所在代码块前后各放多少行 */
// 都停在完整的代码块之后，不会出现没闭合的函数
export const CODE_LINES: Record<SkinDensity, [number, number]> = { low: [4, 6], medium: [14, 13], high: [24, 30] };

export const CODE_BEFORE: [string, string][] = [
  ["kw", 'import { useCallback, useMemo } from "react";'],
  ["kw", 'import { formatDate, toCurrency } from "../utils/format";'],
  ["kw", 'import type { Locale, Term } from "./types";'],
  ["", ""],
  ["cm", "/** 术语表：按模块分组，供界面文案与导出报表共用 */"],
  ["", "const DEFAULT_LOCALE: Locale = \"zh-CN\";"],
  ["", ""],
  ["", "function normalize(input: string): string {"],
  ["", "  return input.trim().replace(/\\s+/g, \" \").toLowerCase();"],
  ["", "}"],
  ["", ""],
  ["", "export function sortTerms(terms: Term[]): Term[] {"],
  ["", "  return [...terms].sort((a, b) => a.id - b.id);"],
  ["", "}"],
  ["", ""],
  ["", "export function findTerm(terms: Term[], key: string) {"],
  ["", "  const target = normalize(key);"],
  ["", "  return terms.find((t) => normalize(t.value) === target);"],
  ["", "}"],
  ["", ""],
  ["cm", "// 导出时按创建时间分组，金额统一保留两位小数"],
  ["", "export function toRows(terms: Term[], locale = DEFAULT_LOCALE) {"],
  ["", "  return terms.map((t) => ({ ...t, date: formatDate(t.createdAt, locale), amount: toCurrency(t.amount ?? 0) }));"],
  ["", "}"],
];

export const CODE_AFTER: [string, string][] = [
  ["", ""],
  ["", "export function useTermIndex(terms: Term[]) {"],
  ["", "  const index = useMemo(() => new Map(terms.map((t) => [normalize(t.value), t])), [terms]);"],
  ["", "  const lookup = useCallback((key: string) => index.get(normalize(key)), [index]);"],
  ["", "  return { index, lookup };"],
  ["", "}"],
  ["", ""],
  ["cm", "// TODO: 与后端确认分页参数，超过 500 条时改为增量加载"],
  ["", "export async function fetchTerms(page = 1, size = 50): Promise<Term[]> {"],
  ["", "  const res = await fetch(`/api/terms?page=${page}&size=${size}`);"],
  ["", "  if (!res.ok) throw new Error(`HTTP ${res.status}`);"],
  ["", "  return (await res.json()) as Term[];"],
  ["", "}"],
  ["", ""],
  ["", "export function groupByModule(terms: Term[]) {"],
  ["", "  const groups = new Map<string, Term[]>();"],
  ["", "  for (const term of terms) {"],
  ["", "    const list = groups.get(term.module) ?? [];"],
  ["", "    list.push(term);"],
  ["", "    groups.set(term.module, list);"],
  ["", "  }"],
  ["", "  return groups;"],
  ["", "}"],
  ["", ""],
  ["", "export function diffTerms(prev: Term[], next: Term[]) {"],
  ["", "  const before = new Set(prev.map((t) => t.id));"],
  ["", "  return next.filter((t) => !before.has(t.id));"],
  ["", "}"],
  ["", ""],
  ["kw", "export default sortTerms;"],
];
