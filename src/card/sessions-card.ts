/**
 * /sessions 会话历史卡片
 *
 * 列出最近会话，每项含 firstPrompt 摘要 + 续接/删除按钮。
 */

import { markdown, hr, button, actionPayload } from "./elements.js";
import { buttonRow } from "./containers.js";
import { buildHeader } from "./header.js";
import { buildCard } from "./compose.js";
import type { SessionRecord } from "../session-history.js";

function relativeTime(now: number, then: number): string {
  const diff = Math.max(0, now - then);  // seconds
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}m 前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h 前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d 前`;
  const d = new Date(then * 1000);
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

export interface SessionsCardOptions {
  records: SessionRecord[];
  currentSessionId?: string;
  cardTitle?: string;
  iconImgKey?: string;
}

export function buildSessionsCard(opts: SessionsCardOptions): Record<string, unknown> {
  const elements: Record<string, unknown>[] = [];

  if (opts.records.length === 0) {
    elements.push(markdown("_暂无会话历史。开始一次对话后会自动记录。_"));
  } else {
    const now = Math.floor(Date.now() / 1000);

    opts.records.forEach((r, i) => {
      const isCurrent = r.sessionId === opts.currentSessionId;
      const shortId = r.sessionId.slice(0, 6);
      const star = isCurrent ? "⭐ " : "";
      const tail = isCurrent ? " · 当前" : "";
      const summary = r.firstPrompt
        ? r.firstPrompt
        : "_(无摘要)_";

      elements.push(markdown(
        `**${star}\`${shortId}\`** · ${relativeTime(now, r.lastUsedAt)} · ${r.msgCount} 条${tail}\n` +
        `> ${summary}`,
      ));

      if (!isCurrent) {
        elements.push(buttonRow([
          button("▶️ 继续此会话", actionPayload("resume_session", { sessionId: r.sessionId }), "primary"),
          button("🗑 删除", actionPayload("delete_session", { sessionId: r.sessionId }), "danger"),
        ]));
      }

      if (i < opts.records.length - 1) {
        elements.push(hr());
      }
    });
  }

  return buildCard({
    elements,
    config: { wide_screen_mode: true },
    header: buildHeader({
      title: opts.cardTitle ?? "🗂 最近会话",
      subtitle: opts.records.length > 0 ? `共 ${opts.records.length} 个会话` : "暂无记录",
      template: "indigo",
      iconImgKey: opts.iconImgKey,
    }),
  });
}
