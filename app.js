const API_BASE = String(window.NAVIGUIDE_API_BASE || "/api").replace(/\/$/, "");
const THEME_STORAGE_KEY = "naviguide-theme";
const ALL_CATEGORY_ID = "__all__";

const FALLBACK_DATA = {
  categories: [
    { id: "life", name: "生活权益", description: "会员、权益与日常省钱路径", position: 0, enabled: true },
    { id: "food", name: "外卖奶茶", description: "点单、优惠与到店核销", position: 1, enabled: true },
    { id: "travel", name: "打车出行", description: "出行平台的新人礼与积分", position: 2, enabled: true },
    { id: "shopping", name: "网购入会", description: "电商入会、返利与试用", position: 3, enabled: true },
    { id: "cash", name: "红包现金", description: "现金任务、红包和提现", position: 4, enabled: true },
    { id: "games", name: "游戏相关", description: "游戏福利、礼包与活动", position: 5, enabled: true },
    { id: "other", name: "其他项目", description: "值得收藏的实用项目", position: 6, enabled: true },
  ],
  links: [
    { id: "life-1", category: "生活权益", title: "城市生活权益包", mark: "01", tone: "orange", status: "新手友好", description: "整理常见生活平台的会员权益，按领取顺序完成首轮体验。", note: "准备时间 · 5 分钟", url: "https://example.com", steps: ["准备常用手机号与收货地址", "从活动页进入权益中心，完成新人任务", "领取后在订单或卡包中确认到账"], tips: "同一设备只建议绑定一个账号，避免权益被系统判定为重复领取。", cover: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80" },
    { id: "food-1", category: "外卖奶茶", title: "奶茶首单优惠", mark: "02", tone: "rose", status: "每周更新", description: "从领券到下单的完整路径，适合第一次使用平台的新用户。", note: "操作步骤 · 4 步", url: "https://example.com", steps: ["打开活动入口，先领取新人券", "选择参与活动的门店与规格", "结算页确认优惠已抵扣，再提交订单", "完成后在订单页检查返还或积分"], tips: "部分优惠券需要配送范围与时段同时满足，结算前要留意小字说明。", cover: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1200&q=80" },
    { id: "travel-1", category: "打车出行", title: "出行平台新人礼", mark: "03", tone: "blue", status: "实测可用", description: "新人注册、实名认证与首单优惠的快速通关清单。", note: "完成时间 · 10 分钟", url: "https://example.com", steps: ["使用未注册过的手机号创建账号", "完成实名认证并开启定位权限", "在优惠中心领取新人券包", "首单结束后确认券包剩余张数"], tips: "高峰期券包可能临时调整，建议先领券再叫车。", cover: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80" },
    { id: "shopping-1", category: "网购入会", title: "电商会员试用", mark: "04", tone: "lime", status: "限时活动", description: "会员试用、运费券和专属价的领取顺序，一页看懂。", note: "适合 · 网购用户", url: "https://example.com", steps: ["从活动页进入会员试用入口", "确认试用结束日期与自动续费开关", "领取运费券并在结算页选择使用", "在设置中关闭不需要的自动服务"], tips: "试用到期前记得检查续费设置，优惠详情以平台最终展示为准。", cover: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80" },
    { id: "cash-1", category: "红包现金", title: "任务红包入门", mark: "05", tone: "yellow", status: "低门槛", description: "把任务、签到、分享和提现的关键节点串起来，减少无效操作。", note: "预计收益 · 以页面为准", url: "https://example.com", steps: ["先阅读活动规则和提现门槛", "按顺序完成签到与首个任务", "在收益明细确认红包到账", "达到门槛后发起提现并保留记录"], tips: "不要为了完成任务授权不必要的权限，遇到异常先截图留存。", cover: "https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=1200&q=80" },
    { id: "games-1", category: "游戏相关", title: "新游礼包领取", mark: "06", tone: "purple", status: "活动中", description: "从预约、下载到兑换码使用的完整流程，适合活动期快速领取。", note: "需要 · 游戏账号", url: "https://example.com", steps: ["进入活动页完成预约或登录", "按提示下载对应版本客户端", "在礼包中心复制兑换码", "进入游戏内的设置或福利中心兑换"], tips: "兑换码通常区分渠道与有效期，复制后尽快使用。", cover: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80" },
    { id: "other-1", category: "其他项目", title: "实用工具集合", mark: "07", tone: "teal", status: "持续补充", description: "把不容易归类但值得收藏的工具和服务，整理成清晰入口。", note: "收藏 · 随时查看", url: "https://example.com", steps: ["先看工具适用场景", "打开官方入口并确认服务范围", "按照页面提示完成注册或安装", "把常用入口加入自己的收藏夹"], tips: "第三方工具请先确认隐私政策与收费规则。", cover: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80" },
  ],
};

let navigationData = { categories: [], links: [] };
let activeCategory = ALL_CATEGORY_ID;
let searchTerm = "";
let lastTrigger = null;

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  document.querySelector("#footer-year").textContent = String(new Date().getFullYear());
  document.querySelector("#search-input")?.addEventListener("input", (event) => { searchTerm = event.target.value.trim().toLowerCase(); renderCategoryList(); renderProjects(); });
  document.querySelector("#clear-filter")?.addEventListener("click", () => { searchTerm = ""; activeCategory = ALL_CATEGORY_ID; document.querySelector("#search-input").value = ""; renderAll(); });
  document.querySelector("#close-dialog")?.addEventListener("click", closeDialog);
  document.querySelector("#project-dialog")?.addEventListener("click", (event) => { if (event.target.id === "project-dialog") closeDialog(); });
  document.querySelector("#project-dialog")?.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && document.querySelector("#project-dialog")?.open) closeDialog(); });
  loadNavigationData();
  refreshIcons();
});

async function loadNavigationData() {
  try {
    const response = await fetch(`${API_BASE}/public/links`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    navigationData = normalizeData(await response.json());
  } catch (error) {
    console.info("Using local guide preview:", error.message);
    navigationData = normalizeData(FALLBACK_DATA);
  }
  if (activeCategory !== ALL_CATEGORY_ID && !navigationData.categories.some((category) => category.id === activeCategory)) {
    activeCategory = ALL_CATEGORY_ID;
  }
  renderAll();
}

function normalizeData(data) {
  const categories = Array.isArray(data?.categories) ? data.categories.filter((item) => item && item.enabled !== false).sort(comparePosition) : [];
  const names = new Set(categories.map((item) => item.name));
  const links = Array.isArray(data?.links) ? data.links.filter((item) => item && names.has(item.category) && item.enabled !== false).sort(comparePosition).map(normalizeLink) : [];
  return { categories, links };
}

function normalizeLink(item) {
  const rawSteps = Array.isArray(item.steps) && item.steps.length
    ? item.steps
    : splitSteps(item.guide || item.tutorial || item.content || item.description);
  const steps = rawSteps.map((step) => {
    if (typeof step === "string") return { title: "", content: step.trim(), image: "" };
    if (!step || typeof step !== "object") return null;
    return {
      title: String(step.title || "").trim(),
      content: String(step.content || step.text || step.description || "").trim(),
      image: String(step.image || step.imageUrl || "").trim(),
    };
  }).filter((step) => step && (step.title || step.content || step.image));
  const guide = String(item.guide || item.tutorial || item.content || "").trim()
    || legacyStepsToMarkdown(rawSteps)
    || String(item.description || "").trim();
  return {
    ...item,
    guide,
    steps,
    tips: item.tips || "",
    cover: item.cover || item.coverUrl || "",
    detailDescription: item.detailDescription || item.detail_description || "",
  };
}

function splitSteps(value) { return String(value || "").split(/\n|。/).map((part) => part.trim()).filter(Boolean).slice(0, 5); }
function legacyStepsToMarkdown(rawSteps) {
  const steps = Array.isArray(rawSteps) ? rawSteps : [];
  return steps.map((step) => {
    if (typeof step === "string") {
      const content = step.trim();
      return content ? `### 教程步骤\n\n${content}` : "";
    }
    if (!step || typeof step !== "object") return "";
    const title = String(step.title || "").trim();
    const content = String(step.content || step.text || step.description || "").trim();
    const image = String(step.image || step.imageUrl || "").trim();
    if (!title && !content && !image) return "";
    return [`### ${title || "教程步骤"}`, content, image ? `![${title || "步骤图片"}](${image})` : ""].filter(Boolean).join("\n\n");
  }).filter(Boolean).join("\n\n");
}

function renderMarkdown(value) {
  const source = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "";
  const blocks = [];
  let paragraph = [];
  let listType = "";
  let listItems = [];
  let quoteLines = [];
  let code = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderMarkdownInline(paragraph.join("\n"), true)}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<${listType}>${listItems.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join("")}</${listType}>`);
    listType = "";
    listItems = [];
  };
  const flushQuote = () => {
    if (!quoteLines.length) return;
    blocks.push(`<blockquote>${renderMarkdown(quoteLines.join("\n"))}</blockquote>`);
    quoteLines = [];
  };
  const flushOpenBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of source.split("\n")) {
    const fence = line.match(/^ {0,3}```\s*([A-Za-z0-9_-]*)\s*$/);
    if (code) {
      if (fence) {
        const languageClass = code.language ? ` class="language-${escapeAttribute(code.language)}"` : "";
        blocks.push(`<pre><code${languageClass}>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }
    if (fence) {
      flushOpenBlocks();
      code = { language: fence[1], lines: [] };
      continue;
    }
    if (!line.trim()) {
      flushOpenBlocks();
      continue;
    }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushOpenBlocks();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      flushOpenBlocks();
      blocks.push("<hr />");
      continue;
    }
    const quote = line.match(/^ {0,3}>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1]);
      continue;
    }
    flushQuote();
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  if (code) {
    const languageClass = code.language ? ` class="language-${escapeAttribute(code.language)}"` : "";
    blocks.push(`<pre><code${languageClass}>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
  }
  flushOpenBlocks();
  return blocks.join("");
}

function renderMarkdownInline(value, preserveBreaks = false) {
  const source = String(value || "");
  const tokenPattern = /!\[([^\]]*)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)|\[([^\]]+)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g;
  let output = "";
  let cursor = 0;
  let match;
  while ((match = tokenPattern.exec(source))) {
    output += escapeHtml(source.slice(cursor, match.index));
    if (match[1] !== undefined) {
      const imageUrl = safeMarkdownUrl(match[2]);
      output += imageUrl
        ? `<img class="markdown-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(match[1] || "正文图片")}"${match[3] ? ` title="${escapeAttribute(match[3])}"` : ""} loading="lazy" decoding="async" />`
        : escapeHtml(match[1]);
    } else if (match[4] !== undefined) {
      const linkUrl = safeMarkdownUrl(match[5]);
      output += linkUrl
        ? `<a href="${escapeAttribute(linkUrl)}"${match[6] ? ` title="${escapeAttribute(match[6])}"` : ""} target="_blank" rel="noopener noreferrer">${escapeHtml(match[4])}</a>`
        : escapeHtml(match[4]);
    } else if (match[7] !== undefined) output += `<code>${escapeHtml(match[7])}</code>`;
    else if (match[8] !== undefined || match[9] !== undefined) output += `<strong>${escapeHtml(match[8] || match[9])}</strong>`;
    else if (match[10] !== undefined) output += `<del>${escapeHtml(match[10])}</del>`;
    else output += `<em>${escapeHtml(match[11] || match[12])}</em>`;
    cursor = tokenPattern.lastIndex;
  }
  output += escapeHtml(source.slice(cursor));
  return preserveBreaks ? output.replace(/\n/g, "<br />") : output;
}

function safeMarkdownUrl(value) {
  const trimmed = String(value || "").trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return "";
}

function comparePosition(left, right) { return Number(left.position || 0) - Number(right.position || 0) || String(left.name || left.title).localeCompare(String(right.name || right.title), "zh-CN"); }

function renderAll() {
  document.querySelector("#category-total-label").textContent = `${navigationData.categories.length} 类`;
  renderCategoryList(); renderProjects(); refreshIcons();
}

function renderCategoryList() {
  const list = document.querySelector("#category-list");
  const matchingLinks = searchTerm ? navigationData.links.filter(matchesSearch) : navigationData.links;
  const allButton = `<button class="section-nav-link tone-purple ${activeCategory === ALL_CATEGORY_ID ? "active" : ""}" type="button" data-category="${ALL_CATEGORY_ID}" aria-pressed="${activeCategory === ALL_CATEGORY_ID}" style="--nav-tone: var(--purple);"><span class="nav-index">00</span><span>全部</span><small>${matchingLinks.length}</small></button>`;
  const categoryButtons = navigationData.categories.map((category, index) => {
    const categoryLinks = navigationData.links.filter((link) => link.category === category.name);
    const matchingLinks = searchTerm ? categoryLinks.filter(matchesSearch) : categoryLinks;
    const count = matchingLinks.length;
    const tone = toneForIndex(index);
    return `<button class="section-nav-link tone-${tone} ${activeCategory === category.id ? "active" : ""}" type="button" data-category="${escapeAttribute(category.id)}" aria-pressed="${activeCategory === category.id}" style="--nav-tone: var(--${tone});"><span class="nav-index">${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(category.name)}</span><small>${count}</small></button>`;
  }).join("");
  list.innerHTML = allButton + categoryButtons;
  list.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    const nextCategory = button.dataset.category;
    if (nextCategory !== ALL_CATEGORY_ID && !navigationData.categories.some((category) => category.id === nextCategory)) return;
    if (nextCategory === activeCategory) return;
    activeCategory = nextCategory;
    const category = navigationData.categories.find((item) => item.id === activeCategory);
    if (category) trackCategory(category);
    renderCategoryList();
    renderProjects();
  }));
}

function renderProjects() {
  const grid = document.querySelector("#project-grid");
  const visibleCategories = activeCategory === ALL_CATEGORY_ID
    ? navigationData.categories
    : navigationData.categories.filter((category) => category.id === activeCategory);
  const sections = visibleCategories.map((category) => {
    const index = navigationData.categories.indexOf(category);
    let projects = navigationData.links.filter((link) => link.category === category.name);
    if (searchTerm) projects = projects.filter(matchesSearch);
    if (searchTerm && !projects.length) return "";
    return renderProjectSection(category, projects, index);
  }).filter(Boolean).join("");
  document.querySelector("#clear-filter").hidden = !searchTerm;
  grid.innerHTML = sections || '<p class="load-state">没有找到匹配的项目，换个关键词试试。</p>';
  grid.querySelectorAll("[data-project-id]").forEach((card) => {
    card.addEventListener("click", () => openDialog(card.dataset.projectId, card));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDialog(card.dataset.projectId, card);
      }
    });
  });
  refreshIcons();
}

function renderProjectSection(category, projects, index) {
  const sectionId = `category-${category.id}`;
  return `<section class="link-section" id="${escapeAttribute(sectionId)}" aria-labelledby="${escapeAttribute(sectionId)}-title"><div class="section-heading"><div class="section-heading-copy"><p class="section-index">${String(index + 1).padStart(2, "0")}</p><div><h2 id="${escapeAttribute(sectionId)}-title">${escapeHtml(category.name)}</h2><p>${escapeHtml(category.description || "选择项目，查看完整的使用教程")}</p></div></div><span class="section-count">${projects.length} 篇教程</span></div><div class="link-grid">${projects.length ? projects.map((link, cardIndex) => renderProjectCard(link, cardIndex)).join("") : '<p class="load-state">这个分类暂时还没有项目教程。</p>'}</div></section>`;
}

function renderProjectCard(link, index) {
  const tone = link.tone || toneForIndex(index);
  return `<article class="project-card link-card tone-${escapeAttribute(tone)}" tabindex="0" role="button" aria-haspopup="dialog" aria-controls="project-dialog" data-project-id="${escapeAttribute(link.id)}" aria-label="查看${escapeAttribute(link.title)}教程"><div class="card-topline"><span class="status-badge">${escapeHtml(link.status || "教程")}</span><span class="card-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></div><div class="card-identity"><span class="link-mark" aria-hidden="true">${escapeHtml(link.mark || "指")}</span><h3><span class="card-title-text">${escapeHtml(link.title)}</span><i data-lucide="arrow-up-right" aria-hidden="true"></i></h3></div><p class="card-description">${escapeHtml(link.description || "打开查看项目介绍和完整教程。")}</p><div class="card-meta"><span>${escapeHtml(link.note || "项目教程")}</span><span>查看完整教程</span></div></article>`;
}

function openDialog(id, trigger = null) {
  const link = navigationData.links.find((item) => item.id === id); if (!link) return;
  lastTrigger = trigger || document.activeElement;
  const detailDescription = link.detailDescription || link.description || "";
  const cover = escapeAttribute(escapeCssUrl(link.cover || fallbackCover(link.tone)));
  const guide = link.guide || legacyStepsToMarkdown(link.steps);
  const markdown = renderMarkdown(guide) || "<p class=\"markdown-empty\">暂无正文，请打开项目入口查看最新说明。</p>";
  document.querySelector("#dialog-content").innerHTML = `<div class="dialog-hero tone-${escapeAttribute(link.tone || "teal")}" style="--cover: url('${cover}')"><span class="project-mark">${escapeHtml(link.mark || "01")}</span><span class="status-badge">${escapeHtml(link.status || "指南")}</span></div><div class="dialog-copy"><div class="dialog-kicker">${escapeHtml(link.category)} / FIELD NOTE</div><h2 id="dialog-title">${escapeHtml(link.title)}</h2><p class="dialog-description">${escapeHtml(detailDescription)}</p><div class="markdown-heading"><span>教程正文</span><span>Markdown</span></div><div class="markdown-body">${markdown}</div>${link.tips ? `<aside class="tips-box"><i data-lucide="lightbulb" aria-hidden="true"></i><p><strong>小提示</strong>${escapeHtml(link.tips)}</p></aside>` : ""}<a class="dialog-cta" href="${escapeAttribute(normalizeUrl(link.url))}" target="_blank" rel="noopener noreferrer" data-track-id="${escapeAttribute(link.id)}"><span>打开项目入口</span><i data-lucide="external-link" aria-hidden="true"></i></a></div>`;
  const dialog = document.querySelector("#project-dialog");
  dialog.showModal();
  document.querySelector("#close-dialog")?.focus();
  document.querySelector("[data-track-id]")?.addEventListener("click", () => trackClick(link, "link_click"));
  trackClick(link, "project_view"); refreshIcons();
}

function closeDialog() {
  const dialog = document.querySelector("#project-dialog");
  if (!dialog?.open) return;
  dialog.close();
  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  lastTrigger = null;
}

function matchesSearch(link) {
  const stepText = (link.steps || []).map((step) => [step.title, step.content, step.image].join(" ")).join(" ");
  return [link.title, link.description, link.detailDescription, link.guide, link.note, link.category, link.status, link.tips, stepText]
    .some((value) => String(value || "").toLowerCase().includes(searchTerm));
}

function trackClick(link, event = "link_click") {
  const category = navigationData.categories.find((item) => item.name === link.category);
  sendTrackingEvent({ projectId: link.id, categoryId: category?.id || link.category, eventType: event });
}
function trackCategory(category) { sendTrackingEvent({ categoryId: category.id, eventType: "category_click" }); }
function sendTrackingEvent(payload) {
  const body = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
  fetch(`${API_BASE}/public/track`, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
function fallbackCover(tone) { const palette = { orange: "#f59e0b", rose: "#e76f91", blue: "#3b82f6", lime: "#8bbd2f", yellow: "#d99b28", purple: "#8b5cf6", teal: "#159a91" }; return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 400'%3E%3Crect width='800' height='400' fill='${encodeURIComponent(palette[tone] || palette.teal)}'/%3E%3Cpath d='M0 300 170 130l120 120 170-170 340 320H0Z' fill='%230f172a' opacity='.22'/%3E%3C/svg%3E`; }
function normalizeUrl(value) { const trimmed = String(value || "").trim(); return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }
function escapeCssUrl(value) { return String(value ?? "").replace(/[\\'"()\n\r]/g, (character) => ({ "\\": "\\\\", "'": "\\'", '"': '\\"', "(": "\\(", ")": "\\)", "\n": "", "\r": "" })[character]); }

function initializeTheme() { applyTheme(readStoredTheme() === "dark" ? "dark" : "light", false); document.querySelector("#theme-toggle")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")); }
function readStoredTheme() { try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; } }
function applyTheme(theme, persist = true) { const normalized = theme === "dark" ? "dark" : "light"; document.documentElement.dataset.theme = normalized; if (persist) try { localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch {} const button = document.querySelector("#theme-toggle"); if (button) { button.innerHTML = `<i data-lucide="${normalized === "dark" ? "sun" : "moon"}" aria-hidden="true"></i>`; button.title = normalized === "dark" ? "切换浅色模式" : "切换深色模式"; button.setAttribute("aria-label", button.title); refreshIcons(); } }
function refreshIcons() { if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } }); }

function toneForIndex(index) {
  return ["teal", "rose", "blue", "purple", "yellow", "orange", "lime"][index % 7];
}
