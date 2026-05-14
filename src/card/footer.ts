/**
 * 飞书卡片 JSON v2 — Footer 构建器
 */

import { markdown } from "./elements.js";
import { column, columnSet } from "./containers.js";

// ── Footer ──────────────────────────────────────────────────

export interface FooterStats {
  inputTokens?: number;
  outputTokens?: number;
  toolCount?: number;
}

export function buildFooterElement(stats: FooterStats): Record<string, unknown> | null {
  const parts: string[] = [];

  if (stats.inputTokens != null) {
    parts.push(`📥 ${stats.inputTokens.toLocaleString()}`);
  }
  if (stats.outputTokens != null) {
    parts.push(`📤 ${stats.outputTokens.toLocaleString()}`);
  }
  if (stats.toolCount != null && stats.toolCount > 0) {
    parts.push(`🔧 ${stats.toolCount}`);
  }

  if (parts.length === 0) return null;

  return columnSet([
    column([
      markdown(`<font color='grey'>${parts.join(' · ')}</font>`, { text_size: "notation" }),
    ]),
  ]);
}
