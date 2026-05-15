# larkcc v0.14 实施总览

> 三个核心功能：状态命令 · 卡片快捷按钮 · 会话历史

---

## 任务完成度

| Phase | 内容 | 状态 |
|-------|------|------|
| 0 | 共享基础（usage-stats / session-history）+ 数据采集接入 | ✅ |
| 1 | `/status` + `/usage` 命令 + 卡片 | ✅ |
| 2 | 卡片快捷按钮（retry / continue / copy / new_session） | ✅ |
| 3 | `/sessions` 会话历史管理 + resume/delete 按钮 | ✅ |
| 4 | 联调、CHANGELOG、README、SUMMARY | ✅ |

`pnpm typecheck` 与 `pnpm build` 全程通过，无错误。

---

## 新增模块

| 文件 | 作用 |
|------|------|
| `src/usage-stats.ts` | 使用量 JSONL 存储 / 聚合 |
| `src/session-history.ts` | 会话历史 JSONL 存储 / 短 id 匹配 |
| `src/card/status-card.ts` | `/status`、`/usage` 卡片渲染 |
| `src/card/sessions-card.ts` | `/sessions` 会话列表卡片 |
| `src/card/actions.ts` | `buildActionButtons` 标准按钮行 |
| `src/card-action-handler.ts` | 卡片按钮回调路由（retry/continue/copy/new/resume/delete） |

## 改动模块

| 文件 | 改动要点 |
|------|----------|
| `src/card/elements.ts` | 新增 `button` / `actionPayload` |
| `src/card/containers.ts` | 新增 `buttonRow` |
| `src/card/index.ts` | 导出新成员 |
| `src/client/cardkit.ts` | `buildFinalCard` 末尾追加按钮行 |
| `src/commands.ts` | 新增 `BUILTIN_CARD_CMD`；`/status`/`/s` 让位给卡片命令，原 git status 改名 `/gs`、`/gst`；help 文本扩展 |
| `src/message-handler.ts` | 增加 `messageCount` / `lastPromptByChat`；返回对象暴露 `runAgentForChat` 与 `getLastPrompt`；处理 `card` 类型分发 |
| `src/app.ts` | 注册 `card.action.trigger` 事件 |
| `src/claude.ts` | `processResultEvent` 末尾接入 `recordUsage` / `recordSession` / `touchSession`；扩展 `SDKResultEvent` 含缓存 token |
| `src/session.ts` | `setSession` 同步 touch 会话历史（不 bump msgCount） |
| `CHANGELOG.md` | 追加 0.14.0 条目 |
| `README.md` | 新增 Status & Usage / Session History / Card Quick Actions 章节 |

## 关键架构决策

1. **零侵入数据采集**：`processResultEvent` 末尾用 try/catch 包住 `recordUsage` / `recordSession` / `touchSession`，失败仅 log，主流程不受影响。
2. **事件命名**：飞书 SDK 事件名为 `card.action.trigger`（不是 `_v1`），SDK 会 normalize 为 camelCase 字段（messageId/chatId/operator.openId）。
3. **命名空间冲突**：原 `/status` 是 git status 快捷 EXEC，新 `/status` 是状态卡片，前者重命名为 `/gs`、`/gst`。在 CHANGELOG 与 README 中显式说明。
4. **runAgent 共享**：从 `createMessageHandler` 抽出 `runAgentForChat`，主消息流与按钮回调流共用，互斥靠同一份 `processing` 标志。
5. **不计算费用**：`/usage` 仅给 raw token / tool count / duration。如果以后要算钱，可以另写脚本读 jsonl 离线算。
6. **JSONL 格式**：使用追加 + 全量重写两种策略：`recordUsage` 用 append，`recordSession`/`touchSession` 用 read-all + write-all（要原地更新）。
7. **会话短 id**：6 位前缀；歧义时 `findSessionByShortId` 返回 null，由调用方提示用户。

## 验证

- `pnpm typecheck` ✅ 无 TS 错误
- `pnpm build`     ✅ tsup 输出 dist/index.js (6.70 MB)
- 手工实地测试需要飞书机器人（本环境为离线 typecheck 验证），可由用户在配好的环境验证：
  - 发送 `/status`、`/usage today`、`/usage all` 看卡片
  - 发送任意消息，等回复完成，点 🔄 / ➡️ / 📋 / 🆕 验证按钮
  - 发送 `/sessions` 看历史列表，点 ▶️ 切换、🗑 删除
  - `/sessions resume <id>`、`/sessions new`、`/sessions delete <id>` 三套子命令

## 风险与备注

- **飞书权限**：需开通 「订阅卡片回调事件」（`card.action.trigger`）。如未开通，按钮点击没有事件回到服务器。CHANGELOG / README 已注明。
- **进程重启 lastPrompt 丢失**：retry 按钮在重启后第一次点会得到「没有可重试」提示。视为预期行为。
- **JSONL 文件膨胀**：长期使用后 `usage-{profile}.jsonl` 会越积越大；本次未做归档/截断。可作为后续增强。
- **`buildStatusCard` 命名冲突**：`compose.ts` 已经有同名函数（在线/离线状态通知），新函数命名 `buildLarkccStatusCard` 与 `buildUsageCard` 避免冲突。
- **会话切换时序**：`session.ts:setSession` 调用 `touchSession({bump:false})` 仅更新 lastUsedAt；下一次 `processResultEvent` 才会 bump msgCount。这避免了双计但也意味着「切换 → 不发消息」不会增加计数。

---

## 实施日志位置

- `docs/impl-log/PHASE-0.md`
- `docs/impl-log/PHASE-1.md`
- `docs/impl-log/PHASE-2.md`
- `docs/impl-log/PHASE-3.md`
- `docs/impl-log/SUMMARY.md`（本文件）
