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
 * @param cardId   当前卡片 id；handler 会用它对按钮做 cardElement.patch（融合状态显示）
 */
export function buildActionButtons(
  copyText?: string,
  cardId?: string,
): Record<string, unknown> {
  const text = (copyText ?? "").slice(0, COPY_MAX);
  const extra = cardId ? { cardId } : {};
  return buttonRow([
    button("🔄 重试",   actionPayload("retry",       extra),                "default", "btn_retry"),
    button("➡️ 继续",   actionPayload("continue",    extra),                "default", "btn_continue"),
    button("📋 复制",   actionPayload("copy",        { ...extra, text }),   "default", "btn_copy"),
    button("🆕 新会话", actionPayload("new_session", extra),                "default", "btn_new_session"),
  ]);
}
