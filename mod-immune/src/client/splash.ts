import { context, navigateTo } from "@devvit/web/client";

const subtitle = document.getElementById("subtitle") as HTMLParagraphElement;
const scanBtn = document.getElementById("scan-btn") as HTMLButtonElement;
const toxicityScanBtn = document.getElementById("toxicity-scan-btn") as HTMLButtonElement;
const raidScanBtn = document.getElementById("raid-scan-btn") as HTMLButtonElement;
const burnoutScanBtn = document.getElementById("burnout-scan-btn") as HTMLButtonElement;
const healthScore = document.getElementById("health-score") as HTMLDivElement;
const healthStatus = document.getElementById("health-status") as HTMLDivElement;
const flaggedPosts = document.getElementById("flagged-posts") as HTMLDivElement;
const postsToday = document.getElementById("posts-today") as HTMLDivElement;
const newMembers = document.getElementById("new-members") as HTMLDivElement;
const highRiskCount = document.getElementById("high-risk-count") as HTMLDivElement;
const analyzedCount = document.getElementById("analyzed-count") as HTMLDivElement;
const toxicPostsContainer = document.getElementById("toxic-posts-container") as HTMLDivElement;
const raidRiskScore = document.getElementById("raid-risk-score") as HTMLDivElement;
const recentCommentsEl = document.getElementById("recent-comments") as HTMLDivElement;
const uniqueAuthorsEl = document.getElementById("unique-authors") as HTMLDivElement;
const newAccountActivityEl = document.getElementById("new-account-activity") as HTMLDivElement;
const raidStatusContainer = document.getElementById("raid-status-container") as HTMLDivElement;
const overloadedMods = document.getElementById("overloaded-mods") as HTMLDivElement;
const totalActions = document.getElementById("total-actions") as HTMLDivElement;
const modListContainer = document.getElementById("mod-list-container") as HTMLDivElement;
const alertsContainer = document.getElementById("alerts-container") as HTMLDivElement;

let healthData: any = null;
let toxicData: any = null;
let raidData: any = null;
let burnoutData: any = null;

// ── TOAST ──────────────────────────────────────────────────────────────────────

function showToast(msg: string, isError = false) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:#1a1a2e;border:1px solid #ff4500;border-radius:10px;
      padding:10px 18px;font-size:13px;font-weight:600;z-index:2000;
      transition:opacity 0.3s;white-space:nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.borderColor = isError ? "#f44336" : "#4caf50";
  toast.style.color = isError ? "#f44336" : "#4caf50";
  toast.style.opacity = "1";
  setTimeout(() => { toast!.style.opacity = "0"; }, 2500);
}

// ── MOD ACTIONS ────────────────────────────────────────────────────────────────

async function removePost(postId: string, itemType: string, btn: HTMLButtonElement, container: HTMLElement) {
  btn.textContent = "⏳";
  btn.disabled = true;
  try {
    const res = await fetch("/api/remove-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, itemType }),
    });
    const data = await res.json();
    if (data.success) {
      container.style.opacity = "0.4";
      container.style.textDecoration = "line-through";
      btn.textContent = "✓";
      showToast("✅ Removed!");
    } else {
      btn.textContent = "🗑️";
      btn.disabled = false;
      showToast("❌ Remove failed", true);
    }
  } catch {
    btn.textContent = "🗑️";
    btn.disabled = false;
    showToast("❌ Error", true);
  }
}

async function lockPost(postId: string, btn: HTMLButtonElement, container: HTMLElement) {
  btn.textContent = "⏳";
  btn.disabled = true;
  try {
    const res = await fetch("/api/lock-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent = "🔒";
      showToast("🔒 Post locked!");
    } else {
      btn.textContent = "🔓";
      btn.disabled = false;
      showToast("❌ Lock failed", true);
    }
  } catch {
    btn.textContent = "🔓";
    btn.disabled = false;
    showToast("❌ Error", true);
  }
}

async function approvePost(postId: string, itemType: string, btn: HTMLButtonElement, container: HTMLElement) {
  btn.textContent = "⏳";
  btn.disabled = true;
  try {
    const res = await fetch("/api/approve-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, itemType }),
    });
    const data = await res.json();
    if (data.success) {
      container.style.opacity = "0.6";
      btn.textContent = "✓";
      showToast("✅ Approved!");
    } else {
      btn.textContent = "✅";
      btn.disabled = false;
      showToast("❌ Approve failed", true);
    }
  } catch {
    btn.textContent = "✅";
    btn.disabled = false;
    showToast("❌ Error", true);
  }
}

async function banUser(username: string, btn: HTMLButtonElement, container: HTMLElement) {
  if (!confirm(`Ban u/${username} from this subreddit?`)) return;
  btn.textContent = "⏳";
  btn.disabled = true;
  try {
    const res = await fetch("/api/ban-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, subredditName: context.subredditName }),
    });
    const data = await res.json();
    if (data.success) {
      container.style.opacity = "0.4";
      btn.textContent = "🚫";
      showToast(`🚫 u/${username} banned!`);
    } else {
      btn.textContent = "🚫 Ban";
      btn.disabled = false;
      showToast("❌ Ban failed", true);
    }
  } catch {
    btn.textContent = "🚫 Ban";
    btn.disabled = false;
    showToast("❌ Error", true);
  }
}

// ── POST CARD ──────────────────────────────────────────────────────────────────

function createPostCard(post: any, showActions = true, colorClass = "good"): HTMLElement {
  const div = document.createElement("div");
  div.className = `alert ${colorClass}`;
  div.style.marginBottom = "8px";

  const typeLabel = post.type === "comment"
    ? `<span style="font-size:10px;background:rgba(100,100,255,0.2);color:#9090ff;padding:2px 6px;border-radius:4px;margin-right:4px;">💬 Comment</span>`
    : "";

  const infoDiv = document.createElement("div");
  infoDiv.style.cursor = "pointer";
  infoDiv.innerHTML = `
    ${typeLabel}
    ${post.riskLevel ? `<span class="risk-badge risk-${post.riskLevel.toLowerCase()}">${post.riskLevel} Risk</span>` : ""}
    ${post.reason ? `<span class="risk-badge risk-high">${post.reason}</span>` : ""}
    <strong>${post.title}</strong>
    <div class="alert-time">👤 u/${post.author ?? "unknown"} ${post.triggers?.length ? "· Triggers: " + post.triggers.join(", ") : ""}</div>
  `;
  infoDiv.addEventListener("click", () => navigateTo(post.url));
  div.appendChild(infoDiv);

  if (showActions && post.id) {
    const actionsDiv = document.createElement("div");
    actionsDiv.style.cssText = "display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;";

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "🗑️ Remove";
    removeBtn.style.cssText = "flex:1;min-width:70px;padding:6px;border-radius:8px;border:1px solid rgba(244,67,54,0.4);background:rgba(244,67,54,0.1);color:#f44336;font-size:11px;font-weight:700;cursor:pointer;";
    removeBtn.addEventListener("click", (e) => { e.stopPropagation(); removePost(post.id, post.type ?? "post", removeBtn, div); });

    const lockBtn = document.createElement("button");
    lockBtn.textContent = "🔓 Lock";
    lockBtn.style.cssText = "flex:1;min-width:70px;padding:6px;border-radius:8px;border:1px solid rgba(255,152,0,0.4);background:rgba(255,152,0,0.1);color:#ff9800;font-size:11px;font-weight:700;cursor:pointer;";
    lockBtn.addEventListener("click", (e) => { e.stopPropagation(); lockPost(post.id, lockBtn, div); });

    const approveBtn = document.createElement("button");
    approveBtn.textContent = "✅ Approve";
    approveBtn.style.cssText = "flex:1;min-width:70px;padding:6px;border-radius:8px;border:1px solid rgba(76,175,80,0.4);background:rgba(76,175,80,0.1);color:#4caf50;font-size:11px;font-weight:700;cursor:pointer;";
    approveBtn.addEventListener("click", (e) => { e.stopPropagation(); approvePost(post.id, post.type ?? "post", approveBtn, div); });

    const banBtn = document.createElement("button");
    banBtn.textContent = "🚫 Ban";
    banBtn.style.cssText = "flex:1;min-width:70px;padding:6px;border-radius:8px;border:1px solid rgba(156,39,176,0.4);background:rgba(156,39,176,0.1);color:#ce93d8;font-size:11px;font-weight:700;cursor:pointer;";
    banBtn.addEventListener("click", (e) => { e.stopPropagation(); banUser(post.author, banBtn, div); });

    actionsDiv.appendChild(removeBtn);
    actionsDiv.appendChild(lockBtn);
    actionsDiv.appendChild(approveBtn);
    actionsDiv.appendChild(banBtn);
    div.appendChild(actionsDiv);
  }

  return div;
}

// ── DETAIL BOXES ───────────────────────────────────────────────────────────────

function showDetail(boxId: string, titleId: string, bodyId: string, closeId: string, title: string, html: string) {
  const box = document.getElementById(boxId)!;
  document.getElementById(titleId)!.textContent = title;
  document.getElementById(bodyId)!.innerHTML = html;
  box.classList.add("show");
  document.getElementById(closeId)!.onclick = () => box.classList.remove("show");
}

// ── FEATURE 3: CUSTOM KEYWORDS UI ─────────────────────────────────────────────

async function openKeywordsPanel() {
  // Build modal if it doesn't exist yet
  let modal = document.getElementById("keywords-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "keywords-modal";
    modal.style.cssText = `
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);
      z-index:3000;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(255,69,0,0.3);border-radius:16px;
                  padding:20px;width:90%;max-width:400px;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <strong style="font-size:15px;">🔑 Custom Keywords</strong>
          <button id="kw-close" style="background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:12px;color:#aaa;margin-bottom:10px;">
          One keyword per line. These are used for toxicity scanning and auto-mod.
        </div>
        <textarea id="kw-textarea" style="width:100%;height:180px;background:rgba(255,255,255,0.05);
          border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;
          font-size:13px;padding:10px;resize:none;box-sizing:border-box;"
          placeholder="hate&#10;kill&#10;spam&#10;scam"></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button id="kw-reset" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,152,0,0.4);
            background:rgba(255,152,0,0.1);color:#ff9800;font-size:12px;font-weight:700;cursor:pointer;">
            ↩️ Reset to Defaults
          </button>
          <button id="kw-save" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(76,175,80,0.4);
            background:rgba(76,175,80,0.1);color:#4caf50;font-size:13px;font-weight:700;cursor:pointer;">
            💾 Save Keywords
          </button>
        </div>
        <div id="kw-status" style="font-size:12px;margin-top:8px;text-align:center;color:#aaa;"></div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("kw-close")!.onclick = () => { modal!.style.display = "none"; };

    document.getElementById("kw-save")!.onclick = async () => {
      const textarea = document.getElementById("kw-textarea") as HTMLTextAreaElement;
      const keywords = textarea.value.split("\n").map(k => k.trim()).filter(k => k.length > 0);
      const statusEl = document.getElementById("kw-status")!;
      statusEl.textContent = "Saving...";
      try {
        const res = await fetch("/api/save-keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords }),
        });
        const data = await res.json();
        if (data.success) {
          statusEl.style.color = "#4caf50";
          statusEl.textContent = `✅ Saved ${data.keywords.length} keywords!`;
          showToast("✅ Keywords saved!");
        } else {
          statusEl.style.color = "#f44336";
          statusEl.textContent = "❌ Save failed";
        }
      } catch {
        statusEl.style.color = "#f44336";
        statusEl.textContent = "❌ Error saving";
      }
    };

    document.getElementById("kw-reset")!.onclick = async () => {
      const DEFAULT = ["hate","kill","stupid","idiot","trash","spam","scam","fake","die","attack","ban","raid"];
      const textarea = document.getElementById("kw-textarea") as HTMLTextAreaElement;
      textarea.value = DEFAULT.join("\n");
      document.getElementById("kw-status")!.textContent = "Defaults loaded — click Save to apply";
    };
  }

  // Load current keywords
  modal.style.display = "flex";
  const textarea = document.getElementById("kw-textarea") as HTMLTextAreaElement;
  textarea.value = "Loading...";
  try {
    const res = await fetch("/api/get-keywords");
    const data = await res.json();
    textarea.value = (data.keywords ?? []).join("\n");
  } catch {
    textarea.value = "";
  }
}

// ── FEATURE 2: ACTION LOG UI ──────────────────────────────────────────────────

async function openActionLog() {
  let modal = document.getElementById("actionlog-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "actionlog-modal";
    modal.style.cssText = `
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);
      z-index:3000;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(255,69,0,0.3);border-radius:16px;
                  padding:20px;width:90%;max-width:420px;max-height:85vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <strong style="font-size:15px;">📋 Mod Action History</strong>
          <button id="al-close" style="background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div id="al-body" style="font-size:13px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("al-close")!.onclick = () => { modal!.style.display = "none"; };
  }

  modal.style.display = "flex";
  const body = document.getElementById("al-body")!;
  body.innerHTML = `<div style="color:#aaa;text-align:center;padding:20px;">Loading...</div>`;

  try {
    const res = await fetch("/api/get-action-log");
    const data = await res.json();
    const log = data.log ?? [];

    if (!log.length) {
      body.innerHTML = `<div class="alert good" style="text-align:center;">✅ No actions yet — actions appear here after you Remove, Lock, Approve, or Ban.</div>`;
      return;
    }

    const actionEmoji: Record<string, string> = {
      remove: "🗑️", lock: "🔒", approve: "✅", ban: "🚫",
      "automod-remove": "🤖🗑️", "automod-lock": "🤖🔒",
    };

    body.innerHTML = log.map((entry: any) => {
      const emoji = actionEmoji[entry.action] ?? "⚡";
      const timeAgo = formatTimeAgo(entry.timestamp);
      const color = ["remove","ban","automod-remove"].includes(entry.action) ? "#f44336"
        : entry.action === "approve" ? "#4caf50" : "#ff9800";
      return `
        <div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:${color};font-weight:700;">${emoji} ${entry.action.toUpperCase()}</span>
            <span style="color:#666;font-size:11px;">${timeAgo}</span>
          </div>
          <div style="color:#ccc;font-size:12px;margin-top:4px;">
            ${entry.targetType}: <code style="color:#ff9800;">${entry.targetId.slice(-12)}</code>
          </div>
          <div style="color:#888;font-size:11px;">by u/${entry.mod}${entry.note ? " · " + entry.note : ""}</div>
        </div>
      `;
    }).join("");
  } catch {
    body.innerHTML = `<div style="color:#f44336;text-align:center;">❌ Failed to load log</div>`;
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── FEATURE 1: AUTO-MOD RULES UI ──────────────────────────────────────────────

async function openAutomodPanel() {
  let modal = document.getElementById("automod-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "automod-modal";
    modal.style.cssText = `
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);
      z-index:3000;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(255,69,0,0.3);border-radius:16px;
                  padding:20px;width:90%;max-width:400px;max-height:85vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <strong style="font-size:15px;">🤖 Auto-Mod Rules</strong>
          <button id="am-close" style="background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div style="background:rgba(255,69,0,0.08);border:1px solid rgba(255,69,0,0.2);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#aaa;">
          When enabled, Auto-Mod automatically acts on flagged content based on your keyword list and threshold — no manual review needed.
        </div>

        <label style="display:flex;align-items:center;gap:10px;margin-bottom:14px;cursor:pointer;">
          <input type="checkbox" id="am-enabled" style="width:18px;height:18px;accent-color:#ff4500;">
          <span style="font-size:14px;font-weight:600;">Enable Auto-Mod</span>
        </label>

        <div style="margin-bottom:12px;">
          <div style="font-size:12px;color:#aaa;margin-bottom:6px;">Action when threshold is hit:</div>
          <select id="am-action" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
            border-radius:8px;color:#fff;padding:9px;font-size:13px;">
            <option value="remove">🗑️ Auto-Remove</option>
            <option value="lock">🔒 Auto-Lock</option>
            <option value="none">👁️ Flag Only (no action)</option>
          </select>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:12px;color:#aaa;margin-bottom:6px;">Risk score threshold (0–100):</div>
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="range" id="am-threshold" min="25" max="100" step="25"
              style="flex:1;accent-color:#ff4500;">
            <span id="am-threshold-val" style="color:#ff4500;font-weight:700;min-width:30px;">75</span>
          </div>
          <div style="font-size:11px;color:#666;margin-top:4px;">25=Low, 50=Medium, 75=High, 100=Max</div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:12px;color:#aaa;margin-bottom:6px;">Apply to:</div>
          <select id="am-target" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
            border-radius:8px;color:#fff;padding:9px;font-size:13px;">
            <option value="both">📝 Posts + 💬 Comments</option>
            <option value="posts">📝 Posts only</option>
            <option value="comments">💬 Comments only</option>
          </select>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <button id="am-save" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(76,175,80,0.4);
            background:rgba(76,175,80,0.1);color:#4caf50;font-size:13px;font-weight:700;cursor:pointer;">
            💾 Save Rules
          </button>
          <button id="am-runnow" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,69,0,0.4);
            background:rgba(255,69,0,0.1);color:#ff4500;font-size:13px;font-weight:700;cursor:pointer;">
            ▶️ Run Now
          </button>
        </div>
        <div id="am-status" style="font-size:12px;text-align:center;color:#aaa;min-height:18px;"></div>
        <div id="am-results" style="margin-top:10px;font-size:12px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("am-close")!.onclick = () => { modal!.style.display = "none"; };

    const slider = document.getElementById("am-threshold") as HTMLInputElement;
    const sliderVal = document.getElementById("am-threshold-val")!;
    slider.addEventListener("input", () => { sliderVal.textContent = slider.value; });

    document.getElementById("am-save")!.onclick = async () => {
      const rules = {
        enabled: (document.getElementById("am-enabled") as HTMLInputElement).checked,
        action: (document.getElementById("am-action") as HTMLSelectElement).value,
        threshold: parseInt((document.getElementById("am-threshold") as HTMLInputElement).value),
        targetType: (document.getElementById("am-target") as HTMLSelectElement).value,
      };
      const statusEl = document.getElementById("am-status")!;
      statusEl.textContent = "Saving...";
      try {
        const res = await fetch("/api/save-automod-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules }),
        });
        const data = await res.json();
        if (data.success) {
          statusEl.style.color = "#4caf50";
          statusEl.textContent = "✅ Rules saved!";
          showToast("🤖 Auto-mod rules saved!");
        } else {
          statusEl.style.color = "#f44336";
          statusEl.textContent = "❌ Save failed";
        }
      } catch {
        statusEl.style.color = "#f44336";
        statusEl.textContent = "❌ Error";
      }
    };

    document.getElementById("am-runnow")!.onclick = async () => {
      const btn = document.getElementById("am-runnow") as HTMLButtonElement;
      const statusEl = document.getElementById("am-status")!;
      const resultsEl = document.getElementById("am-results")!;
      btn.textContent = "⏳ Running...";
      btn.disabled = true;
      statusEl.textContent = "Running auto-mod scan...";
      try {
        const res = await fetch("/api/run-automod");
        const data = await res.json();
        statusEl.style.color = data.success ? "#4caf50" : "#f44336";
        statusEl.textContent = data.message ?? (data.success ? "Done!" : "Failed");
        if (data.actions?.length) {
          resultsEl.innerHTML = data.actions.map((a: string) =>
            `<div style="color:#ff9800;margin-bottom:4px;">• ${a}</div>`
          ).join("");
        } else {
          resultsEl.innerHTML = `<div style="color:#aaa;">No actions taken.</div>`;
        }
      } catch {
        statusEl.style.color = "#f44336";
        statusEl.textContent = "❌ Run failed";
      }
      btn.textContent = "▶️ Run Now";
      btn.disabled = false;
    };
  }

  // Load current rules
  modal.style.display = "flex";
  try {
    const res = await fetch("/api/get-automod-rules");
    const data = await res.json();
    const r = data.rules ?? {};
    (document.getElementById("am-enabled") as HTMLInputElement).checked = !!r.enabled;
    (document.getElementById("am-action") as HTMLSelectElement).value = r.action ?? "remove";
    const slider = document.getElementById("am-threshold") as HTMLInputElement;
    slider.value = String(r.threshold ?? 75);
    document.getElementById("am-threshold-val")!.textContent = String(r.threshold ?? 75);
    (document.getElementById("am-target") as HTMLSelectElement).value = r.targetType ?? "both";
  } catch {
    // ignore, defaults will show
  }
}

// ── FEATURE 4: HEALTH HISTORY UI ──────────────────────────────────────────────

async function openHealthHistory() {
  let modal = document.getElementById("history-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "history-modal";
    modal.style.cssText = `
      display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);
      z-index:3000;align-items:center;justify-content:center;
    `;
    modal.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid rgba(255,69,0,0.3);border-radius:16px;
                  padding:20px;width:90%;max-width:420px;max-height:85vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <strong style="font-size:15px;">📈 Health History</strong>
          <button id="hh-close" style="background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:12px;color:#aaa;margin-bottom:14px;">Recorded each time you run a Health Scan. Up to 14 entries shown.</div>
        <div id="hh-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("hh-close")!.onclick = () => { modal!.style.display = "none"; };
  }

  modal.style.display = "flex";
  const body = document.getElementById("hh-body")!;
  body.innerHTML = `<div style="color:#aaa;text-align:center;padding:20px;">Loading...</div>`;

  try {
    const res = await fetch("/api/get-health-history");
    const data = await res.json();
    const history = data.history ?? [];

    if (!history.length) {
      body.innerHTML = `<div class="alert good" style="text-align:center;">✅ No history yet — run a Health Scan to start recording.</div>`;
      return;
    }

    // Mini bar chart using CSS
    const maxScore = 100;
    body.innerHTML = history.map((entry: any) => {
      const score = entry.score ?? 0;
      const barColor = score >= 80 ? "#4caf50" : score >= 50 ? "#ff9800" : "#f44336";
      const barWidth = Math.round((score / maxScore) * 100);
      return `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="min-width:50px;font-size:11px;color:#aaa;">${entry.date}</div>
          <div style="flex:1;background:rgba(255,255,255,0.05);border-radius:4px;height:18px;overflow:hidden;">
            <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:4px;transition:width 0.4s;"></div>
          </div>
          <div style="min-width:32px;font-size:12px;font-weight:700;color:${barColor};">${score}</div>
          <div style="font-size:11px;color:#666;">${entry.flaggedCount ?? 0}⚠️</div>
        </div>
      `;
    }).join("");
  } catch {
    body.innerHTML = `<div style="color:#f44336;text-align:center;">❌ Failed to load history</div>`;
  }
}

// ── FEATURE BUTTONS (injected into existing tabs) ──────────────────────────────

function injectFeatureButtons() {
  // Inject "🔑 Keywords" + "🤖 Auto-Mod" into toxicity tab
  const toxPanel = document.getElementById("panel-toxicity");
  if (toxPanel) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;margin-bottom:12px;";
    bar.innerHTML = `
      <button id="btn-keywords" style="flex:1;padding:9px;border-radius:8px;border:1px solid rgba(255,152,0,0.4);
        background:rgba(255,152,0,0.1);color:#ff9800;font-size:12px;font-weight:700;cursor:pointer;">
        🔑 Custom Keywords
      </button>
      <button id="btn-automod" style="flex:1;padding:9px;border-radius:8px;border:1px solid rgba(255,69,0,0.4);
        background:rgba(255,69,0,0.1);color:#ff4500;font-size:12px;font-weight:700;cursor:pointer;">
        🤖 Auto-Mod Rules
      </button>
    `;
    toxPanel.insertBefore(bar, toxPanel.firstChild);
    document.getElementById("btn-keywords")!.addEventListener("click", openKeywordsPanel);
    document.getElementById("btn-automod")!.addEventListener("click", openAutomodPanel);
  }

  // Inject "📋 Action Log" + "📈 History" into overview tab
  const overviewPanel = document.getElementById("panel-overview");
  if (overviewPanel) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;margin-bottom:12px;margin-top:4px;";
    bar.innerHTML = `
      <button id="btn-actionlog" style="flex:1;padding:9px;border-radius:8px;border:1px solid rgba(100,100,255,0.4);
        background:rgba(100,100,255,0.1);color:#9090ff;font-size:12px;font-weight:700;cursor:pointer;">
        📋 Action Log
      </button>
      <button id="btn-history" style="flex:1;padding:9px;border-radius:8px;border:1px solid rgba(76,175,80,0.4);
        background:rgba(76,175,80,0.1);color:#4caf50;font-size:12px;font-weight:700;cursor:pointer;">
        📈 Health History
      </button>
    `;
    // Insert after the first element (health score card area)
    const firstCard = overviewPanel.querySelector(".stat-grid") ?? overviewPanel.firstChild;
    if (firstCard && firstCard.nextSibling) {
      overviewPanel.insertBefore(bar, firstCard.nextSibling);
    } else {
      overviewPanel.appendChild(bar);
    }
    document.getElementById("btn-actionlog")!.addEventListener("click", openActionLog);
    document.getElementById("btn-history")!.addEventListener("click", openHealthHistory);
  }
}

// ── INIT & TAB SWITCHING ───────────────────────────────────────────────────────

function init() {
  subtitle.textContent = `r/${context.subredditName ?? "your community"}`;
  injectFeatureButtons();
}

function switchTab(tab: string) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.getElementById(`panel-${tab}`)?.classList.add("active");
}

function updateHealthStatus(score: number) {
  if (score >= 80) {
    healthStatus.textContent = "✅ Healthy";
    healthStatus.className = "score-status healthy";
  } else if (score >= 50) {
    healthStatus.textContent = "⚠️ At Risk";
    healthStatus.className = "score-status atrisk";
  } else {
    healthStatus.textContent = "🚨 Critical";
    healthStatus.className = "score-status critical";
  }
}

// ── TAB EVENTS ─────────────────────────────────────────────────────────────────

document.getElementById("tab-overview")?.addEventListener("click", () => switchTab("overview"));
document.getElementById("tab-toxicity")?.addEventListener("click", () => switchTab("toxicity"));
document.getElementById("tab-raid")?.addEventListener("click", () => switchTab("raid"));
document.getElementById("tab-burnout")?.addEventListener("click", () => switchTab("burnout"));

// ── CARD CLICK EVENTS ──────────────────────────────────────────────────────────

document.getElementById("card-posts")?.addEventListener("click", () => {
  if (!healthData?.recentPosts?.length) return;
  const box = document.getElementById("detail-box")!;
  document.getElementById("detail-title")!.textContent = "📝 Recent Posts";
  const body = document.getElementById("detail-body")!;
  body.innerHTML = "";
  healthData.recentPosts.forEach((p: any) => body.appendChild(createPostCard(p, true, "good")));
  box.classList.add("show");
  document.getElementById("detail-close")!.onclick = () => box.classList.remove("show");
});

document.getElementById("card-flagged")?.addEventListener("click", () => {
  if (!healthData) return;
  const box = document.getElementById("detail-box")!;
  document.getElementById("detail-title")!.textContent = "⚠️ Flagged Posts";
  const body = document.getElementById("detail-body")!;
  body.innerHTML = "";
  if (!healthData.flaggedDetails?.length) {
    body.innerHTML = `<div class="alert good">✅ No flagged posts!</div>`;
  } else {
    healthData.flaggedDetails.forEach((p: any) => body.appendChild(createPostCard(p, true, "danger")));
  }
  box.classList.add("show");
  document.getElementById("detail-close")!.onclick = () => box.classList.remove("show");
});

document.getElementById("card-members")?.addEventListener("click", () => {
  if (!healthData) return;
  showDetail("detail-box", "detail-title", "detail-body", "detail-close", "👥 Community Info",
    `<div class="alert good">
      <strong>r/${healthData.subredditName}</strong>
      <div class="alert-time">👥 ${healthData.members} total members · 📝 ${healthData.totalPosts} posts</div>
    </div>`);
});

document.getElementById("card-raidrisk")?.addEventListener("click", () => {
  showDetail("detail-box", "detail-title", "detail-body", "detail-close", "🚨 Raid Info",
    `<div class="alert">Switch to Raid tab and run Raid Scan for details</div>`);
});

document.getElementById("card-highrisk")?.addEventListener("click", () => {
  if (!toxicData) return;
  const box = document.getElementById("toxic-detail-box")!;
  document.getElementById("toxic-detail-title")!.textContent = "☣️ High Risk Posts";
  const body = document.getElementById("toxic-detail-body")!;
  body.innerHTML = "";
  const high = toxicData.riskyPosts?.filter((p: any) => p.riskLevel === "High") ?? [];
  if (!high.length) {
    body.innerHTML = `<div class="alert good">✅ No high risk posts!</div>`;
  } else {
    high.forEach((p: any) => body.appendChild(createPostCard(p, true, "danger")));
  }
  box.classList.add("show");
  document.getElementById("toxic-detail-close")!.onclick = () => box.classList.remove("show");
});

document.getElementById("card-analyzed")?.addEventListener("click", () => {
  if (!toxicData) return;
  const box = document.getElementById("toxic-detail-box")!;
  document.getElementById("toxic-detail-title")!.textContent = "🔬 All Risky Posts & Comments";
  const body = document.getElementById("toxic-detail-body")!;
  body.innerHTML = "";
  if (!toxicData.riskyPosts?.length) {
    body.innerHTML = `<div class="alert good">✅ All posts clean!</div>`;
  } else {
    toxicData.riskyPosts.forEach((p: any) =>
      body.appendChild(createPostCard(p, true, p.riskLevel === "High" ? "danger" : "warning")));
  }
  box.classList.add("show");
  document.getElementById("toxic-detail-close")!.onclick = () => box.classList.remove("show");
});

document.getElementById("card-uniqueauthors")?.addEventListener("click", () => {
  if (!raidData?.suspiciousUsers?.length) return;
  const box = document.getElementById("raid-detail-box")!;
  document.getElementById("raid-detail-title")!.textContent = "👤 Suspicious Users";
  const body = document.getElementById("raid-detail-body")!;
  body.innerHTML = "";
  raidData.suspiciousUsers.forEach((u: any) => {
    const userDiv = document.createElement("div");
    userDiv.className = `alert ${u.postCount > 3 ? "danger" : u.postCount > 1 ? "warning" : "good"}`;
    userDiv.style.marginBottom = "6px";
    userDiv.innerHTML = `<strong>u/${u.author}</strong> — ${u.postCount} posts · <span style="color:${u.accountAgeDays < 7 ? '#f44336' : u.accountAgeDays < 30 ? '#ff9800' : '#4caf50'}">${u.accountAgeLabel}</span>`;
    body.appendChild(userDiv);
    u.posts?.forEach((p: any) => body.appendChild(createPostCard(p, true, "")));
  });
  box.classList.add("show");
  document.getElementById("raid-detail-close")!.onclick = () => box.classList.remove("show");
});

document.getElementById("card-overloaded")?.addEventListener("click", () => {
  if (!burnoutData) return;
  const high = burnoutData.mods?.filter((m: any) => m.burnoutLevel === "High") ?? [];
  showDetail("burnout-detail-box", "burnout-detail-title", "burnout-detail-body", "burnout-detail-close",
    "😮‍💨 Overloaded Mods",
    high.length === 0
      ? `<div class="alert good">✅ No overloaded mods!</div>`
      : high.map((m: any) => `
          <div class="alert danger" style="margin-bottom:6px;">
            <strong>u/${m.name}</strong>
            <div class="alert-time">${m.actions} actions · ${m.recentActions?.slice(0, 3).join(", ") ?? ""}</div>
          </div>`).join(""));
});

document.getElementById("card-totalactions")?.addEventListener("click", () => {
  if (!burnoutData) return;
  showDetail("burnout-detail-box", "burnout-detail-title", "burnout-detail-body", "burnout-detail-close",
    "⚡ All Mod Actions",
    burnoutData.mods?.map((m: any) => `
      <div class="alert ${m.burnoutLevel === "High" ? "danger" : m.burnoutLevel === "Medium" ? "warning" : "good"}" style="margin-bottom:6px;">
        <strong>u/${m.name}</strong> — ${m.actions} actions
        <div class="alert-time">${m.recentActions?.slice(0, 3).join(", ") ?? ""}</div>
      </div>`).join("") ?? "");
});

// ── SCAN BUTTONS ───────────────────────────────────────────────────────────────

scanBtn.addEventListener("click", async () => {
  scanBtn.textContent = "🔄 Scanning...";
  scanBtn.style.opacity = "0.7";
  try {
    const res = await fetch("/api/health-scan");
    const data = await res.json();
    healthData = data;
    healthScore.textContent = String(data.healthScore ?? 0);
    flaggedPosts.textContent = String(data.flaggedCount ?? 0);
    postsToday.textContent = String(data.totalPosts ?? 0);
    newMembers.textContent = String(data.members ?? "N/A");
    updateHealthStatus(data.healthScore ?? 0);
    alertsContainer.innerHTML = "";
    const allPosts = [...(data.flaggedDetails ?? []), ...(data.recentPosts ?? [])];
    allPosts.forEach(p => alertsContainer.appendChild(
      createPostCard(p, true, p.reason ? "danger" : "good")));
    scanBtn.textContent = "✅ Scan Complete!";
  } catch {
    scanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => { scanBtn.textContent = "🔍 Run Health Scan"; scanBtn.style.opacity = "1"; }, 2000);
});

toxicityScanBtn.addEventListener("click", async () => {
  toxicityScanBtn.textContent = "🔄 Analyzing...";
  toxicityScanBtn.style.opacity = "0.7";
  try {
    const res = await fetch("/api/toxicity-scan");
    const data = await res.json();
    toxicData = data;
    highRiskCount.textContent = String(data.highRiskCount ?? 0);
    analyzedCount.textContent = String(data.totalAnalyzed ?? 0);
    toxicPostsContainer.innerHTML = "";
    if (data.commentCount > 0) {
      const badge = document.createElement("div");
      badge.className = "alert warning";
      badge.style.marginBottom = "8px";
      badge.innerHTML = `💬 <strong>${data.commentCount} risky comments</strong> also found`;
      toxicPostsContainer.appendChild(badge);
    }
    if (!data.riskyPosts?.length) {
      toxicPostsContainer.innerHTML += `<div class="alert good">✅ No risky posts or comments found!</div>`;
    } else {
      data.riskyPosts.forEach((p: any) =>
        toxicPostsContainer.appendChild(
          createPostCard(p, true, p.riskLevel === "High" ? "danger" : "warning")));
    }
    toxicityScanBtn.textContent = "✅ Analysis Complete!";
  } catch {
    toxicityScanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => { toxicityScanBtn.textContent = "☣️ Run Toxicity Scan"; toxicityScanBtn.style.opacity = "1"; }, 2000);
});

raidScanBtn.addEventListener("click", async () => {
  raidScanBtn.textContent = "🔄 Scanning...";
  raidScanBtn.style.opacity = "0.7";
  try {
    const res = await fetch("/api/raid-scan");
    const data = await res.json();
    raidData = data;
    const risk = data.raidRisk ?? "Low";
    const score = data.raidScore ?? 0;
    raidRiskScore.textContent = risk;
    recentCommentsEl.textContent = String(data.recentComments ?? 0);
    uniqueAuthorsEl.textContent = String(data.uniqueAuthors ?? 0);
    newAccountActivityEl.textContent = String(data.newAccountActivity ?? 0);
    const riskColor = risk === "High" ? "danger" : risk === "Medium" ? "warning" : "good";
    const riskEmoji = risk === "High" ? "🚨" : risk === "Medium" ? "⚠️" : "✅";
    raidStatusContainer.innerHTML = `
      <div class="alert ${riskColor}" style="margin-bottom:8px;">
        ${riskEmoji} Raid Risk: <strong>${risk}</strong> (Score: ${score}/100)
        <div class="alert-time">${data.uniqueAuthors} unique authors · ${data.recentComments} recent posts · 👶 ${data.newAccountActivity} new accounts</div>
      </div>
    `;
    data.suspiciousUsers?.slice(0, 5).forEach((u: any) => {
      const userDiv = document.createElement("div");
      const ageColor = u.accountAgeDays < 7 ? "#f44336" : u.accountAgeDays < 30 ? "#ff9800" : "#4caf50";
      userDiv.className = `alert ${u.isNewAccount ? "danger" : u.postCount > 1 ? "warning" : ""}`;
      userDiv.style.marginBottom = "6px";
      userDiv.innerHTML = `
        <strong>u/${u.author}</strong> — ${u.postCount} posts
        <span style="margin-left:8px;color:${ageColor};font-size:11px;">${u.accountAgeLabel}</span>
      `;
      raidStatusContainer.appendChild(userDiv);
      u.posts?.forEach((p: any) =>
        raidStatusContainer.appendChild(createPostCard(p, true, "")));
    });
    raidScanBtn.textContent = "✅ Scan Complete!";
  } catch {
    raidScanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => { raidScanBtn.textContent = "🚨 Run Raid Scan"; raidScanBtn.style.opacity = "1"; }, 2000);
});

burnoutScanBtn.addEventListener("click", async () => {
  burnoutScanBtn.textContent = "🔄 Scanning...";
  burnoutScanBtn.style.opacity = "0.7";
  try {
    const res = await fetch("/api/burnout-scan");
    const data = await res.json();
    burnoutData = data;
    overloadedMods.textContent = String(data.overloadedMods ?? 0);
    totalActions.textContent = String(data.totalActions ?? 0);
    modListContainer.innerHTML = "";
    if (!data.mods?.length) {
      modListContainer.innerHTML = `<div class="alert good">✅ No mod activity found!</div>`;
    } else {
      data.mods.forEach((mod: any) => {
        const div = document.createElement("div");
        div.className = "mod-card";
        div.style.cursor = "pointer";
        div.innerHTML = `
          <div>
            <div class="mod-name">u/${mod.name}</div>
            <div class="mod-actions">${mod.actions} actions · ${mod.recentActions?.slice(0, 2).join(", ") ?? ""} · Tap to view</div>
          </div>
          <span class="risk-badge risk-${mod.burnoutLevel.toLowerCase()}">${mod.burnoutLevel}</span>
        `;
        div.addEventListener("click", () => navigateTo(`https://www.reddit.com/user/${mod.name}`));
        modListContainer.appendChild(div);
      });
    }
    burnoutScanBtn.textContent = "✅ Scan Complete!";
  } catch {
    burnoutScanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => { burnoutScanBtn.textContent = "😮‍💨 Run Burnout Scan"; burnoutScanBtn.style.opacity = "1"; }, 2000);
});

// ── AUTO SCAN ON LOAD ──────────────────────────────────────────────────────────

async function autoScan() {
  try {
    const res = await fetch("/api/health-scan");
    const data = await res.json();
    healthData = data;
    healthScore.textContent = String(data.healthScore ?? 87);
    flaggedPosts.textContent = String(data.flaggedCount ?? 0);
    postsToday.textContent = String(data.totalPosts ?? 0);
    newMembers.textContent = String(data.members ?? 0);
    updateHealthStatus(data.healthScore ?? 87);
    alertsContainer.innerHTML = "";
    const allPosts = [...(data.flaggedDetails ?? []), ...(data.recentPosts ?? [])];
    allPosts.forEach(p => alertsContainer.appendChild(
      createPostCard(p, true, p.reason ? "danger" : "good")));
  } catch (e) {
    console.log("Auto scan failed", e);
  }
}

init();
autoScan();