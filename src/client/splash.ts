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

function init() {
  subtitle.textContent = `r/${context.subredditName ?? "your community"}`;
}

function switchTab(tab: string) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.getElementById(`panel-${tab}`)?.classList.add('active');
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

function renderClickableList(container: HTMLElement, items: any[], emptyMsg: string) {
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="alert good">${emptyMsg}</div>`;
    return;
  }
  container.innerHTML = items.map((item, i) => `
    <div class="alert ${item.riskLevel === 'High' || item.reason === 'Spam' ? 'danger' : item.riskLevel === 'Medium' ? 'warning' : 'good'}" 
         style="cursor:pointer;" data-url="${item.url ?? ''}" data-index="${i}">
      ${item.riskLevel ? `<span class="risk-badge risk-${item.riskLevel.toLowerCase()}">${item.riskLevel} Risk</span>` : ''}
      ${item.reason ? `<span class="risk-badge risk-high">${item.reason}</span>` : ''}
      <strong>${item.title}</strong>
      <div class="alert-time">👤 u/${item.author ?? item.name ?? 'unknown'} ${item.triggers?.length ? '· Triggers: ' + item.triggers.join(', ') : ''} · Tap to open post ↗</div>
    </div>
  `).join("");

  container.querySelectorAll(".alert[data-url]").forEach(el => {
    el.addEventListener("click", () => {
      const url = (el as HTMLElement).dataset.url;
      if (url) navigateTo(url);
    });
  });
}

document.getElementById('tab-overview')?.addEventListener('click', () => switchTab('overview'));
document.getElementById('tab-toxicity')?.addEventListener('click', () => switchTab('toxicity'));
document.getElementById('tab-raid')?.addEventListener('click', () => switchTab('raid'));
document.getElementById('tab-burnout')?.addEventListener('click', () => switchTab('burnout'));

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

    const allPosts = [
      ...(data.flaggedDetails ?? []),
      ...(data.recentPosts ?? [])
    ];
    renderClickableList(alertsContainer, allPosts, "✅ No posts found!");
    scanBtn.textContent = "✅ Scan Complete!";
  } catch (e) {
    scanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => {
    scanBtn.textContent = "🔍 Run Health Scan";
    scanBtn.style.opacity = "1";
  }, 2000);
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
    renderClickableList(toxicPostsContainer, data.riskyPosts ?? [], "✅ No risky posts found!");
    toxicityScanBtn.textContent = "✅ Analysis Complete!";
  } catch (e) {
    toxicityScanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => {
    toxicityScanBtn.textContent = "☣️ Run Toxicity Scan";
    toxicityScanBtn.style.opacity = "1";
  }, 2000);
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
    const comments = data.recentComments ?? 0;
    const authors = data.uniqueAuthors ?? 0;
    raidRiskScore.textContent = risk;
    recentCommentsEl.textContent = String(comments);
    uniqueAuthorsEl.textContent = String(authors);
    newAccountActivityEl.textContent = String(data.newAccountActivity ?? 0);

    const riskColor = risk === "High" ? "danger" : risk === "Medium" ? "warning" : "good";
    const riskEmoji = risk === "High" ? "🚨" : risk === "Medium" ? "⚠️" : "✅";

    const suspiciousHtml = data.suspiciousUsers?.slice(0, 5).map((u: any) => `
      <div class="alert ${u.postCount > 3 ? 'danger' : u.postCount > 1 ? 'warning' : ''}">
        <strong>u/${u.author}</strong> — ${u.postCount} posts
        ${u.posts?.map((p: any) => `
          <div class="alert-time" style="cursor:pointer;text-decoration:underline;" data-url="${p.url}">↗ ${p.title}</div>
        `).join("") ?? ""}
      </div>
    `).join("") ?? "";

    raidStatusContainer.innerHTML = `
      <div class="alert ${riskColor}">
        ${riskEmoji} Raid Risk: <strong>${risk}</strong> (Score: ${score}/100)
        <div class="alert-time">${authors} unique authors · ${comments} recent posts</div>
      </div>
      ${suspiciousHtml}
    `;

    raidStatusContainer.querySelectorAll("[data-url]").forEach(el => {
      el.addEventListener("click", () => {
        const url = (el as HTMLElement).dataset.url;
        if (url) navigateTo(url);
      });
    });

    raidScanBtn.textContent = "✅ Scan Complete!";
  } catch (e) {
    raidScanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => {
    raidScanBtn.textContent = "🚨 Run Raid Scan";
    raidScanBtn.style.opacity = "1";
  }, 2000);
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
    if (!data.mods || data.mods.length === 0) {
      modListContainer.innerHTML = `<div class="alert good">✅ No mod activity found!</div>`;
    } else {
      modListContainer.innerHTML = data.mods.map((mod: any) => `
        <div class="mod-card" style="cursor:pointer;" data-url="https://www.reddit.com/user/${mod.name}">
          <div>
            <div class="mod-name">u/${mod.name}</div>
            <div class="mod-actions">${mod.actions} actions · ${mod.recentActions?.slice(0,2).join(", ") ?? ""} · Tap to view profile</div>
          </div>
          <span class="risk-badge risk-${mod.burnoutLevel.toLowerCase()}">${mod.burnoutLevel}</span>
        </div>
      `).join("");

      modListContainer.querySelectorAll(".mod-card[data-url]").forEach(el => {
        el.addEventListener("click", () => {
          const url = (el as HTMLElement).dataset.url;
          if (url) navigateTo(url);
        });
      });
    }
    burnoutScanBtn.textContent = "✅ Scan Complete!";
  } catch (e) {
    burnoutScanBtn.textContent = "❌ Scan Failed";
  }
  setTimeout(() => {
    burnoutScanBtn.textContent = "😮‍💨 Run Burnout Scan";
    burnoutScanBtn.style.opacity = "1";
  }, 2000);
});

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

    const allPosts = [
      ...(data.flaggedDetails ?? []),
      ...(data.recentPosts ?? [])
    ];
    renderClickableList(alertsContainer, allPosts, "✅ No posts found!");
  } catch (e) {
    console.log("Auto scan failed", e);
  }
}

init();
autoScan();