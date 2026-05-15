/**
 * 使用统计：JSONL 存储 + 聚合查询
 *
 * 只记录原始使用数据（tokens、工具次数、时长），不计算费用。
 * 存储位置：~/.larkcc/usage-{profile}.jsonl
 */

import fs from "fs";
import path from "path";
import os from "os";

const STATE_DIR = path.join(os.homedir(), ".larkcc");

export interface UsageEntry {
  ts: number;                  // 秒级时间戳
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  toolCount: number;
  elapsedSec: number;
}

export interface AggregatedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  toolCount: number;
  conversations: number;
  elapsedSec: number;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    toolCount: number;
    conversations: number;
    elapsedSec: number;
  }>;
}

function usagePath(profile?: string): string {
  const name = !profile || profile === "default" ? "default" : profile;
  return path.join(STATE_DIR, `usage-${name}.jsonl`);
}

function ensureDir(): void {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

export function recordUsage(profile: string | undefined, entry: UsageEntry): void {
  try {
    ensureDir();
    fs.appendFileSync(usagePath(profile), JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    // 静默失败，不影响主流程
    console.error("[usage-stats] recordUsage failed:", err);
  }
}

export function loadUsage(
  profile: string | undefined,
  since?: number,
  until?: number,
): UsageEntry[] {
  const file = usagePath(profile);
  if (!fs.existsSync(file)) return [];

  const entries: UsageEntry[] = [];
  try {
    const content = fs.readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as UsageEntry;
        if (since !== undefined && entry.ts < since) continue;
        if (until !== undefined && entry.ts > until) continue;
        entries.push(entry);
      } catch {
        // 跳过损坏的行
      }
    }
  } catch (err) {
    console.error("[usage-stats] loadUsage failed:", err);
  }
  return entries;
}

export function aggregateUsage(entries: UsageEntry[]): AggregatedUsage {
  const result: AggregatedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    toolCount: 0,
    conversations: 0,
    elapsedSec: 0,
    byModel: {},
  };

  for (const e of entries) {
    result.inputTokens += e.inputTokens;
    result.outputTokens += e.outputTokens;
    result.cacheReadTokens += e.cacheReadTokens;
    result.cacheCreationTokens += e.cacheCreationTokens;
    result.toolCount += e.toolCount;
    result.conversations += 1;
    result.elapsedSec += e.elapsedSec;

    const model = e.model || "unknown";
    if (!result.byModel[model]) {
      result.byModel[model] = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        toolCount: 0,
        conversations: 0,
        elapsedSec: 0,
      };
    }
    const m = result.byModel[model];
    m.inputTokens += e.inputTokens;
    m.outputTokens += e.outputTokens;
    m.cacheReadTokens += e.cacheReadTokens;
    m.cacheCreationTokens += e.cacheCreationTokens;
    m.toolCount += e.toolCount;
    m.conversations += 1;
    m.elapsedSec += e.elapsedSec;
  }

  return result;
}
