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
let lastImageTrigger = null;

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  document.querySelector("#footer-year").textContent = String(new Date().getFullYear());
  document.querySelector("#search-input")?.addEventListener("input", (event) => { searchTerm = event.target.value.trim().toLowerCase(); renderCategoryList(); renderProjects(); });
  document.querySelector("#clear-filter")?.addEventListener("click", () => { searchTerm = ""; activeCategory = ALL_CATEGORY_ID; document.querySelector("#search-input").value = ""; renderAll(); });
  document.querySelector("#close-dialog")?.addEventListener("click", closeDialog);
  document.querySelector("#project-dialog")?.addEventListener("click", (event) => {
    if (event.target.id === "project-dialog") {
      closeDialog();
      return;
    }
    const image = event.target.closest("img[data-lightbox-image]");
    if (image && event.currentTarget.contains(image)) openImageLightbox(image);
  });
  document.querySelector("#project-dialog")?.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
  document.querySelector("#close-image-lightbox")?.addEventListener("click", closeImageLightbox);
  document.querySelector("#image-lightbox")?.addEventListener("click", (event) => {
    if (event.target.id === "image-lightbox" || event.target.id === "image-lightbox-image") closeImageLightbox();
  });
  document.querySelector("#image-lightbox")?.addEventListener("cancel", (event) => { event.preventDefault(); closeImageLightbox(); });
  document.addEventListener("keydown", (event) => {
    const lightbox = document.querySelector("#image-lightbox");
    if (event.key === "Escape") {
      if (lightbox?.open) {
        event.preventDefault();
        event.stopPropagation();
        closeImageLightbox();
      } else if (document.querySelector("#project-dialog")?.open) closeDialog();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    if (lightbox?.open && event.target?.id === "image-lightbox-image") {
      event.preventDefault();
      closeImageLightbox();
      return;
    }
    const image = document.activeElement?.closest?.("img[data-lightbox-image]");
    if (!image || !document.querySelector("#project-dialog")?.contains(image)) return;
    event.preventDefault();
    openImageLightbox(image);
  }, true);
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

function parseMarkdownAlignmentInline(value) {
  const source = String(value || "");
  const div = source.match(/^\s*<div\s+align\s*=\s*["'](left|center|right|justify)["']\s*>([\s\S]*?)<\/div>\s*$/i);
  if (div) return { alignment: div[1].toLowerCase(), content: div[2] };
  const styledDiv = source.match(/^\s*<div\s+style\s*=\s*["']text-align\s*:\s*(left|center|right|justify)\s*;?\s*["']\s*>([\s\S]*?)<\/div>\s*$/i);
  if (styledDiv) return { alignment: styledDiv[1].toLowerCase(), content: styledDiv[2] };
  const center = source.match(/^\s*<center\s*>([\s\S]*?)<\/center>\s*$/i);
  return center ? { alignment: "center", content: center[1] } : null;
}

function parseMarkdownAlignmentStart(value) {
  const source = String(value || "");
  const div = source.match(/^\s*<div\s+align\s*=\s*["'](left|center|right|justify)["']\s*>\s*$/i);
  if (div) return { alignment: div[1].toLowerCase(), closing: /^\s*<\/div>\s*$/i };
  const styledDiv = source.match(/^\s*<div\s+style\s*=\s*["']text-align\s*:\s*(left|center|right|justify)\s*;?\s*["']\s*>\s*$/i);
  if (styledDiv) return { alignment: styledDiv[1].toLowerCase(), closing: /^\s*<\/div>\s*$/i };
  if (/^\s*<center\s*>\s*$/i.test(source)) return { alignment: "center", closing: /^\s*<\/center>\s*$/i };
  return null;
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
  let imageGroup = [];

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
  const flushImageGroup = () => {
    if (!imageGroup.length) return;
    const images = imageGroup.map((image) => renderMarkdownImage(image)).join("");
    blocks.push(imageGroup.length > 1 ? `<div class="markdown-image-grid">${images}</div>` : images);
    imageGroup = [];
  };
  const flushOpenBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushImageGroup();
  };

  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
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
    const inlineAlignment = parseMarkdownAlignmentInline(line);
    if (inlineAlignment) {
      flushOpenBlocks();
      const alignment = inlineAlignment.alignment;
      blocks.push(`<div class="markdown-align markdown-align-${alignment}">${renderMarkdown(inlineAlignment.content)}</div>`);
      continue;
    }
    const alignmentStart = parseMarkdownAlignmentStart(line);
    if (alignmentStart) {
      const closingIndex = lines.findIndex((candidate, candidateIndex) => candidateIndex > index && alignmentStart.closing.test(candidate));
      if (closingIndex !== -1) {
        flushOpenBlocks();
        const alignment = alignmentStart.alignment;
        const content = renderMarkdown(lines.slice(index + 1, closingIndex).join("\n"));
        blocks.push(`<div class="markdown-align markdown-align-${alignment}">${content}</div>`);
        index = closingIndex;
        continue;
      }
    }
    const standaloneImage = standaloneMarkdownImage(line);
    if (standaloneImage) {
      flushParagraph();
      flushList();
      flushQuote();
      imageGroup.push(standaloneImage);
      continue;
    }
    flushImageGroup();
    if (!line.trim()) {
      flushOpenBlocks();
      continue;
    }
    const tableHeader = parseMarkdownTableRow(line);
    if (tableHeader.length > 1 && index + 1 < lines.length && isMarkdownTableDivider(lines[index + 1])) {
      flushOpenBlocks();
      const tableDivider = parseMarkdownTableRow(lines[index + 1]);
      index += 2;
      const tableRows = [];
      while (index < lines.length) {
        const row = parseMarkdownTableRow(lines[index]);
        if (row.length < 2 || isMarkdownTableDivider(lines[index])) break;
        tableRows.push(row);
        index += 1;
      }
      const columnCount = Math.max(tableHeader.length, ...tableRows.map((row) => row.length), 0);
      const header = Array.from({ length: columnCount }, (_, cellIndex) => {
        const cell = tableHeader[cellIndex] || "";
        const alignment = markdownTableAlignment(tableDivider[cellIndex]);
        return `<th scope="col"${alignment ? ` class="markdown-table-${alignment}"` : ""}>${renderMarkdownInline(cell)}</th>`;
      }).join("");
      const body = tableRows.map((row) => `<tr>${Array.from({ length: columnCount }, (_, cellIndex) => {
        const alignment = markdownTableAlignment(tableDivider[cellIndex]);
        return `<td${alignment ? ` class="markdown-table-${alignment}"` : ""}>${renderMarkdownInline(row[cellIndex] || "")}</td>`;
      }).join("")}</tr>`).join("");
      blocks.push(`<div class="markdown-table-wrap"><table><thead><tr>${header}</tr></thead>${body ? `<tbody>${body}</tbody>` : ""}</table></div>`);
      index -= 1;
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
  const tokenPattern = /!\[([^\]]*)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)|\[([^\]]+)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)|`([^`]+)`|<u\s*>([\s\S]*?)<\/u\s*>|\+\+([^+]+)\+\+|<span\s+style\s*=\s*["']font-size\s*:\s*(12|14|16|18|20|24)px\s*;?\s*["']\s*>([\s\S]*?)<\/span\s*>|<span\s+data-font-size\s*=\s*["'](12|14|16|18|20|24)["']\s*>([\s\S]*?)<\/span\s*>|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/gi;
  let output = "";
  let cursor = 0;
  let match;
  while ((match = tokenPattern.exec(source))) {
    output += escapeHtml(source.slice(cursor, match.index));
    if (match[1] !== undefined) {
      const imageUrl = safeImageUrl(match[2]);
      output += imageUrl ? renderMarkdownImage({ url: imageUrl, alt: match[1] || "正文图片", title: match[3] || "" }) : escapeHtml(match[1]);
    } else if (match[4] !== undefined) {
      const linkUrl = safeMarkdownUrl(match[5]);
      output += linkUrl
        ? `<a href="${escapeAttribute(linkUrl)}"${match[6] ? ` title="${escapeAttribute(match[6])}"` : ""} target="_blank" rel="noopener noreferrer">${escapeHtml(match[4])}</a>`
        : escapeHtml(match[4]);
    } else if (match[7] !== undefined) output += `<code>${escapeHtml(match[7])}</code>`;
    else if (match[8] !== undefined || match[9] !== undefined) output += `<u>${renderMarkdownInline(match[8] || match[9], preserveBreaks)}</u>`;
    else if (match[10] !== undefined || match[12] !== undefined) {
      const size = match[10] || match[12];
      const content = match[11] !== undefined ? match[11] : match[13];
      output += `<span class="markdown-font-size" style="font-size:${size}px">${renderMarkdownInline(content, preserveBreaks)}</span>`;
    } else if (match[14] !== undefined || match[15] !== undefined) output += `<strong>${renderMarkdownInline(match[14] || match[15], preserveBreaks)}</strong>`;
    else if (match[16] !== undefined) output += `<del>${renderMarkdownInline(match[16], preserveBreaks)}</del>`;
    else output += `<em>${renderMarkdownInline(match[17] || match[18], preserveBreaks)}</em>`;
    cursor = tokenPattern.lastIndex;
  }
  output += escapeHtml(source.slice(cursor));
  return preserveBreaks ? output.replace(/\n/g, "<br />") : output;
}

function renderMarkdownImage(image, className = "markdown-image") {
  const alt = image.alt || "正文图片";
  return `<img class="${className}" src="${escapeAttribute(image.url)}" alt="${escapeAttribute(alt)}"${image.title ? ` title="${escapeAttribute(image.title)}"` : ""} loading="lazy" decoding="async" data-lightbox-image="true" tabindex="0" role="button" aria-label="${escapeAttribute(`放大查看${alt}`)}" />`;
}

function standaloneMarkdownImageUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate || /\s/.test(candidate) || !isMarkdownImagePath(candidate)) return "";
  return safeImageUrl(candidate);
}

function standaloneMarkdownImage(value) {
  const line = String(value || "").trim();
  const directUrl = standaloneMarkdownImageUrl(line);
  if (directUrl) return { url: directUrl, alt: "正文图片", title: "" };
  const match = line.match(/^!\[([^\]]*)\]\(([^\s]+)(?:\s+["']([^"']*)["'])?\)$/);
  if (!match) return null;
  const imageUrl = safeImageUrl(match[2]);
  return imageUrl ? { url: imageUrl, alt: match[1] || "正文图片", title: match[3] || "" } : null;
}

function isMarkdownImagePath(value) {
  try {
    const parsed = new URL(String(value), window.location.href);
    return /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function parseMarkdownTableRow(value) {
  const line = String(value || "").trim();
  if (!line.includes("|")) return [];
  const cells = [];
  let cell = "";
  let backslashCount = 0;
  for (const character of line) {
    if (character === "\\") {
      backslashCount += 1;
      cell += character;
      continue;
    }
    if (character === "|" && backslashCount % 2 === 0) {
      cells.push(cell.trim());
      cell = "";
      backslashCount = 0;
      continue;
    }
    if (character === "|" && backslashCount % 2 === 1) {
      cell = `${cell.slice(0, -1)}|`;
      backslashCount = 0;
      continue;
    }
    backslashCount = 0;
    cell += character;
  }
  cells.push(cell.trim());
  if (line.startsWith("|")) cells.shift();
  if (line.endsWith("|") && !isMarkdownTableEscapedPipe(line, line.length - 1)) cells.pop();
  return cells.length > 1 ? cells : [];
}

function isMarkdownTableEscapedPipe(value, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function markdownTableAlignment(value) {
  const divider = String(value || "").trim();
  if (/^:-{3,}:$/.test(divider)) return "align-center";
  if (/^-{3,}:$/.test(divider)) return "align-right";
  if (/^:-{3,}$/.test(divider)) return "align-left";
  return "";
}

function isMarkdownTableDivider(value) {
  const cells = parseMarkdownTableRow(value);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function safeMarkdownUrl(value) {
  const trimmed = String(value || "").trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return "";
}

function safeImageUrl(value) {
  const trimmed = String(value || "").trim();
  const safe = safeMarkdownUrl(trimmed);
  if (!safe) return "";
  if (window.location.protocol === "https:" && /^http:\/\//i.test(safe)) return imageProxyUrl(safe);
  return safe;
}

function imageProxyUrl(value) {
  const base = String(API_BASE || "/api").replace(/\/$/, "");
  if (/^http:/i.test(base)) return value;
  return `${base}/public/image?url=${encodeURIComponent(value)}`;
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
  return `<article class="project-card link-card tone-${escapeAttribute(tone)}" tabindex="0" role="button" aria-haspopup="dialog" aria-controls="project-dialog" data-project-id="${escapeAttribute(link.id)}" aria-label="查看${escapeAttribute(link.title)}教程"><div class="card-topline"><span class="status-badge">${escapeHtml(link.status || "教程")}</span><span class="card-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></div><div class="card-identity"><span class="link-mark" aria-hidden="true">${renderMark(link.mark, "指")}</span><h3><span class="card-title-text">${escapeHtml(link.title)}</span><i data-lucide="arrow-up-right" aria-hidden="true"></i></h3></div><p class="card-description">${escapeHtml(link.description || "打开查看项目介绍和完整教程。")}</p><div class="card-meta"><span>${escapeHtml(link.note || "项目教程")}</span><span>查看完整教程</span></div></article>`;
}

function openDialog(id, trigger = null) {
  const link = navigationData.links.find((item) => item.id === id); if (!link) return;
  lastTrigger = trigger || document.activeElement;
  const detailDescription = link.detailDescription || link.description || "";
  const guide = link.guide || legacyStepsToMarkdown(link.steps);
  const markdown = renderMarkdown(guide) || "<p class=\"markdown-empty\">暂无正文，请打开项目入口查看最新说明。</p>";
  const entryUrl = normalizeUrl(link.url);
  const entryCta = entryUrl ? `<a class="dialog-cta" href="${escapeAttribute(entryUrl)}" target="_blank" rel="noopener noreferrer" data-track-id="${escapeAttribute(link.id)}"><span>打开项目入口</span><i data-lucide="external-link" aria-hidden="true"></i></a>` : "";
  document.querySelector("#dialog-content").innerHTML = `<div class="dialog-copy"><div class="dialog-kicker">${escapeHtml(link.category)}</div><h2 id="dialog-title">${escapeHtml(link.title)}<span class="dialog-title-status status-badge">${escapeHtml(link.status || "指南")}</span></h2><p class="dialog-description">${escapeHtml(detailDescription)}</p><div class="markdown-heading"><span>教程正文</span></div><div class="markdown-body">${markdown}</div>${link.tips ? `<aside class="tips-box"><i data-lucide="lightbulb" aria-hidden="true"></i><p><strong>小提示</strong>${escapeHtml(link.tips)}</p></aside>` : ""}${entryCta}</div>`;
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

function openImageLightbox(image) {
  const dialog = document.querySelector("#image-lightbox");
  const preview = document.querySelector("#image-lightbox-image");
  if (!dialog || !preview || !image?.src) return;
  lastImageTrigger = image;
  preview.src = image.currentSrc || image.src;
  preview.alt = image.alt || "正文图片";
  if (image.title) preview.title = image.title;
  else preview.removeAttribute("title");
  dialog.showModal();
  document.querySelector("#close-image-lightbox")?.focus();
}

function closeImageLightbox() {
  const dialog = document.querySelector("#image-lightbox");
  if (!dialog?.open) return;
  dialog.close();
  if (lastImageTrigger && document.contains(lastImageTrigger)) lastImageTrigger.focus();
  lastImageTrigger = null;
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
function normalizeUrl(value) { const trimmed = String(value || "").trim(); if (!trimmed) return ""; return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }
function renderMark(value, fallback = "指") {
  const characters = Array.from(String(value ?? "").trim() || fallback).slice(0, 12);
  if (characters.length <= 3) return `<span class="mark-line">${escapeHtml(characters.join(""))}</span>`;
  const lines = [];
  if (characters.length === 4) {
    lines.push(characters.slice(0, 2), characters.slice(2));
  } else {
    for (let index = 0; index < characters.length; index += 3) lines.push(characters.slice(index, index + 3));
  }
  return lines.map((line) => `<span class="mark-line">${escapeHtml(line.join(""))}</span>`).join("");
}
function escapeCssUrl(value) { return String(value ?? "").replace(/[\\'"()\n\r]/g, (character) => ({ "\\": "\\\\", "'": "\\'", '"': '\\"', "(": "\\(", ")": "\\)", "\n": "", "\r": "" })[character]); }

function initializeTheme() { applyTheme(readStoredTheme() === "dark" ? "dark" : "light", false); document.querySelector("#theme-toggle")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")); }
function readStoredTheme() { try { return localStorage.getItem(THEME_STORAGE_KEY); } catch { return null; } }
function applyTheme(theme, persist = true) { const normalized = theme === "dark" ? "dark" : "light"; document.documentElement.dataset.theme = normalized; if (persist) try { localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch {} const button = document.querySelector("#theme-toggle"); if (button) { button.innerHTML = `<i data-lucide="${normalized === "dark" ? "sun" : "moon"}" aria-hidden="true"></i>`; button.title = normalized === "dark" ? "切换浅色模式" : "切换深色模式"; button.setAttribute("aria-label", button.title); refreshIcons(); } }
function refreshIcons() { if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } }); }

function toneForIndex(index) {
  return ["teal", "rose", "blue", "purple", "yellow", "orange", "lime"][index % 7];
}
