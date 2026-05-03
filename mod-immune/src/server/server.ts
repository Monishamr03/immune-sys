import type { IncomingMessage, ServerResponse } from "node:http";
import { context, reddit, redis } from "@devvit/web/server";
import type {
  PartialJsonValue,
  TriggerResponse,
  UiResponse,
} from "@devvit/web/shared";
import {
  ApiEndpoint,
  type DecrementRequest,
  type DecrementResponse,
  type IncrementRequest,
  type IncrementResponse,
  type InitResponse,
} from "../shared/api.ts";
import { once } from "node:events";

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`;
    console.error(msg);
    writeJSON<ErrorResponse>(500, { error: msg, status: 500 }, rsp);
  }
}

async function onRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  const url = req.url;

  if (!url || url === "/") {
    writeJSON<ErrorResponse>(404, { error: "not found", status: 404 }, rsp);
    return;
  }

  if (url === "/api/health-scan") {
    const body = await onHealthScan();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/toxicity-scan") {
    const body = await onToxicityScan();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/raid-scan") {
    const body = await onRaidScan();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/burnout-scan") {
    const body = await onBurnoutScan();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/remove-post") {
    const body = await onRemovePost(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/lock-post") {
    const body = await onLockPost(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/approve-post") {
    const body = await onApprovePost(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/ban-user") {
    const body = await onBanUser(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  // ── NEW FEATURE ENDPOINTS ──────────────────────────────────────────────────

  // Feature 3: Custom Keywords — get/save
  if (url === "/api/get-keywords") {
    const body = await onGetKeywords();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/save-keywords") {
    const body = await onSaveKeywords(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  // Feature 2: Mod Action History Log — get/add
  if (url === "/api/get-action-log") {
    const body = await onGetActionLog();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/add-action-log") {
    const body = await onAddActionLog(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  // Feature 1: Auto-mod Rules — get/save/run
  if (url === "/api/get-automod-rules") {
    const body = await onGetAutomodRules();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/save-automod-rules") {
    const body = await onSaveAutomodRules(req);
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  if (url === "/api/run-automod") {
    const body = await onRunAutomod();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  // Feature 4: Daily Health Report
  if (url === "/api/get-health-history") {
    const body = await onGetHealthHistory();
    writeJSON<PartialJsonValue>(200, body, rsp);
    return;
  }

  // ──────────────────────────────────────────────────────────────────────────

  const endpoint = url as ApiEndpoint;
  let body: ApiResponse | UiResponse | ErrorResponse;
  switch (endpoint) {
    case ApiEndpoint.Init:
      body = await onInit();
      break;
    case ApiEndpoint.Increment:
      body = await onIncrement(req);
      break;
    case ApiEndpoint.Decrement:
      body = await onDecrement(req);
      break;
    case ApiEndpoint.OnPostCreate:
      body = await onMenuNewPost();
      break;
    case ApiEndpoint.OnAppInstall:
      body = await onAppInstall();
      break;
    default:
      endpoint satisfies never;
      body = { error: "not found", status: 404 };
      break;
  }

  writeJSON<PartialJsonValue>("status" in body ? body.status : 200, body, rsp);
}

type ApiResponse = InitResponse | IncrementResponse | DecrementResponse;
type ErrorResponse = { error: string; status: number; };

function getPostId(): string {
  if (!context.postId) throw Error("no post ID");
  return context.postId;
}

function getPostCountKey(postId: string): string {
  return `count:${postId}`;
}

async function onInit(): Promise<InitResponse> {
  const postId = getPostId();
  const count = Number((await redis.get(getPostCountKey(postId))) ?? 0);
  return { type: "init", postId, count, username: context.username ?? "user" };
}

async function onIncrement(req: IncomingMessage): Promise<IncrementResponse> {
  const postId = getPostId();
  const { amount } = await readJSON<IncrementRequest>(req).catch(() => ({ amount: 1 }));
  const incrementBy = Number.isFinite(amount) ? amount : 1;
  const count = await redis.incrBy(getPostCountKey(postId), incrementBy);
  return { type: "increment", postId, count };
}

async function onDecrement(req: IncomingMessage): Promise<DecrementResponse> {
  const postId = getPostId();
  const { amount } = await readJSON<DecrementRequest>(req).catch(() => ({ amount: 1 }));
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  const decrementBy = Number.isFinite(parsedAmount) ? parsedAmount : 1;
  const count = Number(await redis.incrBy(getPostCountKey(postId), -decrementBy));
  return { type: "decrement", postId, count };
}

async function onMenuNewPost(): Promise<UiResponse> {
  const post = await reddit.submitCustomPost({ title: context.appName });
  return {
    showToast: { text: `Post ${post.id} created.`, appearance: "success" },
    navigateTo: post.url,
  };
}

async function onAppInstall(): Promise<TriggerResponse> {
  return {};
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function normalizeRedditId(id: string, type: "post" | "comment"): string {
  const stripped = id.replace(/^(t1_|t3_)+/, "");
  return type === "comment" ? `t1_${stripped}` : `t3_${stripped}`;
}

// Returns the subreddit-scoped Redis key (safe even if postId is unavailable)
function subKey(suffix: string): string {
  return `sub:${context.subredditName ?? "global"}:${suffix}`;
}

// ── EXISTING MOD ACTIONS ─────────────────────────────────────────────────────

async function onRemovePost(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { postId, itemType } = await readJSON<{ postId: string; itemType?: string }>(req);
    const isComment = itemType === "comment" || postId.includes("t1_");
    const fullId = normalizeRedditId(postId, isComment ? "comment" : "post");
    console.log(`Removing ${isComment ? "comment" : "post"}: ${fullId}`);
    await reddit.remove(fullId, false);
    // Log the action
    await addActionLogEntry({
      action: "remove",
      targetId: fullId,
      targetType: isComment ? "comment" : "post",
      mod: context.username ?? "mod",
    });
    return { success: true, message: "Removed successfully", postId };
  } catch (error) {
    return { success: false, message: `Failed to remove: ${error}` };
  }
}

async function onLockPost(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { postId } = await readJSON<{ postId: string }>(req);
    const fullId = normalizeRedditId(postId, "post");
    await reddit.lock(fullId);
    await addActionLogEntry({
      action: "lock",
      targetId: fullId,
      targetType: "post",
      mod: context.username ?? "mod",
    });
    return { success: true, message: "Post locked successfully", postId };
  } catch (error) {
    return { success: false, message: `Failed to lock: ${error}` };
  }
}

async function onApprovePost(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { postId, itemType } = await readJSON<{ postId: string; itemType?: string }>(req);
    const isComment = itemType === "comment" || postId.includes("t1_");
    const fullId = normalizeRedditId(postId, isComment ? "comment" : "post");
    await reddit.approve(fullId);
    await addActionLogEntry({
      action: "approve",
      targetId: fullId,
      targetType: isComment ? "comment" : "post",
      mod: context.username ?? "mod",
    });
    return { success: true, message: "Approved successfully", postId };
  } catch (error) {
    return { success: false, message: `Failed to approve: ${error}` };
  }
}

async function onBanUser(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { username, subredditName } = await readJSON<{ username: string; subredditName: string }>(req);
    await reddit.banUser({
      subredditName,
      username,
      duration: 1,
      reason: "Flagged by SubReddit Immune System",
    });
    await addActionLogEntry({
      action: "ban",
      targetId: username,
      targetType: "user",
      mod: context.username ?? "mod",
    });
    return { success: true, message: `u/${username} banned successfully` };
  } catch (error) {
    return { success: false, message: `Failed to ban: ${error}` };
  }
}

// ── FEATURE 2: MOD ACTION HISTORY LOG ────────────────────────────────────────

interface ActionLogEntry {
  action: string;      // "remove" | "lock" | "approve" | "ban" | "automod"
  targetId: string;
  targetType: string;  // "post" | "comment" | "user"
  mod: string;
  timestamp: number;
  note?: string;
}

async function addActionLogEntry(entry: Omit<ActionLogEntry, "timestamp">): Promise<void> {
  try {
    const key = subKey("action-log");
    const existing = await redis.get(key);
    const log: ActionLogEntry[] = existing ? JSON.parse(existing) : [];
    log.unshift({ ...entry, timestamp: Date.now() }); // newest first
    // Keep last 100 entries
    if (log.length > 100) log.splice(100);
    await redis.set(key, JSON.stringify(log));
  } catch (e) {
    console.log("Failed to write action log:", e);
  }
}

async function onGetActionLog(): Promise<PartialJsonValue> {
  try {
    const key = subKey("action-log");
    const existing = await redis.get(key);
    const log: ActionLogEntry[] = existing ? JSON.parse(existing) : [];
    return { success: true, log };
  } catch (error) {
    return { success: false, log: [], message: `${error}` };
  }
}

async function onAddActionLog(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const entry = await readJSON<Omit<ActionLogEntry, "timestamp">>(req);
    await addActionLogEntry(entry);
    return { success: true };
  } catch (error) {
    return { success: false, message: `${error}` };
  }
}

// ── FEATURE 3: CUSTOM KEYWORD LIST ───────────────────────────────────────────

const DEFAULT_KEYWORDS = [
  "hate", "kill", "stupid", "idiot", "trash", "spam",
  "scam", "fake", "die", "attack", "ban", "raid"
];

async function getKeywords(): Promise<string[]> {
  try {
    const key = subKey("keywords");
    const stored = await redis.get(key);
    if (stored) return JSON.parse(stored);
    return DEFAULT_KEYWORDS;
  } catch {
    return DEFAULT_KEYWORDS;
  }
}

async function onGetKeywords(): Promise<PartialJsonValue> {
  const keywords = await getKeywords();
  return { success: true, keywords };
}

async function onSaveKeywords(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { keywords } = await readJSON<{ keywords: string[] }>(req);
    const sanitized = keywords
      .map((k: string) => k.trim().toLowerCase())
      .filter((k: string) => k.length > 0);
    const key = subKey("keywords");
    await redis.set(key, JSON.stringify(sanitized));
    return { success: true, keywords: sanitized };
  } catch (error) {
    return { success: false, message: `Failed to save keywords: ${error}` };
  }
}

// ── FEATURE 1: AUTO-MOD RULES ────────────────────────────────────────────────

interface AutomodRule {
  enabled: boolean;
  action: "remove" | "lock" | "none";
  threshold: number; // risk score threshold 0-100 to trigger auto-action
  targetType: "posts" | "comments" | "both";
}

const DEFAULT_AUTOMOD_RULES: AutomodRule = {
  enabled: false,
  action: "remove",
  threshold: 75,
  targetType: "both",
};

async function onGetAutomodRules(): Promise<PartialJsonValue> {
  try {
    const key = subKey("automod-rules");
    const stored = await redis.get(key);
    const rules: AutomodRule = stored ? JSON.parse(stored) : DEFAULT_AUTOMOD_RULES;
    return { success: true, rules };
  } catch (error) {
    return { success: false, rules: DEFAULT_AUTOMOD_RULES, message: `${error}` };
  }
}

async function onSaveAutomodRules(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { rules } = await readJSON<{ rules: AutomodRule }>(req);
    const key = subKey("automod-rules");
    await redis.set(key, JSON.stringify(rules));
    return { success: true, rules };
  } catch (error) {
    return { success: false, message: `Failed to save rules: ${error}` };
  }
}

async function onRunAutomod(): Promise<PartialJsonValue> {
  try {
    const rulesKey = subKey("automod-rules");
    const stored = await redis.get(rulesKey);
    const rules: AutomodRule = stored ? JSON.parse(stored) : DEFAULT_AUTOMOD_RULES;

    if (!rules.enabled) {
      return { success: true, actionsCount: 0, message: "Auto-mod is disabled", actions: [] };
    }

    const keywords = await getKeywords();
    const subreddit = await reddit.getCurrentSubreddit();
    const posts = await reddit.getNewPosts({
      subredditName: subreddit.name,
      limit: 10,
    }).all();

    const actions: string[] = [];
    let actionsCount = 0;

    // Check posts
    if (rules.targetType === "posts" || rules.targetType === "both") {
      for (const post of posts) {
        if (post.authorName === "mod-immune") continue;
        const text = (post.title + " " + (post.body ?? "")).toLowerCase();
        const matches = keywords.filter((k: string) => text.includes(k));
        const riskScore = Math.min(100, matches.length * 25);
        if (riskScore >= rules.threshold) {
          const fullId = normalizeRedditId(post.id, "post");
          try {
            if (rules.action === "remove") {
              await reddit.remove(fullId, false);
              actions.push(`Removed post: "${post.title.slice(0, 40)}..."`);
            } else if (rules.action === "lock") {
              await reddit.lock(fullId);
              actions.push(`Locked post: "${post.title.slice(0, 40)}..."`);
            }
            await addActionLogEntry({
              action: `automod-${rules.action}`,
              targetId: fullId,
              targetType: "post",
              mod: "AutoMod",
              note: `Risk score: ${riskScore}, triggers: ${matches.join(", ")}`,
            });
            actionsCount++;
          } catch (e) {
            console.log("Automod post action failed:", e);
          }
        }
      }
    }

    // Check comments
    if (rules.targetType === "comments" || rules.targetType === "both") {
      for (const post of posts.slice(0, 5)) {
        try {
          const comments = await reddit.getComments({ postId: post.id, limit: 10 }).all();
          for (const comment of comments) {
            const text = (comment.body ?? "").toLowerCase();
            const matches = keywords.filter((k: string) => text.includes(k));
            const riskScore = Math.min(100, matches.length * 25);
            if (riskScore >= rules.threshold) {
              const rawId = comment.id.replace(/^(t1_|t3_)+/, "");
              const fullId = normalizeRedditId(rawId, "comment");
              try {
                if (rules.action === "remove") {
                  await reddit.remove(fullId, false);
                  actions.push(`Removed comment by u/${comment.authorName ?? "unknown"}`);
                }
                await addActionLogEntry({
                  action: `automod-${rules.action}`,
                  targetId: fullId,
                  targetType: "comment",
                  mod: "AutoMod",
                  note: `Risk score: ${riskScore}, triggers: ${matches.join(", ")}`,
                });
                actionsCount++;
              } catch (e) {
                console.log("Automod comment action failed:", e);
              }
            }
          }
        } catch (e) {
          console.log("Comment fetch error in automod:", e);
        }
      }
    }

    return { success: true, actionsCount, actions, message: `Auto-mod ran: ${actionsCount} actions taken` };
  } catch (error) {
    return { success: false, actionsCount: 0, actions: [], message: `Auto-mod error: ${error}` };
  }
}

// ── FEATURE 4: HEALTH HISTORY / DAILY REPORT ─────────────────────────────────

async function onGetHealthHistory(): Promise<PartialJsonValue> {
  try {
    const key = subKey("health-history");
    const stored = await redis.get(key);
    const history = stored ? JSON.parse(stored) : [];
    return { success: true, history };
  } catch (error) {
    return { success: false, history: [], message: `${error}` };
  }
}

async function saveHealthSnapshot(score: number, flaggedCount: number, totalPosts: number): Promise<void> {
  try {
    const key = subKey("health-history");
    const stored = await redis.get(key);
    const history: any[] = stored ? JSON.parse(stored) : [];
    history.unshift({
      score,
      flaggedCount,
      totalPosts,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    // Keep last 14 entries (2 weeks)
    if (history.length > 14) history.splice(14);
    await redis.set(key, JSON.stringify(history));
  } catch (e) {
    console.log("Failed to save health snapshot:", e);
  }
}

// ── SCANS ────────────────────────────────────────────────────────────────────

async function onHealthScan(): Promise<PartialJsonValue> {
  const subreddit = await reddit.getCurrentSubreddit();
  const posts = await reddit.getNewPosts({
    subredditName: subreddit.name,
    limit: 25,
  }).all();

  const totalPosts = posts.length;
  const flaggedPostsList = posts.filter(p =>
    (p.isSpam || p.isLocked) && p.authorName !== "mod-immune"
  );
  const flaggedCount = flaggedPostsList.length;
  const healthScore = Math.max(0, 100 - (flaggedCount * 10));
  const status = healthScore >= 80 ? "Healthy" : healthScore >= 50 ? "At Risk" : "Critical";

  // Auto-save snapshot for health history (Feature 4)
  await saveHealthSnapshot(healthScore, flaggedCount, totalPosts);

  const flaggedDetails = flaggedPostsList.map(p => ({
    id: p.id,
    title: p.title,
    author: p.authorName ?? "unknown",
    reason: p.isSpam ? "Spam" : "Locked",
    url: p.url,
  }));

  const recentPosts = posts.slice(0, 5).map(p => ({
    id: p.id,
    title: p.title,
    author: p.authorName ?? "unknown",
    url: p.url,
  }));

  return {
    healthScore,
    totalPosts,
    flaggedCount,
    flaggedDetails,
    recentPosts,
    subredditName: subreddit.name,
    members: subreddit.numberOfSubscribers,
    status,
  };
}

async function onToxicityScan(): Promise<PartialJsonValue> {
  const subreddit = await reddit.getCurrentSubreddit();
  const posts = await reddit.getNewPosts({
    subredditName: subreddit.name,
    limit: 10,
  }).all();

  // Feature 3: use custom keywords from Redis instead of hardcoded list
  const toxicKeywords = await getKeywords();

  const riskyPosts = posts.map(post => {
    const text = (post.title + " " + (post.body ?? "")).toLowerCase();
    const matches = toxicKeywords.filter((k: string) => text.includes(k));
    const riskScore = Math.min(100, matches.length * 25);
    return {
      id: post.id,
      title: post.title,
      author: post.authorName ?? "unknown",
      url: post.url,
      type: "post",
      riskScore,
      riskLevel: riskScore >= 75 ? "High" : riskScore >= 25 ? "Medium" : "Low",
      triggers: matches,
    };
  }).filter(p => p.riskScore > 0 && p.author !== "mod-immune");

  const riskyComments: any[] = [];
  try {
    for (const post of posts.slice(0, 5)) {
      const comments = await reddit.getComments({
        postId: post.id,
        limit: 10,
      }).all();

      for (const comment of comments) {
        const text = (comment.body ?? "").toLowerCase();
        const matches = toxicKeywords.filter((k: string) => text.includes(k));
        if (matches.length > 0) {
          const riskScore = Math.min(100, matches.length * 25);
          const rawCommentId = comment.id.replace(/^(t1_|t3_)+/, "");
          riskyComments.push({
            id: rawCommentId,
            title: (comment.body?.slice(0, 80) ?? "comment") + "...",
            author: comment.authorName ?? "unknown",
            url: `https://reddit.com${(comment as any).permalink ?? ""}`,
            type: "comment",
            riskScore,
            riskLevel: riskScore >= 75 ? "High" : riskScore >= 25 ? "Medium" : "Low",
            triggers: matches,
          });
        }
      }
    }
  } catch (e) {
    console.log("Comment scan error:", e);
  }

  const allRisky = [...riskyPosts, ...riskyComments];

  return {
    riskyPosts: allRisky,
    totalAnalyzed: posts.length,
    highRiskCount: allRisky.filter(p => p.riskLevel === "High").length,
    commentCount: riskyComments.length,
  };
}

async function onRaidScan(): Promise<PartialJsonValue> {
  const subreddit = await reddit.getCurrentSubreddit();
  const posts = await reddit.getNewPosts({
    subredditName: subreddit.name,
    limit: 25,
  }).all();

  const uniqueAuthors = new Set(posts.map(p => p.authorName));
  const raidScore = Math.min(100, uniqueAuthors.size * 5);
  const raidRisk = raidScore >= 70 ? "High" : raidScore >= 40 ? "Medium" : "Low";

  const suspiciousUsers = await Promise.all(
    [...uniqueAuthors].map(async (author) => {
      let accountAgeDays = 999;
      let accountAgeLabel = "unknown";
      try {
        if (author) {
          const user = await reddit.getUserByUsername(author);
          const createdAt = (user as any).createdAt ?? (user as any).created_utc;
          if (createdAt) {
            const created = typeof createdAt === "number"
              ? new Date(createdAt * 1000)
              : new Date(createdAt);
            accountAgeDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
            accountAgeLabel = accountAgeDays < 7
              ? `🚨 ${accountAgeDays}d old`
              : accountAgeDays < 30
              ? `⚠️ ${accountAgeDays}d old`
              : `${accountAgeDays}d old`;
          }
        }
      } catch {
        accountAgeLabel = "unknown";
      }

      return {
        author: author ?? "unknown",
        postCount: posts.filter(p => p.authorName === author).length,
        accountAgeDays,
        accountAgeLabel,
        isNewAccount: accountAgeDays < 30,
        posts: posts.filter(p => p.authorName === author).map(p => ({
          id: p.id,
          title: p.title,
          url: p.url,
        })),
      };
    })
  );

  suspiciousUsers.sort((a, b) => b.postCount - a.postCount);
  const newAccountCount = suspiciousUsers.filter(u => u.isNewAccount).length;

  return {
    raidRisk,
    raidScore,
    recentComments: posts.length,
    uniqueAuthors: uniqueAuthors.size,
    newAccountActivity: newAccountCount,
    suspiciousUsers,
    subredditName: subreddit.name,
  };
}

async function onBurnoutScan(): Promise<PartialJsonValue> {
  const subreddit = await reddit.getCurrentSubreddit();
  const modLog = await reddit.getModerationLog({
    subredditName: subreddit.name,
    limit: 50,
  }).all();

  const modActivity: Record<string, number> = {};
  const modActions: Record<string, string[]> = {};

  for (const entry of modLog) {
    const mod = (entry as any).moderatorName ?? (entry as any).mod ?? "unknown";
    modActivity[mod] = (modActivity[mod] ?? 0) + 1;
    if (!modActions[mod]) modActions[mod] = [];
    modActions[mod].push((entry as any).action ?? "unknown action");
  }

  const mods = Object.entries(modActivity).map(([name, actions]) => ({
    name,
    actions,
    recentActions: modActions[name]?.slice(0, 3) ?? [],
    burnoutLevel: actions >= 20 ? "High" : actions >= 10 ? "Medium" : "Low",
  }));

  return {
    mods,
    totalActions: modLog.length,
    overloadedMods: mods.filter(m => m.burnoutLevel === "High").length,
    subredditName: subreddit.name,
  };
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function writeJSON<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json);
  const len = Buffer.byteLength(body);
  rsp.writeHead(status, {
    "Content-Length": len,
    "Content-Type": "application/json",
  });
  rsp.end(body);
}

async function readJSON<T>(req: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  await once(req, "end");
  return JSON.parse(`${Buffer.concat(chunks)}`);
}