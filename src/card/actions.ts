/**
 * 卡片快捷动作按钮
 *
 * 提供 retry / continue / copy / new_session 等标准按钮的复用构建函数。
 * 点击会触发 `card.action.trigger` 事件，由 src/card-action-handler.ts 处理。
 */

import { button, actionPayload } from "./elements.js";
import { buttonRow } from "./containers.js";

const COPY_MAX = 3000;

/**
 * 标准对话回复按钮行：retry / continue / copy / new_session
 *
 * @param copyText 用于「复制」按钮的文本（会截断到 3000 字符）
 */
export function buildActionButtons(copyText?: string): Record<string, unknown> {
  const text = (copyText ?? "").slice(0, COPY_MAX);
  return buttonRow([
    button("🔄 重试",  actionPayload("retry"),       "default"),
    button("➡️ 继续",  actionPayload("continue"),    "default"),
    button("📋 复制",  actionPayload("copy", { text }), "default"),
    button("🆕 新会话", actionPayload("new_session"), "default"),
  ]);
}
