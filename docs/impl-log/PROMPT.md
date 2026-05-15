# larkcc v0.14 Headless 实施 Prompt

你是 larkcc v0.14 的实施工程师。当前工作目录是 `/home/zza/larkcc-v0.14`。

## 任务

严格按照 `docs/v0.14-PLAN.md` 的内容，端到端实施 larkcc v0.14 的全部四个阶段。计划文件你必须完整读完一遍再开始动手。

## 工作要求

1. **严格遵循 PLAN**：文件名、改动点、命令名、卡片字段、按钮动作类型都按 PLAN 来。
2. **代码风格**：模仿现有 src/ 下的 TypeScript 代码风格、命名约定、模块边界，不要引入新依赖。
3. **零侵入**：Phase 0 数据采集必须像 PLAN 写的那样在 `processResultEvent` 末尾接入，不要改变现有流程。
4. **每个 Phase 完成后**：
   - 跑 `pnpm tsc --noEmit`（或 `pnpm build` 如有）验证通过
   - 在 `docs/impl-log/PHASE-<N>.md` 写实现日志：列出新增/修改的文件、关键决策、踩坑、验证命令和结果
5. **最后**：
   - 更新 `CHANGELOG.md`，按现有格式追加 v0.14 条目
   - 更新 `README.md` 介绍三个新功能
   - 跑 `pnpm build` 完整构建一次确保无错
   - 写 `docs/impl-log/SUMMARY.md` 总览

## 实施顺序

### Phase 0: 共享基础设施
- 新建 `src/usage-stats.ts`：JSONL 存储 + 三个方法
- 新建 `src/session-history.ts`：JSONL 存储 + 四个方法
- 在 `src/claude.ts:processResultEvent` 末尾接入两者
- 提交点：tsc 通过 + 写 impl-log

### Phase 1: /status + /usage 命令
- 新建 `src/card/status-card.ts`：buildStatusCard、buildUsageCard
- `src/commands.ts` 注册新命令分类 `BUILTIN_CARD_CMD`，注册 `/status` 和 `/usage [today|week|month|all]`
- `src/message-handler.ts` 加 `messageCount` 计数和 `card` 类型分发

### Phase 2: 卡片快捷按钮
- `src/card/elements.ts` 加 `button(text, value, type)`、`actionPayload`
- `src/card/containers.ts` 加 `buttonRow`
- `src/client/cardkit.ts` 的 `buildFinalCard` 末尾追加按钮行
- 新建 `src/card-action-handler.ts`：retry / continue / new_session / copy
- `src/app.ts` 注册 `card.action.trigger_v1` 事件
- `src/message-handler.ts` 加 `lastPrompt`（按 chatId）并提取 `runAgentForChat`

### Phase 3: /sessions 会话历史
- 新建 `src/card/sessions-card.ts`
- `src/commands.ts` 注册 `/sessions` / `/ss` 及子命令 `resume|new|delete`，id 支持前 6 位短匹配
- `src/session.ts` 的 `setSession` 同步调 `recordSession`/`touchSession`
- `src/claude.ts` 中根据是否新 session 调对应方法、记录 firstPrompt
- `src/card-action-handler.ts` 加 `resume_session`、`delete_session` action

### Phase 4: 联调测试、文档
- 完整 build 一次
- 更新 CHANGELOG/README
- 写 SUMMARY

## 输出要求

执行过程不要询问任何确认。所有路径都可以直接读写。最后输出本次 session 的总结。

## 现在开始

第一步：读 `docs/v0.14-PLAN.md` 和 `package.json`、`tsconfig.json`、`src/` 主要文件，建立全局认识。
第二步：开始 Phase 0。
