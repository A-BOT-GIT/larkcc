# Phase 2 实施日志

> 卡片快捷按钮：retry / continue / copy / new_session

## 新增文件

- `src/card/actions.ts`
  - `buildActionButtons(copyText?)` — 4 按钮行：🔄 重试 / ➡️ 继续 / 📋 复制 / 🆕 新会话
  - 复制文本截断到 3000 字符避免飞书 callback value 上限

- `src/card-action-handler.ts`
  - 工厂 `createCardActionHandler(deps)` 返回事件处理函数
  - 根据 `action.value.type` 分发：
    - `retry`：取 `getLastPrompt(chatId)`，调 `runAgentForChat`
    - `continue`：组 prompt = "继续"，调 `runAgentForChat`
    - `new_session`：`clearSession()` + 文本提示
    - `copy`：把 `value.text` 作为文本消息发回
    - `resume_session` / `delete_session`：占位（Phase 3 复用）
  - owner 校验，复用 `config.feishu.owner_open_id`

## 修改文件

- `src/card/elements.ts`
  - 新增 `button(text, value, type)` 与 `actionPayload(type, extra?)`
  - 新类型 `ButtonType`
- `src/card/containers.ts`
  - 新增 `buttonRow(buttons)`，把按钮均分宽度
- `src/card/index.ts`
  - 重新导出 `button` / `actionPayload` / `ButtonType` / `buttonRow` / `buildActionButtons`
- `src/client/cardkit.ts`
  - `buildFinalCard` 末尾追加 `buildActionButtons(content)`，让所有最终回复带按钮
- `src/message-handler.ts`
  - `createMessageHandler` 改为返回对象 `{ handler, runAgentForChat, isProcessing, getLastPrompt, setLastPrompt }`
  - 新增内部 `runAgentForChat`：处理 `processing` 互斥、超时、abort，但不操作 reaction（按钮触发场景没有原始用户消息）
- `src/app.ts`
  - 引入 `createCardActionHandler`
  - 注册 `card.action.trigger` 事件给 `cardActionHandler`
  - 用 `handlerCtx.handler` 替换原 `handler`

## 关键决策

1. **事件名**：从 lark SDK 源码确认事件 key 为 `"card.action.trigger"`（不是 `_v1`）。SDK 已自动 normalize 成 camelCase（messageId / chatId / operator.openId）。
2. **runAgentForChat 与主 handler 分离**：把"互斥 + 超时 + abort"封装为独立函数，主 handler 调用一份，按钮回调调用另一份。reactions 操作放在主 handler，按钮回调没有用户消息可以加表情，省略不做。
3. **复制按钮的实现**：飞书原生没有"零回调复制"按钮，于是把内容塞进 button value 里，点击后服务端 reply 一条 text 消息，让用户在 lark 客户端长按复制。3000 字截断防止 value 超限。
4. **`buildActionButtons` 位置**：放到独立 `src/card/actions.ts`，避免和 `status-card.ts`（业务卡片）耦合。Phase 3 也会复用。
5. **`new_session`** 不主动开新对话，只清除当前 sessionId，下一条消息自然新建。
6. **存量 `/status`、`/s` 改名**：参见 Phase 1 日志，git 快捷已迁到 `/gs`、`/gst`。

## 验证

```
$ pnpm typecheck
> tsc --noEmit
（无错误）
```

## 备注 / 风险

- 按钮互斥：当 retry/continue 与正常消息同时到来，`processing` 标志会让后到的请求被拒绝，提示「上一条消息还在处理中」。这是预期行为。
- 飞书应用需开通「订阅卡片回调事件」权限。否则按钮点击后服务器收不到事件，按钮形同虚设。
- `getLastPrompt` 在进程重启后即丢失。重启后第一次点击 retry 会得到「没有可重试的上一条 prompt」提示。
