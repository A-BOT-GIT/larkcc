# Phase 1 实施日志

> /status + /usage 命令与卡片

## 新增文件

- `src/card/status-card.ts`
  - `buildLarkccStatusCard(opts)` — `/status` 卡片
  - `buildUsageCard(opts)` — `/usage` 卡片
  - `UsageRange` 类型：`"today" | "week" | "month" | "all"`

## 修改文件

- `src/commands.ts`
  - `BUILTIN_EXEC` 中将 `/status`、`/s` 重命名为 `/gs`、`/gst`（git status），让位给新的卡片命令
  - 新增 `BUILTIN_CARD_CMD` 常量：`/status` `/st` → `status`；`/usage` `/u` → `usage`；`/sessions` `/ss` → `sessions`
  - `CommandResult.type` 增加 `"card"`，新增 `cardType` 与 `cardArgs` 字段
  - `parseCommand` 中先匹配 `BUILTIN_CARD_CMD`（最高优先级）
  - `buildHelpText` 增加状态与历史命令栏目

- `src/message-handler.ts`
  - 引入 `buildLarkccStatusCard`、`buildUsageCard`、`loadUsage`、`listSessions`、`replyMessage`
  - 新增运行时状态：`messageCount`、`lastPromptByChat`
  - 新增内部辅助：`replyCard`、`rangeToBounds`、`handleCardCommand`
  - 主流程对 `result.type === "card"` 分发到 `handleCardCommand`
  - 调 `runAgent` 前 `messageCount++` 并记录 `lastPromptByChat`
  - `/sessions` 暂留 placeholder，Phase 3 完成

## 关键决策

1. **命名冲突解决**：原 `/status`/`/s` 是 git status 的快捷 EXEC，与 PLAN 新增 `/status` 卡片命令冲突。解决方式：把 git status 重命名为 `/gs`、`/gst`，将 `/status`/`/st` 留给新功能；并在 help 文本中分类列出。
2. **`messageCount` 语义**：每次实际调用 `runAgent` 后递增（不算被命令拦截掉的）；放在 closure 内，进程重启清零。
3. **session 消息数显示**：从 `session-history.ts` 的 `SessionRecord.msgCount` 读取，不维护内存版本。
4. **`/usage` 默认范围**：无参数视为 `today`；`week` = 最近 7×86400 秒；`month` = 当月起始；`all` = 不设下界。
5. **卡片函数命名**：`buildStatusCard` 已被 `compose.ts` 占用（在线/离线通知），新函数命名为 `buildLarkccStatusCard` 避免冲突；导出位置在 `card/status-card.ts`，`message-handler` 直接 import。

## 验证

```
$ pnpm typecheck
> tsc --noEmit
（无错误）
```

UI 功能依赖运行时实际飞书事件回调，本环境为离线 typecheck 验证。

## 备注

- `BUILTIN_CARD_CMD` 优先级高于 EXEC，是为了让用户即使将来添加同名 EXEC 也不会覆盖核心卡片命令。
- `/usage week` 用滚动 7 天（不是自然周）以避免周一刚开始时空数据。
