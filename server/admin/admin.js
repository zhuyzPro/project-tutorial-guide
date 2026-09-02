const API_BASE = String(window.NAVIGUIDE_API_BASE || "/api").replace(/\/$/, "");
const THEME_KEY = "guide-admin-theme";
const DATA_NAV_KEY = "guide-admin-data-nav-expanded";
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
const DATA_VIEWS = new Set(["dashboard", "analytics-trend", "analytics-sources", "analytics-projects"]);

const state = {
  session: null,
  categories: [],
  links: [],
  stats: emptyStats(),
  statsFrom: dateInputValue(daysAgo(6)),
  statsTo: dateInputValue(new Date()),
  statsPreset: "7d",
  statsGranularity: "hour",
  activeView: "dashboard",
  dataNavExpanded: readStoredDataNavExpanded(),
  projectSearch: "",
  projectCategory: "all",
  projectPreviewMode: "front",
  modal: null,
  loading: false,
  statsLoading: false,
  statsBusyTimer: 0,
  statsBusyVisible: false,
  statsRequestId: 0,
  statsAbortController: null,
  statsTimeoutTimer: 0,
  contentError: "",
};

let projectPreviewSync = null;

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", handleChange);
  document.addEventListener("input", handleInput);
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
  } catch (error) {
    if (error?.name === "AbortError") throw error;
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
  if (!state.session || state.loading) return;
  cancelStatsRequest();
  const statsRequestId = ++state.statsRequestId;
  if (state.statsBusyTimer) window.clearTimeout(state.statsBusyTimer);
  state.statsLoading = false;
  state.statsBusyVisible = false;
  state.statsBusyTimer = 0;
  state.loading = true;
  state.contentError = "";
  render();
  const [navigationResult, statsResult] = await Promise.allSettled([loadNavigation(), loadStats(statsRequestId)]);
  if (navigationResult.status === "rejected") {
    state.contentError = navigationResult.reason?.message || "无法加载项目和分类";
  }
  if (statsResult.status === "rejected" && statsRequestId === state.statsRequestId) {
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

async function loadStats(requestId = state.statsRequestId, signal) {
  const query = new URLSearchParams({ from: state.statsFrom, to: state.statsTo, granularity: state.statsGranularity });
  const payload = await api(`/admin/stats?${query.toString()}`, signal ? { signal } : {});
  if (requestId !== state.statsRequestId) return false;
  state.stats = normalizeStats(payload);
  return true;
}

function render() {
  const app = document.querySelector("#app");
  if (!app) return;
  destroyProjectPreviewSync();
  document.body.classList.toggle("modal-open", Boolean(state.modal));
  app.className = "";
  app.innerHTML = state.session ? renderShell() : renderLogin();
  refreshIcons();
  if (state.modal?.type === "project") {
    window.requestAnimationFrame(() => {
      const form = document.querySelector("form[data-form='project']");
      updateCoverPreview(form?.querySelector("[data-control='project-cover']")?.value || "");
      updateProjectLivePreview(form);
      setupProjectPreviewSync(form);
    });
  }
}

function renderLogin() {
  const error = state.contentError ? `<div class="load-error" role="alert">${escapeHtml(state.contentError)}</div>` : "";
  return `<main class="login-page" aria-labelledby="login-title">
    <section class="login-intro">
      <div class="brand-lockup"><span class="brand-stamp">Z</span><span><strong>Zhuyz Pro-猪油仔</strong><small>FIELD GUIDE / EDITORIAL DESK</small></span></div>
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
  const content = state.loading ? renderLoading() : renderPage();
  const dataSectionActive = DATA_VIEWS.has(state.activeView);
  const dataNavExpanded = state.dataNavExpanded;
  return `<div class="admin-shell">
    <aside class="sidebar" aria-label="后台导航">
      <nav class="sidebar-nav">
        <span class="sidebar-eyebrow sidebar-eyebrow--content">内容管理</span>
        ${renderNavButton("projects", "folder-plus", "项目教程", state.links.length)}
        ${renderNavButton("categories", "settings-2", "分类管理", state.categories.length)}
        <span class="sidebar-eyebrow sidebar-eyebrow--data">数据中心</span>
        <div class="nav-group">
          ${renderNavButton("dashboard", "layout-dashboard", "数据概览", "", { parent: true, active: dataSectionActive, action: "toggle-data-nav", expanded: dataNavExpanded })}
          <div id="data-overview-subnav" class="nav-subnav${dataNavExpanded ? "" : " is-collapsed"}" aria-label="数据概览子菜单" aria-hidden="${dataNavExpanded ? "false" : "true"}">
            ${renderNavButton("dashboard", "chart-column", "总览", "", { sub: true })}
            ${renderNavButton("analytics-trend", "activity", "访问趋势", "", { sub: true })}
            ${renderNavButton("analytics-sources", "globe-2", "访问来源", "", { sub: true })}
            ${renderNavButton("analytics-projects", "mouse-pointer-click", "项目点击", "", { sub: true })}
          </div>
        </div>
      </nav>
      <div class="sidebar-note"><span>当前可见教程</span><strong>${formatNumber(state.links.filter((item) => item.enabled !== false).length)} 篇</strong></div>
    </aside>
    <main id="workspace" class="workspace" tabindex="-1">
      <header class="topbar">
        <div class="topbar-brand"><span class="brand-stamp">Z</span><span><strong>Zhuyz Pro-猪油仔</strong><small>PROJECT TUTORIAL DESK</small></span></div>
        <div class="topbar-actions">
          <span class="account-name" title="${escapeAttribute(state.session.username || "管理员")}">${escapeHtml(state.session.username || "管理员")}</span>
          <button class="icon-button" type="button" data-action="toggle-theme" title="切换主题" aria-label="切换主题"><i data-lucide="${currentTheme() === "dark" ? "sun" : "moon"}" aria-hidden="true"></i></button>
          <button class="icon-button logout-button" type="button" data-action="logout" title="退出登录" aria-label="退出登录"><i data-lucide="log-out" aria-hidden="true"></i></button>
        </div>
      </header>
      <div class="page-content">${content}</div>
    </main>
    <div class="admin-gutter" aria-hidden="true"></div>
  </div>${renderModal()}`;
}

function renderNavButton(view, icon, label, count, options = {}) {
  const active = options.active ?? (state.activeView === view);
  const classes = ["nav-button", active ? "active" : "", options.parent ? "nav-parent" : "", options.sub ? "nav-button-sub" : ""].filter(Boolean).join(" ");
  const current = active && !options.parent ? ` aria-current="page"` : "";
  const action = options.action || "navigate";
  const expanded = options.parent ? ` aria-expanded="${options.expanded !== false ? "true" : "false"}" aria-controls="data-overview-subnav"` : "";
  const chevron = options.parent ? `<i class="nav-chevron" data-lucide="chevron-down" aria-hidden="true"></i>` : "";
  return `<button class="${classes}" type="button" data-action="${action}" data-view="${view}"${current}${expanded}><i data-lucide="${icon}" aria-hidden="true"></i><span class="nav-label">${label}</span>${count !== "" ? `<span class="nav-count">${formatNumber(count)}</span>` : ""}${chevron}</button>`;
}

function renderLoading() {
  return `<section class="empty-state" role="status"><div><strong>正在同步内容</strong><p>项目、分类和访问数据正在读取。</p></div></section>`;
}

function renderPage() {
  if (state.activeView === "projects") return renderProjects();
  if (state.activeView === "categories") return renderCategories();
  if (state.activeView === "analytics-trend") return renderAnalyticsTrend();
  if (state.activeView === "analytics-sources") return renderAnalyticsSources();
  if (state.activeView === "analytics-projects") return renderAnalyticsProjects();
  return renderDashboard();
}

function renderDashboard() {
  const overview = state.stats.overview;
  const rangeLabel = statsRangeLabel();
  const categoryRows = state.stats.categories.slice(0, 6);
  const projectRows = state.stats.projects.slice(0, 6);
  const sourceRows = state.stats.recent.slice(0, 5);
  return `${renderPageHeading("数据概览", "先看整体访问，再进入趋势、来源或项目点击明细。", `<button class="secondary-button" type="button" data-action="refresh-stats"><i data-lucide="refresh-cw" aria-hidden="true"></i><span>刷新数据</span></button>`)}
    ${renderStatsToolbar()}
    <div class="stats-results" data-stats-results aria-busy="false">
    ${renderContentError()}
    ${renderMetricGrid([
      ["pine", "独立访客（按 IP）", overview.uniqueVisitors, "按 IP 去重，不等同于真实用户数"],
      ["blue", "访问次数", overview.events, `统计区间：${rangeLabel}`],
      ["amber", "项目点击次数", overview.linkClicks, "教程入口被点击的次数"],
      ["coral", "分类浏览次数", overview.categoryViews, "访客选择分类的次数"],
    ])}
    <section class="dashboard-grid">
      <article class="panel span-two">
        <div class="panel-header">
          <div><h2 class="panel-title">访问趋势</h2><p class="panel-caption">${state.statsGranularity === "day" ? "按天" : "按小时"}汇总访问次数。</p></div>
          <button class="quiet-button panel-link" type="button" data-action="navigate" data-view="analytics-trend">查看趋势明细 <i data-lucide="arrow-up-right" aria-hidden="true"></i></button>
        </div>
        <div class="panel-body">${renderTimeline(state.stats.hourly, rangeLabel, state.stats.error)}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">热门分类</h2><p class="panel-caption">分类浏览与项目点击</p></div><span class="panel-summary">${formatNumber(categoryRows.length)} 项</span></div>
        <div class="panel-body">${renderCategoryStats(categoryRows)}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">热门项目</h2><p class="panel-caption">访问者最常点击的教程</p></div><button class="quiet-button panel-link" type="button" data-action="navigate" data-view="analytics-projects">全部 <i data-lucide="arrow-up-right" aria-hidden="true"></i></button></div>
        <div class="panel-body">${renderProjectStats(projectRows)}</div>
      </article>
      <article class="panel span-two">
        <div class="panel-header"><div><h2 class="panel-title">访问来源</h2><p class="panel-caption">按完整 IP 汇总，次数代表该来源在区间内的访问次数。</p></div><div class="panel-header-actions"><span class="panel-summary">共 ${formatNumber(state.stats.sourceCount)} 个来源</span><button class="quiet-button panel-link" type="button" data-action="navigate" data-view="analytics-sources">查看全部 <i data-lucide="arrow-up-right" aria-hidden="true"></i></button></div></div>
        <div class="panel-body">${renderSourceSummary(sourceRows)}</div>
      </article>
    </section>
    </div>`;
}

function renderAnalyticsTrend() {
  const overview = state.stats.overview;
  const rangeLabel = statsRangeLabel();
  return `${renderPageHeading("访问趋势", "按时间粒度观察前台访问次数变化，定位高峰和低谷。", `<button class="secondary-button" type="button" data-action="refresh-stats"><i data-lucide="refresh-cw" aria-hidden="true"></i><span>刷新数据</span></button>`)}
    ${renderStatsToolbar()}
    <div class="stats-results" data-stats-results aria-busy="false">
    ${renderContentError()}
    ${renderMetricGrid([
      ["pine", "访问次数", overview.events, `统计区间：${rangeLabel}`],
      ["blue", "独立访客（按 IP）", overview.uniqueVisitors, "按 IP 去重，不等同于真实用户数"],
      ["amber", "分类浏览次数", overview.categoryViews, "进入分类页的次数"],
      ["coral", "项目点击次数", overview.linkClicks, "教程入口点击次数"],
    ])}
    <section class="dashboard-grid analytics-grid">
      <article class="panel span-two">
        <div class="panel-header"><div><h2 class="panel-title">访问次数趋势</h2><p class="panel-caption">柱高表示${state.statsGranularity === "day" ? "当天" : "该小时"}的访问次数。</p></div><span class="panel-summary">${escapeHtml(rangeLabel)}</span></div>
        <div class="panel-body">${renderTimeline(state.stats.hourly, rangeLabel, state.stats.error)}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">分类访问结构</h2><p class="panel-caption">按分类浏览次数排序</p></div></div>
        <div class="panel-body">${renderCategoryStats(state.stats.categories.slice(0, 8))}</div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2 class="panel-title">项目点击结构</h2><p class="panel-caption">按教程点击次数排序</p></div></div>
        <div class="panel-body">${renderProjectStats(state.stats.projects.slice(0, 8))}</div>
      </article>
    </section>
    </div>`;
}

function renderAnalyticsSources() {
  const overview = state.stats.overview;
  const rows = state.stats.recent;
  const sourceCount = Number(state.stats.sourceCount ?? rows.length) || 0;
  const average = sourceCount ? overview.events / sourceCount : 0;
  const latest = rows.reduce((current, row) => {
    const candidate = row.lastSeenAt || row.createdAt || row.timestamp || row.time || "";
    if (!candidate) return current;
    if (!current) return candidate;
    return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
  }, "") || "--";
  const sourceDisplayNote = sourceCount > rows.length ? `当前展示访问次数最高的 ${formatNumber(rows.length)} 个来源` : "访问次数按当前筛选区间汇总";
  return `${renderPageHeading("访问来源", "查看访客完整 IP、访问次数与活跃时间，便于识别来源质量。", `<button class="secondary-button" type="button" data-action="refresh-stats"><i data-lucide="refresh-cw" aria-hidden="true"></i><span>刷新数据</span></button>`)}
    ${renderStatsToolbar()}
    <div class="stats-results" data-stats-results aria-busy="false">
    ${renderContentError()}
    ${renderMetricGrid([
      ["pine", "来源数", sourceCount, "当前区间内的 IP 来源"],
      ["blue", "访问次数", overview.events, "所有来源合计"],
      ["amber", "平均每来源", formatDecimal(average), "访问次数 ÷ 来源数"],
      ["coral", "最近活跃", formatDateTime(latest), "来源列表中的最新访问"],
    ])}
    <article class="panel sources-panel">
      <div class="panel-header"><div><h2 class="panel-title">IP 来源明细</h2><p class="panel-caption">IP 按完整地址展示；${escapeHtml(sourceDisplayNote)}。</p></div><span class="panel-summary">共 ${formatNumber(sourceCount)} 个来源</span></div>
      <div class="panel-body">${renderRecentStats(rows)}</div>
    </article>
    </div>`;
}

function renderAnalyticsProjects() {
  const overview = state.stats.overview;
  const rows = state.stats.projects;
  const top = rows[0];
  const topTitle = top?.linkTitle || top?.title || "--";
  const average = rows.length ? overview.linkClicks / rows.length : 0;
  return `${renderPageHeading("项目点击", "按项目查看教程入口点击次数，帮助你判断哪些内容最值得持续维护。", `<button class="secondary-button" type="button" data-action="refresh-stats"><i data-lucide="refresh-cw" aria-hidden="true"></i><span>刷新数据</span></button>`)}
    ${renderStatsToolbar()}
    <div class="stats-results" data-stats-results aria-busy="false">
    ${renderContentError()}
    ${renderMetricGrid([
      ["pine", "项目点击次数", overview.linkClicks, "当前区间内的教程点击"],
      ["blue", "有点击项目", rows.length, "至少产生 1 次点击的项目"],
      ["amber", "平均每项目", formatDecimal(average), "点击次数 ÷ 有点击项目"],
      ["coral", "最高点击项目", top ? formatNumber(statValue(top, ["clicks", "linkClicks", "count"])) : "0", topTitle],
    ])}
    <article class="panel project-stats-panel">
      <div class="panel-header"><div><h2 class="panel-title">项目点击明细</h2><p class="panel-caption">按点击次数从高到低排列。</p></div><span class="panel-summary">共 ${formatNumber(rows.length)} 个项目</span></div>
      <div class="panel-body">${renderProjectRanking(rows)}</div>
    </article>
    </div>`;
}

function renderMetricGrid(items) {
  return `<section class="metric-grid" aria-label="统计摘要">${items.map(([tone, label, value, note]) => renderMetric(tone, label, value, note)).join("")}</section>`;
}

function renderStatsToolbar() {
  const presets = [["today", "今天"], ["7d", "近 7 天"], ["30d", "近 30 天"], ["90d", "近 90 天"]];
  const granularity = state.statsGranularity === "day" ? "day" : "hour";
  const today = dateInputValue(new Date());
  const loading = state.statsLoading;
  const busy = loading && state.statsBusyVisible;
  const shellClass = busy ? " is-loading" : loading ? " is-pending" : "";
  const disabled = loading ? " disabled" : "";
  return `<section class="stats-toolbar${shellClass}" data-stats-toolbar aria-label="统计筛选" aria-busy="${loading ? "true" : "false"}">
    <div class="range-presets" role="group" aria-label="常用时间范围">${presets.map(([value, label]) => `<button class="range-preset ${state.statsPreset === value ? "active" : ""}" type="button" data-action="set-stats-range" data-range="${value}" aria-pressed="${state.statsPreset === value ? "true" : "false"}"${disabled}>${label}</button>`).join("")}<span class="range-current" data-stats-range-label>${escapeHtml(statsRangeLabel())}</span><span class="stats-status" data-stats-status role="status" aria-live="polite"${busy ? "" : " hidden"}><i data-lucide="refresh-cw" aria-hidden="true"></i><span>正在更新统计</span></span></div>
    <form class="range-control" data-form="stats-filter">
      <label class="range-field"><span>开始日期</span><input class="date-input" name="from" type="date" value="${escapeAttribute(state.statsFrom)}" max="${escapeAttribute(today)}" required${disabled} /></label>
      <label class="range-field"><span>结束日期</span><input class="date-input" name="to" type="date" value="${escapeAttribute(state.statsTo)}" max="${escapeAttribute(today)}" required${disabled} /></label>
      <label class="range-field"><span>统计粒度</span><select class="date-input granularity-select" name="granularity"${disabled}><option value="hour" ${granularity === "hour" ? "selected" : ""}>按小时</option><option value="day" ${granularity === "day" ? "selected" : ""}>按天</option></select></label>
      <button class="secondary-button stats-reset" type="button" data-action="reset-stats-filter"${disabled}>重置筛选条件</button>
      <button class="secondary-button stats-submit" data-role="stats-submit" type="submit" aria-busy="${loading ? "true" : "false"}"${disabled}><i class="stats-submit-icon${busy ? " is-spinning" : ""}" data-lucide="filter" aria-hidden="true"></i><span data-stats-submit-label>${busy ? "更新中…" : "应用筛选"}</span></button>
    </form>
  </section>`;
}

function syncStatsToolbar() {
  const toolbar = document.querySelector("[data-stats-toolbar]");
  const loading = state.statsLoading;
  const busy = loading && state.statsBusyVisible;
  if (!toolbar) {
    syncStatsResultsBusy();
    syncStatsRefreshButtons();
    return;
  }
  toolbar.classList.toggle("is-loading", busy);
  toolbar.classList.toggle("is-pending", loading && !busy);
  toolbar.setAttribute("aria-busy", loading ? "true" : "false");
  toolbar.querySelectorAll(".range-preset").forEach((button) => {
    const active = button.dataset.range === state.statsPreset;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.disabled = loading;
  });
  const rangeLabel = toolbar.querySelector("[data-stats-range-label]");
  if (rangeLabel) rangeLabel.textContent = statsRangeLabel();
  const from = toolbar.querySelector("[name='from']");
  const to = toolbar.querySelector("[name='to']");
  const granularity = toolbar.querySelector("[name='granularity']");
  if (from && from.value !== state.statsFrom) from.value = state.statsFrom;
  if (to && to.value !== state.statsTo) to.value = state.statsTo;
  if (granularity && granularity.value !== state.statsGranularity) granularity.value = state.statsGranularity;
  toolbar.querySelectorAll(".range-field input, .range-field select").forEach((control) => { control.disabled = loading; });
  const status = toolbar.querySelector("[data-stats-status]");
  if (status) status.hidden = !busy;
  const submit = toolbar.querySelector("[data-role='stats-submit']");
  if (submit) {
    submit.disabled = loading;
    submit.setAttribute("aria-busy", loading ? "true" : "false");
  }
  const submitIcon = toolbar.querySelector(".stats-submit-icon");
  if (submitIcon) submitIcon.classList.toggle("is-spinning", busy);
  const submitLabel = toolbar.querySelector("[data-stats-submit-label]");
  if (submitLabel) submitLabel.textContent = busy ? "更新中…" : "应用筛选";
  const reset = toolbar.querySelector("[data-action='reset-stats-filter']");
  if (reset) reset.disabled = loading;
  syncStatsResultsBusy();
  syncStatsRefreshButtons();
}

function syncStatsRefreshButtons() {
  document.querySelectorAll("[data-action='refresh-stats']").forEach((button) => {
    button.disabled = state.statsLoading;
    button.setAttribute("aria-busy", state.statsLoading ? "true" : "false");
    button.classList.toggle("is-loading", state.statsLoading);
  });
}

function syncStatsResultsBusy() {
  const results = document.querySelector("[data-stats-results]");
  if (results) results.setAttribute("aria-busy", state.statsLoading ? "true" : "false");
}

function renderStatsResultsOnly() {
  const results = document.querySelector("[data-stats-results]");
  if (!results) {
    if (state.loading || !state.session) render();
    return;
  }
  if (state.loading || !state.session) {
    render();
    return;
  }
  const template = document.createElement("template");
  template.innerHTML = renderPage().trim();
  const nextResults = template.content.querySelector("[data-stats-results]");
  if (!nextResults) {
    return;
  }
  results.innerHTML = nextResults.innerHTML;
  results.setAttribute("aria-busy", "false");
  refreshIcons(results);
}

function renderMetric(tone, label, value, note) {
  const textValue = typeof value === "string" && value.trim() && !/^-?\d+(?:\.\d+)?$/.test(value.trim());
  return `<article class="metric ${tone}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value ${textValue ? "metric-value-text" : ""}">${formatMetricValue(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></article>`;
}

function renderTimeline(points, rangeLabel, error) {
  if (error) return `<div class="empty-chart">${escapeHtml(error)}</div>`;
  if (!points.length) return `<div class="empty-chart">${escapeHtml(rangeLabel)} 暂无访问记录</div>`;
  const visible = points.slice(-40);
  const max = Math.max(1, ...visible.map((item) => statValue(item, ["events", "count", "value"])));
  const bars = visible.map((item) => {
    const events = statValue(item, ["events", "count", "value"]);
    const label = `${formatTimelineTime(item.timestamp || item.time || item.hour || "", state.statsGranularity)} · ${formatNumber(events)} 次`;
    const height = Math.max(4, Math.round((events / max) * 100));
    return `<span class="timeline-bar" style="--height:${height}%" data-label="${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}"></span>`;
  }).join("");
  const first = formatTimelineTime(visible[0]?.timestamp || visible[0]?.time || visible[0]?.hour || "", state.statsGranularity);
  const last = formatTimelineTime(visible.at(-1)?.timestamp || visible.at(-1)?.time || visible.at(-1)?.hour || "", state.statsGranularity);
  return `<div class="timeline" style="--columns:${visible.length}" role="img" aria-label="${escapeAttribute(`${rangeLabel} 的访问趋势`)}">${bars}</div><div class="timeline-labels"><span>${escapeHtml(first)}</span><span>${escapeHtml(last)}</span></div>`;
}

function renderCategoryStats(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有分类浏览记录");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>分类</th><th class="numeric">浏览次数</th><th class="numeric">点击次数</th></tr></thead><tbody>${rows.map((row) => {
    const name = row.categoryName || row.name || row.title || "未分类";
    return `<tr><td><span class="table-main">${escapeHtml(name)}</span></td><td class="numeric">${formatNumber(statValue(row, ["categoryViews", "views", "viewCount"]))}</td><td class="numeric">${formatNumber(statValue(row, ["linkClicks", "clicks", "clickCount"]))}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderProjectStats(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有项目点击记录");
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>项目</th><th class="numeric">点击次数</th></tr></thead><tbody>${rows.map((row) => {
    const title = row.linkTitle || row.title || row.name || "未命名项目";
    const category = row.categoryName || row.category || "";
    return `<tr><td><span class="table-main">${escapeHtml(title)}</span><span class="table-sub">${escapeHtml(category)}</span></td><td class="numeric">${formatNumber(statValue(row, ["clicks", "linkClicks", "count"]))}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderSourceSummary(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有可展示的访问来源");
  return `<div class="source-summary">${rows.map((row, index) => {
    const source = row.source || row.ip || row.ipSource || row.address || "未记录";
    const events = statValue(row, ["events", "count", "visits"]);
    const time = row.lastSeenAt || row.createdAt || row.timestamp || row.time || "--";
    return `<div class="source-summary-row"><span class="source-rank">${String(index + 1).padStart(2, "0")}</span><div class="source-summary-main"><strong>${escapeHtml(source)}</strong><span>${escapeHtml(formatDateTime(time))}</span></div><strong class="source-events">${formatNumber(events)} <small>次</small></strong></div>`;
  }).join("")}</div>`;
}

function renderRecentStats(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有可展示的访问来源");
  return `<div class="data-table-wrap"><table class="data-table source-table"><thead><tr><th>IP 来源</th><th class="numeric">访问次数</th><th>首次访问</th><th>最近访问</th></tr></thead><tbody>${rows.map((row) => {
    const source = row.source || row.ip || row.ipSource || row.address || "未记录";
    const firstSeen = row.firstSeenAt || row.createdAt || row.timestamp || row.time || "--";
    const lastSeen = row.lastSeenAt || row.createdAt || row.timestamp || row.time || "--";
    const events = statValue(row, ["events", "count", "visits"]);
    return `<tr><td><span class="table-main">${escapeHtml(source)}</span></td><td class="numeric source-events-cell">${formatNumber(events)}</td><td><span class="table-sub">${escapeHtml(formatDateTime(firstSeen))}</span></td><td><span class="table-sub">${escapeHtml(formatDateTime(lastSeen))}</span></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderProjectRanking(rows) {
  if (!rows.length) return renderEmptyTable("当前时段还没有项目点击记录");
  const total = rows.reduce((sum, row) => sum + statValue(row, ["clicks", "linkClicks", "count"]), 0);
  return `<div class="data-table-wrap"><table class="data-table project-ranking-table"><thead><tr><th>#</th><th>项目</th><th>所属分类</th><th class="numeric">点击次数</th><th class="share-column">占比</th></tr></thead><tbody>${rows.map((row, index) => {
    const title = row.linkTitle || row.title || row.name || "未命名项目";
    const category = row.categoryName || row.category || "未分类";
    const clicks = statValue(row, ["clicks", "linkClicks", "count"]);
    const share = total ? (clicks / total) * 100 : 0;
    return `<tr><td class="rank-cell">${String(index + 1).padStart(2, "0")}</td><td><span class="table-main">${escapeHtml(title)}</span></td><td><span class="table-sub">${escapeHtml(category)}</span></td><td class="numeric source-events-cell">${formatNumber(clicks)}</td><td class="share-cell"><span class="share-track"><span class="share-fill" style="--share:${Math.min(100, Math.max(0, share))}%"></span></span><span>${formatPercent(share)}</span></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderEmptyTable(message) {
  return `<p class="table-empty">${escapeHtml(message)}</p>`;
}

function renderProjects() {
  const links = filteredLinks();
  const categoryOptions = [`<option value="all">全部分类</option>`, ...state.categories.map((item) => `<option value="${escapeAttribute(item.id)}" ${state.projectCategory === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)].join("");
  const rows = links.length ? links.map(renderProjectRow).join("") : `<div class="empty-state"><div><strong>${state.links.length ? "没有匹配的教程" : "还没有项目教程"}</strong><p>${state.links.length ? "调整搜索词或分类后再试。" : "先新建一篇项目教程，前台就能开始展示。"}</p></div></div>`;
  return `${renderPageHeading("项目教程", "维护项目介绍、图文教程和排序；前台是否可见请用每行左侧的启用胶囊按钮切换。", `<button class="primary-button" type="button" data-action="new-project"><i data-lucide="plus" aria-hidden="true"></i><span>新建教程</span></button>`)}
    ${renderContentError()}
    <div class="toolbar">
      <form class="toolbar-filters" data-form="project-filter">
        <label class="search-input"><span class="visually-hidden">搜索教程</span><input name="search" value="${escapeAttribute(state.projectSearch)}" placeholder="搜索标题、卡片简介、分类或状态" /></label>
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
    ? `<span class="project-cover has-image"><img src="${escapeAttribute(image)}" alt="" width="64" height="62" loading="lazy" decoding="async" /></span>`
    : `<span class="project-cover">${escapeHtml(link.mark || "指")}</span>`;
  const visibilityLabel = link.enabled === false ? "已隐藏" : "已启用";
  return `<article class="project-row">
    ${cover}
    <div class="project-main"><div class="project-title-row"><span class="status-dot ${link.enabled === false ? "off" : ""}" aria-hidden="true"></span><strong class="project-title">${escapeHtml(link.title)}</strong></div><span class="project-description">${escapeHtml(link.description || "未填写简介")}</span></div>
    <div class="project-meta"><strong>${escapeHtml(link.category || "未分类")}</strong><span>${escapeHtml(link.note || "未填写卡片说明")}</span></div>
    <div class="project-meta"><span class="status-tag ${link.enabled === false ? "off" : ""}">${escapeHtml(link.status || "待核实")}</span></div>
    <button class="visibility-pill ${link.enabled === false ? "is-off" : "is-on"}" type="button" data-action="toggle-project" data-id="${escapeAttribute(link.id)}" aria-pressed="${link.enabled === false ? "false" : "true"}" title="${link.enabled === false ? "点击显示到前台" : "点击从前台隐藏"}"><span class="visibility-pill-dot" aria-hidden="true"></span><span>${visibilityLabel}</span></button>
    <div class="row-actions" aria-label="${escapeAttribute(`${link.title} 的操作`)}">
      <button class="icon-button" type="button" data-action="move-project-up" data-id="${escapeAttribute(link.id)}" title="上移排序" aria-label="上移排序" ${index <= 0 ? "disabled" : ""}><i data-lucide="arrow-up" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="move-project-down" data-id="${escapeAttribute(link.id)}" title="下移排序" aria-label="下移排序" ${index === siblings.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="edit-project" data-id="${escapeAttribute(link.id)}" title="编辑教程" aria-label="编辑教程"><i data-lucide="pencil" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="delete-project" data-id="${escapeAttribute(link.id)}" title="删除教程" aria-label="删除教程"><i data-lucide="trash-2" aria-hidden="true"></i></button>
    </div>
  </article>`;
}

function renderCategories() {
  const rows = state.categories.length ? state.categories.map(renderCategoryRow).join("") : `<div class="empty-state"><div><strong>还没有分类</strong><p>新建分类后即可把项目教程放入其中。</p></div></div>`;
  return `${renderPageHeading("分类管理", "分类决定首页的浏览顺序；前台是否可见请用每行左侧的启用胶囊按钮切换。删除分类时，可将其中的教程转移到其他分类。", `<button class="primary-button" type="button" data-action="new-category"><i data-lucide="plus" aria-hidden="true"></i><span>新建分类</span></button>`)}
    ${renderContentError()}
    <section class="category-list" aria-label="项目分类列表">${rows}</section>`;
}

function renderCategoryRow(category, index) {
  const projectCount = state.links.filter((item) => item.category === category.name).length;
  const visibilityLabel = category.enabled === false ? "已隐藏" : "已启用";
  return `<article class="category-row">
    <span class="category-order">${String(index + 1).padStart(2, "0")}</span>
    <div class="category-main"><div class="category-title-row"><span class="status-dot ${category.enabled === false ? "off" : ""}" aria-hidden="true"></span><strong class="category-title">${escapeHtml(category.name)}</strong></div><span class="category-description">${escapeHtml(category.description || "未填写分类说明")}</span></div>
    <div class="project-meta"><strong>${formatNumber(projectCount)} 篇教程</strong><span class="status-tag">${category.enabled === false ? "分类隐藏" : "分类显示"}</span></div>
    <button class="visibility-pill ${category.enabled === false ? "is-off" : "is-on"}" type="button" data-action="toggle-category" data-id="${escapeAttribute(category.id)}" aria-pressed="${category.enabled === false ? "false" : "true"}" title="${category.enabled === false ? "点击显示到前台" : "点击从前台隐藏"}"><span class="visibility-pill-dot" aria-hidden="true"></span><span>${visibilityLabel}</span></button>
    <div class="row-actions" aria-label="${escapeAttribute(`${category.name} 的操作`)}">
      <button class="icon-button" type="button" data-action="move-category-up" data-id="${escapeAttribute(category.id)}" title="上移排序" aria-label="上移排序" ${index <= 0 ? "disabled" : ""}><i data-lucide="arrow-up" aria-hidden="true"></i></button>
      <button class="icon-button" type="button" data-action="move-category-down" data-id="${escapeAttribute(category.id)}" title="下移排序" aria-label="下移排序" ${index === state.categories.length - 1 ? "disabled" : ""}><i data-lucide="arrow-down" aria-hidden="true"></i></button>
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
  const toneOptions = TONES.map(([tone, label]) => `<label class="tone-option tone-${tone}"><input type="radio" name="tone" value="${tone}" ${link.tone === tone ? "checked" : ""} /><span class="tone-swatch" aria-hidden="true"></span>${label}</label>`).join("");
  const noCategories = state.categories.length === 0;
  const cover = link.cover || link.image || "";
  const mark = link.mark || nextMark();
  const guide = String(link.guide || "").trim() || stepsToText(link.steps);
  return `<div class="modal-backdrop editor-backdrop" data-action="modal-backdrop"><section class="modal editor-drawer editor-workbench" role="dialog" aria-modal="true" aria-labelledby="project-editor-title">
    <header class="modal-header editor-header"><div><span class="editor-kicker">项目教程</span><h2 id="project-editor-title">${existing ? "编辑项目教程" : "新建项目教程"}</h2><p>右侧编辑，左侧实时查看未保存的卡片和详情效果。</p></div><button class="icon-button modal-close" type="button" data-action="close-modal" title="关闭编辑器" aria-label="关闭编辑器"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <div class="editor-workbench-body">
      <aside class="editor-preview-pane" aria-label="项目成品预览"><div class="editor-preview-heading"><div><span class="editor-kicker">LIVE PREVIEW</span><h3>成品预览</h3></div><span class="editor-preview-state">未保存</span></div><div class="editor-preview-tabs" role="tablist" aria-label="预览页面"><button class="editor-preview-tab${state.projectPreviewMode === "front" ? " active" : ""}" type="button" role="tab" aria-selected="${state.projectPreviewMode === "front" ? "true" : "false"}" data-action="set-project-preview" data-preview-mode="front">卡片前方</button><button class="editor-preview-tab${state.projectPreviewMode === "back" ? " active" : ""}" type="button" role="tab" aria-selected="${state.projectPreviewMode === "back" ? "true" : "false"}" data-action="set-project-preview" data-preview-mode="back">卡片后方</button></div><div id="project-live-preview-content" class="editor-live-preview" role="tabpanel" aria-live="polite">${renderProjectPreviewContent(link, state.projectPreviewMode)}</div><p class="editor-preview-note">预览会随右侧输入即时更新，保存后才会同步到前台。</p></aside>
    <form class="editor-form editor-project-form" data-form="project">
      <div class="editor-scroll">
        <section class="editor-section editor-section--front" aria-labelledby="project-front-title"><div class="editor-section-heading"><div><span class="editor-section-kicker">未点击卡片</span><h3 id="project-front-title" class="editor-section-title">卡片前方</h3><p>用户在首页还没有点击卡片时，直接看到的内容。</p></div><span class="editor-section-chip">首页卡片</span></div>
          <div class="form-grid">
            <div class="field field--category"><label for="project-category">所属分类</label><select id="project-category" name="category" data-control="project-category" required ${noCategories ? "disabled" : ""}>${categoryOptions}</select><p class="field-help">首页分类标题和详情顶部分类标识都使用这里的值。</p>${noCategories ? `<p class="field-help">请先创建一个分类。</p>` : ""}</div>
            <div class="field field--title"><label for="project-title">项目标题</label><input id="project-title" name="title" maxlength="80" value="${escapeAttribute(link.title || "")}" placeholder="例如：奶茶首单优惠" required /><p class="field-help">同时显示在首页卡片和点击后的详情标题。</p></div>
            <div class="field field--status"><label for="project-status">状态文案</label><input id="project-status" name="status" maxlength="24" value="${escapeAttribute(link.status || "待核实")}" placeholder="例如：实测可用" required /><p class="field-help">显示在卡片前方顶部，也会显示在详情信息顶部。</p></div>
            <div class="field field--mark"><label for="project-mark">卡片标记</label><input id="project-mark" name="mark" data-control="project-mark" maxlength="12" value="${escapeAttribute(mark)}" placeholder="例如：益" required /><p class="field-help">显示在首页卡片左侧，也会显示在详情信息顶部。</p></div>
            <div class="field wide field--description"><label for="project-description">卡片简介</label><textarea id="project-description" name="description" maxlength="240" placeholder="一句话说明这张卡片能帮用户做什么" required>${escapeHtml(link.description || "")}</textarea><p class="field-help">这是卡片前方的主简介；详情介绍留空时会自动沿用它。</p></div>
            <div class="field wide field--note"><label for="project-note">卡片说明</label><input id="project-note" name="note" maxlength="80" value="${escapeAttribute(link.note || "")}" placeholder="例如：准备时间 · 5 分钟" required /><p class="field-help">显示在首页卡片底部的补充信息，例如耗时、门槛或适用人群。</p></div>
          </div>
        </section>
        <section class="editor-section editor-section--back" aria-labelledby="project-back-title"><div class="editor-section-heading"><div><span class="editor-section-kicker">点击卡片后</span><h3 id="project-back-title" class="editor-section-title">卡片后方</h3><p>用户点击卡片后打开详情弹层时，看到的完整介绍和操作内容。</p></div><span class="editor-section-chip">详情弹层</span></div><div class="form-grid">
          <div class="field wide field--detail-description"><label for="project-detail-description">详情介绍</label><textarea id="project-detail-description" name="detailDescription" maxlength="1000" placeholder="点击卡片后显示在标题下方的完整介绍；留空则沿用卡片简介。">${escapeHtml(link.detailDescription || "")}</textarea><p class="field-help">对应前台详情弹层标题下方的介绍文字，与卡片前方的“卡片简介”分开维护。</p></div>
          <div class="field wide field--guide"><div class="field-heading"><div><label for="project-guide">正文 Markdown</label><p class="field-help">直接粘贴或编辑完整教程正文，前台会按 Markdown 渲染。</p></div><span class="editor-field-chip">Markdown</span></div>
            <div class="markdown-toolbar" data-markdown-toolbar role="toolbar" aria-label="Markdown 工具栏">
              <div class="markdown-toolbar-group" role="group" aria-label="标题级别">
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="heading" data-markdown-level="1" title="一级标题" aria-label="一级标题"><span aria-hidden="true">H1</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="heading" data-markdown-level="2" title="二级标题" aria-label="二级标题"><span aria-hidden="true">H2</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="heading" data-markdown-level="3" title="三级标题" aria-label="三级标题"><span aria-hidden="true">H3</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="heading" data-markdown-level="4" title="四级标题" aria-label="四级标题"><span aria-hidden="true">H4</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="heading" data-markdown-level="5" title="五级标题" aria-label="五级标题"><span aria-hidden="true">H5</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="heading" data-markdown-level="6" title="六级标题" aria-label="六级标题"><span aria-hidden="true">H6</span></button>
              </div>
              <span class="markdown-toolbar-divider" aria-hidden="true"></span>
              <div class="markdown-toolbar-group" role="group" aria-label="文字样式">
                <button class="markdown-tool-button markdown-tool-button--strong" type="button" data-action="markdown-format" data-markdown-command="bold" title="粗体" aria-label="粗体"><span aria-hidden="true">B</span></button>
                <button class="markdown-tool-button markdown-tool-button--emphasis" type="button" data-action="markdown-format" data-markdown-command="italic" title="斜体" aria-label="斜体"><span aria-hidden="true">I</span></button>
                <button class="markdown-tool-button markdown-tool-button--strike" type="button" data-action="markdown-format" data-markdown-command="strike" title="删除线" aria-label="删除线"><span aria-hidden="true">S</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="inline-code" title="行内代码" aria-label="行内代码"><span aria-hidden="true">&lt;/&gt;</span></button>
              </div>
              <span class="markdown-toolbar-divider" aria-hidden="true"></span>
              <div class="markdown-toolbar-group" role="group" aria-label="段落和列表">
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="quote" title="引用" aria-label="引用"><span aria-hidden="true">&gt; 引用</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="unordered-list" title="无序列表" aria-label="无序列表"><span aria-hidden="true">- 列表</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="ordered-list" title="有序列表" aria-label="有序列表"><span aria-hidden="true">1. 列表</span></button>
              </div>
              <span class="markdown-toolbar-divider" aria-hidden="true"></span>
              <div class="markdown-toolbar-group" role="group" aria-label="媒体和结构">
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="code-block" title="代码块" aria-label="代码块"><span aria-hidden="true">\`\`\`</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="link" title="链接" aria-label="链接"><span aria-hidden="true">链接</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="image" title="图片" aria-label="图片"><span aria-hidden="true">图片</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="table" title="表格" aria-label="表格"><span aria-hidden="true">表格</span></button>
                <button class="markdown-tool-button" type="button" data-action="markdown-format" data-markdown-command="hr" title="分割线" aria-label="分割线"><span aria-hidden="true">---</span></button>
              </div>
              <span class="markdown-toolbar-divider" aria-hidden="true"></span>
              <button class="markdown-tool-button markdown-tool-button--clear" type="button" data-action="markdown-format" data-markdown-command="clear" title="清空正文" aria-label="清空正文"><span aria-hidden="true">清空</span></button>
            </div>
            <textarea id="project-guide" name="guide" class="markdown-editor" maxlength="100000" spellcheck="false" placeholder="# 教程标题

先说明使用前需要准备什么。

## 操作流程

1. 第一步
2. 第二步
3. 更多步骤可以继续添加

> 注意事项
">${escapeHtml(guide)}</textarea><p class="field-help">支持标题、粗体、列表、链接、图片和代码块；不需要拆分成固定步骤。</p></div>
          <div class="field wide field--cover"><label for="project-cover">封面图 URL</label><div class="cover-field-layout"><div><div class="cover-input-row"><input id="project-cover" name="cover" data-control="project-cover" maxlength="2048" value="${escapeAttribute(cover)}" placeholder="https://example.com/cover.jpg 或 /images/cover.jpg" /><button class="icon-button cover-clear" type="button" data-action="clear-cover" title="清除封面链接" aria-label="清除封面链接" ${cover ? "" : "disabled"}><i data-lucide="x" aria-hidden="true"></i></button></div><p class="field-help">仅用于后台列表和编辑预览的封面素材；支持 http、https 或站内路径。前台详情顶部不显示横幅封面。</p></div><div id="project-cover-preview" class="project-cover-preview" data-mark="${escapeAttribute(mark)}" aria-live="polite"><span class="cover-preview-mark">${escapeHtml(mark)}</span><span class="cover-preview-copy">${cover ? "正在加载预览" : "未设置封面"}</span></div></div></div>
          <div class="field wide field--tips"><label for="project-tips">小提示</label><textarea id="project-tips" name="tips" maxlength="2000" placeholder="提醒用户注意条件、时效或常见问题。">${escapeHtml(link.tips || "")}</textarea><p class="field-help">对应详情弹层底部的“小提示”区域。</p></div>
          <div class="field wide field--url"><label for="project-url">入口 URL</label><input id="project-url" name="url" type="url" maxlength="2048" value="${escapeAttribute(link.url || "")}" placeholder="https://example.com" /><p class="field-help">可选；填写后对应详情弹层底部的“打开项目入口”按钮。</p></div>
        </div></section>
        <details class="editor-details"><summary><span><strong>视觉和内部信息</strong><small>设置卡片色调，或记录仅后台可见的备注。</small></span><i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="editor-details-body"><div class="form-grid"><div class="field wide"><span class="field-label">色调</span><div class="tone-options">${toneOptions}</div></div><div class="field wide"><label for="project-admin-note">后台备注</label><textarea id="project-admin-note" name="adminNote" maxlength="500" placeholder="仅后台可见，例如来源、复核日期或待补充内容。">${escapeHtml(link.adminNote || "")}</textarea></div></div></div></details>
      </div>
      <footer class="form-footer editor-footer"><span class="form-footer-note">${existing ? "编辑会保留原排序位置。" : "新教程会添加到所属分类的末尾。"} 可见性请在项目教程列表左侧的胶囊按钮中切换。</span><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit" ${noCategories ? "disabled" : ""}><span>保存教程</span><i data-lucide="check" aria-hidden="true"></i></button></div></footer>
    </form>
    </div>
  </section></div>`;
}

function projectDraftFromForm(form) {
  const data = new FormData(form);
  return {
    category: String(data.get("category") || "").trim(),
    title: String(data.get("title") || "").trim(),
    mark: String(data.get("mark") || "").trim(),
    tone: String(data.get("tone") || "teal").trim(),
    status: String(data.get("status") || "").trim(),
    description: String(data.get("description") || "").trim(),
    detailDescription: String(data.get("detailDescription") || "").trim(),
    note: String(data.get("note") || "").trim(),
    cover: String(data.get("cover") || "").trim(),
    guide: String(data.get("guide") || ""),
    tips: String(data.get("tips") || "").trim(),
    url: String(data.get("url") || "").trim(),
  };
}

function updateProjectLivePreview(form) {
  const preview = document.querySelector("#project-live-preview-content");
  if (!preview || !form) return;
  preview.innerHTML = renderProjectPreviewContent(projectDraftFromForm(form), state.projectPreviewMode);
  refreshIcons(preview);
}

function setProjectPreviewMode(mode, { scroll = false } = {}) {
  const nextMode = mode === "back" ? "back" : "front";
  state.projectPreviewMode = nextMode;
  document.querySelectorAll(".editor-preview-tab").forEach((tab) => {
    const active = tab.dataset.previewMode === nextMode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  const form = document.querySelector("form[data-form='project']");
  updateProjectLivePreview(form);
  if (scroll) scrollProjectEditorTo(nextMode, form);
}

function scrollProjectEditorTo(mode, form = document.querySelector("form[data-form='project']")) {
  const editorScroll = form?.querySelector(".editor-scroll");
  const target = editorScroll?.querySelector(mode === "back" ? ".editor-section--back" : ".editor-section--front");
  if (!editorScroll || !target) return;
  const scrollRect = editorScroll.getBoundingClientRect();
  const targetTop = Math.max(0, target.getBoundingClientRect().top - scrollRect.top + editorScroll.scrollTop - 8);
  if (projectPreviewSync) {
    projectPreviewSync.programmaticTarget = { mode, top: targetTop, expiresAt: performance.now() + 1400 };
  }
  editorScroll.scrollTo({ top: targetTop, behavior: "smooth" });
}

function setupProjectPreviewSync(form) {
  const editorScroll = form?.querySelector(".editor-scroll");
  const front = editorScroll?.querySelector(".editor-section--front");
  const back = editorScroll?.querySelector(".editor-section--back");
  if (!editorScroll || !front || !back) return;

  const sync = {
    editorScroll,
    front,
    back,
    frame: 0,
    programmaticTarget: null,
    onScroll: null,
  };
  const syncFromScroll = () => {
    sync.frame = 0;
    const target = sync.programmaticTarget;
    if (target) {
      const reached = Math.abs(editorScroll.scrollTop - target.top) <= 6;
      if (!reached && performance.now() < target.expiresAt) return;
      sync.programmaticTarget = null;
    }
    const scrollRect = editorScroll.getBoundingClientRect();
    const switchLine = scrollRect.top + Math.min(140, Math.max(64, editorScroll.clientHeight * 0.25));
    const mode = back.getBoundingClientRect().top <= switchLine ? "back" : "front";
    if (mode !== state.projectPreviewMode) setProjectPreviewMode(mode);
  };
  sync.onScroll = () => {
    if (!sync.frame) sync.frame = window.requestAnimationFrame(syncFromScroll);
  };
  projectPreviewSync = sync;
  editorScroll.addEventListener("scroll", sync.onScroll, { passive: true });
  syncFromScroll();
}

function destroyProjectPreviewSync() {
  if (!projectPreviewSync) return;
  projectPreviewSync.editorScroll.removeEventListener("scroll", projectPreviewSync.onScroll);
  if (projectPreviewSync.frame) window.cancelAnimationFrame(projectPreviewSync.frame);
  projectPreviewSync = null;
}

function renderProjectPreviewContent(link, mode = "front") {
  const tone = TONES.some(([value]) => value === link.tone) ? link.tone : "teal";
  const category = link.category || "所属分类";
  const title = link.title || "项目标题";
  const mark = link.mark || "指";
  const status = link.status || "状态文案";
  const description = link.description || "卡片简介会显示在这里。";
  const note = link.note || "卡片说明";
  if (mode !== "back") {
    return `<article class="preview-card tone-${escapeAttribute(tone)}"><div class="preview-card-topline"><span class="preview-status">${escapeHtml(status)}</span><span class="preview-card-number">01</span></div><div class="preview-card-identity"><span class="preview-mark">${escapeHtml(mark)}</span><h4>${escapeHtml(title)}<i data-lucide="arrow-up-right" aria-hidden="true"></i></h4></div><p class="preview-card-description">${escapeHtml(description)}</p><div class="preview-card-meta"><span>${escapeHtml(note)}</span><span>查看完整教程</span></div></article>`;
  }
  const detailDescription = link.detailDescription || description;
  const guide = String(link.guide || "").trim();
  const markdown = renderPreviewMarkdown(guide) || `<p class="preview-markdown-empty">正文 Markdown 预览会显示在这里。</p>`;
  const tips = link.tips ? `<aside class="preview-tips"><i data-lucide="lightbulb" aria-hidden="true"></i><div><strong>小提示</strong><p>${escapeHtml(link.tips)}</p></div></aside>` : "";
  const entry = normalizePreviewUrl(link.url) ? `<div class="preview-entry"><i data-lucide="external-link" aria-hidden="true"></i><span>打开项目入口</span></div>` : `<div class="preview-entry is-empty"><span>未设置入口 URL</span></div>`;
  return `<article class="preview-detail"><div class="preview-detail-meta"><span class="preview-detail-mark">${escapeHtml(mark)}</span><span class="preview-status">${escapeHtml(status)}</span></div><p class="preview-detail-kicker">${escapeHtml(category)} / FIELD NOTE</p><h4 class="preview-detail-title">${escapeHtml(title)}</h4><p class="preview-detail-description">${escapeHtml(detailDescription)}</p><div class="preview-markdown-heading"><span>教程正文</span><span>Markdown</span></div><div class="preview-markdown">${markdown}</div>${tips}${entry}</article>`;
}

function renderPreviewMarkdown(value) {
  const source = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "";
  const blocks = [];
  let paragraph = [];
  let listType = "";
  let listItems = [];
  let quoteLines = [];
  let code = null;
  let imageGroup = [];
  const flushParagraph = () => { if (paragraph.length) { blocks.push(`<p>${renderPreviewMarkdownInline(paragraph.join("\n"), true)}</p>`); paragraph = []; } };
  const flushList = () => { if (listItems.length) { blocks.push(`<${listType}>${listItems.map((item) => `<li>${renderPreviewMarkdownInline(item)}</li>`).join("")}</${listType}>`); listType = ""; listItems = []; } };
  const flushQuote = () => { if (quoteLines.length) { blocks.push(`<blockquote>${renderPreviewMarkdown(quoteLines.join("\n"))}</blockquote>`); quoteLines = []; } };
  const flushImageGroup = () => {
    if (!imageGroup.length) return;
    const images = imageGroup.map((image) => `<img class="preview-markdown-image" src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.alt)}"${image.title ? ` title="${escapeAttribute(image.title)}"` : ""} loading="lazy" decoding="async" />`).join("");
    blocks.push(imageGroup.length > 1 ? `<div class="preview-markdown-image-grid">${images}</div>` : images);
    imageGroup = [];
  };
  const flushOpenBlocks = () => { flushParagraph(); flushList(); flushQuote(); flushImageGroup(); };
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^ {0,3}```\s*([A-Za-z0-9_-]*)\s*$/);
    if (code) {
      if (fence) { blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`); code = null; } else code.push(line);
      continue;
    }
    if (fence) { flushOpenBlocks(); code = []; continue; }
    const standaloneImage = standalonePreviewImage(line);
    if (standaloneImage) {
      flushParagraph();
      flushList();
      flushQuote();
      imageGroup.push(standaloneImage);
      continue;
    }
    flushImageGroup();
    if (!line.trim()) { flushOpenBlocks(); continue; }
    const tableHeader = parsePreviewMarkdownTableRow(line);
    if (tableHeader.length > 1 && index + 1 < lines.length && isPreviewMarkdownTableDivider(lines[index + 1])) {
      flushOpenBlocks();
      index += 2;
      const tableRows = [];
      while (index < lines.length) {
        const row = parsePreviewMarkdownTableRow(lines[index]);
        if (row.length < 2 || isPreviewMarkdownTableDivider(lines[index])) break;
        tableRows.push(row);
        index += 1;
      }
      const columnCount = Math.max(tableHeader.length, ...tableRows.map((row) => row.length), 0);
      const header = tableHeader.map((cell) => `<th scope="col">${renderPreviewMarkdownInline(cell)}</th>`).join("");
      const body = tableRows.map((row) => `<tr>${Array.from({ length: columnCount }, (_, cellIndex) => `<td>${renderPreviewMarkdownInline(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("");
      blocks.push(`<table><thead><tr>${header}</tr></thead>${body ? `<tbody>${body}</tbody>` : ""}</table>`);
      index -= 1;
      continue;
    }
    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) { flushOpenBlocks(); const level = heading[1].length; blocks.push(`<h${level}>${renderPreviewMarkdownInline(heading[2])}</h${level}>`); continue; }
    if (/^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) { flushOpenBlocks(); blocks.push("<hr />"); continue; }
    const quote = line.match(/^ {0,3}>\s?(.*)$/);
    if (quote) { flushParagraph(); flushList(); quoteLines.push(quote[1]); continue; }
    flushQuote();
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) { flushParagraph(); const nextType = unordered ? "ul" : "ol"; if (listType && listType !== nextType) flushList(); listType = nextType; listItems.push((unordered || ordered)[1]); continue; }
    flushList(); paragraph.push(line);
  }
  if (code) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushOpenBlocks();
  return blocks.join("");
}

function renderPreviewMarkdownInline(value, preserveBreaks = false) {
  const source = String(value || "");
  const tokenPattern = /!\[([^\]]*)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)|\[([^\]]+)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g;
  let output = "";
  let cursor = 0;
  let match;
  while ((match = tokenPattern.exec(source))) {
    output += escapeHtml(source.slice(cursor, match.index));
    if (match[1] !== undefined) {
      const imageUrl = safeImageUrl(match[2]);
      output += imageUrl ? `<img class="preview-markdown-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(match[1] || "正文图片")}" loading="lazy" decoding="async" />` : escapeHtml(match[1]);
    } else if (match[4] !== undefined) {
      const linkUrl = safePreviewUrl(match[5]);
      output += linkUrl ? `<a href="${escapeAttribute(linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match[4])}</a>` : escapeHtml(match[4]);
    } else if (match[7] !== undefined) output += `<code>${escapeHtml(match[7])}</code>`;
    else if (match[8] !== undefined || match[9] !== undefined) output += `<strong>${escapeHtml(match[8] || match[9])}</strong>`;
    else if (match[10] !== undefined) output += `<del>${escapeHtml(match[10])}</del>`;
    else output += `<em>${escapeHtml(match[11] || match[12])}</em>`;
    cursor = tokenPattern.lastIndex;
  }
  output += escapeHtml(source.slice(cursor));
  return preserveBreaks ? output.replace(/\n/g, "<br />") : output;
}

function standalonePreviewImageUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate || /\s/.test(candidate) || !isPreviewImagePath(candidate)) return "";
  return safeImageUrl(candidate);
}

function standalonePreviewImage(value) {
  const line = String(value || "").trim();
  const directUrl = standalonePreviewImageUrl(line);
  if (directUrl) return { url: directUrl, alt: "正文图片", title: "" };
  const match = line.match(/^!\[([^\]]*)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)$/);
  if (!match) return null;
  const imageUrl = safeImageUrl(match[2]);
  return imageUrl ? { url: imageUrl, alt: match[1] || "正文图片", title: match[3] || "" } : null;
}

function isPreviewImagePath(value) {
  try {
    const parsed = new URL(String(value), window.location.href);
    return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function parsePreviewMarkdownTableRow(value) {
  const line = String(value || "").trim();
  if (!line.includes("|")) return [];
  const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  return cells.length > 1 ? cells : [];
}

function isPreviewMarkdownTableDivider(value) {
  const cells = parsePreviewMarkdownTableRow(value);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function safePreviewUrl(value) {
  const text = String(value || "").trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  return "";
}

function normalizePreviewUrl(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function renderCategoryModal(category) {
  const existing = Boolean(category.id);
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal small" role="dialog" aria-modal="true" aria-labelledby="category-editor-title">
    <header class="modal-header"><div><h2 id="category-editor-title">${existing ? "编辑分类" : "新建分类"}</h2><p>分类名称会显示在首页的项目索引中。</p></div><button class="icon-button modal-close" type="button" data-action="close-modal" title="关闭" aria-label="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header>
    <form class="editor-form" data-form="category">
      <div class="field-stack">
        <div class="field"><label for="category-name">分类名称</label><input id="category-name" name="name" maxlength="40" value="${escapeAttribute(category.name || "")}" placeholder="例如：生活权益" required /></div>
        <div class="field"><label for="category-description">分类说明</label><textarea id="category-description" name="description" maxlength="120" placeholder="用于告诉用户这个分类包含什么内容。">${escapeHtml(category.description || "")}</textarea></div>
        <p class="editor-inline-note">分类是否在前台显示，请在分类管理列表左侧的启用胶囊按钮中切换。</p>
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
      if (DATA_VIEWS.has(state.activeView)) setDataNavExpanded(true);
      state.contentError = "";
      render();
      return;
    }
    if (action === "toggle-data-nav") {
      if (!DATA_VIEWS.has(state.activeView)) state.activeView = button.dataset.view || "dashboard";
      setDataNavExpanded(!state.dataNavExpanded);
      state.contentError = "";
      render();
      return;
    }
    if (action === "set-stats-range") {
      await updateStatsPreset(button.dataset.range || "7d");
      return;
    }
    if (action === "reset-stats-filter") {
      await resetStatsFilter();
      return;
    }
    if (action === "toggle-theme") return toggleTheme();
    if (action === "logout") {
      await logout();
      return;
    }
    if (action === "refresh-stats") {
      await refreshStats();
      return;
    }
    if (action === "refresh-navigation") {
      await refreshNavigation();
      return;
    }
    if (action === "new-project") return openProjectEditor();
    if (action === "new-category") return openCategoryEditor();
    if (action === "clear-cover") {
      const cover = document.querySelector("[data-control='project-cover']");
      if (!cover) return;
      cover.value = "";
      updateCoverPreview("");
      updateProjectLivePreview(cover.form);
      cover.focus();
      return;
    }
    if (action === "set-project-preview") {
      setProjectPreviewMode(button.dataset.previewMode, { scroll: true });
      return;
    }
    if (action === "markdown-format") {
      formatMarkdownEditor(button);
      return;
    }
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
    if (submitter?.isConnected) submitter.disabled = form.dataset.form === "stats-filter" ? state.statsLoading : false;
  }
}

function handleChange(event) {
  const control = event.target;
  const projectForm = control.closest("form[data-form='project']");
  if (projectForm) updateProjectLivePreview(projectForm);
}

function handleInput(event) {
  const control = event.target;
  const projectForm = control.closest("form[data-form='project']");
  if (projectForm) updateProjectLivePreview(projectForm);
  if (control.matches("[data-control='project-cover']")) {
    updateCoverPreview(control.value);
    return;
  }
  if (control.matches("[data-control='project-mark']")) {
    const preview = document.querySelector("#project-cover-preview");
    if (!preview) return;
    preview.dataset.mark = control.value.trim() || "指";
    updateCoverPreview(document.querySelector("[data-control='project-cover']")?.value || "");
  }
}

function formatMarkdownEditor(button) {
  const textarea = button.closest("[data-markdown-toolbar]")?.parentElement?.querySelector("textarea.markdown-editor")
    || document.querySelector("textarea.markdown-editor");
  if (!textarea) return;
  const command = button.dataset.markdownCommand || "";
  if (command === "clear") {
    textarea.focus({ preventScroll: true });
    replaceMarkdownRange(textarea, 0, textarea.value.length, "", 0, 0);
    return;
  }

  const value = textarea.value;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? start;
  const selected = value.slice(start, end);
  const level = Number(button.dataset.markdownLevel || 1);
  if (command === "heading") return formatMarkdownLines(textarea, start, end, (line, index, lines) => {
    const nonEmpty = lines.filter((item) => item.trim());
    const headingPattern = /^\s{0,3}#{1,6}\s+/;
    const desiredPattern = new RegExp(`^\\s{0,3}#{${Math.min(6, Math.max(1, level))}}\\s+`);
    const remove = nonEmpty.length > 0 && nonEmpty.every((item) => desiredPattern.test(item));
    if (!line.trim()) return line;
    const indent = (line.match(/^\s{0,3}/) || [""])[0];
    const content = line.replace(headingPattern, "");
    return remove ? content : `${indent}${"#".repeat(Math.min(6, Math.max(1, level)))} ${content}`;
  }, { collapsedCaretOffset: "prefix" });
  if (command === "quote") return formatMarkdownLines(textarea, start, end, (line, index, lines) => {
    const nonEmpty = lines.filter((item) => item.trim());
    const quotePattern = /^\s{0,3}>\s?/;
    const remove = nonEmpty.length > 0 && nonEmpty.every((item) => quotePattern.test(item));
    if (!line.trim()) return line;
    return remove ? line.replace(quotePattern, "") : `> ${line.replace(quotePattern, "")}`;
  }, { collapsedCaretOffset: "prefix" });
  if (command === "unordered-list" || command === "ordered-list") {
    const ordered = command === "ordered-list";
    return formatMarkdownLines(textarea, start, end, (line, index, lines) => {
      const nonEmpty = lines.filter((item) => item.trim());
      const listPattern = /^\s*(?:[-+*]|\d+[.)])\s+/;
      const desiredPattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-+*]\s+/;
      const remove = nonEmpty.length > 0 && nonEmpty.every((item) => desiredPattern.test(item));
      if (!line.trim()) return line;
      if (remove) return line.replace(listPattern, "");
      const indent = (line.match(/^\s*/) || [""])[0];
      const content = line.replace(listPattern, "").trim();
      return `${indent}${ordered ? `${index + 1}.` : "-"} ${content}`;
    }, { collapsedCaretOffset: "prefix" });
  }
  if (command === "bold" || command === "italic" || command === "strike" || command === "inline-code") {
    const marker = command === "bold" ? "**" : command === "italic" ? "*" : command === "strike" ? "~~" : "`";
    const placeholder = command === "bold" ? "粗体文本" : command === "italic" ? "斜体文本" : command === "strike" ? "删除文本" : "代码";
    return formatMarkdownInline(textarea, start, end, marker, marker, selected || placeholder);
  }
  if (command === "code-block") {
    const inner = selected.replace(/^\s*```[^\n]*\n?/, "").replace(/\n?\s*```\s*$/, "");
    const alreadyFenced = /^\s*```[^\n]*\n[\s\S]*\n\s*```\s*$/.test(selected);
    if (alreadyFenced) return replaceMarkdownRange(textarea, start, end, inner, 0, inner.length);
    const content = inner || "代码";
    const replacement = `\`\`\`\n${content}\n\`\`\``;
    const contentOffset = 4;
    return replaceMarkdownRange(textarea, start, end, replacement, selected ? 0 : contentOffset, selected ? replacement.length : contentOffset + content.length);
  }
  if (command === "link" || command === "image") {
    const label = selected || (command === "link" ? "链接文字" : "图片描述");
    const replacement = command === "link" ? `[${label}](https://example.com)` : `![${label}](https://example.com/image.jpg)`;
    const urlStart = replacement.indexOf("https://");
    return replaceMarkdownRange(textarea, start, end, replacement, urlStart, replacement.length - 1);
  }
  if (command === "table") {
    const replacement = "| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |";
    const tableStart = replacement.indexOf("列 1");
    return replaceMarkdownRange(textarea, start, end, replacement, tableStart, tableStart + 3);
  }
  if (command === "hr") {
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const suffix = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
    const replacement = `${prefix}---${suffix}`;
    return replaceMarkdownRange(textarea, start, end, replacement, prefix.length + 3, prefix.length + 3);
  }
}

function formatMarkdownInline(textarea, start, end, prefix, suffix, content) {
  const selected = textarea.value.slice(start, end);
  const isWrapped = selected.length >= prefix.length + suffix.length
    && selected.startsWith(prefix)
    && selected.endsWith(suffix);
  if (isWrapped) {
    const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
    return replaceMarkdownRange(textarea, start, end, unwrapped, 0, unwrapped.length);
  }
  const replacement = `${prefix}${content}${suffix}`;
  return replaceMarkdownRange(textarea, start, end, replacement, prefix.length, prefix.length + content.length);
}

function formatMarkdownLines(textarea, start, end, transform, options = {}) {
  const value = textarea.value;
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const selectionEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const lineEndIndex = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const source = value.slice(lineStart, lineEnd);
  const lines = source.split("\n");
  const transformed = lines.map((line, index) => transform(line, index, lines));
  const replacement = transformed.join("\n");
  if (start === end) {
    const firstLineBefore = lines[0];
    const firstLineAfter = transformed[0];
    const delta = firstLineAfter.length - firstLineBefore.length;
    const caret = Math.max(lineStart, Math.min(lineEnd + delta, start + (options.collapsedCaretOffset === "prefix" ? delta : 0)));
    return replaceMarkdownRange(textarea, lineStart, lineEnd, replacement, caret - lineStart, caret - lineStart);
  }
  return replaceMarkdownRange(textarea, lineStart, lineEnd, replacement, 0, replacement.length);
}

function replaceMarkdownRange(textarea, start, end, replacement, selectionOffset = replacement.length, selectionEndOffset = selectionOffset) {
  if (typeof textarea.setRangeText === "function") {
    textarea.setRangeText(replacement, start, end, "end");
  } else {
    textarea.value = `${textarea.value.slice(0, start)}${replacement}${textarea.value.slice(end)}`;
  }
  textarea.focus({ preventScroll: true });
  const nextStart = Math.max(0, start + selectionOffset);
  const nextEnd = Math.max(nextStart, start + selectionEndOffset);
  textarea.setSelectionRange(nextStart, nextEnd);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
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
  cancelStatsRequest();
  state.statsRequestId += 1;
  state.session = null;
  state.modal = null;
  state.contentError = "";
  render();
}

async function updateStatsFilter(form) {
  if (state.statsLoading) return;
  const data = new FormData(form);
  const from = String(data.get("from") || "");
  const to = String(data.get("to") || "");
  if (!from || !to || from > to) throw new Error("请填写有效的开始和结束日期");
  state.statsFrom = from;
  state.statsTo = to;
  state.statsPreset = "custom";
  state.statsGranularity = String(data.get("granularity") || "hour") === "day" ? "day" : "hour";
  await refreshStats();
}

async function updateStatsPreset(preset) {
  if (state.statsLoading) return;
  const ranges = {
    today: { days: 1, granularity: "hour" },
    "7d": { days: 7, granularity: "hour" },
    "30d": { days: 30, granularity: "day" },
    "90d": { days: 90, granularity: "day" },
  };
  const selected = ranges[preset] || ranges["7d"];
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - selected.days + 1);
  state.statsFrom = dateInputValue(start);
  state.statsTo = dateInputValue(end);
  state.statsPreset = preset in ranges ? preset : "7d";
  state.statsGranularity = selected.granularity;
  await refreshStats();
}

async function resetStatsFilter() {
  if (state.statsLoading) return;
  await updateStatsPreset("7d");
}

async function refreshStats() {
  if (!state.session || state.statsLoading) return;
  const requestId = ++state.statsRequestId;
  state.statsLoading = true;
  state.statsBusyVisible = false;
  state.contentError = "";
  const controller = new AbortController();
  state.statsAbortController = controller;
  let timedOut = false;
  syncStatsToolbar();
  state.statsBusyTimer = window.setTimeout(() => {
    if (requestId !== state.statsRequestId || !state.statsLoading) return;
    state.statsBusyVisible = true;
    syncStatsToolbar();
  }, 220);
  state.statsTimeoutTimer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    await loadStats(requestId, controller.signal);
  } catch (error) {
    if (requestId !== state.statsRequestId) return;
    if (requestId === state.statsRequestId) {
      state.contentError = error?.name === "AbortError" && timedOut ? "统计数据请求超时，请稍后重试" : (error.message || "无法加载统计数据");
    }
    const normalizedError = error?.name === "AbortError" && timedOut ? Object.assign(new Error("统计数据请求超时，请稍后重试"), { status: 408 }) : error;
    throw normalizedError;
  } finally {
    if (requestId !== state.statsRequestId) return;
    if (state.statsBusyTimer) window.clearTimeout(state.statsBusyTimer);
    if (state.statsTimeoutTimer) window.clearTimeout(state.statsTimeoutTimer);
    state.statsBusyTimer = 0;
    state.statsTimeoutTimer = 0;
    if (state.statsAbortController === controller) state.statsAbortController = null;
    state.statsLoading = false;
    state.statsBusyVisible = false;
    syncStatsToolbar();
    renderStatsResultsOnly();
  }
}

function cancelStatsRequest() {
  if (state.statsBusyTimer) window.clearTimeout(state.statsBusyTimer);
  if (state.statsTimeoutTimer) window.clearTimeout(state.statsTimeoutTimer);
  if (state.statsAbortController) state.statsAbortController.abort();
  state.statsBusyTimer = 0;
  state.statsTimeoutTimer = 0;
  state.statsAbortController = null;
  state.statsLoading = false;
  state.statsBusyVisible = false;
}

function updateProjectFilter(form) {
  const data = new FormData(form);
  state.projectSearch = String(data.get("search") || "").trim();
  state.projectCategory = String(data.get("category") || "all");
  render();
}

function openProjectEditor(link = null) {
  const defaultCategory = state.categories[0]?.name || "";
  state.projectPreviewMode = "front";
  state.modal = { type: "project", entity: link ? { ...link } : { category: defaultCategory, title: "", mark: nextMark(), tone: "teal", status: "待核实", description: "", detailDescription: "", note: "", adminNote: "", cover: "", guide: "", tips: "", steps: [], url: "", enabled: true } };
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
  const guide = String(data.get("guide") || "");
  const payload = {
    category: String(data.get("category") || ""),
    title: String(data.get("title") || ""),
    mark: String(data.get("mark") || ""),
    tone: String(data.get("tone") || "teal"),
    status: String(data.get("status") || ""),
    description: String(data.get("description") || ""),
    detailDescription: String(data.get("detailDescription") || ""),
    note: String(data.get("note") || ""),
    url: String(data.get("url") || ""),
    cover: String(data.get("cover") || ""),
    guide,
    // Keep the legacy field in the request for older API/database versions;
    // the editable source of truth is now the Markdown body above.
    steps: [],
    tips: String(data.get("tips") || ""),
    adminNote: String(data.get("adminNote") || ""),
  };
  let result;
  if (existing.id) {
    result = await api(`/admin/links/${encodeURIComponent(existing.id)}`, { method: "PUT", body: { ...payload, updatedAt: existing.updatedAt } });
  } else {
    result = await api("/admin/links", { method: "POST", body: payload });
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
  const payload = { name: String(data.get("name") || ""), description: String(data.get("description") || "") };
  let result;
  if (existing.id) {
    result = await api(`/admin/categories/${encodeURIComponent(existing.id)}`, { method: "PUT", body: { ...payload, updatedAt: existing.updatedAt } });
  } else {
    result = await api("/admin/categories", { method: "POST", body: payload });
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

function readStoredDataNavExpanded() {
  try {
    const stored = localStorage.getItem(DATA_NAV_KEY);
    return stored === null ? true : stored !== "false";
  } catch {
    return true;
  }
}

function setDataNavExpanded(expanded) {
  state.dataNavExpanded = Boolean(expanded);
  try { localStorage.setItem(DATA_NAV_KEY, state.dataNavExpanded ? "true" : "false"); } catch {}
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
    return [link.title, link.description, link.detailDescription, link.note, link.status, link.category, link.tips, stepsToText(link.steps)].some((value) => String(value || "").toLocaleLowerCase("zh-CN").includes(search));
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
  const sourceRows = array(payload?.ipSources).length ? array(payload.ipSources) : array(payload?.recent || payload?.sources);
  const fallbackSourceCount = new Set(sourceRows.map((row) => row.source || row.ipSource || row.ip || row.address || "未记录")).size;
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
    recent: sourceRows,
    sourceCount: Number.isFinite(Number(payload?.ipSourceCount)) ? Number(payload.ipSourceCount) : fallbackSourceCount,
    range: payload?.range || null,
    error: "",
  };
}

function emptyStats(error = "") {
  return { overview: { events: 0, categoryViews: 0, linkClicks: 0, uniqueVisitors: 0 }, categories: [], projects: [], hourly: [], recent: [], sourceCount: 0, range: null, error };
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
function formatMetricValue(value) {
  if (typeof value === "string" && value.trim() && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return escapeHtml(value);
  return formatNumber(value);
}
function formatDecimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(number) : "0.0";
}
function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(number)}%` : "0%";
}
function statsRangeLabel() {
  return `${state.statsFrom} 至 ${state.statsTo}`;
}
function dateInputValue(date) { const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 10); }
function daysAgo(days) { return new Date(Date.now() - days * 86_400_000); }

function formatDateTime(value) {
  const time = new Date(value);
  if (!value || Number.isNaN(time.getTime())) return value || "--";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(time);
}

function formatTimelineTime(value, granularity = "hour") {
  if (!value) return "--";
  const time = new Date(value);
  if (!Number.isNaN(time.getTime())) {
    const options = granularity === "day"
      ? { month: "numeric", day: "numeric" }
      : { month: "numeric", day: "numeric", hour: "2-digit", hour12: false };
    return new Intl.DateTimeFormat("zh-CN", options).format(time);
  }
  return String(value).replace("T", " ").slice(5, 16);
}

function stepsToText(steps) {
  return array(steps).map((step) => typeof step === "string" ? step : [step?.title, step?.content || step?.text || step?.description].filter(Boolean).join("：")).filter(Boolean).join("\n");
}

function updateCoverPreview(value) {
  const preview = document.querySelector("#project-cover-preview");
  if (!preview) return;
  const text = String(value || "").trim();
  const clearButton = document.querySelector("[data-action='clear-cover']");
  if (clearButton) clearButton.disabled = !text;
  const imageUrl = safeImageUrl(text);
  const mark = preview.dataset.mark || "指";
  if (!imageUrl) {
    renderCoverFallback(preview, mark, text ? "暂不支持该链接格式" : "未设置封面", Boolean(text));
    return;
  }
  const image = document.createElement("img");
  image.alt = "封面预览";
  image.addEventListener("error", () => {
    if (image.isConnected) renderCoverFallback(preview, mark, "图片无法加载", true);
  });
  image.addEventListener("load", () => {
    if (image.isConnected) preview.classList.remove("has-error");
  });
  image.src = imageUrl;
  preview.classList.add("has-image");
  preview.classList.remove("has-error");
  preview.replaceChildren(image);
}

function renderCoverFallback(preview, mark, label = "未设置封面", isError = false) {
  preview.classList.remove("has-image");
  preview.classList.toggle("has-error", isError);
  const markElement = document.createElement("span");
  markElement.className = "cover-preview-mark";
  markElement.textContent = String(mark || "指").slice(0, 12);
  const copy = document.createElement("span");
  copy.className = "cover-preview-copy";
  copy.textContent = label;
  preview.replaceChildren(markElement, copy);
}

function safeImageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const parsed = new URL(text);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    const normalized = parsed.toString();
    return window.location.protocol === "https:" && parsed.protocol === "http:"
      ? imageProxyUrl(normalized)
      : normalized;
  } catch { return ""; }
}

function imageProxyUrl(value) {
  const base = String(API_BASE || "/api").replace(/\/$/, "");
  if (/^http:/i.test(base)) return value;
  return `${base}/public/image?url=${encodeURIComponent(value)}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }

function refreshIcons(root = document) {
  window.lucide?.createIcons?.({ root, attrs: { "stroke-width": 1.8 } });
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
