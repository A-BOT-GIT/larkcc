/**
 * 会话历史：JSONL 存储 + CRUD 查询
 *
 * 存储位置：~/.larkcc/sessions-{profile}.jsonl
 * 每行一个会话记录，按追加 + 重写策略维护。
 */

import fs from "fs";
import path from "path";
import os from "os";

const STATE_DIR = path.join(os.homedir(), ".larkcc");

export interface SessionRecord {
  sessionId: string;
  createdAt: number;     // 秒级
  lastUsedAt: number;    // 秒级
  firstPrompt: string;   // 截断后的首条 prompt
  msgCount: number;
  lastModel?: string;
}

const FIRST_PROMPT_MAX = 120;

function sessionsPath(profile?: string): string {
  const name = !profile || profile === "default" ? "default" : profile;
  return path.join(STATE_DIR, `sessions-${name}.jsonl`);
}

function ensureDir(): void {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function loadAll(profile: string | undefined): SessionRecord[] {
  const file = sessionsPath(profile);
  if (!fs.existsSync(file)) return [];

  const records: SessionRecord[] = [];
  try {
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as SessionRecord);
      } catch {
        // 跳过损坏的行
      }
    }
  } catch (err) {
    console.error("[session-history] loadAll failed:", err);
  }
  return records;
}

function writeAll(profile: string | undefined, records: SessionRecord[]): void {
  try {
    ensureDir();
    const content = records.map(r => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "");
    fs.writeFileSync(sessionsPath(profile), content, "utf8");
  } catch (err) {
    console.error("[session-history] writeAll failed:", err);
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function recordSession(
  profile: string | undefined,
  sessionId: string,
  prompt: string,
  model?: string,
): void {
  const records = loadAll(profile);
  const existing = records.find(r => r.sessionId === sessionId);
  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    // 已存在则补充信息
    existing.lastUsedAt = now;
    existing.msgCount += 1;
    if (model) existing.lastModel = model;
    if (!existing.firstPrompt && prompt) {
      existing.firstPrompt = truncate(prompt, FIRST_PROMPT_MAX);
    }
  } else {
    records.push({
      sessionId,
      createdAt: now,
      lastUsedAt: now,
      firstPrompt: truncate(prompt || "", FIRST_PROMPT_MAX),
      msgCount: 1,
      lastModel: model,
    });
  }

  writeAll(profile, records);
}

export function touchSession(
  profile: string | undefined,
  sessionId: string,
  modelOrOpts?: string | { model?: string; bump?: boolean },
): void {
  const opts = typeof modelOrOpts === "string"
    ? { model: modelOrOpts, bump: true }
    : { model: modelOrOpts?.model, bump: modelOrOpts?.bump ?? true };

  const records = loadAll(profile);
  const existing = records.find(r => r.sessionId === sessionId);
  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    existing.lastUsedAt = now;
    if (opts.bump) existing.msgCount += 1;
    if (opts.model) existing.lastModel = opts.model;
    writeAll(profile, records);
  } else if (opts.bump) {
    // 续接但本地没有记录（例如旧 session）→ 创建一个空 firstPrompt 占位
    records.push({
      sessionId,
      createdAt: now,
      lastUsedAt: now,
      firstPrompt: "",
      msgCount: 1,
      lastModel: opts.model,
    });
    writeAll(profile, records);
  }
}

export function listSessions(
  profile: string | undefined,
  limit = 10,
): SessionRecord[] {
  const records = loadAll(profile);
  records.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  return records.slice(0, limit);
}

export function deleteSession(
  profile: string | undefined,
  sessionId: string,
): boolean {
  const records = loadAll(profile);
  const idx = records.findIndex(r => r.sessionId === sessionId);
  if (idx < 0) return false;
  records.splice(idx, 1);
  writeAll(profile, records);
  return true;
}

/**
 * 通过短 id（前缀）查找会话；支持完整 id 与 6 位短匹配。
 * 若有歧义返回 null。
 */
export function findSessionByShortId(
  profile: string | undefined,
  shortId: string,
): SessionRecord | null {
  if (!shortId) return null;
  const records = loadAll(profile);
  const direct = records.find(r => r.sessionId === shortId);
  if (direct) return direct;

  const matches = records.filter(r => r.sessionId.startsWith(shortId));
  if (matches.length === 1) return matches[0];
  return null;
}
