/**
 * 卡片按钮回调处理器
 *
 * 飞书卡片按钮点击会触发 `card.action.trigger_v1` 事件，本处理器：
 * 1. 解析 action.value.type（按钮类型）
 * 2. 路由到 retry / continue / new_session / copy / resume_session / delete_session
 *
 * 依赖外部传入 message-handler 的 runAgentForChat / lastPrompt 接口。
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { sendText } from "./client/index.js";
import { logger } from "./logger.js";
import { clearSession, setSession } from "./session.js";
import { deleteSession, findSessionByShortId } from "./session-history.js";
import type { LarkccConfig } from "./config.js";
import type { RunAgentResult } from "./claude.js";

export interface CardActionDeps {
  client: lark.Client;
  config: LarkccConfig;
  profile: string | undefined;
  runAgentForChat: (opts: { prompt: string; chatId: string; rootMsgId: string; onCardCreated?: () => void }) => Promise<RunAgentResult | "errored">;
  getLastPrompt: (chatId: string) => string | undefined;
  setLastPrompt: (chatId: string, prompt: string) => void;
}

interface CardActionEvent {
  // 兼容两种载荷：
  //   (a) SDK 已 normalize 为顶层 camelCase（messageId/chatId/operator.openId）
  //   (b) 原始事件未 normalize，字段在 event.context.* 下 snake_case
  messageId?: string;
  chatId?: string;
  context?: {
    open_message_id?: string;
    open_chat_id?: string;
  };
  open_message_id?: string;
  open_chat_id?: string;
  operator?: {
    openId?: string;
    open_id?: string;
    userId?: string;
    user_id?: string;
    name?: string;
  };
  action?: { value?: unknown; tag?: string; name?: string; option?: string };
  raw?: unknown;
}

export function createCardActionHandler(deps: CardActionDeps) {
  const { client, config, profile, runAgentForChat, getLastPrompt, setLastPrompt } = deps;

  return async (event: CardActionEvent): Promise<void> => {
    const senderId =
      event.operator?.openId ??
      event.operator?.open_id ??
      "";
    const rawValue = event.action?.value;
    const value: Record<string, unknown> = (rawValue && typeof rawValue === "object")
      ? rawValue as Record<string, unknown>
      : {};
    const chatId =
      event.chatId ??
      event.context?.open_chat_id ??
      event.open_chat_id;
    const rootMsgId =
      event.messageId ??
      event.context?.open_message_id ??
      event.open_message_id;

    if (!chatId || !rootMsgId) {
      logger.warn(`[card-action] missing chatId or rootMsgId; keys=${Object.keys(event).join(",")}`);
      return;
    }

    // owner 校验：和 message-handler 的逻辑一致，只接收 owner
    const owner = config.feishu.owner_open_id;
    if (owner && senderId && senderId !== owner) {
      logger.warn(`[card-action] ignored from non-owner: ${senderId}`);
      return;
    }

    const type = String(value.type ?? "");
    logger.info(`[card-action] type=${type}`);

    try {
      const CARD_CREATE_TIMEOUT_MS = 2500;
      const waitForCardOrTimeout = (run: (onCreated: () => void) => void): Promise<void> =>
        new Promise<void>((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          run(finish);
          setTimeout(finish, CARD_CREATE_TIMEOUT_MS);
        });

      // 状态指示走 rootMsgId 上的 reaction：入口 Typing → 完成 DONE / 失败 OnIt。
      // 卡片完成后飞书对单 element 的 patch / update 会被前端回滚，所以按钮文字保持不变。
      const runWithButtonState = (opts: {
        prompt: string;
        chatId: string;
        rootMsgId: string;
        onCreated: () => void;
        label: string;
      }): void => {
        const { prompt, chatId, rootMsgId, onCreated, label } = opts;

        const reactionIdPromise: Promise<string | undefined> = client.im.messageReaction
          .create({
            path: { message_id: rootMsgId },
            data: { reaction_type: { emoji_type: config.reaction?.processing ?? "Typing" } },
          })
          .then((r) => r.data?.reaction_id)
          .catch((e) => {
            logger.warn(`[card-action] ${label} reaction create failed: ${String(e)}`);
            return undefined;
          });

        void runAgentForChat({ prompt, chatId, rootMsgId, onCardCreated: onCreated })
          .then(async (result) => {
            const reactionId = await reactionIdPromise;
            if (reactionId) {
              await client.im.messageReaction
                .delete({ path: { message_id: rootMsgId, reaction_id: reactionId } })
                .catch(() => {});
            }
            const finalEmoji =
              result === "completed"
                ? (config.reaction?.done ?? "DONE")
                : (config.reaction?.error ?? "OnIt");
            await client.im.messageReaction
              .create({
                path: { message_id: rootMsgId },
                data: { reaction_type: { emoji_type: finalEmoji } },
              })
              .catch((e) => logger.warn(`[card-action] ${label} reaction final failed: ${String(e)}`));
          })
          .catch(async (err) => {
            logger.error(`[card-action] ${label} runAgent failed: ${String(err)}`);
            const reactionId = await reactionIdPromise;
            if (reactionId) {
              await client.im.messageReaction
                .delete({ path: { message_id: rootMsgId, reaction_id: reactionId } })
                .catch(() => {});
            }
            await client.im.messageReaction
              .create({
                path: { message_id: rootMsgId },
                data: { reaction_type: { emoji_type: config.reaction?.error ?? "OnIt" } },
              })
              .catch(() => {});
          });
      };

      switch (type) {
        case "retry": {
          const last = getLastPrompt(chatId);
          if (!last) {
            await sendText(client, chatId, "❌ 没有可重试的上一条 prompt。");
            return;
          }
          await waitForCardOrTimeout((onCreated) => {
            runWithButtonState({
              prompt: last,
              chatId,
              rootMsgId,
              onCreated,
              label: "retry",
            });
          });
          return;
        }

        case "continue": {
          const prompt = "继续";
          setLastPrompt(chatId, prompt);
          await waitForCardOrTimeout((onCreated) => {
            runWithButtonState({
              prompt,
              chatId,
              rootMsgId,
              onCreated,
              label: "continue",
            });
          });
          return;
        }

        case "new_session": {
          clearSession();
          await sendText(client, chatId, "✅ 新会话已开启，下一条消息将以全新上下文开始。");
          return;
        }

        case "copy": {
          const text = String(value.text ?? "");
          if (!text) {
            await sendText(client, chatId, "（未携带可复制内容）");
            return;
          }
          await sendText(client, chatId, text);
          return;
        }

        case "resume_session": {
          const sid = String(value.sessionId ?? "");
          if (!sid) {
            await sendText(client, chatId, "❌ 缺少 sessionId");
            return;
          }
          const found = findSessionByShortId(profile, sid);
          if (!found) {
            await sendText(client, chatId, `❌ 未找到会话：${sid}`);
            return;
          }
          setSession(found.sessionId);
          await sendText(client, chatId, `✅ 已切换到会话 \`${found.sessionId.slice(0, 8)}\`，下一条消息将续接。`);
          return;
        }

        case "delete_session": {
          const sid = String(value.sessionId ?? "");
          if (!sid) {
            await sendText(client, chatId, "❌ 缺少 sessionId");
            return;
          }
          const ok = deleteSession(profile, sid);
          await sendText(client, chatId, ok ? `🗑 已删除会话 \`${sid.slice(0, 8)}\`` : `❌ 未找到会话：${sid}`);
          return;
        }

        default:
          logger.warn(`[card-action] unknown type: ${type}`);
          await sendText(client, chatId, `⚠️ 未知按钮：${type}`);
      }
    } catch (err) {
      logger.error(`[card-action] error: ${String(err)}`);
      await sendText(client, chatId, `❌ 操作失败：${String(err)}`);
    }
  };
}
