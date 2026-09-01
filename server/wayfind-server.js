#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const dns = require("node:dns").promises;
const { URL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");

const NODE_ENV = process.env.NODE_ENV || "development";
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4899);
const ROOT_DIR = path.resolve(__dirname);
const PUBLIC_DIR = path.resolve(ROOT_DIR, "..");
const ADMIN_DIR = path.join(ROOT_DIR, "admin");
const ADMIN_FILES = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["admin.css", "text/css; charset=utf-8"],
  ["admin.js", "application/javascript; charset=utf-8"],
  ["lucide-mini.js", "application/javascript; charset=utf-8"],
]);
const PUBLIC_FILES = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["styles.css", "text/css; charset=utf-8"],
  ["app.js", "application/javascript; charset=utf-8"],
  ["lucide-mini.js", "application/javascript; charset=utf-8"],
  ["favicon.svg", "image/svg+xml"],
]);
const DB_PATH = process.env.DB_PATH || (NODE_ENV === "production"
  ? "/var/lib/guide-admin/guide.sqlite"
  : path.join(ROOT_DIR, "guide.sqlite"));
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_COOKIE_PATH = "/api/";

function configuredSessionSecret(value) {
  const secret = String(value || "");
  if (secret) return secret;
  if (NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return crypto.randomBytes(32).toString("hex");
}

function configuredCookiePath(value) {
  const cookiePath = String(value || DEFAULT_COOKIE_PATH).trim();
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(cookiePath)) {
    throw new Error("COOKIE_PATH must be an absolute path ending in '/'");
  }
  return cookiePath;
}

function configuredSessionTtl(value) {
  if (value === undefined || value === "") return DEFAULT_SESSION_TTL_MS;
  const ttl = Number(value);
  if (!Number.isSafeInteger(ttl) || ttl < MIN_SESSION_TTL_MS || ttl > MAX_SESSION_TTL_MS) {
    throw new Error(`SESSION_TTL_MS must be an integer between ${MIN_SESSION_TTL_MS} and ${MAX_SESSION_TTL_MS}`);
  }
  return ttl;
}

const SESSION_SECRET = configuredSessionSecret(process.env.SESSION_SECRET);
const COOKIE_PATH = configuredCookiePath(process.env.COOKIE_PATH);
const SESSION_TTL_MS = configuredSessionTtl(process.env.SESSION_TTL_MS);
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_IMAGE_PROXY_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PROXY_REDIRECTS = 4;
const IMAGE_PROXY_TIMEOUT_MS = 12_000;
const MAX_LOGIN_ATTEMPT_RECORDS = 10_000;
const MAX_SESSION_RECORDS = 10_000;
const configuredAdminOrigins = [process.env.ADMIN_ORIGINS, process.env.ADMIN_ORIGIN]
  .flatMap((value) => String(value || "").split(","))
  .map((origin) => origin.trim())
  .filter(Boolean);
if (NODE_ENV === "production" && configuredAdminOrigins.length === 0) {
  throw new Error("ADMIN_ORIGIN or ADMIN_ORIGINS must be set in production");
}
const ADMIN_ORIGINS = new Set([
  ...configuredAdminOrigins,
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
]);
const PUBLIC_ORIGINS = new Set(
  [
    process.env.PUBLIC_ORIGINS,
    process.env.PUBLIC_ORIGIN,
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
    "http://127.0.0.1:4173",
    "http://localhost:4173",
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const DEFAULT_CATEGORIES = [
  { id: "life-benefits", name: "生活权益", description: "会员权益、日常服务与优惠使用指南" },
  { id: "food-drinks", name: "外卖奶茶", description: "外卖、到店与饮品优惠活动教程" },
  { id: "travel", name: "打车出行", description: "出行券、乘车权益和活动说明" },
  { id: "shopping-membership", name: "网购入会", description: "电商会员、购物权益和开通步骤" },
  { id: "cash-rewards", name: "红包现金", description: "活动奖励、红包与到账注意事项" },
  { id: "games", name: "游戏相关", description: "游戏活动、礼包和账号权益教程" },
  { id: "other-projects", name: "其他项目", description: "未归类项目与新手使用说明" },
];
const TONES = new Set(["coral", "teal", "yellow", "blue", "purple", "orange", "rose", "lime", "indigo"]);

const SEED_LINKS = [
  {
    category: "生活权益", title: "会员权益查询与领取", mark: "益", tone: "teal", status: "新手教程",
    description: "先核对账号，再按页面提示领取可用的生活权益。", note: "账号权益 · 图文步骤", url: "https://www.10086.cn/",
    guide: "打开权益页面后，确认登录账号和权益有效期。选择需要的权益并完成领取，使用前再次查看适用范围。",
    tips: "不同地区和账号等级的可领权益可能不同，以活动页面的最终说明为准。",
    steps: [
      { title: "登录账号", content: "使用参与活动的手机号或会员账号登录官方页面。" },
      { title: "查看可领权益", content: "在权益中心筛选未领取、有效期内的项目。" },
      { title: "领取并核对", content: "领取后保存使用条件和截止时间，再按规则使用。" },
    ],
  },
  {
    category: "外卖奶茶", title: "外卖优惠券使用指南", mark: "券", tone: "coral", status: "优惠教程",
    description: "领券、选店、下单前核对门槛，一次看清优惠的使用流程。", note: "外卖奶茶 · 下单前核对", url: "https://www.meituan.com/",
    guide: "先在活动页领取优惠券，再选择支持活动的商家和商品。结算页会显示是否满足使用门槛。",
    tips: "优惠券通常有城市、门店、配送方式和最低消费限制，提交订单前请以结算页为准。",
    steps: [
      { title: "领取优惠券", content: "在官方活动页或会员中心领取，确认有效期。" },
      { title: "选择适用商家", content: "进入券面标明的品类、城市或门店范围内选购。" },
      { title: "结算确认", content: "检查优惠已勾选、优惠金额和订单总价后再提交。" },
    ],
  },
  {
    category: "打车出行", title: "出行券领取与使用", mark: "行", tone: "blue", status: "使用教程",
    description: "出行券到账后，按车型、城市和有效期完成抵扣。", note: "打车出行 · 抵扣规则", url: "https://www.didiglobal.com/",
    guide: "从活动页领取出行券后，在可用券列表确认限制。发起行程时选择符合规则的车型，系统会在支付前展示抵扣结果。",
    tips: "券的适用城市、车型、拼车或特惠订单限制可能不同，取消订单后的返还规则也应提前确认。",
    steps: [
      { title: "领取并查看规则", content: "确认券已进入账户，查看有效期、城市和车型要求。" },
      { title: "发起符合条件的订单", content: "选择适用车型和上车地点，避免超出券面限制。" },
      { title: "支付前确认抵扣", content: "在支付页面确认已自动选择正确的优惠券。" },
    ],
  },
  {
    category: "网购入会", title: "电商会员开通与权益查看", mark: "会", tone: "purple", status: "入会教程",
    description: "完成入会后，集中查看运费、折扣和专属券等会员权益。", note: "网购入会 · 权益总览", url: "https://www.jd.com/",
    guide: "从官方会员页面选择合适的方案，支付前确认自动续费状态。开通完成后进入会员中心查看已生效的权益和券包。",
    tips: "试用、首月优惠和自动续费规则各不相同，付款前务必阅读页面展示的价格与续费说明。",
    steps: [
      { title: "选择会员方案", content: "比较不同周期的价格、权益和续费说明。" },
      { title: "确认支付信息", content: "检查账号、金额和是否开启自动续费。" },
      { title: "进入会员中心", content: "查看权益是否到账，并领取需要手动领取的券。" },
    ],
  },
  {
    category: "红包现金", title: "活动奖励领取说明", mark: "奖", tone: "orange", status: "活动教程",
    description: "按照活动任务要求完成操作，再在奖励页核对到账状态。", note: "红包现金 · 到账核对", url: "https://www.alipay.com/",
    guide: "先阅读活动规则和资格要求，完成页面列出的任务。奖励到账后，在官方账户或活动记录内核对金额、有效期和使用方式。",
    tips: "不提供任何账号、验证码或付款密码；涉及转账、缴费或下载未知应用的内容请先核验官方渠道。",
    steps: [
      { title: "阅读活动规则", content: "确认参与资格、任务时间和奖励发放条件。" },
      { title: "完成指定任务", content: "仅在官方页面内完成活动要求的操作。" },
      { title: "核对到账记录", content: "在账户明细或活动记录中确认奖励状态。" },
    ],
  },
  {
    category: "游戏相关", title: "游戏福利活动参与指南", mark: "游", tone: "indigo", status: "福利教程",
    description: "通过官方活动页参与任务、领取礼包并核对发放方式。", note: "游戏相关 · 官方活动", url: "https://store.steampowered.com/",
    guide: "先确认游戏区服和登录账号，再进入官方活动页查看参与条件。完成任务后，根据页面说明在游戏内邮箱、兑换中心或背包中领取奖励。",
    tips: "兑换码、账号密码和二次验证码属于敏感信息，请只在游戏官网、客户端或认证渠道中输入。",
    steps: [
      { title: "确认账号与区服", content: "登录正确账号，避免奖励发放到错误角色或服务器。" },
      { title: "参与官方活动", content: "按照活动页要求完成签到、预约或任务。" },
      { title: "领取游戏内奖励", content: "根据说明到邮箱、兑换中心或背包确认奖励。" },
    ],
  },
  {
    category: "其他项目", title: "新项目使用说明", mark: "新", tone: "lime", status: "通用教程",
    description: "适用于新收录项目的基础查看、报名和使用流程。", note: "其他项目 · 使用说明", url: "https://example.com/",
    guide: "打开项目详情后先阅读参与条件、有效期和所需材料。确认满足要求后再跳转官方页面完成操作，并保留相关记录。",
    tips: "本导航用于整理公开项目说明，不替代活动官方规则；涉及个人信息或支付时请优先核验官方页面。",
    steps: [
      { title: "查看项目详情", content: "先了解项目适用人群、截止时间和操作条件。" },
      { title: "按步骤完成操作", content: "根据教程跳转到对应的官方页面。" },
      { title: "保存结果", content: "记录报名、领取或到账结果，方便后续核对。" },
    ],
  },
];

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    position INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    mark TEXT NOT NULL,
    tone TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT NOT NULL,
    detail_description TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL,
    admin_note TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    guide TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '[]',
    tips TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL,
    position INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    category_id TEXT,
    category_name TEXT,
    link_id TEXT,
    link_title TEXT,
    ip TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    referer TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS links_category_position ON links(category, position);
  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS analytics_events_created_at ON analytics_events(created_at_ms);
  CREATE INDEX IF NOT EXISTS analytics_events_type ON analytics_events(event_type, created_at_ms);
  CREATE INDEX IF NOT EXISTS analytics_events_category ON analytics_events(category_id, created_at_ms);
  CREATE INDEX IF NOT EXISTS analytics_events_link ON analytics_events(link_id, created_at_ms);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    return true;
  }
  return false;
}

ensureColumn("categories", "enabled", "INTEGER NOT NULL DEFAULT 1");
ensureColumn("links", "enabled", "INTEGER NOT NULL DEFAULT 1");
const detailDescriptionAdded = ensureColumn("links", "detail_description", "TEXT NOT NULL DEFAULT ''");
if (detailDescriptionAdded) {
  db.prepare("UPDATE links SET detail_description = description WHERE trim(detail_description) = ''").run();
}
ensureColumn("links", "admin_note", "TEXT NOT NULL DEFAULT ''");
ensureColumn("links", "cover", "TEXT NOT NULL DEFAULT ''");
ensureColumn("links", "guide", "TEXT NOT NULL DEFAULT ''");
ensureColumn("links", "steps", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("links", "tips", "TEXT NOT NULL DEFAULT ''");

let lastUpdatedAtMilliseconds = 0;

function nextUpdatedAt() {
  // `updated_at` is also the optimistic-concurrency token. Keep it unique
  // even when two synchronous writes happen in the same clock millisecond.
  lastUpdatedAtMilliseconds = Math.max(Date.now(), lastUpdatedAtMilliseconds + 1);
  return new Date(lastUpdatedAtMilliseconds).toISOString();
}

function initializeNavigationData() {
  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const initialized = db.prepare("SELECT value FROM settings WHERE key = ?").get("navigation_initialized_at");
    if (!initialized) {
      const categoryCount = Number(db.prepare("SELECT COUNT(*) AS count FROM categories").get().count);
      const linkCount = Number(db.prepare("SELECT COUNT(*) AS count FROM links").get().count);
      const now = nextUpdatedAt();

      if (categoryCount === 0 && linkCount === 0) {
        const insertCategory = db.prepare(`
          INSERT INTO categories (id, name, description, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        DEFAULT_CATEGORIES.forEach((category, position) => {
          insertCategory.run(category.id, category.name, category.description, position, now, now);
        });

        const insertLink = db.prepare(`
          INSERT INTO links (id, category, title, mark, tone, status, description, detail_description, note, cover, guide, steps, tips, url, position, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const positions = new Map(DEFAULT_CATEGORIES.map((category) => [category.name, 0]));
        for (const link of SEED_LINKS) {
          insertLink.run(
            crypto.randomUUID(), link.category, link.title, link.mark, link.tone, link.status,
            link.description, link.detailDescription || link.description || "", link.note, link.cover || "", link.guide || "", JSON.stringify(link.steps || []), link.tips || "",
            link.url, positions.get(link.category), now, now,
          );
          positions.set(link.category, positions.get(link.category) + 1);
        }
      }

      db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
        .run("navigation_initialized_at", now, now);
    }
    db.exec("COMMIT");
  } catch (error) {
    if (transactionOpen) db.exec("ROLLBACK");
    throw error;
  }
}

initializeNavigationData();

function legacyStepsToMarkdown(guideValue, rawSteps) {
  const guide = typeof guideValue === "string" ? guideValue.trim() : "";
  const steps = Array.isArray(rawSteps) ? rawSteps : parseSteps(rawSteps);
  const sections = [];
  if (guide) sections.push(guide);

  for (const step of steps) {
    if (typeof step === "string") {
      const content = step.trim();
      if (content) sections.push(`### 教程步骤\n\n${content}`);
      continue;
    }
    if (!step || typeof step !== "object" || Array.isArray(step)) continue;
    const title = String(step.title || "").trim();
    const content = String(step.content ?? step.text ?? step.description ?? "").trim();
    const image = String(step.image ?? step.imageUrl ?? "").trim();
    if (!title && !content && !image) continue;

    const section = [`### ${title || "教程步骤"}`];
    if (content) section.push(content);
    if (image) section.push(`![${title || "步骤图片"}](${image})`);
    sections.push(section.join("\n\n"));
  }

  return sections.join("\n\n");
}

function migrateLegacyGuideData() {
  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const migrated = db.prepare("SELECT value FROM settings WHERE key = ?").get("markdown_body_migrated_at");
    if (!migrated) {
      const rows = db.prepare("SELECT id, guide, steps FROM links").all();
      const update = db.prepare("UPDATE links SET guide = ?, updated_at = ? WHERE id = ?");
      for (const row of rows) {
        const guide = legacyStepsToMarkdown(row.guide, row.steps);
        if (guide !== String(row.guide || "").trim()) {
          update.run(guide, nextUpdatedAt(), row.id);
        }
      }
      const now = nextUpdatedAt();
      db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)")
        .run("markdown_body_migrated_at", now, now);
    }
    db.exec("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) db.exec("ROLLBACK");
    throw error;
  }
}

migrateLegacyGuideData();

const loginAttempts = new Map();

function configuredPasswordHash() {
  if (ADMIN_PASSWORD_HASH) return ADMIN_PASSWORD_HASH;
  if (ADMIN_PASSWORD) return hashPassword(ADMIN_PASSWORD);
  throw new Error("Set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD before starting the server");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

function hashPasswordAsync(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 32, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) return reject(error);
      resolve(`scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`);
    });
  });
}

function verifyPassword(password, encoded) {
  try {
    const [algorithm, saltText, keyText, extra] = String(encoded).split("$");
    if (algorithm !== "scrypt" || !saltText || !keyText || extra !== undefined) return Promise.resolve(false);

    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (salt.length === 0 || expected.length === 0) return Promise.resolve(false);

    return new Promise((resolve) => {
      crypto.scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1 }, (error, actual) => {
        resolve(!error && actual.length === expected.length && crypto.timingSafeEqual(actual, expected));
      });
    });
  } catch {
    return Promise.resolve(false);
  }
}

const storedPassword = db.prepare("SELECT value FROM settings WHERE key = ?").get("admin_password_hash");
let passwordHash = storedPassword?.value || configuredPasswordHash();
if (!storedPassword) {
  db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").run("admin_password_hash", passwordHash, new Date().toISOString());
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function isPrivateIpAddress(value) {
  const normalized = String(value || "").toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const version = net.isIP(normalized);
  if (version === 4) {
    const octets = normalized.split(".").map(Number);
    const [first, second] = octets;
    return first === 0 || first === 10 || first === 127 || first >= 224
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && (second === 0 || second === 168))
      || (first === 198 && second >= 18 && second <= 19);
  }
  if (version === 6) {
    return normalized === "::" || normalized === "::1"
      || normalized.startsWith("fc") || normalized.startsWith("fd")
      || /^(fe[89ab])/.test(normalized)
      || (normalized.startsWith("::ffff:") && isPrivateIpAddress(normalized.slice(7)));
  }
  return false;
}

async function validateImageProxyTarget(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 2_048) throw Object.assign(new Error("图片地址格式不正确"), { status: 400 });
  let target;
  try { target = new URL(text); } catch { throw Object.assign(new Error("图片地址格式不正确"), { status: 400 }); }
  if (!["http:", "https:"].includes(target.protocol)) {
    throw Object.assign(new Error("图片地址只能使用 http 或 https"), { status: 400 });
  }
  if (target.username || target.password) {
    throw Object.assign(new Error("图片地址不能包含账号或密码"), { status: 400 });
  }

  const hostname = target.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal" || isPrivateIpAddress(hostname)) {
    throw Object.assign(new Error("图片地址不允许访问本机或内网地址"), { status: 400 });
  }
  if (net.isIP(hostname) === 0) {
    let addresses;
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw Object.assign(new Error("图片地址无法解析"), { status: 400 });
    }
    if (!addresses.length || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
      throw Object.assign(new Error("图片地址不允许访问本机或内网地址"), { status: 400 });
    }
  }
  return target;
}

async function readLimitedResponseBody(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_PROXY_BYTES) {
    throw Object.assign(new Error("图片文件不能超过 8 MB"), { status: 413 });
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_PROXY_BYTES) {
        await reader.cancel();
        throw Object.assign(new Error("图片文件不能超过 8 MB"), { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function handlePublicImageProxy(req, res, searchParams) {
  const rawUrl = searchParams.get("url");
  let target;
  let response;
  try {
    target = await validateImageProxyTarget(rawUrl);
    for (let redirect = 0; redirect <= MAX_IMAGE_PROXY_REDIRECTS; redirect += 1) {
      response = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(IMAGE_PROXY_TIMEOUT_MS),
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/*;q=0.9",
          "User-Agent": "ZhuyzPro-ImageProxy/1.0",
        },
      });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get("location");
      response.body?.cancel();
      if (!location || redirect === MAX_IMAGE_PROXY_REDIRECTS) {
        throw Object.assign(new Error("图片地址重定向次数过多"), { status: 502 });
      }
      target = await validateImageProxyTarget(new URL(location, target).toString());
    }

    if (!response?.ok) throw Object.assign(new Error("图片源暂时无法访问"), { status: 502 });
    const contentType = String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!/^image\/(?:avif|bmp|gif|jpeg|jpg|png|svg\+xml|tiff|webp|x-icon|vnd\.microsoft\.icon)$/.test(contentType)) {
      throw Object.assign(new Error("图片地址未返回可显示的图片"), { status: 415 });
    }
    const body = await readLimitedResponseBody(response);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.length,
      "Cache-Control": "public, max-age=86400",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    });
    return res.end(body);
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return sendRequestError(res, Object.assign(new Error("图片加载超时，请稍后重试"), { status: 504 }));
    }
    if (error?.status) return sendRequestError(res, error);
    return sendRequestError(res, Object.assign(new Error("图片源暂时无法访问"), { status: 502 }));
  }
}

function sendRequestError(res, error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  if (res.headersSent || res.writableEnded) {
    res.destroy();
    return;
  }
  sendJson(res, status, { error: status === 500 ? "服务器暂时无法处理请求" : error.message });
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && PUBLIC_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type, X-CSRF-Token");
    res.setHeader("Vary", "Origin");
  }
}

function isAllowedAdminOrigin(req) {
  const origin = req.headers.origin;
  return typeof origin === "string" && ADMIN_ORIGINS.has(origin);
}

function parseCookies(header) {
  return String(header || "").split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index > 0) {
      const name = item.slice(0, index).trim();
      if (!name) return cookies;
      try {
        // Browsers list the most-specific cookie path first. Keep it when a
        // legacy root-path cookie shares the same name during migration.
        if (!Object.hasOwn(cookies, name)) cookies[name] = decodeURIComponent(item.slice(index + 1).trim());
      } catch {
        // Ignore malformed cookie values instead of failing the request.
      }
    }
    return cookies;
  }, Object.create(null));
}

function pruneLoginAttempts(now) {
  for (const [address, record] of loginAttempts) {
    if (record.resetAt <= now) loginAttempts.delete(address);
  }
  while (loginAttempts.size >= MAX_LOGIN_ATTEMPT_RECORDS) {
    loginAttempts.delete(loginAttempts.keys().next().value);
  }
}

function pruneExpiredSessions(now) {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  const count = Number(db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count);
  const overflow = count - MAX_SESSION_RECORDS + 1;
  if (overflow > 0) {
    db.prepare("DELETE FROM sessions WHERE id IN (SELECT id FROM sessions ORDER BY created_at ASC LIMIT ?)").run(overflow);
  }
}

function clientAddress(req) {
  const socketAddress = req.socket.remoteAddress || "unknown";
  const isLoopback = socketAddress === "127.0.0.1" || socketAddress === "::1" || socketAddress === "::ffff:127.0.0.1";
  if (!isLoopback) return socketAddress;
  const realIp = req.headers["x-real-ip"];
  const candidate = Array.isArray(realIp) ? realIp[0] : String(realIp || "").trim();
  return net.isIP(candidate) ? candidate : socketAddress;
}

function signSession(id) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(id).digest("base64url");
}

function createSession(username) {
  const now = Date.now();
  pruneExpiredSessions(now);
  const id = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (id, username, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(id, username, now + SESSION_TTL_MS, now);
  return `${id}.${signSession(id)}`;
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie).wayfind_session;
  if (typeof token !== "string") return null;
  const [id, signature, ...rest] = token.split(".");
  if (!id || !signature || rest.length > 0) return null;
  const expectedSignature = Buffer.from(signSession(id), "base64url");
  const actualSignature = Buffer.from(signature, "base64url");
  if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;
  const session = db.prepare("SELECT id, username, expires_at AS expiresAt FROM sessions WHERE id = ?").get(id);
  const now = Date.now();
  if (!session || Number(session.expiresAt) <= now) {
    if (session) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(expiresAt, id);
  return { id, username: session.username, expiresAt };
}

function sessionCookie(token, cookiePath = COOKIE_PATH) {
  const secure = COOKIE_SECURE ? "; Secure" : "";
  return `wayfind_session=${encodeURIComponent(token)}; Path=${cookiePath}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

function clearSessionCookie(cookiePath = COOKIE_PATH) {
  const secure = COOKIE_SECURE ? "; Secure" : "";
  return `wayfind_session=; Path=${cookiePath}; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function sessionCookies(token) {
  const cookies = [sessionCookie(token)];
  // Old deployments used Path=/. Clear that broad cookie while issuing the
  // scoped replacement so existing logins migrate without a forced logout.
  if (COOKIE_PATH !== "/") cookies.push(clearSessionCookie("/"));
  return cookies;
}

function clearedSessionCookies() {
  const cookies = [clearSessionCookie()];
  if (COOKIE_PATH !== "/") cookies.push(clearSessionCookie("/"));
  return cookies;
}

function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: "登录已失效，请重新登录" }, { "Set-Cookie": clearedSessionCookies() });
    return null;
  }
  // Refresh the browser cookie while the account is actively being used.
  res.setHeader("Set-Cookie", sessionCookies(`${session.id}.${signSession(session.id)}`));
  return session;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(Object.assign(new Error("请求内容过大"), { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw Object.assign(new Error("请求体必须是 JSON 对象"), { status: 400 });
        }
        settled = true;
        resolve(body);
      } catch (error) {
        fail(error?.status ? error : Object.assign(new Error("请求不是有效 JSON"), { status: 400 }));
      }
    });
    req.on("error", fail);
  });
}

function textField(value, name, { required = true, max = 240 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw Object.assign(new Error(`${name}不能为空`), { status: 400 });
    return "";
  }
  if (typeof value !== "string") throw Object.assign(new Error(`${name}必须是文本`), { status: 400 });
  const text = value.trim();
  if (required && !text) throw Object.assign(new Error(`${name}不能为空`), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`${name}不能超过${max}个字符`), { status: 400 });
  return text;
}

function enabledField(value) {
  if (typeof value !== "boolean") throw Object.assign(new Error("启用状态必须是布尔值"), { status: 400 });
  return value;
}

function updatedAtField(value) {
  return textField(value, "版本信息", { max: 96 });
}

function staleUpdateError() {
  return Object.assign(new Error("内容已被其他会话更新，请刷新后重试"), { status: 409 });
}

function requireSingleChange(result) {
  if (Number(result.changes) !== 1) throw staleUpdateError();
}

function toCategory(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    position: row.position,
    enabled: Number(row.enabled) === 1,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function getCategories() {
  return db.prepare("SELECT id, name, description, position, enabled, updated_at FROM categories ORDER BY position, name COLLATE NOCASE").all().map(toCategory);
}

function getPublicCategories() {
  return db.prepare("SELECT id, name, description, position, enabled, updated_at FROM categories WHERE enabled = 1 ORDER BY position, name COLLATE NOCASE").all().map(toCategory);
}

function getCategory(id) {
  const row = db.prepare("SELECT id, name, description, position, enabled, updated_at FROM categories WHERE id = ?").get(id);
  return row ? toCategory(row) : null;
}

function getCategoryNames() {
  return new Set(getCategories().map((category) => category.name));
}

function normalizeLink(input, existing = {}) {
  const category = textField(input.category ?? existing.category, "分类", { max: 40 });
  const url = textField(input.url ?? existing.url ?? "", "地址", { required: false, max: 2048 });
  let parsed = null;
  if (url) {
    try { parsed = new URL(url); } catch { throw Object.assign(new Error("地址格式不正确"), { status: 400 }); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("地址只能使用 http 或 https"), { status: 400 });
    if (parsed.username || parsed.password) throw Object.assign(new Error("地址不能包含账号或密码"), { status: 400 });
  }
  if (!getCategoryNames().has(category)) throw Object.assign(new Error("分类不存在，请先新增分类"), { status: 400 });
  const tone = textField(input.tone ?? existing.tone ?? "teal", "色调", { max: 12 });
  if (!TONES.has(tone)) throw Object.assign(new Error("色调不受支持"), { status: 400 });

  const coverValue = input.cover ?? input.image ?? existing.cover ?? existing.image ?? "";
  const cover = textField(coverValue, "封面图 URL", { required: false, max: 2048 });
  validateImageUrl(cover, "封面图 URL");

  const guide = textField(input.guide ?? input.content ?? existing.guide ?? existing.content ?? "", "正文 Markdown", { required: false, max: 100_000 });
  const rawSteps = input.steps ?? existing.steps ?? [];
  const steps = normalizeSteps(rawSteps);
  return {
    category,
    title: textField(input.title ?? existing.title, "项目标题", { max: 80 }),
    mark: textField(input.mark ?? existing.mark, "卡片标记", { max: 12 }),
    tone,
    status: textField(input.status ?? existing.status, "状态文案", { max: 24 }),
    description: textField(input.description ?? existing.description, "卡片简介", { max: 240 }),
    detailDescription: textField(input.detailDescription ?? input.detail_description ?? existing.detailDescription ?? existing.detail_description ?? "", "详情介绍", { required: false, max: 1_000 }),
    note: textField(input.note ?? existing.note, "卡片说明", { max: 80 }),
    adminNote: textField(input.adminNote ?? existing.adminNote, "后台备注", { required: false, max: 500 }),
    cover,
    guide,
    steps,
    tips: textField(input.tips ?? existing.tips ?? "", "小提示", { required: false, max: 2_000 }),
    url: parsed ? parsed.toString() : "",
  };
}

function normalizeSteps(value) {
  let steps = value;
  if (typeof steps === "string") {
    try { steps = JSON.parse(steps); } catch { steps = steps ? [steps] : []; }
  }
  if (steps === undefined || steps === null || steps === "") return [];
  if (!Array.isArray(steps)) throw Object.assign(new Error("教程步骤必须是数组"), { status: 400 });
  if (steps.length > 100) throw Object.assign(new Error("教程步骤不能超过 100 项"), { status: 400 });
  return steps.map((step, index) => {
    if (typeof step === "string") return textField(step, `教程步骤 ${index + 1}`, { max: 2_000 });
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw Object.assign(new Error(`教程步骤 ${index + 1}格式不正确`), { status: 400 });
    }
    const title = textField(step.title, `教程步骤 ${index + 1}标题`, { required: false, max: 120 });
    const content = textField(step.content ?? step.text ?? step.description, `教程步骤 ${index + 1}内容`, { required: false, max: 2_000 });
    const image = textField(step.image ?? step.imageUrl ?? "", `教程步骤 ${index + 1}图片地址`, { required: false, max: 2_048 });
    validateImageUrl(image, `教程步骤 ${index + 1}图片地址`);
    if (!title && !content) throw Object.assign(new Error(`教程步骤 ${index + 1}不能为空`), { status: 400 });
    return { title, content, image };
  });
}

function validateImageUrl(value, name) {
  if (!value) return;
  let imageUrl;
  try { imageUrl = new URL(value, "http://localhost"); } catch { throw Object.assign(new Error(`${name}格式不正确`), { status: 400 }); }
  if (!["http:", "https:"].includes(imageUrl.protocol) && !(value.startsWith("/") && !value.startsWith("//"))) {
    throw Object.assign(new Error(`${name}只能使用 http、https 或站内路径`), { status: 400 });
  }
}

function parseSteps(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toLink(row) {
  const steps = Array.isArray(row.steps) ? row.steps : parseSteps(row.steps);
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    mark: row.mark,
    tone: row.tone,
    status: row.status,
    description: row.description,
    detailDescription: row.detail_description ?? row.detailDescription ?? "",
    note: row.note,
    adminNote: row.admin_note ?? row.adminNote ?? "",
    cover: row.cover ?? row.image ?? "",
    image: row.cover ?? row.image ?? "",
    guide: row.guide ?? row.content ?? "",
    content: row.guide ?? row.content ?? "",
    steps,
    tips: row.tips ?? "",
    url: row.url,
    position: row.position,
    enabled: Number(row.enabled) === 1,
    updatedAt: row.updated_at,
  };
}

function getAllLinks() {
  return db.prepare("SELECT links.* FROM links LEFT JOIN categories ON categories.name = links.category ORDER BY categories.position, links.position, links.title COLLATE NOCASE").all().map(toLink);
}

function getPublicLinks() {
  return db.prepare("SELECT links.id, links.category, links.title, links.mark, links.tone, links.status, links.description, links.detail_description, links.note, links.cover, links.guide, links.steps, links.tips, links.url, links.position, links.enabled, links.updated_at FROM links INNER JOIN categories ON categories.name = links.category WHERE links.enabled = 1 AND categories.enabled = 1 ORDER BY categories.position, links.position, links.title COLLATE NOCASE").all().map(toPublicLink);
}

function toPublicLink(row) {
  const cover = row.cover ?? row.image ?? "";
  const guide = row.guide ?? row.content ?? "";
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    mark: row.mark,
    tone: row.tone,
    status: row.status,
    description: row.description,
    detailDescription: row.detail_description ?? row.detailDescription ?? "",
    note: row.note,
    cover,
    image: cover,
    guide,
    content: guide,
    steps: Array.isArray(row.steps) ? row.steps : parseSteps(row.steps),
    tips: row.tips ?? "",
    url: row.url,
    position: row.position,
    updatedAt: row.updated_at,
  };
}

function getLink(id) {
  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(id);
  return row ? toLink(row) : null;
}

function nextPosition(category) {
  const row = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM links WHERE category = ?").get(category);
  return Number(row.position);
}

const ANALYTICS_EVENT_TYPES = new Set(["category_view", "link_click"]);
const MAX_ANALYTICS_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

function headerText(value, max = 1_000) {
  const text = Array.isArray(value) ? String(value[0] || "") : String(value || "");
  return text.slice(0, max);
}

function normalizeAnalyticsEventType(value, hasLink) {
  const raw = String(value || "").trim().toLowerCase();
  const aliases = new Map([
    ["click", "link_click"],
    ["project_click", "link_click"],
    ["tutorial_click", "link_click"],
    ["project_view", "link_click"],
    ["tutorial_view", "link_click"],
    ["category_click", "category_view"],
    ["category", "category_view"],
  ]);
  const eventType = aliases.get(raw) || raw || (hasLink ? "link_click" : "category_view");
  if (!ANALYTICS_EVENT_TYPES.has(eventType)) {
    throw Object.assign(new Error("不支持的统计事件类型"), { status: 400 });
  }
  if (eventType === "link_click" && !hasLink) {
    throw Object.assign(new Error("项目点击事件需要项目标识"), { status: 400 });
  }
  return eventType;
}

function findAnalyticsCategory(idOrName) {
  if (!idOrName) return null;
  return db.prepare("SELECT id, name FROM categories WHERE id = ? OR name = ? COLLATE NOCASE LIMIT 1")
    .get(idOrName, idOrName) || null;
}

function resolveAnalyticsTarget(body) {
  const requestedCategory = textField(body.categoryId ?? body.category ?? "", "分类标识", { required: false, max: 80 });
  const requestedLink = textField(body.linkId ?? body.projectId ?? body.tutorialId ?? "", "项目标识", { required: false, max: 80 });
  if (!requestedCategory && !requestedLink) {
    throw Object.assign(new Error("需要提供分类或项目标识"), { status: 400 });
  }

  const link = requestedLink
    ? db.prepare(`SELECT links.id, links.title, links.enabled AS link_enabled,
        categories.id AS category_id, categories.name AS category_name, categories.enabled AS category_enabled
        FROM links INNER JOIN categories ON categories.name = links.category WHERE links.id = ?`).get(requestedLink)
    : null;
  if (requestedLink && !link) throw Object.assign(new Error("项目不存在"), { status: 404 });
  if (link && (Number(link.link_enabled) !== 1 || Number(link.category_enabled) !== 1)) {
    throw Object.assign(new Error("项目当前不可访问"), { status: 404 });
  }

  const category = requestedCategory ? findAnalyticsCategory(requestedCategory) : null;
  if (requestedCategory && !category) throw Object.assign(new Error("分类不存在"), { status: 404 });
  if (category && Number(db.prepare("SELECT enabled FROM categories WHERE id = ?").get(category.id).enabled) !== 1) {
    throw Object.assign(new Error("分类当前不可访问"), { status: 404 });
  }
  if (link && category && link.category_id !== category.id) {
    throw Object.assign(new Error("项目不属于指定分类"), { status: 400 });
  }

  return {
    categoryId: link?.category_id || category?.id || null,
    categoryName: link?.category_name || category?.name || null,
    linkId: link?.id || null,
    linkTitle: link?.title || null,
  };
}

function handlePublicAnalytics(req, res) {
  return readJson(req).then((body) => {
    const target = resolveAnalyticsTarget(body);
    const eventType = normalizeAnalyticsEventType(body.eventType ?? body.event ?? body.type, Boolean(target.linkId));
    const createdAtMs = Date.now();
    const createdAt = new Date(createdAtMs).toISOString();
    db.prepare(`INSERT INTO analytics_events
      (event_type, category_id, category_name, link_id, link_title, ip, user_agent, referer, created_at, created_at_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        eventType,
        target.categoryId,
        target.categoryName,
        target.linkId,
        target.linkTitle,
        clientAddress(req).slice(0, 64),
        headerText(req.headers["user-agent"]),
        headerText(req.headers.referer || req.headers.referrer, 2_048),
        createdAt,
        createdAtMs,
      );
    return sendJson(res, 201, { ok: true });
  }).catch((error) => sendRequestError(res, error));
}

function parseAnalyticsMoment(value, name, fallback, endOfDay = false) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  let milliseconds;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    milliseconds = Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0));
  } else {
    milliseconds = Date.parse(text);
    if (endOfDay && Number.isFinite(milliseconds)) milliseconds += 1;
  }
  if (!Number.isFinite(milliseconds)) throw Object.assign(new Error(`${name}格式不正确`), { status: 400 });
  return milliseconds;
}

function analyticsRange(searchParams) {
  const now = Date.now();
  const from = parseAnalyticsMoment(searchParams.get("from"), "开始时间", now - 30 * 24 * 60 * 60 * 1000);
  const to = parseAnalyticsMoment(searchParams.get("to"), "结束时间", now + 1, true);
  if (from >= to) throw Object.assign(new Error("结束时间必须晚于开始时间"), { status: 400 });
  if (to - from > MAX_ANALYTICS_RANGE_MS) throw Object.assign(new Error("统计时间范围不能超过 366 天"), { status: 400 });
  return { from, to };
}

function maskIpAddress(value) {
  const ip = String(value || "").trim();
  return net.isIP(ip) ? ip : "未知来源";
}

function handleAdminStats(req, res, searchParams) {
  try {
    const { from, to } = analyticsRange(searchParams);
    const granularity = searchParams.get("granularity") === "hour" ? "hour" : "day";
    const params = [from, to];
    const where = "created_at_ms >= ? AND created_at_ms < ?";
    const totals = db.prepare(`SELECT
      COUNT(*) AS events,
      SUM(CASE WHEN event_type = 'category_view' THEN 1 ELSE 0 END) AS category_views,
      SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END) AS link_clicks,
      COUNT(DISTINCT ip) AS unique_visitors
      FROM analytics_events WHERE ${where}`).get(...params);
    const byCategory = db.prepare(`SELECT category_id AS categoryId, category_name AS categoryName,
      COUNT(*) AS events,
      SUM(CASE WHEN event_type = 'category_view' THEN 1 ELSE 0 END) AS categoryViews,
      SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END) AS linkClicks
      FROM analytics_events WHERE ${where}
      GROUP BY category_id, category_name ORDER BY events DESC, category_name COLLATE NOCASE LIMIT 100`).all(...params);
    const byProject = db.prepare(`SELECT link_id AS linkId, link_title AS linkTitle,
      category_id AS categoryId, category_name AS categoryName, COUNT(*) AS clicks
      FROM analytics_events WHERE ${where} AND link_id IS NOT NULL
      GROUP BY link_id, link_title, category_id, category_name ORDER BY clicks DESC, link_title COLLATE NOCASE LIMIT 100`).all(...params);
    const timelineExpression = granularity === "hour"
      ? "substr(created_at, 1, 13) || ':00:00.000Z'"
      : "substr(created_at, 1, 10)";
    const timeline = db.prepare(`SELECT ${timelineExpression} AS timestamp, COUNT(*) AS events,
      SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END) AS linkClicks
      FROM analytics_events WHERE ${where}
      GROUP BY timestamp ORDER BY timestamp ASC`).all(...params);
    const rawIpSources = db.prepare(`SELECT ip, COUNT(*) AS events,
      MIN(created_at) AS firstSeenAt, MAX(created_at) AS lastSeenAt
      FROM analytics_events WHERE ${where}
      GROUP BY ip`).all(...params);
    const ipSourceMap = new Map();
    rawIpSources.forEach((item) => {
      const source = maskIpAddress(item.ip);
      const aggregate = ipSourceMap.get(source) || { source, events: 0, firstSeenAt: item.firstSeenAt, lastSeenAt: item.lastSeenAt };
      aggregate.events += Number(item.events || 0);
      if (item.firstSeenAt < aggregate.firstSeenAt) aggregate.firstSeenAt = item.firstSeenAt;
      if (item.lastSeenAt > aggregate.lastSeenAt) aggregate.lastSeenAt = item.lastSeenAt;
      ipSourceMap.set(source, aggregate);
    });
    const rankedIpSources = [...ipSourceMap.values()].sort((left, right) => right.events - left.events || right.lastSeenAt.localeCompare(left.lastSeenAt));
    const ipSources = rankedIpSources.slice(0, 100);
    const recent = db.prepare(`SELECT event_type AS eventType, category_id AS categoryId, category_name AS categoryName,
      link_id AS linkId, link_title AS linkTitle, ip, created_at AS createdAt
      FROM analytics_events WHERE ${where} ORDER BY created_at_ms DESC LIMIT 50`).all(...params)
      .map((item) => ({
        eventType: item.eventType,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        linkId: item.linkId,
        linkTitle: item.linkTitle,
        ipSource: maskIpAddress(item.ip),
        createdAt: item.createdAt,
      }));

    return sendJson(res, 200, {
      range: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      granularity,
      totals: {
        events: Number(totals.events || 0),
        categoryViews: Number(totals.category_views || 0),
        linkClicks: Number(totals.link_clicks || 0),
        uniqueVisitors: Number(totals.unique_visitors || 0),
      },
      byCategory,
      byProject,
      timeline,
      ipSources,
      ipSourceCount: rankedIpSources.length,
      recent,
    });
  } catch (error) {
    return sendRequestError(res, error);
  }
}

function handleLogin(req, res) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  const address = clientAddress(req);
  const now = Date.now();
  pruneLoginAttempts(now);
  const record = loginAttempts.get(address) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (record.resetAt <= now) { record.count = 0; record.resetAt = now + 15 * 60 * 1000; }
  if (record.count >= 10) return sendJson(res, 429, { error: "尝试次数过多，请稍后再试" });
  return readJson(req).then(async (body) => {
    record.count += 1;
    loginAttempts.set(address, record);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (username !== ADMIN_USERNAME || !(await verifyPassword(password, passwordHash))) return sendJson(res, 401, { error: "用户名或密码不正确" });
    loginAttempts.delete(address);
    sendJson(res, 200, { ok: true, username }, { "Set-Cookie": sessionCookies(createSession(username)) });
  }).catch((error) => sendRequestError(res, error));
}

function handlePasswordChange(req, res) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then(async (body) => {
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");
    const currentPasswordHash = passwordHash;
    if (!(await verifyPassword(currentPassword, currentPasswordHash))) throw Object.assign(new Error("当前密码不正确"), { status: 400 });
    if (newPassword.length < 12) throw Object.assign(new Error("新密码至少需要 12 个字符"), { status: 400 });
    if (newPassword.length > 200) throw Object.assign(new Error("新密码不能超过 200 个字符"), { status: 400 });
    if (newPassword !== confirmPassword) throw Object.assign(new Error("两次输入的新密码不一致"), { status: 400 });

    const nextPasswordHash = await hashPasswordAsync(newPassword);
    let transactionOpen = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      const update = db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = ? AND value = ?")
        .run(nextPasswordHash, nextUpdatedAt(), "admin_password_hash", currentPasswordHash);
      if (Number(update.changes) !== 1) {
        throw Object.assign(new Error("密码已被其他会话修改，请重新登录"), { status: 409 });
      }
      db.prepare("DELETE FROM sessions").run();
      db.exec("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) db.exec("ROLLBACK");
      throw error;
    }
    passwordHash = nextPasswordHash;
    return sendJson(res, 200, { ok: true, reauthenticate: true }, { "Set-Cookie": clearedSessionCookies() });
  }).catch((error) => sendRequestError(res, error));
}

function handleReorder(req, res) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    const categoryId = textField(body.categoryId, "分类标识", { max: 80 });
    const categoryUpdatedAt = updatedAtField(body.categoryUpdatedAt);
    if (!Array.isArray(body.items) || body.items.length === 0) throw Object.assign(new Error("排序数据不正确"), { status: 400 });
    const requested = body.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw Object.assign(new Error("排序数据不正确"), { status: 400 });
      return { id: textField(item.id, "入口标识", { max: 80 }), updatedAt: updatedAtField(item.updatedAt) };
    });
    const requestedVersions = new Map(requested.map((item) => [item.id, item.updatedAt]));
    if (requestedVersions.size !== requested.length) throw Object.assign(new Error("排序数据包含重复入口"), { status: 400 });

    let transactionOpen = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      const category = db.prepare("SELECT name FROM categories WHERE id = ? AND updated_at = ?").get(categoryId, categoryUpdatedAt);
      if (!category) {
        const exists = db.prepare("SELECT id FROM categories WHERE id = ?").get(categoryId);
        if (!exists) throw Object.assign(new Error("分类不存在"), { status: 404 });
        throw staleUpdateError();
      }
      const current = db.prepare("SELECT id, updated_at FROM links WHERE category = ? ORDER BY position").all(category.name);
      if (current.length !== requested.length || !current.every((row) => requestedVersions.get(row.id) === row.updated_at)) throw staleUpdateError();
      const update = db.prepare("UPDATE links SET position = ?, updated_at = ? WHERE id = ? AND updated_at = ?");
      requested.forEach((item, index) => requireSingleChange(update.run(index, nextUpdatedAt(), item.id, item.updatedAt)));
      db.exec("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) db.exec("ROLLBACK");
      throw error;
    }
    sendJson(res, 200, { ok: true, links: getAllLinks() });
  }).catch((error) => sendRequestError(res, error));
}

function handleCategoryReorder(req, res) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    if (!Array.isArray(body.items) || body.items.length === 0) throw Object.assign(new Error("排序数据不正确"), { status: 400 });
    const requested = body.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw Object.assign(new Error("排序数据不正确"), { status: 400 });
      return { id: textField(item.id, "分类标识", { max: 80 }), updatedAt: updatedAtField(item.updatedAt) };
    });
    const requestedVersions = new Map(requested.map((item) => [item.id, item.updatedAt]));
    if (requestedVersions.size !== requested.length) throw Object.assign(new Error("排序数据包含重复分类"), { status: 400 });

    let transactionOpen = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      const current = db.prepare("SELECT id, updated_at FROM categories ORDER BY position, name COLLATE NOCASE").all();
      if (current.length !== requested.length || !current.every((row) => requestedVersions.get(row.id) === row.updated_at)) throw staleUpdateError();
      const update = db.prepare("UPDATE categories SET position = ?, updated_at = ? WHERE id = ? AND updated_at = ?");
      requested.forEach((item, index) => requireSingleChange(update.run(index, nextUpdatedAt(), item.id, item.updatedAt)));
      db.exec("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) db.exec("ROLLBACK");
      throw error;
    }
    return sendJson(res, 200, { ok: true, categories: getCategories() });
  }).catch((error) => sendRequestError(res, error));
}

function handleAdminCategory(req, res) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    const name = textField(body.name, "分类名称", { max: 40 });
    const description = textField(body.description, "分类说明", { required: false, max: 120 }) || "自定义入口集合";
    const duplicate = db.prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE").get(name);
    if (duplicate) throw Object.assign(new Error("这个分类已经存在"), { status: 409 });
    const now = nextUpdatedAt();
    const position = Number(db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM categories").get().position);
    const category = { id: `category-${crypto.randomUUID()}`, name, description, position, enabled: true, created_at: now, updated_at: now };
    db.prepare("INSERT INTO categories (id, name, description, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(category.id, category.name, category.description, category.position, category.created_at, category.updated_at);
    return sendJson(res, 201, { category: toCategory(category) });
  }).catch((error) => sendRequestError(res, error));
}

function handleAdminCategoryUpdate(req, res, id) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    const category = db.prepare("SELECT id, name, description, position, enabled, updated_at FROM categories WHERE id = ?").get(id);
    if (!category) return sendJson(res, 404, { error: "分类不存在" });
    const updatedAt = updatedAtField(body.updatedAt);

    const name = textField(body.name, "分类名称", { max: 40 });
    const description = textField(body.description, "分类说明", { required: false, max: 120 }) || "自定义入口集合";
    const duplicate = db.prepare("SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?").get(name, id);
    if (duplicate) throw Object.assign(new Error("这个分类已经存在"), { status: 409 });

    let transactionOpen = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      const now = nextUpdatedAt();
      requireSingleChange(db.prepare("UPDATE categories SET name = ?, description = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
        .run(name, description, now, id, updatedAt));
      if (name !== category.name) {
        db.prepare("UPDATE links SET category = ?, updated_at = ? WHERE category = ?").run(name, nextUpdatedAt(), category.name);
      }
      db.exec("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) db.exec("ROLLBACK");
      throw error;
    }

    return sendJson(res, 200, {
      category: getCategory(id),
      links: getAllLinks(),
    });
  }).catch((error) => sendRequestError(res, error));
}

function handleAdminCategoryEnabled(req, res, id) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    const enabled = enabledField(body.enabled);
    const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);
    if (!category) return sendJson(res, 404, { error: "分类不存在" });
    const updatedAt = updatedAtField(body.updatedAt);
    const now = nextUpdatedAt();
    requireSingleChange(db.prepare("UPDATE categories SET enabled = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
      .run(enabled ? 1 : 0, now, id, updatedAt));
    return sendJson(res, 200, { category: getCategory(id) });
  }).catch((error) => sendRequestError(res, error));
}

function handleAdminCategoryDelete(req, res, id) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    const category = db.prepare("SELECT id, name, updated_at FROM categories WHERE id = ?").get(id);
    if (!category) return sendJson(res, 404, { error: "分类不存在" });
    const updatedAt = updatedAtField(body.updatedAt);
    const categories = getCategories();
    if (categories.length <= 1) return sendJson(res, 400, { error: "至少需要保留一个分类" });
    const count = Number(db.prepare("SELECT COUNT(*) AS count FROM links WHERE category = ?").get(category.name).count);
    const targetId = String(body.targetCategoryId || "").trim();
    const target = targetId ? categories.find((item) => item.id === targetId) : null;
    if (targetId && (!target || target.id === category.id)) return sendJson(res, 400, { error: "移动目标分类不正确" });
    if (count > 0 && !target) return sendJson(res, 409, { error: `该分类还有 ${count} 个入口，请选择要移动到的分类` });

    let transactionOpen = false;
    try {
      db.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      if (count > 0) {
        const startPosition = nextPosition(target.name);
        const update = db.prepare("UPDATE links SET category = ?, position = ?, updated_at = ? WHERE id = ?");
        const links = db.prepare("SELECT id FROM links WHERE category = ? ORDER BY position, title COLLATE NOCASE").all(category.name);
        links.forEach((link, index) => update.run(target.name, startPosition + index, nextUpdatedAt(), link.id));
      }
      requireSingleChange(db.prepare("DELETE FROM categories WHERE id = ? AND updated_at = ?").run(id, updatedAt));
      db.exec("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) db.exec("ROLLBACK");
      throw error;
    }
    return sendJson(res, 200, { ok: true, categories: getCategories(), links: getAllLinks() });
  }).catch((error) => sendRequestError(res, error));
}

function handleAdminLink(req, res, method, id) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    if (method === "POST") {
      const link = normalizeLink(body);
      const now = nextUpdatedAt();
      const created = { id: crypto.randomUUID(), ...link, position: nextPosition(link.category), enabled: true, created_at: now, updated_at: now };
      db.prepare(`INSERT INTO links (id, category, title, mark, tone, status, description, detail_description, note, admin_note, cover, guide, steps, tips, url, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(created.id, created.category, created.title, created.mark, created.tone, created.status, created.description, created.detailDescription, created.note, created.adminNote, created.cover, created.guide, JSON.stringify(created.steps), created.tips, created.url, created.position, created.created_at, created.updated_at);
      return sendJson(res, 201, { link: toLink(created) });
    }
    const existing = getLink(id);
    if (!existing) return sendJson(res, 404, { error: "入口不存在" });
    const updatedAt = updatedAtField(body.updatedAt);
    if (method === "DELETE") {
      requireSingleChange(db.prepare("DELETE FROM links WHERE id = ? AND updated_at = ?").run(id, updatedAt));
      return sendJson(res, 200, { ok: true });
    }
    const link = normalizeLink(body, existing);
    const now = nextUpdatedAt();
    const position = link.category === existing.category ? existing.position : nextPosition(link.category);
    requireSingleChange(db.prepare(`UPDATE links SET category = ?, title = ?, mark = ?, tone = ?, status = ?, description = ?, detail_description = ?, note = ?, admin_note = ?, cover = ?, guide = ?, steps = ?, tips = ?, url = ?, position = ?, updated_at = ? WHERE id = ? AND updated_at = ?`)
      .run(link.category, link.title, link.mark, link.tone, link.status, link.description, link.detailDescription, link.note, link.adminNote, link.cover, link.guide, JSON.stringify(link.steps), link.tips, link.url, position, now, id, updatedAt));
    return sendJson(res, 200, { link: getLink(id) });
  }).catch((error) => sendRequestError(res, error));
}

function handleAdminLinkEnabled(req, res, id) {
  if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
  return readJson(req).then((body) => {
    const enabled = enabledField(body.enabled);
    const existing = getLink(id);
    if (!existing) return sendJson(res, 404, { error: "入口不存在" });
    const updatedAt = updatedAtField(body.updatedAt);
    const now = nextUpdatedAt();
    requireSingleChange(db.prepare("UPDATE links SET enabled = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
      .run(enabled ? 1 : 0, now, id, updatedAt));
    return sendJson(res, 200, { link: getLink(id) });
  }).catch((error) => sendRequestError(res, error));
}

function serveAdminFile(req, res, pathname) {
  const relative = pathname === "/admin/" ? "index.html" : pathname.slice("/admin/".length);
  const contentType = ADMIN_FILES.get(relative);
  if (!contentType) return sendText(res, 404, "Not found\n");
  const file = path.join(ADMIN_DIR, relative);
  try {
    const body = fs.readFileSync(file);
    sendText(res, 200, body, contentType);
  } catch { sendText(res, 404, "Not found\n"); }
}

function servePublicFile(res, relative) {
  const contentType = PUBLIC_FILES.get(relative);
  if (!contentType) return sendText(res, 404, "Not found\n");
  const file = path.join(PUBLIC_DIR, relative);
  try {
    return sendText(res, 200, fs.readFileSync(file), contentType);
  } catch {
    return sendText(res, 404, "Not found\n");
  }
}

const server = http.createServer((req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", "http://localhost");
    const pathname = requestUrl.pathname;
  if (pathname.startsWith("/api/")) applyCors(req, res);
  if (req.method === "OPTIONS" && pathname.startsWith("/api/")) return res.writeHead(204).end();
  if (pathname === "/api/health" && req.method === "GET") return sendJson(res, 200, { ok: true, service: "guide-admin" });
  if (pathname === "/api/public/image" && req.method === "GET") return handlePublicImageProxy(req, res, requestUrl.searchParams);
  if (pathname === "/api/public/links" && req.method === "GET") return sendJson(res, 200, { categories: getPublicCategories(), links: getPublicLinks() });
  if (["/api/public/track", "/api/public/click", "/api/public/events", "/api/public/analytics", "/api/public/analytics/click"].includes(pathname) && req.method === "POST") {
    return handlePublicAnalytics(req, res);
  }
  if (pathname === "/api/auth/login" && req.method === "POST") return handleLogin(req, res);
  if (pathname === "/api/auth/password" && req.method === "POST") {
    const session = requireSession(req, res);
    if (!session) return;
    return handlePasswordChange(req, res);
  }
  if (pathname === "/api/auth/logout" && req.method === "POST") {
    if (!isAllowedAdminOrigin(req)) return sendJson(res, 403, { error: "来源不被允许" });
    const session = getSession(req);
    if (session) db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearedSessionCookies() });
  }
  if (pathname === "/api/auth/session" && req.method === "GET") {
    const session = getSession(req);
    if (session) res.setHeader("Set-Cookie", sessionCookies(`${session.id}.${signSession(session.id)}`));
    return sendJson(res, 200, session ? { authenticated: true, username: session.username } : { authenticated: false }, session ? {} : { "Set-Cookie": clearedSessionCookies() });
  }
  if (pathname === "/api/admin/links" && req.method === "GET") {
    if (!requireSession(req, res)) return;
    return sendJson(res, 200, { categories: getCategories(), links: getAllLinks() });
  }
  if (["/api/admin/stats", "/api/admin/analytics"].includes(pathname) && req.method === "GET") {
    if (!requireSession(req, res)) return;
    return handleAdminStats(req, res, requestUrl.searchParams);
  }
  if (pathname === "/api/admin/categories" && req.method === "POST") {
    if (!requireSession(req, res)) return;
    return handleAdminCategory(req, res);
  }
  if (pathname === "/api/admin/categories/reorder" && req.method === "POST") {
    if (!requireSession(req, res)) return;
    return handleCategoryReorder(req, res);
  }
  const categoryEnabledMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)\/enabled$/);
  if (categoryEnabledMatch && req.method === "PATCH") {
    if (!requireSession(req, res)) return;
    return handleAdminCategoryEnabled(req, res, categoryEnabledMatch[1]);
  }
  const categoryMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (categoryMatch && req.method === "PUT") {
    if (!requireSession(req, res)) return;
    return handleAdminCategoryUpdate(req, res, categoryMatch[1]);
  }
  if (categoryMatch && req.method === "DELETE") {
    if (!requireSession(req, res)) return;
    return handleAdminCategoryDelete(req, res, categoryMatch[1]);
  }
  if (pathname === "/api/admin/links" && req.method === "POST") {
    if (!requireSession(req, res)) return;
    return handleAdminLink(req, res, "POST");
  }
  const linkEnabledMatch = pathname.match(/^\/api\/admin\/links\/([^/]+)\/enabled$/);
  if (linkEnabledMatch && req.method === "PATCH") {
    if (!requireSession(req, res)) return;
    return handleAdminLinkEnabled(req, res, linkEnabledMatch[1]);
  }
  const linkMatch = pathname.match(/^\/api\/admin\/links\/([^/]+)$/);
  if (linkMatch && ["PUT", "DELETE"].includes(req.method)) {
    if (!requireSession(req, res)) return;
    return req.method === "DELETE" ? handleAdminLink(req, res, "DELETE", linkMatch[1]) : handleAdminLink(req, res, "PUT", linkMatch[1]);
  }
  if (pathname === "/api/admin/reorder" && req.method === "POST") {
    if (!requireSession(req, res)) return;
    return handleReorder(req, res);
  }
  if (pathname === "/admin" && req.method === "GET") {
    res.writeHead(301, { Location: "/admin/" });
    return res.end();
  }
  if (pathname.startsWith("/admin/") && req.method === "GET") return serveAdminFile(req, res, pathname);
  if (pathname === "/" && req.method === "GET") return servePublicFile(res, "index.html");
  if (req.method === "GET" && PUBLIC_FILES.has(pathname.slice(1))) return servePublicFile(res, pathname.slice(1));
  sendText(res, 404, "Not found\n");
  } catch (error) {
    sendRequestError(res, error);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`guide-admin listening on http://${HOST}:${PORT}`);
});

function close() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
