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

type ErrorResponse = {
  error: string;
  status: number;
};

function getPostId(): string {
  if (!context.postId) {
    throw Error("no post ID");
  }
  return context.postId;
}

function getPostCountKey(postId: string): string {
  return `count:${postId}`;
}

async function onInit(): Promise<InitResponse> {
  const postId = getPostId();
  const count = Number((await redis.get(getPostCountKey(postId))) ?? 0);
  return {
    type: "init",
    postId,
    count,
    username: context.username ?? "user",
  };
}

async function onIncrement(req: IncomingMessage): Promise<IncrementResponse> {
  const postId = getPostId();
  const { amount } = await readJSON<IncrementRequest>(req).catch(() => ({
    amount: 1,
  }));
  const incrementBy = Number.isFinite(amount) ? amount : 1;
  const count = await redis.incrBy(getPostCountKey(postId), incrementBy);
  return {
    type: "increment",
    postId,
    count,
  };
}

async function onDecrement(req: IncomingMessage): Promise<DecrementResponse> {
  const postId = getPostId();
  const { amount } = await readJSON<DecrementRequest>(req).catch(() => ({
    amount: 1,
  }));
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  const decrementBy = Number.isFinite(parsedAmount) ? parsedAmount : 1;
  const count = Number(
    await redis.incrBy(getPostCountKey(postId), -decrementBy),
  );
  return {
    type: "decrement",
    postId,
    count,
  };
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

async function onHealthScan(): Promise<PartialJsonValue> {
  const subreddit = await reddit.getCurrentSubreddit();
  const posts = await reddit.getNewPosts({
    subredditName: subreddit.name,
    limit: 25,
  }).all();

  const totalPosts = posts.length;
  const flaggedCount = posts.filter(p => p.isSpam || p.isLocked).length;
  const healthScore = Math.max(0, 100 - (flaggedCount * 10));
  const status = healthScore >= 80 ? "Healthy" : healthScore >= 50 ? "At Risk" : "Critical";

  return {
    healthScore,
    totalPosts,
    flaggedCount,
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

  const toxicKeywords = [
    "hate", "kill", "stupid", "idiot", "trash", "spam",
    "scam", "fake", "die", "attack", "ban", "raid"
  ];

  const riskyPosts = posts.map(post => {
    const text = (post.title + " " + (post.body ?? "")).toLowerCase();
    const matches = toxicKeywords.filter(k => text.includes(k));
    const riskScore = Math.min(100, matches.length * 25);
    return {
      id: post.id,
      title: post.title,
      riskScore,
      riskLevel: riskScore >= 75 ? "High" : riskScore >= 25 ? "Medium" : "Low",
      triggers: matches,
    };
  }).filter(p => p.riskScore > 0);

  return {
    riskyPosts,
    totalAnalyzed: posts.length,
    highRiskCount: riskyPosts.filter(p => p.riskLevel === "High").length,
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

  return {
    raidRisk,
    raidScore,
    recentComments: posts.length,
    uniqueAuthors: uniqueAuthors.size,
    newAccountActivity: 0,
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
  for (const entry of modLog) {
    const mod = (entry as any).moderatorName ?? (entry as any).mod ?? "unknown";
    modActivity[mod] = (modActivity[mod] ?? 0) + 1;
  }

  const mods = Object.entries(modActivity).map(([name, actions]) => ({
    name,
    actions,
    burnoutLevel: actions >= 20 ? "High" : actions >= 10 ? "Medium" : "Low",
  }));

  const totalActions = modLog.length;
  const overloadedMods = mods.filter(m => m.burnoutLevel === "High").length;

  return {
    mods,
    totalActions,
    overloadedMods,
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