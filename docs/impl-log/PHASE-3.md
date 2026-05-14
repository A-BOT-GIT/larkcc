# Phase 3 实施日志

> /sessions 会话历史管理

## 新增文件

- `src/card/sessions-card.ts`
  - `buildSessionsCard({ records, currentSessionId, ... })` 渲染最近会话列表
  - 当前会话标识 ⭐，无按钮；非当前会话显示「▶️ 继续此会话」「🗑 删除」两个按钮
  - 时间显示用相对时间（刚刚 / 12m 前 / 3h 前 / 2d 前 / 月-日）

## 修改文件

- `src/session-history.ts`
  - `touchSession` 签名加重载：第三参数支持 `string | { model?, bump? }`
  - `bump=false` 时只更新 `lastUsedAt`，不递增 `msgCount`，避免双计
- `src/session.ts`
  - `setSession` 末尾调用 `touchSession(profile, id, { bump: false })`，让 lastUsedAt 跟随会话切换更新
- `src/message-handler.ts`
  - 引入 `buildSessionsCard`、`findSessionByShortId`、`deleteSession`、`clearSession`
  - `handleCardCommand("sessions", ...)` 完整实现：
    - 无参 → 列出最近 10 个会话
    - `resume <id>` / `r <id>` → setSession（前 6 位短匹配）
    - `new` / `n` → clearSession + 文本提示
    - `delete <id>` / `d <id>` / `del <id>` → 删除 + 文本提示
- `src/card-action-handler.ts`（Phase 2 已铺设占位，本阶段未改动）
  - `resume_session` 与 `delete_session` 已在 Phase 2 实现，可被 sessions 卡片按钮直接触发

## 关键决策

1. **短 id 匹配**：`findSessionByShortId(profile, sid)` 用前缀，歧义返回 null。卡片显示前 6 位作为标识。
2. **ms 计数避免双计**：`session.ts:setSession` 与 `claude.ts:processResultEvent` 都会触达 session-history。setSession 不 bump，processResultEvent 显式调 recordSession（新）/ touchSession（续，带 bump）。
3. **当前会话不显示按钮**：避免重复 resume 当前会话的歧义；删除按钮也屏蔽防止误删当前。
4. **空状态**：无任何记录时显示「暂无会话历史」。
5. **列表排序**：`session-history.listSessions` 按 lastUsedAt 倒序，limit=10。

## 与 Phase 2 的协同

- 会话卡片中的 `▶️ 继续此会话` / `🗑 删除` 按钮带 `actionPayload("resume_session", { sessionId })` / `actionPayload("delete_session", { sessionId })`，Phase 2 的 `card-action-handler.ts` 已经实现这两个 case，无需再改。

## 验证

```
$ pnpm typecheck
> tsc --noEmit
（无错误）
```

## 备注

- /sessions 子命令在文本命令路径生效；按钮触发走 card.action.trigger 路径。两条路径共用 `findSessionByShortId` / `deleteSession`，行为一致。
- 老用户升级时 `~/.larkcc/sessions-{profile}.jsonl` 不存在 → listSessions 返回空数组 → 卡片显示空状态。零迁移。
