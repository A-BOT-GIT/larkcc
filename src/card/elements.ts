/**
 * 飞书卡片 JSON v2 — 原子展示组件
 *
 * 每个函数对应飞书卡片的一个 tag，返回标准 JSON 对象。
 * @see https://open.feishu.cn/document/feishu-cards/card-json-v2-components/component-json-v2-overview
 */

// ── 富文本（markdown） ──────────────────────────────────────

export interface MarkdownOptions {
  text_size?: string;
  element_id?: string;
}

export function markdown(content: string, options?: MarkdownOptions): Record<string, unknown> {
  const el: Record<string, unknown> = { tag: "markdown", content };
  if (options?.text_size) el.text_size = options.text_size;
  if (options?.element_id) el.element_id = options.element_id;
  return el;
}

// ── 分割线（hr） ──────────────────────────────────────────

export function hr(): Record<string, string> {
  return { tag: "hr" };
}

// ── 普通文本（plain_text） ──────────────────────────────────

export function plainText(content: string): Record<string, unknown> {
  return { tag: "plain_text", content };
}

// ── 选项标签（text_tag） ──────────────────────────────────

export function textTag(text: string, color: string): Record<string, unknown> {
  return {
    tag: "text_tag",
    text: plainText(text),
    color,
  };
}

// ── 图标 ──────────────────────────────────────────────────

export function standardIcon(token: string, size?: string): Record<string, unknown> {
  const icon: Record<string, unknown> = { tag: "standard_icon", token };
  if (size) icon.size = size;
  return icon;
}

export function customIcon(imgKey: string): Record<string, unknown> {
  return { tag: "custom_icon", img_key: imgKey };
}

// ── 按钮（button） ─────────────────────────────────────────

export type ButtonType = "primary" | "default" | "danger" | "text";

/**
 * 构建卡片按钮（card v2 schema）
 * - 点击触发 `card.action.trigger_v1` 事件，`action.value` 为传入的 value 对象
 * - 通过 behaviors:callback 让飞书把 value 透传回服务器
 */
export function button(
  text: string,
  value: Record<string, unknown>,
  type: ButtonType = "default",
  elementId?: string,
  disabled?: boolean,
): Record<string, unknown> {
  const el: Record<string, unknown> = {
    tag: "button",
    text: plainText(text),
    type,
    behaviors: [{ type: "callback", value }],
  };
  if (elementId) el.element_id = elementId;
  if (disabled) el.disabled = true;
  return el;
}

/**
 * 构建带类型字段的 action payload，便于 card-action-handler 路由
 */
export function actionPayload(
  type: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return { type, ...(extra ?? {}) };
}
