# Phase 0 实施日志

> 共享基础设施：使用统计 + 会话历史

## 新增文件

- `src/usage-stats.ts` — Usage JSONL 存储
  - 类型：`UsageEntry`（单条）/ `AggregatedUsage`（聚合结果）
  - 方法：`recordUsage`、`loadUsage(profile, since?, until?)`、`aggregateUsage(entries)`
  - 文件位置：`~/.larkcc/usage-{profile}.jsonl`
- `src/session-history.ts` — 会话历史 JSONL 存储
  - 类型：`SessionRecord`
  - 方法：`recordSession`、`touchSession`、`listSessions(profile, limit=10)`、`deleteSession`、`findSessionByShortId`
  - 文件位置：`~/.larkcc/sessions-{profile}.jsonl`
  - `firstPrompt` 截断到 120 字
  - `findSessionByShortId` 用前缀匹配，歧义返回 `null`

## 修改文件

- `src/claude.ts`
  - 引入 `recordUsage` / `recordSession` / `touchSession`
  - `SDKResultEvent` 加上 `cacheReadInputTokens` / `cacheCreationInputTokens`
  - `AgentContext` 加 `profile` / `prompt` / `resumedSessionId`
  - `processResultEvent` 提取 `cacheReadTokens` / `cacheCreationTokens`
  - 在 `processResultEvent` 末尾接入 `recordUsage` 与 `recordSession`/`touchSession`
  - 通过 `resumedSessionId` 区分新会话 vs 续接

## 关键决策

1. **零侵入**：数据采集放在 `processResultEvent` 末尾，包在 `try/catch` 中，失败只 log，不影响主流程。
2. **续接判定**：进入 `runAgent` 时存下 `getSession()` 到 `ctx.resumedSessionId`，与 `event.session_id` 对比。匹配 → 续接（touch），不匹配或为空 → 新会话（record）。
3. **首条 prompt 截断**：120 字（保留省略号），`SessionRecord.firstPrompt` 字段。
4. **profile 落盘命名**：`default` 与未指定时统一文件名 `usage-default.jsonl`。
5. **JSONL 写入**：`recordUsage` 用 `appendFileSync`（多行）；`recordSession`/`touchSession` 因要更新已有记录，用 read-all + writeFileSync。

## 验证

```
$ pnpm typecheck
> tsc --noEmit
（无错误输出）
```

## 备注 / 踩坑

- SDK 的 `modelUsage` 中实际有 `cacheReadInputTokens` / `cacheCreationInputTokens` 字段，类型定义需补全。
- `recordSession` 内部已对 sessionId 重复做了去重处理（已存在则视同 touch），保证 JSONL 不含重复行。
