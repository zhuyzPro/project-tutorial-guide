const API_BASE = String(window.NAVIGUIDE_API_BASE || "/api").replace(/\/$/, "");
const THEME_KEY = "guide-admin-theme";
const TONES = [
  ["teal", "青绿"],
  ["blue", "蓝色"],
  ["orange", "橙色"],
  ["rose", "玫红"],
  ["lime", "青柠"],
  ["yellow", "金黄"],
  ["purple", "紫色"],
  ["coral", "珊瑚"],
];

const state = {
  session: null,
  categories: [],
  links: [],
  stats: emptyStats(),
  statsFrom: dateInputValue(daysAgo(6)),
  statsTo: dateInputValue(new Date()),
  activeView: "dashboard",
  projectSearch: "",
  projectCategory: "all",
  modal: null,
  loading: false,
  contentError: "",
};

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleKeydown);
  boot();
});

async function boot() {
  try {
    const session = await api("/auth/session");
    if (session?.authenticated) {
      state.session = session;
      await loadWorkspace();
      return;
    }
  } catch (error) {
    state.contentError = error.message || "无法连接后台服务";
  }
  render();
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const request = { credentials: "same-origin", cache: "no-store", ...options, headers };
  if (request.body && typeof request.body !== "string" && !(request.body instanceof FormData) && !(request.body instanceof Blob)) {
    headers.set("Content-Type", "application/json");
    request.body = JSON.stringify(request.body);
  }
  headers.set("Accept", "application/json");

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, request);
  } catch {
    throw Object.assign(new Error("无法连接后台服务，请检查服务是否启动"), { status: 0 });
  }

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    payload = text ? { error: text } : null;
  }
  if (!response.ok) {
    const error = Object.assign(new Error(payload?.error || `请求失败（${response.status}）`), { status: response.status, payload });
    if (response.status === 401 && path !== "/auth/login") {
      state.session = null;
      state.modal = null;
      render();
    }
    throw error;
  }
  return payload || {};
}

async function loadWorkspace() {
  if (!state.session) return;
  state.loading = true;
  state.contentError = "";
  render();
  const [navigationResult, statsResult] = await Promise.allSettled([loadNavigation(), loadStats()]);
  if (navigationResult.status === "rejected") {
    state.contentError = navigationResult.reason?.message || "无法加载项目和分类";
  }
  if (statsResult.status === "rejected") {
    state.stats = emptyStats(statsResult.reason?.message || "无法加载统计数据");
  }
  state.loading = false;
  render();
}

async function loadNavigation() {
  const payload = await api("/admin/links");
  state.categories = sortByPosition(array(payload.categories));
  state.links = sortLinks(array(payload.links), state.categories);
}

async function loadStats() {
  const query = new URLSearchParams({ from: state.statsFrom, to: state.statsTo, granularity: "hour" });
  const payload = await api(`/admin/stats?${query.toString()}`);
  state.stats = normalizeStats(payload);
}

function render() {
  const app = document.querySelector("#app");
  if (!app) return;
  app.className = "";
  app.innerHTML = state.session ? renderShell() : renderLogin();
  refreshIcons();
}

function renderLogin() {
  const error = state.contentError ? `<div class="load-error" role="alert">${escapeHtml(state.contentError)}</div>` : "";
  return `<main class="login-page" aria-labelledby="login-title">
    <section class="login-intro">
      <div class="brand-lockup"><span class="brand-stamp">指</span><span><strong>指南所后台</strong><small>FIELD GUIDE / EDITORIAL DESK</small></span></div>
      <div class="login-copy"><p>项目教程内容工作台</p><h1>把内容排好，<br /><em>把路径讲清。</em></h1></div>
      <p class="login-footnote">管理项目、分类与访客点击数据。</p>
    </section>
    <section class="login-panel">
      <form class="login-form" data-form="login">
        <p class="form-kicker">管理员登录</p>
        <h2 id="login-title">进入编辑台</h2>
        <p class="form-lede">使用后台账号继续管理项目教程。</p>
        ${error}
        <div class="field-stack">
          <div class="field"><label for="login-username">用户名</label><input id="login-username" name="username" autocomplete="username" required /></div>
          <div class="field"><label for="login-password">密码</label><input id="login-password" name="password" type="password" autocomplete="current-password" required /></div>
          <button class="primary-button" type="submit"><span>登录后台</span><i data-lucide="arrow-right" aria-hidden="true"></i></button>
        </div>
      </form>
    </section>
  </main>`;
}

function renderShell() {
  const viewTitle = { dashboard: "访问概览", projects: "项目教程", categories: "分类管理" }[state.activeView] || "后台";
  const content = state.loading ? renderLoading() : renderPage();
  return `<div class="admin-shell">
    <aside class="sidebar" aria-label="后台导航">
      <div class="sidebar-brand"><span class="brand-stamp">指</span><span><strong>指南所后台</strong><small>内容编辑台</small></span></div>
      <nav class="sidebar-nav">
        ${renderNavButton("dashboard", "route", "访问概览", "")}
        ${renderNavButton("projects", "folder-plus", "项目教程", state.links.length)}
        ${renderNavButton("categories", "settings-2", "分类管理", state.categories.length)}
      </nav>
      <div class="sidebar-note"><span>当前可见教程</span><strong>${formatNumber(state.links.filter((item) => item.enabled !== false).length)} 篇</strong></div>
    </aside>
    <main id="workspace" class="workspace" tabindex="-1">
      <header class="topbar">
        <div class="topbar-location"><span>指南所 / 内容工作台</span><strong>${escapeHtml(viewTitle)}</strong></div>
        <div class="topbar-actions">
          <span class="account-name" title="${escapeAttribute(state.session.username || "管理员")}">${escapeHtml(state.session.username || "管理员")}</span>
          <button class="icon-button" type="button" data-action="toggle-theme" title="切换主题" aria-label="切换主题"><i data-lucide="${currentTheme() === "dark" ? "sun" : "moon"}" aria-hidden="true"></i></button>
          <button class="icon-button logout-button" type="button" data-action="logout" title="退出登录" aria-label="退出登录"><i data-lucide="log-out" aria-hidden="true"></i></button>
        </div>
      </header>
      <div class="page-content">${content}</div>
    </main>
  </div>${renderModal()}`;
}

function renderNavButton(view, icon, label, count) {
  return `<button class="nav-button ${state.activeView === view ? "active" : ""}" type="button" data-action="navigate" data-view="${view}"><i data-lucide="${icon}" aria-hidden="true"></i><span class="nav-label">${label}</span>${count !== "" ? `<span class="nav-count">${formatNumber(count)}</span>` : ""}</button>`;
}

function renderLoading() {
  return `<section class="empty-state" role="status"><div><strong>正在同步内容</strong><p>项目、分类和访问数据正在读取。</p></div></section>`;
}

function renderPage() {
  if (state.activeView === "projects") return renderProjects();
  if (state.activeView === "categories") return renderCategories();
  return renderDashboard();
}

function renderDashboard() {
  const overview = state.stats.overview;
  const rangeLabel = `${state.statsFrom} 至 ${state.statsTo}`;
  const categoryRows = state.stats.categories.slice(0, 6);
  const projectRows = state.stats.projects.slice(0, 6);
  const recentRows = state.stats.recent.slice(0, 8);
  return `${renderPageHeading("访问概览", "按时间段查看分类、项目和访问来源的点击情况。", `<button class="secondary-button" type="button" data-action="refresh-workspace"><span>刷新数据</span></button>`)}
    ${renderContentError()}
    <section class="metric-grid" aria-label="统计摘要">
      ${renderMetric("pine", "访问事件", overview.events, `统计区间：${rangeLabel}`)}
      ${renderMetric("blue", "分类浏览", overview.categoryViews, "访客选择分类次数")}
      ${renderMetric("amber", "项目点击", overview.linkClicks, "项目教程入口与查看")}
      ${renderMetric("coral", "独立 IP", overview.uniqueVisitors, "按 IP 去重的访问来源")}
    </section>
    <section class="dashboard-grid">
      <article class="panel span-two">
        <div class="panel-header">
          <div><h2 class="panel-title">访问时段</h2><p class="panel-caption">按小时汇总的访问事件，柱高表示事件数量。</p></div>
          <form class="range-control" data-form="stats-filter">
            <label class="range-field"><span>开始日期</span><input class="date-input" name="from" type="date" value="${escapeAttribute(state.statsFrom)}" required /></label>
            <label class="range-field"><span>结束日期</span><input class="date-input" name="to" type="date" value="${escapeAttribute(state.statsTo)}" required /></label>
            <button class="secondary-button" type="submit">更新</button>
          </form>
        </div>
        <div class="panel-body">${renderTimeline(state.stats.hourly, rangeLabel, state.stats.error)}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">热门分类</h2><p class="panel-caption">分类浏览与项目点击</p></div></div>
        <div class="panel-body">${renderCategoryStats(categoryRows)}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">热门项目</h2><p class="panel-caption">访问者最常点击的教程</p></div></div>
        <div class="panel-body">${renderProjectStats(projectRows)}</div>
      </article>
      <article class="panel span-two">
        <div class="panel-header"><div><h2 class="panel-title">访问来源</h2><p class="panel-caption">按 IP 汇总，显示最近一次访问时间。</p></div></div>
        <div class="panel-body">${renderRecentStats(recentRows)}</div>
      </article>
    </section>`;
}

function renderMetric(tone, label, value, note) {
  return `<article class="metric ${tone}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${formatNumber(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></article>`;
}

function renderTimeline(points, rangeLabel, error) {
  if (error) return `<div class="empty-chart">${escapeHtml(error)}</div>`;
  if (!points.length) return `<div class="empty-chart">${escapeHtml(rangeLabel)} 暂无访问记录</div>`;
  const visible = points.slice(-40);
  const max = Math.max(1, ...visible.map((item) => statValue(item, ["events", "count", "value"])));
  const bars = visible.map((item) => {
    const events = statValue(item, ["events", "count", "value"]);
    const label = `${formatTimelineTime(item.timestamp || item.time || item.hour || "")} · ${formatNumber(events)} 次`;
    const height = Math.max(4, Math.round((events / max) * 100));
    return `<span class="timeline-bar" style="--height:${height}%" data-label="${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}"></span>`;
  }).join("");
  const first = formatTimelineTime(visible[0]?.timestamp || visible[0]?.time || visible[0]?.hour || "");
  const last = formatTimelineTime(visible.at(-1)?.timestamp || visible.at(-1)?.time || visible.at(-1)?.hour || "");
  return `<div class="timeline" style="--columns:${visible.length}" role="img" aria-label="${escapeAttribute(`${rangeLabel} 的访问趋势`)}">${bars}</div><div class="timeline-labels"><span>${escapeHtml(first)}</span><span>${escapeHtml(last)}</span></div>`;
}

function renderCategoryStats(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有分类浏览记录");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>分类</th><th class="numeric">浏览</th><th class="numeric">点击</th></tr></thead><tbody>${rows.map((row) => {
    const name = row.categoryName || row.name || row.title || "未分类";
    return `<tr><td><span class="table-main">${escapeHtml(name)}</span></td><td class="numeric">${formatNumber(statValue(row, ["categoryViews", "views", "viewCount"]))}</td><td class="numeric">${formatNumber(statValue(row, ["linkClicks", "clicks", "clickCount"]))}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderProjectStats(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有项目点击记录");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>项目</th><th class="numeric">点击</th></tr></thead><tbody>${rows.map((row) => {
    const title = row.linkTitle || row.title || row.name || "未命名项目";
    const category = row.categoryName || row.category || "";
    return `<tr><td><span class="table-main">${escapeHtml(title)}</span><span class="table-sub">${escapeHtml(category)}</span></td><td class="numeric">${formatNumber(statValue(row, ["clicks", "linkClicks", "count"]))}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderRecentStats(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有可展示的访问来源");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>IP 来源</th><th>最近访问</th><th class="numeric">事件</th></tr></thead><tbody>${rows.map((row) => {
    const source = row.ip || row.ipSource || row.source || row.address || "未记录";
    const time = row.lastSeenAt || row.createdAt || row.timestamp || row.time || "--";
    const events = statValue(row, ["events", "count", "visits"]) || 1;
    return `<tr><td><span class="table-main">${escapeHtml(source)}</span></td><td><span class="table-sub">${escapeHtml(formatDateTime(time))}</span></td><td class="numeric">${formatNumber(events)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderEmptyTable(message) {
  return `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderProjects() {
  const links = filteredLinks();
  const categoryOptions = [`<option value="all">全部分类</option>`, ...state.categories.map((item) => `<option value="${escapeAttribute(item.id)}" ${state.projectCategory === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)].join("");
  const rows = links.length ? links.map(renderProjectRow).join("") : `<div class="empty-state"><div><strong>${state.links.length ? "没有匹配的教程" : "还没有项目教程"}</strong><p>${state.links.length ? "调整搜索词或分类后再试。" : "先新建一篇项目教程，前台就能开始展示。"}</p></div></div>`;
  return `${renderPageHeading("项目教程", "维护项目介绍、图文教程和前台显示状态；排序在同一分类内生效。", `<button class="primary-button" type="button" data-action="new-project"><i data-lucide="plus" aria-hidden="true"></i><span>新建教程</span></button>`)}
    ${renderContentError()}
    <div class="toolbar">
      <form class="toolbar-filters" data-form="project-filter">
        <label class="search-input"><span class="visually-hidden">搜索教程</span><input name="search" value="${escapeAttribute(state.projectSearch)}" placeholder="搜索标题、简介或说明" /></label>
        <select class="filter-select" name="category" aria-label="按分类筛选">${categoryOptions}</select>
        <button class="secondary-button" type="submit">筛选</button>
      </form>
      <div class="toolbar-actions"><button class="secondary-button" type="button" data-action="refresh-navigation">刷新列表</button></div>
    </div>
    <section class="project-list" aria-label="项目教程列表">${rows}</section>`;
}

function renderProjectRow(link) {
  const siblings = sortByPosition(state.links.filter((item) => item.category === link.category));
  const index = siblings.findIndex((item) => item.id === link.id);
  const category = state.categories.find((item) => item.name === link.category);
  const image = safeImageUrl(link.cover || link.image);
  const cover = image
    ? `<span class="project-cover has-image"><img src="${escapeAttribute(image)}" alt="" /></span>`
    : `<span class="project-cover">${escapeHtml(link.mark || "指")}</span>`;
  return `<article class="project-row">
    ${cover}
    <div class="project-main"><div class="project-title-row"><span class="status-dot ${link.enabled === false ? "off" : ""}" aria-hidden="true"></span><strong class="project-title">${escapeHtml(link.title)}</strong></div><span class="project-description">${escapeHtml(link.description || "未填写简介")}</span></div>
    <div class="project-meta"><strong>${escapeHtml(link.category || "未分类")}</strong><span>${escapeHtml(link.note || "未填写说明")}</span></div>
    <div class="project-meta"><span class="status-tag ${link.enabled === false ? "off" : ""}">${escapeHtml(link.enabled === false ? "已隐藏" : (link.status || "已发布"))}</span></div>
    <div class="row-actions" aria-label="${escapeAttribute(`${link.title} 的操作`)}">
      <button class="icon-button" type="button" data-action="move-project-up" data-id="${escapeAttribute(link.id)}" title="上移排序" aria-label="上移排序" ${index <= 0 ? "disabled" : ""}><i data-lucide="arrow-up" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="move-project-down" data-id="${escapeAttribute(link.id)}" title="下移排序" aria-label="下移排序" ${index === siblings.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="toggle-project" data-id="${escapeAttribute(link.id)}" title="${link.enabled === false ? "显示到前台" : "从前台隐藏"}" aria-label="${link.enabled === false ? "显示到前台" : "从前台隐藏"}"><i data-lucide="${link.enabled === false ? "check" : "settings-2"}" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="edit-project" data-id="${escapeAttribute(link.id)}" title="编辑教程" aria-label="编辑教程"><i data-lucide="pencil" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="delete-project" data-id="${escapeAttribute(link.id)}" title="删除教程" aria-label="删除教程"><i data-lucide="trash-2" aria-hidden="true"></i></button>
    </div>
  </article>`;
}

function renderCategories() {
  const rows = state.categories.length ? state.categories.map(renderCategoryRow).join("") : `<div class="empty-state"><div><strong>还没有分类</strong><p>新建分类后即可把项目教程放入其中。</p></div></div>`;
  return `${renderPageHeading("分类管理", "分类决定首页的浏览顺序。删除分类时，可将其中的教程转移到其他分类。", `<button class="primary-button" type="button" data-action="new-category"><i data-lucide="plus" aria-hidden="true"></i><span>新建分类</span></button>`)}
    ${renderContentError()}
    <section class="category-list" aria-label="项目分类列表">${rows}</section>`;
}

function renderCategoryRow(category, index) {
  const projectCount = state.links.filter((item) => item.category === category.name).length;
  return `<article class="category-row">
    <span class="category-order">${String(index + 1).padStart(2, "0")}</span>
    <div class="category-main"><div class="category-title-row"><span class="status-dot ${category.enabled === false ? "off" : ""}" aria-hidden="true"></span><strong class="category-title">${escapeHtml(category.name)}</strong></div><span class="category-description">${escapeHtml(category.description || "未填写分类说明")}</span></div>
    <div class="project-meta"><strong>${formatNumber(projectCount)} 篇教程</strong><span class="status-tag ${category.enabled === false ? "off" : ""}">${category.enabled === false ? "前台隐藏" : "前台显示"}</span></div>
    <div class="row-actions" aria-label="${escapeAttribute(`${category.name} 的操作`)}">
      <button class="icon-button" type="button" data-action="move-category-up" data-id="${escapeAttribute(category.id)}" title="上移排序" aria-label="上移排序" ${index <= 0 ? "disabled" : ""}><i data-lucide="arrow-up" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="move-category-down" data-id="${escapeAttribute(category.id)}" title="下移排序" aria-label="下移排序" ${index === state.categories.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="toggle-category" data-id="${escapeAttribute(category.id)}" title="${category.enabled === false ? "显示到前台" : "从前台隐藏"}" aria-label="${category.enabled === false ? "显示到前台" : "从前台隐藏"}"><i data-lucide="${category.enabled === false ? "check" : "settings-2"}" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="edit-category" data-id="${escapeAttribute(category.id)}" title="编辑分类" aria-label="编辑分类"><i data-lucide="pencil" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="delete-category" data-id="${escapeAttribute(category.id)}" title="删除分类" aria-label="删除分类"><i data-lucide="trash-2" aria-hidden="true"></i></button>
    </div>
  </article>`;
}

function renderPageHeading(title, description, actions = "") {
  return `<header class="page-heading"><div class="page-heading-copy"><p class="eyebrow">CONTENT DESK</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="heading-actions">${actions}</div></header>`;
}

function renderContentError() {
  return state.contentError && state.session ? `<div class="load-error" role="alert">${escapeHtml(state.contentError)}</div>` : "";
}

function renderModal() {
  if (!state.modal) return "";
  if (state.modal.type === "project") return renderProjectModal(state.modal.entity);
  if (state.modal.type === "category") return renderCategoryModal(state.modal.entity);
  if (state.modal.type === "delete-project") return renderDeleteProjectModal(state.modal.entity);
  if (state.modal.type === "delete-category") return renderDeleteCategoryModal(state.modal.entity);
  return "";
}

function renderProjectModal(link) {
  const existing = Boolean(link.id);
  const categoryOptions = state.categories.map((category) => `<option value="${escapeAttribute(category.name)}" ${link.category === category.name ? "selected" : ""}>${escapeHtml(category.name)}${category.enabled === false ? "（已隐藏）" : ""}</option>`).join("");
  const tutorial = link.guide || stepsToText(link.steps);
  const toneOptions = TONES.map(([tone, label]) => `<label class="tone-option tone-${tone}"><input type="radio" name="tone" value="${tone}" ${link.tone === tone ? "checked" : ""} /><span class="tone-swatch" aria-hidden="true"></span>${label}</label>`).join("");
  const noCategories = state.categories.length === 0;
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="project-editor-title">
    <header class="modal-header"><div><h2 id="project-editor-title">${existing ? "编辑项目教程" : "新建项目教程"}</h2><p>保存后，内容会同步到前台项目索引。</p></div><button class="icon-button modal-close" type="button" data-action="close-modal" title="关闭" aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <form class="editor-form" data-form="project">
      <div class="form-grid">
        <div class="field"><label for="project-category">所属分类</label><select id="project-category" name="category" required ${noCategories ? "disabled" : ""}>${categoryOptions}</select>${noCategories ? `<p class="field-help">请先创建一个分类。</p>` : ""}</div>
        <div class="field"><label for="project-title">项目标题</label><input id="project-title" name="title" maxlength="80" value="${escapeAttribute(link.title || "")}" placeholder="例如：奶茶首单优惠" required /></div>
        <div class="field"><label for="project-status">状态文案</label><input id="project-status" name="status" maxlength="24" value="${escapeAttribute(link.status || "待核实")}" placeholder="例如：实测可用" required /></div>
        <div class="field"><label for="project-mark">显示标记</label><input id="project-mark" name="mark" maxlength="12" value="${escapeAttribute(link.mark || nextMark())}" placeholder="例如：01" required /><p class="field-help">用于前台卡片上的短标记。</p></div>
        <div class="field wide"><label for="project-description">简介</label><textarea id="project-description" name="description" maxlength="240" placeholder="一句话说明这个项目能帮用户做什么" required>${escapeHtml(link.description || "")}</textarea></div>
        <div class="field"><label for="project-note">说明</label><input id="project-note" name="note" maxlength="80" value="${escapeAttribute(link.note || "")}" placeholder="例如：准备时间 · 5 分钟" required /></div>
        <div class="field"><label for="project-url">入口 URL</label><input id="project-url" name="url" type="url" maxlength="2048" value="${escapeAttribute(link.url || "")}" placeholder="https://example.com" required /></div>
        <div class="field wide"><label for="project-cover">封面图 URL</label><input id="project-cover" name="cover" maxlength="2048" value="${escapeAttribute(link.cover || link.image || "")}" placeholder="https://... 或 /images/cover.jpg" /><p class="field-help">支持 http、https 或站内路径；留空则用项目标记显示。</p></div>
      </div>
      <section class="editor-section"><h3 class="editor-section-title">教程内容</h3><div class="form-grid">
        <div class="field wide"><label for="project-guide">教程正文</label><textarea id="project-guide" class="tall" name="guide" maxlength="100000" placeholder="每行一条操作步骤；会自动同步为前台的步骤列表。">${escapeHtml(tutorial)}</textarea><p class="field-help">每行会作为一个前台教程步骤，最多 100 行。</p></div>
        <div class="field wide"><label for="project-tips">小提示</label><textarea id="project-tips" name="tips" maxlength="2000" placeholder="提醒用户注意条件、时效或常见问题。">${escapeHtml(link.tips || "")}</textarea></div>
      </div></section>
      <section class="editor-section"><h3 class="editor-section-title">后台信息</h3><div class="form-grid">
        <div class="field wide"><span class="field-label">色调</span><div class="tone-options">${toneOptions}</div></div>
        <div class="field wide"><label for="project-admin-note">后台备注</label><textarea id="project-admin-note" name="adminNote" maxlength="500" placeholder="仅后台可见，例如来源、复核日期或待补充内容。">${escapeHtml(link.adminNote || "")}</textarea></div>
        <label class="toggle-field wide"><input name="enabled" type="checkbox" ${link.enabled !== false ? "checked" : ""} /><span class="toggle-track" aria-hidden="true"></span><span class="toggle-copy">在前台显示<small>关闭后，前台不再展示这篇教程。</small></span></label>
      </div></section>
      <footer class="form-footer"><span class="form-footer-note">${existing ? "编辑会保留原排序位置。" : "新教程会添加到所属分类的末尾。"}</span><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" ${noCategories ? "disabled" : ""}><span>保存教程</span><i data-lucide="check" aria-hidden="true"></i></button></div></footer>
    </form>
  </section></div>`;
}

function renderCategoryModal(category) {
  const existing = Boolean(category.id);
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal small" role="dialog" aria-modal="true" aria-labelledby="category-editor-title">
    <header class="modal-header"><div><h2 id="category-editor-title">${existing ? "编辑分类" : "新建分类"}</h2><p>分类名称会显示在首页的项目索引中。</p></div><button class="icon-button modal-close" type="button" data-action="close-modal" title="关闭" aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <form class="editor-form" data-form="category">
      <div class="field-stack">
        <div class="field"><label for="category-name">分类名称</label><input id="category-name" name="name" maxlength="40" value="${escapeAttribute(category.name || "")}" placeholder="例如：生活权益" required /></div>
        <div class="field"><label for="category-description">分类说明</label><textarea id="category-description" name="description" maxlength="120" placeholder="用于告诉用户这个分类包含什么内容。">${escapeHtml(category.description || "")}</textarea></div>
        <label class="toggle-field"><input name="enabled" type="checkbox" ${category.enabled !== false ? "checked" : ""} /><span class="toggle-track" aria-hidden="true"></span><span class="toggle-copy">在前台显示<small>隐藏分类会同时隐藏其中的项目教程。</small></span></label>
      </div>
      <footer class="form-footer"><span class="form-footer-note">${existing ? "修改名称会同步更新其中的项目。" : "新分类会排在现有分类最后。"}</span><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit"><span>保存分类</span><i data-lucide="check" aria-hidden="true"></i></button></div></footer>
    </form>
  </section></div>`;
}

function renderDeleteProjectModal(link) {
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal small" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
    <header class="modal-header"><div><h2 id="delete-project-title">删除项目教程</h2><p>此操作无法撤销。</p></div><button class="icon-button modal-close" type="button" data-action="close-modal" title="关闭" aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <form class="confirm-body" data-form="delete-project"><p>将删除「<strong>${escapeHtml(link.title)}</strong>」及其教程内容。</p><div class="confirm-warning">前台会立即停止展示这篇教程，访问统计历史不会删除。</div><div class="modal-actions" style="margin-top:18px"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="danger-button" type="submit"><i data-lucide="trash-2" aria-hidden="true"></i><span>确认删除</span></button></div></form>
  </section></div>`;
}

function renderDeleteCategoryModal(category) {
  const links = state.links.filter((item) => item.category === category.name);
  const targets = state.categories.filter((item) => item.id !== category.id).map((item) => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  const transfer = links.length ? `<div class="field"><label for="delete-category-target">教程转移到</label><select id="delete-category-target" name="targetCategoryId" required>${targets}</select><p class="field-help">该分类的 ${links.length} 篇教程会随删除一并转移。</p></div>` : "";
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal small" role="dialog" aria-modal="true" aria-labelledby="delete-category-title">
    <header class="modal-header"><div><h2 id="delete-category-title">删除分类</h2><p>此操作无法撤销。</p></div><button class="icon-button modal-close" type="button" data-action="close-modal" title="关闭" aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <form class="confirm-body" data-form="delete-category"><p>将删除「<strong>${escapeHtml(category.name)}</strong>」。</p>${transfer}<div class="confirm-warning">${links.length ? "教程会转移到所选分类后再删除当前分类。" : "该分类中没有教程，可以直接删除。"}</div><div class="modal-actions" style="margin-top:18px"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="danger-button" type="submit" ${state.categories.length <= 1 ? "disabled" : ""}><i data-lucide="trash-2" aria-hidden="true"></i><span>确认删除</span></button></div></form>
  </section></div>`;
}

async function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (!action) return;
  if (action === "modal-backdrop" && event.target !== button) return;
  event.preventDefault();

  try {
    if (action === "navigate") {
      state.activeView = button.dataset.view || "dashboard";
      state.contentError = "";
      render();
      return;
    }
    if (action === "toggle-theme") return toggleTheme();
    if (action === "logout") return logout();
    if (action === "refresh-workspace") return loadWorkspace();
    if (action === "refresh-navigation") return refreshNavigation();
    if (action === "new-project") return openProjectEditor();
    if (action === "new-category") return openCategoryEditor();
    if (action === "close-modal" || action === "modal-backdrop") {
      state.modal = null;
      render();
      return;
    }

    const id = button.dataset.id;
    if (action === "edit-project") return openProjectEditor(findLink(id));
    if (action === "delete-project") return openDeleteProject(findLink(id));
    if (action === "toggle-project") return toggleProject(findLink(id));
    if (action === "move-project-up") return moveProject(findLink(id), -1);
    if (action === "move-project-down") return moveProject(findLink(id), 1);
    if (action === "edit-category") return openCategoryEditor(findCategory(id));
    if (action === "delete-category") return openDeleteCategory(findCategory(id));
    if (action === "toggle-category") return toggleCategory(findCategory(id));
    if (action === "move-category-up") return moveCategory(findCategory(id), -1);
    if (action === "move-category-down") return moveCategory(findCategory(id), 1);
  } catch (error) {
    handleActionError(error);
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter) submitter.disabled = true;
  try {
    if (form.dataset.form === "login") await login(form);
    if (form.dataset.form === "stats-filter") await updateStatsFilter(form);
    if (form.dataset.form === "project-filter") updateProjectFilter(form);
    if (form.dataset.form === "project") await saveProject(form);
    if (form.dataset.form === "category") await saveCategory(form);
    if (form.dataset.form === "delete-project") await deleteProject();
    if (form.dataset.form === "delete-category") await deleteCategory(form);
  } catch (error) {
    handleActionError(error);
  } finally {
    if (submitter?.isConnected) submitter.disabled = false;
  }
}

function handleChange(event) {
  const control = event.target;
  if (control.matches("[data-control='project-category']")) {
    state.projectCategory = control.value;
    render();
  }
}

function handleKeydown(event) {
  if (event.key === "Escape" && state.modal) {
    state.modal = null;
    render();
  }
}

async function login(form) {
  const data = new FormData(form);
  const payload = await api("/auth/login", { method: "POST", body: { username: data.get("username"), password: data.get("password") } });
  state.session = { authenticated: true, username: payload.username || String(data.get("username") || "管理员") };
  state.contentError = "";
  showToast("已登录后台");
  await loadWorkspace();
}

async function logout() {
  try { await api("/auth/logout", { method: "POST" }); } catch (error) { if (error.status !== 401) throw error; }
  state.session = null;
  state.modal = null;
  state.contentError = "";
  render();
}

async function updateStatsFilter(form) {
  const data = new FormData(form);
  const from = String(data.get("from") || "");
  const to = String(data.get("to") || "");
  if (!from || !to || from > to) throw new Error("请填写有效的开始和结束日期");
  state.statsFrom = from;
  state.statsTo = to;
  state.loading = true;
  render();
  try {
    await loadStats();
  } finally {
    state.loading = false;
    render();
  }
}

function updateProjectFilter(form) {
  const data = new FormData(form);
  state.projectSearch = String(data.get("search") || "").trim();
  state.projectCategory = String(data.get("category") || "all");
  render();
}

function openProjectEditor(link = null) {
  const defaultCategory = state.categories[0]?.name || "";
  state.modal = { type: "project", entity: link ? { ...link } : { category: defaultCategory, title: "", mark: nextMark(), tone: "teal", status: "待核实", description: "", note: "", adminNote: "", cover: "", guide: "", tips: "", steps: [], url: "", enabled: true } };
  render();
}

function openCategoryEditor(category = null) {
  state.modal = { type: "category", entity: category ? { ...category } : { name: "", description: "", enabled: true } };
  render();
}

function openDeleteProject(link) {
  if (!link) return;
  state.modal = { type: "delete-project", entity: link };
  render();
}

function openDeleteCategory(category) {
  if (!category) return;
  state.modal = { type: "delete-category", entity: category };
  render();
}

async function saveProject(form) {
  const modal = state.modal;
  const existing = modal?.entity;
  if (!existing) return;
  const data = new FormData(form);
  const guide = String(data.get("guide") || "").trim();
  const steps = guide ? guide.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
  if (steps.length > 100) throw new Error("教程正文最多支持 100 行步骤");
  const enabled = data.get("enabled") === "on";
  const payload = {
    category: String(data.get("category") || ""),
    title: String(data.get("title") || ""),
    mark: String(data.get("mark") || ""),
    tone: String(data.get("tone") || "teal"),
    status: String(data.get("status") || ""),
    description: String(data.get("description") || ""),
    note: String(data.get("note") || ""),
    url: String(data.get("url") || ""),
    cover: String(data.get("cover") || ""),
    guide,
    steps,
    tips: String(data.get("tips") || ""),
    adminNote: String(data.get("adminNote") || ""),
  };
  let result;
  if (existing.id) {
    result = await api(`/admin/links/${encodeURIComponent(existing.id)}`, { method: "PUT", body: { ...payload, updatedAt: existing.updatedAt } });
  } else {
    result = await api("/admin/links", { method: "POST", body: payload });
  }
  let saved = result.link;
  if (saved && saved.enabled !== enabled) {
    const visibility = await api(`/admin/links/${encodeURIComponent(saved.id)}/enabled`, { method: "PATCH", body: { enabled, updatedAt: saved.updatedAt } });
    saved = visibility.link || saved;
  }
  state.modal = null;
  await refreshNavigation(false);
  showToast(existing.id ? "教程已更新" : "教程已新建");
}

async function saveCategory(form) {
  const modal = state.modal;
  const existing = modal?.entity;
  if (!existing) return;
  const data = new FormData(form);
  const enabled = data.get("enabled") === "on";
  const payload = { name: String(data.get("name") || ""), description: String(data.get("description") || "") };
  let result;
  if (existing.id) {
    result = await api(`/admin/categories/${encodeURIComponent(existing.id)}`, { method: "PUT", body: { ...payload, updatedAt: existing.updatedAt } });
  } else {
    result = await api("/admin/categories", { method: "POST", body: payload });
  }
  let saved = result.category;
  if (saved && saved.enabled !== enabled) {
    const visibility = await api(`/admin/categories/${encodeURIComponent(saved.id)}/enabled`, { method: "PATCH", body: { enabled, updatedAt: saved.updatedAt } });
    saved = visibility.category || saved;
  }
  state.modal = null;
  await refreshNavigation(false);
  showToast(existing.id ? "分类已更新" : "分类已新建");
}

async function deleteProject() {
  const link = state.modal?.entity;
  if (!link?.id) return;
  await api(`/admin/links/${encodeURIComponent(link.id)}`, { method: "DELETE", body: { updatedAt: link.updatedAt } });
  state.modal = null;
  await refreshNavigation(false);
  showToast("教程已删除");
}

async function deleteCategory(form) {
  const category = state.modal?.entity;
  if (!category?.id) return;
  const data = new FormData(form);
  await api(`/admin/categories/${encodeURIComponent(category.id)}`, { method: "DELETE", body: { updatedAt: category.updatedAt, targetCategoryId: String(data.get("targetCategoryId") || "") } });
  state.modal = null;
  await refreshNavigation(false);
  showToast("分类已删除");
}

async function toggleProject(link) {
  if (!link) return;
  await api(`/admin/links/${encodeURIComponent(link.id)}/enabled`, { method: "PATCH", body: { enabled: link.enabled === false, updatedAt: link.updatedAt } });
  await refreshNavigation(false);
  showToast(link.enabled === false ? "教程已显示到前台" : "教程已从前台隐藏");
}

async function toggleCategory(category) {
  if (!category) return;
  await api(`/admin/categories/${encodeURIComponent(category.id)}/enabled`, { method: "PATCH", body: { enabled: category.enabled === false, updatedAt: category.updatedAt } });
  await refreshNavigation(false);
  showToast(category.enabled === false ? "分类已显示到前台" : "分类已从前台隐藏");
}

async function moveProject(link, direction) {
  if (!link) return;
  const category = state.categories.find((item) => item.name === link.category);
  const links = sortByPosition(state.links.filter((item) => item.category === link.category));
  const index = links.findIndex((item) => item.id === link.id);
  const target = index + direction;
  if (!category || target < 0 || target >= links.length) return;
  [links[index], links[target]] = [links[target], links[index]];
  await api("/admin/reorder", { method: "POST", body: { categoryId: category.id, categoryUpdatedAt: category.updatedAt, items: links.map((item) => ({ id: item.id, updatedAt: item.updatedAt })) } });
  await refreshNavigation(false);
  showToast("教程排序已更新");
}

async function moveCategory(category, direction) {
  if (!category) return;
  const categories = sortByPosition([...state.categories]);
  const index = categories.findIndex((item) => item.id === category.id);
  const target = index + direction;
  if (target < 0 || target >= categories.length) return;
  [categories[index], categories[target]] = [categories[target], categories[index]];
  await api("/admin/categories/reorder", { method: "POST", body: { items: categories.map((item) => ({ id: item.id, updatedAt: item.updatedAt })) } });
  await refreshNavigation(false);
  showToast("分类排序已更新");
}

async function refreshNavigation(showMessage = true) {
  await loadNavigation();
  state.contentError = "";
  render();
  if (showMessage) showToast("列表已刷新");
}

function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  render();
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function filteredLinks() {
  const search = state.projectSearch.toLocaleLowerCase("zh-CN");
  const category = state.categories.find((item) => item.id === state.projectCategory);
  return state.links.filter((link) => {
    if (category && link.category !== category.name) return false;
    if (!search) return true;
    return [link.title, link.description, link.note, link.status, link.category].some((value) => String(value || "").toLocaleLowerCase("zh-CN").includes(search));
  });
}

function findLink(id) { return state.links.find((item) => item.id === id) || null; }
function findCategory(id) { return state.categories.find((item) => item.id === id) || null; }

function nextMark() {
  const number = state.links.length + 1;
  return String(number).padStart(2, "0");
}

function normalizeStats(payload) {
  const overview = payload?.overview || payload?.totals || payload?.summary || {};
  return {
    overview: {
      events: statValue(overview, ["events", "totalEvents", "total"]),
      categoryViews: statValue(overview, ["categoryViews", "categories", "views"]),
      linkClicks: statValue(overview, ["linkClicks", "projectClicks", "clicks"]),
      uniqueVisitors: statValue(overview, ["uniqueVisitors", "uniqueIps", "uniqueIPs", "ips"]),
    },
    categories: array(payload?.categories || payload?.byCategory),
    projects: array(payload?.projects || payload?.byProject),
    hourly: array(payload?.hourly || payload?.timeline),
    recent: array(payload?.ipSources).length ? array(payload.ipSources) : array(payload?.recent || payload?.sources),
    range: payload?.range || null,
    error: "",
  };
}

function emptyStats(error = "") {
  return { overview: { events: 0, categoryViews: 0, linkClicks: 0, uniqueVisitors: 0 }, categories: [], projects: [], hourly: [], recent: [], range: null, error };
}

function sortByPosition(items) {
  return [...items].sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0) || String(left.name || left.title || "").localeCompare(String(right.name || right.title || ""), "zh-CN"));
}

function sortLinks(links, categories) {
  const positions = new Map(categories.map((category, index) => [category.name, Number(category.position ?? index)]));
  return [...links].sort((left, right) => (positions.get(left.category) ?? 9999) - (positions.get(right.category) ?? 9999) || Number(left.position ?? 0) - Number(right.position ?? 0) || String(left.title || "").localeCompare(String(right.title || ""), "zh-CN"));
}

function statValue(item, keys) {
  for (const key of keys) {
    const value = Number(item?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function array(value) { return Array.isArray(value) ? value : []; }
function formatNumber(value) { return new Intl.NumberFormat("zh-CN").format(Number(value) || 0); }
function dateInputValue(date) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }
function daysAgo(days) { return new Date(Date.now() - days * 86_400_000); }

function formatDateTime(value) {
  const time = new Date(value);
  if (!value || Number.isNaN(time.getTime())) return value || "--";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(time);
}

function formatTimelineTime(value) {
  if (!value) return "--";
  const time = new Date(value);
  if (!Number.isNaN(time.getTime())) return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", hour12: false }).format(time);
  return String(value).replace("T", " ").slice(5, 16);
}

function stepsToText(steps) {
  return array(steps).map((step) => typeof step === "string" ? step : [step?.title, step?.content || step?.text || step?.description].filter(Boolean).join("：")).filter(Boolean).join("\n");
}

function safeImageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch { return ""; }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }

function refreshIcons() {
  window.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
}

function showToast(message, type = "success") {
  const region = document.querySelector("#toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function handleActionError(error) {
  if (error?.status === 401) return;
  showToast(error?.message || "操作没有完成", "error");
  if (error?.status === 409) refreshNavigation(false).catch(() => {});
}
