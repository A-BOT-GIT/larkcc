/**
 * /status 与 /usage 卡片
 */

import { markdown, hr } from "./elements.js";
import { buildHeader } from "./header.js";
import { buildCard } from "./compose.js";
import { formatDuration } from "../format/time.js";
import type { AggregatedUsage, UsageEntry } from "../usage-stats.js";
import { aggregateUsage } from "../usage-stats.js";

// ── /status 卡片 ────────────────────────────────────────────

export interface LarkccStatusCardOptions {
  cwd: string;
  profile: string;
  sessionId?: string;
  sessionMsgCount?: number;
  startupTime: number;
  messageCount: number;
  pid: number;
  cardTitle?: string;
  iconImgKey?: string;
}

function formatStartTime(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function buildLarkccStatusCard(opts: LarkccStatusCardOptions): Record<string, unknown> {
  const elapsed = (Date.now() - opts.startupTime) / 1000;
  const sessionLine = opts.sessionId
    ? `🔗 **当前会话**：\`${opts.sessionId.slice(0, 8)}\`${opts.sessionMsgCount ? ` · ${opts.sessionMsgCount} 条消息` : ""}`
    : "🔗 **当前会话**：（无）";

  const lines = [
    `📁 **工作目录**：\`${opts.cwd}\``,
    `🤖 **Profile**：\`${opts.profile}\``,
    sessionLine,
    `🕐 **启动时间**：${formatStartTime(opts.startupTime)}`,
    `⏱ **运行时长**：${formatDuration(elapsed)}`,
    `💬 **已处理**：${opts.messageCount} 条消息`,
    `🧰 **PID**：${opts.pid}`,
  ];

  return buildCard({
    elements: [markdown(lines.join("\n\n"))],
    config: { wide_screen_mode: true },
    header: buildHeader({
      title: opts.cardTitle ?? "larkcc 状态",
      subtitle: "🟢 在线",
      template: "green",
      iconImgKey: opts.iconImgKey,
    }),
  });
}

// ── /usage 卡片 ─────────────────────────────────────────────

export type UsageRange = "today" | "week" | "month" | "all";

export interface UsageCardOptions {
  range: UsageRange;
  todayEntries: UsageEntry[];
  rangeEntries: UsageEntry[];
  rangeLabel: string;       // 例如 "近 7 天" / "本月"
  cardTitle?: string;
  iconImgKey?: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function buildAggSection(label: string, agg: AggregatedUsage): string[] {
  const lines = [
    `**${label}**`,
    `   📥 ${formatNumber(agg.inputTokens)}   📤 ${formatNumber(agg.outputTokens)}   💾 ${formatNumber(agg.cacheReadTokens)}`,
    `   🔧 ${formatNumber(agg.toolCount)}   💬 ${agg.conversations} 次对话   ⏱ ${formatDuration(agg.elapsedSec)}`,
  ];
  return lines;
}

function buildByModelSection(agg: AggregatedUsage): string[] {
  const models = Object.entries(agg.byModel);
  if (models.length === 0) return [];

  models.sort((a, b) => b[1].conversations - a[1].conversations);
  const lines = ["**按模型**"];
  for (const [model, stats] of models) {
    const tokens = stats.inputTokens + stats.outputTokens;
    lines.push(`   \`${model}\`: ${stats.conversations} 次 / ${formatNumber(tokens)} tokens`);
  }
  return lines;
}

export function buildUsageCard(opts: UsageCardOptions): Record<string, unknown> {
  const todayAgg = aggregateUsage(opts.todayEntries);
  const rangeAgg = aggregateUsage(opts.rangeEntries);

  const todayDate = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });

  const sections: string[][] = [];
  sections.push(buildAggSection(`今日 (${todayDate})`, todayAgg));
  if (opts.range !== "today") {
    sections.push(buildAggSection(opts.rangeLabel, rangeAgg));
  }
  const byModel = buildByModelSection(rangeAgg);
  if (byModel.length > 0) sections.push(byModel);

  const body = sections.map(s => s.join("\n")).join("\n\n");
  const empty = todayAgg.conversations === 0 && rangeAgg.conversations === 0;

  const elements: Record<string, unknown>[] = [
    markdown(empty ? "_暂无使用记录。开始一次对话后再来查看。_" : body),
    hr(),
    markdown("<font color='grey'>📥 输入 · 📤 输出 · 💾 缓存读取 · 🔧 工具调用 · 💬 对话次数</font>", { text_size: "notation" }),
  ];

  return buildCard({
    elements,
    config: { wide_screen_mode: true },
    header: buildHeader({
      title: opts.cardTitle ?? "📊 使用统计",
      subtitle: `范围：${opts.rangeLabel}`,
      template: "blue",
      iconImgKey: opts.iconImgKey,
    }),
  });
}
