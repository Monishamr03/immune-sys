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

// Helper: strips any existing t1_/t3_ prefix (prevents double-prefix bug)
// then applies the correct one based on type
function normalizeRedditId(id: string, type: "post" | "comment"): string {
  const stripped = id.replace(/^(t1_|t3_)+/, "");
  return type === "comment" ? `t1_${stripped}` : `t3_${stripped}`;
}

// FIXED: Uses itemType sent from splash.ts to know if it's a comment or post
// This prevents the double-prefix bug (t1_t1_xxx) that caused "Remove failed"
async function onRemovePost(req: IncomingMessage): Promise<PartialJsonValue> {
  try {
    const { postId, itemType } = await readJSON<{ postId: string; itemType?: string }>(req);
    const isComment = itemType === "comment" || postId.includes("t1_");
    const fullId = normalizeRedditId(postId, isComment ? "comment" : "post");
    console.log(`Removing ${isComment ? "comment" : "post"}: ${fullId}`);
    await reddit.remove(fullId, false);
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
    return { success: true, message: `u/${username} banned successfully` };
  } catch (error) {
    return { success: false, message: `Failed to ban: ${error}` };
  }
}

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

// Scans posts AND comments per post
async function onToxicityScan(): Promise<PartialJsonValue> {
  const subreddit = await reddit.getCurrentSubreddit();
  const posts = await reddit.getNewPosts({
    subredditName: subreddit.name,
    limit: 10,
  }).all();

  const toxicKeywords = [
    "hate", "kill", "stupid", "idiot", "trash", "spam",
    "scam", "fake", "die", "attack", "ban", "raid"
  ];

  // Scan posts
  const riskyPosts = posts.map(post => {
    const text = (post.title + " " + (post.body ?? "")).toLowerCase();
    const matches = toxicKeywords.filter(k => text.includes(k));
    const riskScore = Math.min(100, matches.length * 25);
    return {
      id: post.id,        // raw ID, no prefix — normalizeRedditId adds t3_ server-side
      title: post.title,
      author: post.authorName ?? "unknown",
      url: post.url,
      type: "post",
      riskScore,
      riskLevel: riskScore >= 75 ? "High" : riskScore >= 25 ? "Medium" : "Low",
      triggers: matches,
    };
  }).filter(p => p.riskScore > 0 && p.author !== "mod-immune");

  // Scan comments per post
  const riskyComments: any[] = [];
  try {
    for (const post of posts.slice(0, 5)) {
      const comments = await reddit.getComments({
        postId: post.id,
        limit: 10,
      }).all();

      for (const comment of comments) {
        const text = (comment.body ?? "").toLowerCase();
        const matches = toxicKeywords.filter(k => text.includes(k));
        if (matches.length > 0) {
          const riskScore = Math.min(100, matches.length * 25);
          // FIXED: strip any t1_ prefix from comment.id before storing
          // so normalizeRedditId can cleanly add t1_ without doubling it
          const rawCommentId = comment.id.replace(/^(t1_|t3_)+/, "");
          riskyComments.push({
            id: rawCommentId,
            title: comment.body?.slice(0, 80) + "..." ?? "comment",
            author: comment.authorName ?? "unknown",
            url: `https://reddit.com${(comment as any).permalink ?? ""}`,
            type: "comment",   // tells onRemovePost/onApprovePost to use t1_ prefix
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

// Includes account age for raid detection
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