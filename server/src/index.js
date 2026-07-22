const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const argon2 = require("argon2");

const {
  get,
  all,
  run,
  initializeSchema,
  closeDb,
  hashToken,
  withTransaction,
} = require("./database");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_PRODUCTION) {
    throw new Error("JWT_SECRET must be configured when NODE_ENV=production");
  }
  // A development/test secret is intentionally explicit and may never be used in production.
  return "development-only-ai-city-jwt-secret";
})();
const ACCESS_TTL = process.env.ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = Number.parseInt(process.env.REFRESH_TTL_DAYS || "14", 10);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{6,20}$/;
const CORS_ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || (IS_PRODUCTION ? "" : "http://localhost:5173,http://127.0.0.1:5173"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const LOGIN_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || "900000", 10);
const LOGIN_RATE_LIMIT_MAX = Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX || "10", 10);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || CORS_ALLOWED_ORIGINS.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin is not allowed"));
    },
  })
);
app.use(morgan("dev"));
app.use(
  express.json({
    limit: "16kb",
  })
);

function nowIso() {
  return new Date().toISOString();
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return null;
  }
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(dLng / 2) ** 2;
  return Number((2 * 6371 * Math.asin(Math.sqrt(a))).toFixed(1));
}

function traceId(req, _res, next) {
  req.traceId =
    req.headers["x-trace-id"] ||
    req.headers["x-request-id"] ||
    `trace_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  next();
}

function okResponse(res, data, meta) {
  return res.json({
    ok: true,
    data,
    meta,
  });
}

function failResponse(res, code, message, status = 400) {
  return res.status(status).json({
    ok: false,
    error: {
      code,
      message,
    },
  });
}

function parsePager(req) {
  const page = Math.max(
    1,
    Number.parseInt(req.query.page, 10) || 1
  );
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20)
  );
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function requirePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseIdentity(body) {
  const phone =
    typeof body.phone === "string" ? body.phone.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawAccount =
    typeof body.account === "string" ? body.account.trim().toLowerCase() : "";

  if (!phone && !email && rawAccount) {
    if (rawAccount.includes("@")) {
      return {
        identity: rawAccount,
        identityType: "email",
        phone: "",
        email: rawAccount,
      };
    }
    return {
      identity: rawAccount,
      identityType: "phone",
      phone: rawAccount,
      email: "",
    };
  }
  const identity = phone || email;
  const hasPhone = phone.length > 0;
  const hasEmail = email.length > 0;
  const identityType = hasPhone ? "phone" : hasEmail ? "email" : "";
  return { identity, identityType, phone, email };
}

function parseAuthIdentity(body) {
  // 登录/注册：当前版本固定仅支持「账号 + 密码」，不启用验证码逻辑
  const result = parseIdentity(body || {});
  const { identity, identityType } = result;
  if (!identity || !identityType) {
    return { identity: "", identityType: "", phone: "", email: "" };
  }
  if (identityType === "email" && !EMAIL_PATTERN.test(identity)) {
    return { identity: "", identityType: "", phone: "", email: "" };
  }
  if (identityType === "phone" && !PHONE_PATTERN.test(identity)) {
    return { identity: "", identityType: "", phone: "", email: "" };
  }
  return (
    result.identityType && identity.length <= 50
      ? result
      : { identity: "", identityType: "", phone: "", email: "" }
  );
}

function buildPasswordDigest(password, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${String(password || "")}`)
    .digest("hex");
}

async function makePasswordRecord(password) {
  const passwordHash = await argon2.hash(String(password || ""), {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  return {
    password_hash: passwordHash,
    password_salt: null,
  };
}

async function verifyPassword(password, password_hash, password_salt) {
  if (!password_hash) {
    return { valid: false, legacy: false };
  }
  if (password_hash.startsWith("$argon2id$")) {
    try {
      return { valid: await argon2.verify(password_hash, String(password || "")), legacy: false };
    } catch (_error) {
      return { valid: false, legacy: false };
    }
  }
  if (!password_salt) {
    return { valid: false, legacy: false };
  }
  const candidate = buildPasswordDigest(password, password_salt);
  if (candidate.length !== password_hash.length) {
    return { valid: false, legacy: true };
  }
  return {
    valid: crypto.timingSafeEqual(
    Buffer.from(candidate),
    Buffer.from(password_hash)
    ),
    legacy: true,
  };
}

function demoSeedAllowed() {
  return !IS_PRODUCTION && process.env.DEMO_SEED_ENABLED === "true";
}

const loginRateLimiter = rateLimit({
  windowMs: Number.isFinite(LOGIN_RATE_LIMIT_WINDOW_MS) ? LOGIN_RATE_LIMIT_WINDOW_MS : 900000,
  limit: Number.isFinite(LOGIN_RATE_LIMIT_MAX) ? LOGIN_RATE_LIMIT_MAX : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req) {
    const identity = parseAuthIdentity({ account: req.body?.account }).identity || "unknown";
    return `${req.socket?.remoteAddress || "unknown"}:${identity}`;
  },
  handler(_req, res) {
    return failResponse(res, "LOGIN_RATE_LIMITED", "登录尝试过于频繁，请稍后再试", 429);
  },
});

function makeAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      nickname: user.nickname,
      sub: String(user.id),
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function makeRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

async function issueRefreshToken(userId) {
  const token = makeRefreshToken();
  const tokenHash = hashToken(token);
  await run(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, datetime('now', ?))",
    [userId, tokenHash, `+${REFRESH_TTL_DAYS} days`]
  );
  return token;
}

function authFromToken(req, res, next) {
  req.auth = null;
  const raw = req.headers.authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
  } catch (_err) {
    // keep anonymous for public endpoints
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.id) {
    return failResponse(res, "AUTH_REQUIRED", "请先登录", 401);
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.auth || !["admin", "owner"].includes(req.auth.role)) {
    return failResponse(res, "FORBIDDEN", "需要管理员权限", 403);
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.auth || req.auth.role !== "owner") {
    return failResponse(res, "FORBIDDEN", "需要 Owner 权限", 403);
  }
  next();
}

function normalizeSignupType(value) {
  if (value === "link") {
    return "invite";
  }
  return value === "invite" || value === "manual" ? value : null;
}

function normalizeEventCategory(value) {
  if (value === "free" || value === "paid") {
    return value;
  }
  return "";
}

function normalizeReportTargetType(value) {
  return value === "post" || value === "comment" || value === "news" || value === "event"
    ? value
    : "";
}

function normalizeFavoriteTargetType(value) {
  return value === "post" || value === "news" || value === "event" ? value : "";
}

function targetTableOf(type) {
  if (type === "post") return "posts";
  if (type === "news") return "news";
  if (type === "event") return "events";
  if (type === "comment") return "comments";
  return "";
}

async function findTarget(type, id) {
  const safeType = normalizeReportTargetType(type);
  const table = targetTableOf(safeType);
  if (!table) {
    return null;
  }
  const safeId = requirePositiveInt(id);
  if (!safeId) {
    return null;
  }
  return get(`SELECT id FROM ${table} WHERE id = ?`, [safeId]);
}

async function toggleFavoriteInternal(userId, targetType, targetId) {
  const safeType = normalizeFavoriteTargetType(targetType);
  if (!safeType) {
    return { ok: false, code: "INVALID_TARGET_TYPE", message: "目标类型非法" };
  }

  const safeId = requirePositiveInt(targetId);
  if (!safeId) {
    return { ok: false, code: "INVALID_TARGET_ID", message: "目标 ID 不合法" };
  }

  const targetExists = await findTarget(safeType, safeId);
  if (!targetExists) {
    return { ok: false, code: "NOT_FOUND", message: "目标不存在" };
  }

  const exists = await get(
    "SELECT id FROM favorites WHERE user_id = ? AND target_type = ? AND target_id = ?",
    [userId, safeType, safeId]
  );

  if (exists) {
    await run("DELETE FROM favorites WHERE id = ?", [exists.id]);
    const favoriteCount = await get(
      "SELECT COUNT(*) AS total FROM favorites WHERE target_type = ? AND target_id = ?",
      [safeType, safeId]
    );
    return {
      ok: true,
      payload: {
        target_type: safeType,
        target_id: safeId,
        favorited: false,
        favorite_count: favoriteCount.total || 0,
      },
    };
  }

  await run(
    "INSERT INTO favorites (user_id, target_type, target_id) VALUES (?, ?, ?)",
    [userId, safeType, safeId]
  );

  const favoriteCount = await get(
    "SELECT COUNT(*) AS total FROM favorites WHERE target_type = ? AND target_id = ?",
    [safeType, safeId]
  );
  return {
    ok: true,
    payload: {
      target_type: safeType,
      target_id: safeId,
      favorited: true,
      favorite_count: favoriteCount.total || 0,
    },
  };
}

async function reportTargetInternal(reporterId, targetType, targetId, reason) {
  const safeType = normalizeReportTargetType(targetType);
  if (!safeType) {
    return { ok: false, code: "INVALID_TARGET_TYPE", message: "目标类型非法" };
  }

  const safeId = requirePositiveInt(targetId);
  if (!safeId) {
    return { ok: false, code: "INVALID_TARGET_ID", message: "目标 ID 不合法" };
  }

  const safeReason = String(reason || "").trim();
  if (safeReason.length < 2 || safeReason.length > 200) {
    return { ok: false, code: "INVALID_REPORT_REASON", message: "举报原因需 2-200 字" };
  }

  const target = await findTarget(safeType, safeId);
  if (!target) {
    return { ok: false, code: "NOT_FOUND", message: "目标不存在" };
  }

  const insert = await run(
    "INSERT INTO reports (reporter_id, target_type, target_id, reason, status) VALUES (?, ?, ?, ?, 'open')",
    [reporterId, safeType, safeId, safeReason]
  );
  const created = await get("SELECT * FROM reports WHERE id = ?", [insert.lastID]);

  return { ok: true, payload: created };
}

async function _legacyEnsureDemoSeed() {
  const userTotal = await get("SELECT COUNT(*) AS total FROM users");
  if (userTotal.total > 0) {
    return;
  }

  const owner = await get(
    "INSERT INTO users (email, nickname, role) VALUES ('admin@tai.demo', 'AI平台管理员', 'owner') ON CONFLICT(email) DO UPDATE SET role = COALESCE(role, 'owner') RETURNING id"
  );
  const ownerId = owner?.id;
  if (!ownerId) {
    return;
  }

  const organizer = await get(
    "INSERT INTO users (email, nickname, role) VALUES ('organizer@tai.demo', 'AI活动组织者', 'admin') ON CONFLICT(email) DO UPDATE SET role = COALESCE(role, 'admin') RETURNING id"
  );
  const organizerId = organizer?.id || ownerId;

  const member = await get(
    "INSERT INTO users (email, nickname, role) VALUES ('user@tai.demo', 'AI爱好者', 'user') ON CONFLICT(email) DO UPDATE SET role = COALESCE(role, 'user') RETURNING id"
  );
  const memberId = member?.id || ownerId;

  const now = nowIso();
  const eventRows = await all("SELECT COUNT(*) AS total FROM events");
  if (eventRows.length === 0 || (eventRows[0]?.total || 0) === 0) {
    await run(
      `INSERT INTO events
       (title, summary, start_time, end_time, location_name, lat, lng, capacity, fee_type, signup_type, status, created_by)
       VALUES
         ('杭州市 AI CLUB·深夜线下联想夜', '每周五在地铁口附近举办，聚焦AI工具实战与开源模型落地。', ?, ?, '杭州市文三路·智慧树咖啡店', 30.2741, 120.1551, 50, 'free', 'manual', 'published', ?),
         ('上海外滩 AI 公开分享会', '围绕生成式图像工作流和应用评审，含作品展示。', ?, ?, '上海市黄浦区外滩花园', 31.2396, 121.4926, 80, 'paid', 'invite', 'published', ?),
         ('周末 AI 创业共创营', '线下活动，适合零基础到研发同学一起做Demo。', ?, ?, '成都市高新区天府软件园', 30.5728, 104.0668, 120, 'free', 'manual', 'published', ?)`
    ,
      nowWithOffsetDays(1),
      nowWithOffsetDays(1).replace("T", " ").replace("Z", ""),
      ownerId,
      nowWithOffsetDays(2),
      nowWithOffsetDays(2).replace("T", " ").replace("Z", ""),
      organizerId,
      nowWithOffsetDays(4),
      nowWithOffsetDays(4).replace("T", " ").replace("Z", ""),
      memberId
    );
  }

  const newsRows = await all("SELECT COUNT(*) AS total FROM news");
  if (newsRows.length === 0 || (newsRows[0]?.total || 0) === 0) {
    await run(
      "INSERT INTO news (title, body, category, tags, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "AI City最新：如何在本地部署开源大模型",
        "本周推荐通过轻量化工具链、向量检索和工作流编排，快速把实验环境落地到活动现场。包含环境搭建清单与常见坑位。",
        "tech",
        "mcp,model,guide",
        "published",
        now,
        ownerId,
      ]
    );
    await run(
      "INSERT INTO news (title, body, category, tags, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "AI CLUB 线下活动预告与城市节点安排",
        "本周末新增北京、武汉、深圳联动节点，建议提前报名，名额有限。主讲覆盖AI安全、提示词工程与内容审核。",
        "activity",
        "event,community",
        "published",
        now,
        organizerId,
      ]
    );
  }

  const postRows = await all("SELECT COUNT(*) AS total FROM posts");
  if (postRows.length === 0 || (postRows[0]?.total || 0) === 0) {
    await run(
      "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
      [
        memberId,
        "第一次用 AI 做活动总结，有这些坑",
        "我在一次活动里把模型提示词、素材库、时间计划全部打包成一个任务流，发现最大收益在“重复跑通流程”，而不是单次效果。",
        "经验,AI,工作流",
        "approved",
      ]
    );
    await run(
      "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
      [
        ownerId,
        "给新手的 MCP 与 AI 组件清单",
        "先从内容生成、图片检索、表单联动三个任务开始；先做最小闭环：发布活动->报名提醒->复盘汇总。",
        "mcp,skill,UGC",
        "approved",
      ]
    );
    await run(
      "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
      [
        organizerId,
        "这周活动日历更新啦，带上你的作品提交链接",
        "周三之前提交海报和演示链接，工作组会统一收口，活动日当晚会做 5 分钟作品点评环节。",
        "活动,社区",
        "approved",
      ]
    );
  }
}

async function logAudit(action, req, targetType, targetId, payload = null) {
  const actorId = req.auth ? req.auth.id : null;
  const packed = payload === null ? null : JSON.stringify(payload);
  try {
    await run(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, payload, trace_id) VALUES (?, ?, ?, ?, ?, ?)",
      [actorId, action, targetType, targetId, packed, req.traceId]
    );
  } catch (_e) {
    // avoid blocking the main flow on logging failure
  }
}

async function ensurePasswordColumns() {
  const info = await all("PRAGMA table_info(users)");
  const hasPasswordHash = info.some((row) => row.name === "password_hash");
  const hasPasswordSalt = info.some((row) => row.name === "password_salt");
  if (!hasPasswordHash) {
    await run("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
  if (!hasPasswordSalt) {
    await run("ALTER TABLE users ADD COLUMN password_salt TEXT");
  }
}

async function ensureSeedUser(email, nickname, role, defaultPassword = "") {
  const exists = await get("SELECT id, password_hash FROM users WHERE email = ?", [email]);
  if (exists?.id) {
    if (!exists.password_hash && defaultPassword) {
      const { password_hash, password_salt } = await makePasswordRecord(defaultPassword);
      await run(
        "UPDATE users SET password_hash = ?, password_salt = ?, role = COALESCE(role, ?), nickname = COALESCE(nickname, ?) WHERE id = ?",
        [password_hash, password_salt, role, nickname, exists.id]
      );
    }
    return exists.id;
  }

  const seedPassword = defaultPassword
    ? await makePasswordRecord(defaultPassword)
    : { password_hash: null, password_salt: null };
  const inserted = await run(
    "INSERT INTO users (email, nickname, role, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
    [email, nickname, role, seedPassword.password_hash, seedPassword.password_salt]
  );
  return inserted.lastID;
}

function buildOffsetDate(hoursFromNow) {
  const now = new Date();
  now.setHours(now.getHours() + hoursFromNow);
  return now.toISOString();
}

async function ensureDemoSeed() {
  const demoPassword = "12345678";
  const ownerId = await ensureSeedUser("admin@tai.demo", "AI平台管理员", "owner", demoPassword);
  const organizerId = await ensureSeedUser(
    "organizer@tai.demo",
    "AI活动组织者",
    "admin",
    demoPassword
  );
  const memberId = await ensureSeedUser("user@tai.demo", "AI爱好者", "user", demoPassword);

  const eventTotal = await get("SELECT COUNT(*) AS total FROM events");
  if ((eventTotal.total || 0) === 0) {
    await run(
      `INSERT INTO events
       (title, summary, start_time, end_time, location_name, lat, lng, capacity, fee_type, signup_type, status, created_by)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "杭州市 AI CLUB·深夜线下联想夜",
        "每周五在地铁口附近举办，聚焦AI工具实战与开源模型落地。",
        buildOffsetDate(10),
        buildOffsetDate(19),
        "杭州市文三路·智慧树咖啡店",
        30.2741,
        120.1551,
        50,
        "free",
        "manual",
        "published",
        ownerId,
        "上海外滩 AI 公开分享会",
        "围绕生成式图像工作流和应用评审，含作品展示。",
        buildOffsetDate(48),
        buildOffsetDate(52),
        "上海市黄浦区外滩花园",
        31.2396,
        121.4926,
        80,
        "paid",
        "invite",
        "published",
        organizerId,
        "周末 AI 创业共创营",
        "线下活动，适合零基础到研发同学一起做Demo。",
        buildOffsetDate(120),
        buildOffsetDate(130),
        "成都市高新区天府软件园",
        30.5728,
        104.0668,
        120,
        "free",
        "manual",
        "published",
        memberId,
      ]
    );
  }

  const newsTotal = await get("SELECT COUNT(*) AS total FROM news");
  if ((newsTotal.total || 0) === 0) {
    const now = nowIso();
    await run(
      "INSERT INTO news (title, body, category, tags, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "AI City最新：如何在本地部署开源大模型",
        "本周推荐通过轻量化工具链、向量检索和工作流编排，快速把实验环境落地到活动现场。包含环境搭建清单与常见坑位。",
        "tech",
        "mcp,model,guide",
        "published",
        now,
        ownerId,
      ]
    );
    await run(
      "INSERT INTO news (title, body, category, tags, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "AI CLUB 线下活动预告与城市节点安排",
        "本周末新增北京、武汉、深圳联动节点，建议提前报名，名额有限。主讲覆盖AI安全、提示词工程与内容审核。",
        "activity",
        "event,community",
        "published",
        now,
        organizerId,
      ]
    );
  }

  const postTotal = await get("SELECT COUNT(*) AS total FROM posts");
  if ((postTotal.total || 0) === 0) {
    await run(
      "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
      [
        memberId,
        "第一次用 AI 做活动总结，有这些坑",
        "我在一次活动里把模型提示词、素材库、时间计划全部打包成一个任务流，发现最大收益在“重复跑通流程”，而不是单次效果。",
        "经验,AI,工作流",
        "approved",
      ]
    );
    await run(
      "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
      [
        ownerId,
        "给新手的 MCP 与 AI 组件清单",
        "先从内容生成、图片检索、表单联动三个任务开始；先做最小闭环：发布活动->报名提醒->复盘汇总。",
        "mcp,skill,UGC",
        "approved",
      ]
    );
    await run(
      "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
      [
        organizerId,
        "这周活动日历更新啦，带上你的作品提交链接",
        "周三之前提交海报和演示链接，工作组会统一收口，活动日当晚会做 5 分钟作品点评环节。",
        "活动,社区",
        "approved",
      ]
    );
  }
}

app.use(traceId);
app.use(authFromToken);

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.type === "entity.parse.failed") {
    return failResponse(res, "INVALID_JSON", "非法 JSON 请求体");
  }
  return failResponse(res, "INTERNAL_ERROR", "服务器错误", 500);
});

app.get("/api/v1/health", (req, res) => {
  okResponse(res, {
    service: "ai-city-platform",
    status: "ready",
    startedAt: process.env.STARTED_AT || nowIso(),
    uptimeSeconds: Math.floor(process.uptime()),
    traceId: req.traceId,
  });
});

app.post("/api/v1/auth/register", async (req, res) => {
  const { account, password, nickname } = req.body || {};
  const { identity, identityType, email, phone } = parseAuthIdentity({
    account,
  });

  if (!identity || !identityType) {
    return failResponse(res, "INVALID_IDENTITY", "账号不能为空");
  }
  if (typeof password !== "string" || password.length < 6) {
    return failResponse(res, "INVALID_CREDENTIALS", "密码至少 6 位");
  }

  const trimmedNickname = String(nickname || "").trim();
  const safeNickname =
    trimmedNickname.length >= 2 && trimmedNickname.length <= 20
      ? trimmedNickname
      : `${identityType === "email" ? "AI" : "User"}${identity.slice(0, 12)}`;

  const identityColumn = identityType === "email" ? "email" : "phone";
  const exists = await get(`SELECT * FROM users WHERE ${identityColumn} = ?`, [identity]);
  if (exists) {
    if (exists.password_hash) {
      return failResponse(res, "ACCOUNT_EXISTS", "账号已存在");
    }
    const { password_hash, password_salt } = await makePasswordRecord(password);
    await run(
      `UPDATE users SET nickname = ?, password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [safeNickname, password_hash, password_salt, exists.id]
    );
    const refreshToken = await issueRefreshToken(exists.id);
    await logAudit("auth.register", req, "user", exists.id, {
      identityType,
      action: "set_password",
    });
    return okResponse(res, {
      accessToken: makeAccessToken(exists),
      refreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TTL,
    });
  }

  const { password_hash, password_salt } = await makePasswordRecord(password);
  const inserted = await run(
    `INSERT INTO users (${identityColumn}, nickname, role, status, password_hash, password_salt) VALUES (?, ?, 'user', 'active', ?, ?)`,
    [identity, safeNickname, password_hash, password_salt]
  );
  const refreshToken = await issueRefreshToken(inserted.lastID);
  await logAudit("auth.register", req, "user", inserted.lastID, {
    identityType,
    action: "create",
  });

  return okResponse(res, {
    accessToken: makeAccessToken({
      id: inserted.lastID,
      role: "user",
      nickname: safeNickname,
    }),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TTL,
  });
});

app.post("/api/v1/auth/login", loginRateLimiter, async (req, res) => {
  const { account, password } = req.body || {};
  const { identity, identityType } = parseAuthIdentity({ account });

  if (!identity || !identityType) {
    return failResponse(res, "INVALID_IDENTITY", "账号不能为空");
  }
  if (typeof password !== "string" || password.length < 6) {
    return failResponse(res, "INVALID_CREDENTIALS", "密码至少 6 位");
  }

  const identityColumn = identityType === "email" ? "email" : "phone";
  const user = await get(
    `SELECT * FROM users WHERE ${identityColumn} = ?`,
    [identity]
  );
  if (!user) {
    return failResponse(res, "INVALID_CREDENTIALS", "账号不存在或密码错误");
  }
  const passwordResult = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!passwordResult.valid) {
    return failResponse(res, "INVALID_CREDENTIALS", "账号不存在或密码错误");
  }

  if (user.status !== "active") {
    return failResponse(res, "ACCOUNT_DISABLED", "账号已被封禁");
  }

  if (passwordResult.legacy) {
    const upgraded = await makePasswordRecord(password);
    await run(
      "UPDATE users SET password_hash = ?, password_salt = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [upgraded.password_hash, user.id]
    );
  } else {
    await run(
      "UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [user.id]
    );
  }
  const refreshToken = await issueRefreshToken(user.id);
  await logAudit("auth.login", req, "user", user.id, { identityType });

  return okResponse(res, {
    accessToken: makeAccessToken(user),
    refreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TTL,
  });
});

app.post("/api/v1/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken !== "string" || refreshToken.length < 20) {
    return failResponse(res, "INVALID_TOKEN", "refresh token 无效");
  }
  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await get(
    "SELECT rt.*, u.id, u.role, u.nickname, u.status FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > datetime('now')",
    [tokenHash]
  );
  if (!tokenRecord) {
    return failResponse(res, "REFRESH_EXPIRED", "refresh token 无效或已过期", 401);
  }
  if (tokenRecord.status !== "active") {
    return failResponse(res, "ACCOUNT_DISABLED", "账号已被封禁", 403);
  }
  const nextRefreshToken = await issueRefreshToken(tokenRecord.user_id);
  await run(
    "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?",
    [tokenRecord.id]
  );
  await logAudit("auth.refresh", req, "user", tokenRecord.user_id, {
    previousTokenId: tokenRecord.id,
    status: tokenRecord.status,
  });
  const user = {
    id: tokenRecord.user_id,
    role: tokenRecord.role,
    nickname: tokenRecord.nickname,
  };
  return okResponse(res, {
    accessToken: makeAccessToken(user),
    refreshToken: nextRefreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_TTL,
  });
});

app.post("/api/v1/auth/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken === "string" && refreshToken.length > 10) {
    const tokenHash = hashToken(refreshToken);
    await run("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?", [
      tokenHash,
    ]);
  }
  await logAudit("auth.logout", req, "user", req.auth?.id || null);
  return okResponse(res, { loggedOut: true });
});

app.get("/api/v1/user/me", requireAuth, async (req, res) => {
  const user = await get(
    "SELECT id, phone, email, nickname, avatar_url, role, status, created_at, updated_at FROM users WHERE id = ?",
    [req.auth.id]
  );
  if (!user) {
    return failResponse(res, "USER_NOT_FOUND", "用户不存在", 404);
  }
  return okResponse(res, user);
});

app.post("/api/v1/admin/seed-demo", requireAuth, requireAdmin, async (req, res) => {
  if (!demoSeedAllowed()) {
    return failResponse(res, "DEMO_SEED_DISABLED", "演示数据初始化未启用", 403);
  }
  try {
    await ensureDemoSeed();
    const summaryRows = await all(
      "SELECT id, email, nickname, role FROM users WHERE email LIKE '%@tai.demo' ORDER BY role DESC, id"
    );
    const eventTotal = await get("SELECT COUNT(*) AS total FROM events");
    const newsTotal = await get("SELECT COUNT(*) AS total FROM news");
    const postTotal = await get("SELECT COUNT(*) AS total FROM posts");

    return okResponse(res, {
      message: "演示数据已初始化",
      accounts: summaryRows,
      totals: {
        events: eventTotal.total || 0,
        news: newsTotal.total || 0,
        posts: postTotal.total || 0,
      },
    });
  } catch (_err) {
    return failResponse(res, "DEMO_SEED_FAILED", "演示数据初始化失败", 500);
  }
});

app.patch("/api/v1/user/me", requireAuth, async (req, res) => {
  const { nickname, avatar_url } = req.body || {};
  const update = {};
  if (typeof nickname === "string") {
    const fixed = nickname.trim();
    if (fixed.length < 2 || fixed.length > 20) {
      return failResponse(res, "INVALID_NICKNAME", "昵称长度 2-20 字符");
    }
    update.nickname = fixed;
  }
  if (typeof avatar_url === "string") {
    update.avatar_url = avatar_url;
  }
  const keys = Object.keys(update);
  if (keys.length === 0) {
    return failResponse(res, "EMPTY_UPDATE", "没有可更新的字段");
  }
  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  await run(
    `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...keys.map((k) => update[k]), req.auth.id]
  );
  const updated = await get(
    "SELECT id, phone, email, nickname, avatar_url, role, status, created_at, updated_at FROM users WHERE id = ?",
    [req.auth.id]
  );
  await logAudit("user.update", req, "user", req.auth.id, update);
  return okResponse(res, updated);
});

app.get("/api/v1/user/:id/posts", async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "用户 ID 不合法");
  }
  const { page, pageSize, offset } = parsePager(req);
  const viewerId = req.auth?.id;
  const baseWhere =
    viewerId && viewerId === id
      ? ""
      : "AND (p.status = 'approved' OR p.status = 'offline')";
  const rows = await all(
    `SELECT p.* FROM posts p WHERE p.author_id = ? ${baseWhere}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [id, pageSize, offset]
  );
  const totalRow = await get(
    `SELECT COUNT(*) AS total FROM posts p WHERE p.author_id = ? ${baseWhere}`,
    [id]
  );
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(
      1,
      Math.ceil((totalRow.total || 0) / pageSize)
    ),
  });
});

app.get("/api/v1/user/:id/registrations", requireAuth, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id || id !== req.auth.id) {
    return failResponse(res, "FORBIDDEN", "无权限查看他人报名记录", 403);
  }
  const { page, pageSize, offset } = parsePager(req);
  const rows = await all(
    `SELECT er.id, er.event_id, er.status, er.created_at,
            e.title, e.summary, e.start_time, e.end_time, e.location_name, e.capacity
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
      WHERE er.user_id = ?
      ORDER BY er.created_at DESC
      LIMIT ? OFFSET ?`,
    [id, pageSize, offset]
  );
  const totalRow = await get(
    "SELECT COUNT(*) AS total FROM event_registrations WHERE user_id = ?",
    [id]
  );
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/user/:id/favorites", requireAuth, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id || id !== req.auth.id) {
    return failResponse(res, "FORBIDDEN", "无权限查看他人收藏", 403);
  }
  const targetType = req.query.targetType || "post";
  const safeType = targetType === "news" ? "news" : targetType === "event" ? "event" : "post";
  const { page, pageSize, offset } = parsePager(req);
  const favorites = await all(
    `SELECT id, target_id, created_at FROM favorites WHERE user_id = ? AND target_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [id, safeType, pageSize, offset]
  );
  const totalRow = await get(
    `SELECT COUNT(*) AS total FROM favorites WHERE user_id = ? AND target_type = ?`,
    [id, safeType]
  );
  const rows = await Promise.all(
    favorites.map(async (fav) => {
      if (safeType === "post") {
        const post = await get("SELECT id, title, body, author_id, status, created_at FROM posts WHERE id = ?", [fav.target_id]);
        return post
          ? {
              ...post,
              favorite_created_at: fav.created_at,
              target_type: "post",
            }
          : null;
      }
      if (safeType === "news") {
        const news = await get("SELECT id, title, body, category, status, created_at, published_at FROM news WHERE id = ?", [fav.target_id]);
        return news
          ? {
              ...news,
              favorite_created_at: fav.created_at,
              target_type: "news",
            }
          : null;
      }
      const evt = await get("SELECT id, title, summary, status, start_time, end_time, location_name FROM events WHERE id = ?", [fav.target_id]);
      return evt
        ? {
            ...evt,
            favorite_created_at: fav.created_at,
            target_type: "event",
          }
        : null;
    })
  );
  return okResponse(res, rows.filter(Boolean), {
    page,
    pageSize,
    total: totalRow.total || 0,
    targetType: safeType,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/events", async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const status = req.query.status ? String(req.query.status) : "published";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const sort = req.query.sort === "distance" ? "distance" : "start";
  const lat = Number.parseFloat(req.query.lat);
  const lng = Number.parseFloat(req.query.lng);
  const category = normalizeEventCategory(req.query.category);
  const allowed = ["published", "draft", "closed", "ended", "canceled"];
  const safeStatus = allowed.includes(status) ? status : "published";
  const viewerId = req.auth?.id || null;

  const where = ["1=1"];
  const params = [];
  if (!req.auth || !["admin", "owner"].includes(req.auth.role)) {
    where.push("e.status IN ('published', 'ended', 'closed')");
  } else if (safeStatus) {
    where.push("e.status = ?");
    params.push(safeStatus);
  }
  if (q) {
    where.push(" (e.title LIKE ? OR e.summary LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push("e.fee_type = ?");
    params.push(category);
  }
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    where.push("e.lat IS NOT NULL AND e.lng IS NOT NULL");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderBy = sort === "distance" ? "e.start_time ASC" : "e.start_time ASC";
  const baseRows = await all(
    `SELECT e.*,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') AS reg_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'event' AND f.target_id = e.id) AS favorite_count,
      CASE WHEN ? IS NOT NULL THEN
        EXISTS(SELECT 1 FROM event_registrations er2 WHERE er2.event_id = e.id AND er2.user_id = ? AND er2.status = 'registered')
      ELSE 0 END AS is_registered,
      CASE WHEN ? IS NOT NULL THEN
        EXISTS(SELECT 1 FROM favorites f2 WHERE f2.user_id = ? AND f2.target_type = 'event' AND f2.target_id = e.id)
      ELSE 0 END AS is_favorited
     FROM events e
      ${whereSql}
      ORDER BY ${orderBy}`,
    [...params, viewerId, viewerId, viewerId, viewerId]
  );
  const totalRow = await get(
    `SELECT COUNT(*) AS total FROM events e ${whereSql}`,
    params
  );
  const withDistance = baseRows.map((row) => {
    const distanceKm = getDistanceKm(lat, lng, row.lat, row.lng);
    return {
      ...row,
      reg_count: row.reg_count || 0,
      is_registered: !!row.is_registered,
      distance_km: Number.isFinite(distanceKm) ? distanceKm : null,
    };
  });

  const sortedRows = sort === "distance"
    ? withDistance.sort((a, b) => {
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      })
    : withDistance;

  const rows = sortedRows.slice(offset, offset + pageSize);
  rows.forEach((r) => {
    if (req.query.lat && req.query.lng) {
      const lat = Number.parseFloat(req.query.lat);
      const lng = Number.parseFloat(req.query.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && r.lat !== null && r.lng !== null) {
        r.distance_km = getDistanceKm(lat, lng, r.lat, r.lng);
      }
    }
    r.registrationAllowed = !("status" in r && ["ended", "canceled", "closed"].includes(r.status));
  });
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/events/:id", async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "活动 ID 不合法");
  }
  const viewerId = req.auth?.id || null;
  const row = await get(
    `SELECT e.*,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.status = 'registered') AS reg_count,
      CASE WHEN ? IS NOT NULL THEN
        EXISTS(SELECT 1 FROM event_registrations er2 WHERE er2.event_id = e.id AND er2.user_id = ? AND er2.status = 'registered')
      ELSE 0 END AS is_registered,
      (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'event' AND f.target_id = e.id) AS favorite_count,
      CASE WHEN ? IS NOT NULL THEN
        EXISTS(SELECT 1 FROM favorites f2 WHERE f2.user_id = ? AND f2.target_type = 'event' AND f2.target_id = e.id)
      ELSE 0 END AS is_favorited
     FROM events e WHERE e.id = ?`,
    [viewerId, viewerId, viewerId, viewerId, id]
  );
  if (!row) {
    return failResponse(res, "NOT_FOUND", "活动不存在", 404);
  }
  if (
    !["published", "ended", "closed"].includes(row.status) &&
    (!req.auth || !["admin", "owner"].includes(req.auth.role))
  ) {
    return failResponse(res, "FORBIDDEN", "活动不可见", 403);
  }
  if (req.query.lat && req.query.lng) {
    const lat = Number.parseFloat(req.query.lat);
    const lng = Number.parseFloat(req.query.lng);
    row.distance_km = getDistanceKm(lat, lng, row.lat, row.lng);
  }
  return okResponse(res, row);
});

app.post("/api/v1/events/:id/register", requireAuth, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "活动 ID 不合法");
  }
  const result = await withTransaction(async (transaction) => {
    const event = await transaction.get("SELECT * FROM events WHERE id = ?", [id]);
    if (!event) return { error: ["NOT_FOUND", "活动不存在", 404] };
    if (event.status !== "published") return { error: ["NOT_AVAILABLE", "当前活动不可报名", 403] };
    if (new Date(event.end_time) <= new Date()) {
      await transaction.run("UPDATE events SET status = 'ended' WHERE id = ?", [id]);
      return { error: ["EVENT_ENDED", "活动已结束", 409] };
    }
    if ((event.signup_type || "manual") !== "manual") {
      return { error: ["NOT_AVAILABLE", "当前活动不支持站内报名", 403] };
    }
    const existed = await transaction.get(
      "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?",
      [id, req.auth.id]
    );
    if (existed?.status === "registered") return { error: ["ALREADY_REGISTERED", "你已报名", 409] };
    const regCount = await transaction.get(
      "SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND status = 'registered'",
      [id]
    );
    if (event.capacity > 0 && regCount.total >= event.capacity) {
      return { error: ["FULL", "名额已满", 409] };
    }
    if (existed) {
      await transaction.run("UPDATE event_registrations SET status = 'registered' WHERE id = ?", [existed.id]);
      return { payload: { eventId: id, status: "registered" }, mode: "reactivate" };
    }
    await transaction.run(
      "INSERT INTO event_registrations (event_id, user_id, status) VALUES (?, ?, 'registered')",
      [id, req.auth.id]
    );
    return { payload: { eventId: id, status: "registered" }, mode: "create" };
  });
  if (result.error) return failResponse(res, ...result.error);
  await logAudit("event.register", req, "event", id, { mode: result.mode });
  return okResponse(res, result.payload);
});

app.delete("/api/v1/events/:id/register", requireAuth, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "活动 ID 不合法");
  }
  const result = await withTransaction(async (transaction) => {
    const info = await transaction.get(
      "SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ? AND status = 'registered'",
      [id, req.auth.id]
    );
    if (!info) return { error: ["NOT_FOUND", "你当前未报名", 404] };
    await transaction.run("UPDATE event_registrations SET status = 'cancelled' WHERE id = ?", [info.id]);
    return { payload: { eventId: id, status: "cancelled" } };
  });
  if (result.error) return failResponse(res, ...result.error);
  await logAudit("event.unregister", req, "event", id);
  return okResponse(res, result.payload);
});

app.post("/api/v1/admin/events", requireAuth, requireAdmin, async (req, res) => {
  const {
    title,
    summary,
    start_time,
    end_time,
    location_name,
    lat,
    lng,
    capacity,
    fee_type,
    signup_type,
    status,
  } = req.body || {};

  const normalizedSignupType = normalizeSignupType(signup_type);
  if (!normalizedSignupType) {
    return failResponse(res, "INVALID_PARAMS", "报名方式非法");
  }
  if (!title || !start_time || !end_time || !location_name) {
    return failResponse(res, "INVALID_PARAMS", "活动字段缺失");
  }
  const trimmedTitle = String(title).trim();
  if (trimmedTitle.length < 2 || trimmedTitle.length > 60) {
    return failResponse(res, "INVALID_TITLE", "标题长度需 2-60 字符");
  }
  const startTs = Date.parse(start_time);
  const endTs = Date.parse(end_time);
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || startTs >= endTs) {
    return failResponse(res, "INVALID_TIME", "活动时间非法");
  }
  if (startTs < Date.now()) {
    return failResponse(res, "INVALID_TIME", "活动不能早于当前时间");
  }
  const safeStatus = ["draft", "published", "closed", "ended", "canceled"].includes(
    status
  )
    ? status
    : "draft";
  const safeCapacity = Number.parseInt(capacity, 10) || 0;
  if (safeCapacity < 0) {
    return failResponse(res, "INVALID_CAPACITY", "容量不能为负");
  }
  const insert = await run(
    `INSERT INTO events
      (title, summary, start_time, end_time, location_name, lat, lng, capacity, fee_type, signup_type, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trimmedTitle,
      String(summary || "").trim(),
      new Date(startTs).toISOString(),
      new Date(endTs).toISOString(),
      String(location_name).trim(),
      lat === undefined ? null : Number(lat),
      lng === undefined ? null : Number(lng),
      safeCapacity,
      fee_type || "free",
      normalizedSignupType,
      safeStatus,
      req.auth.id,
    ]
  );
  const created = await get("SELECT * FROM events WHERE id = ?", [insert.lastID]);
  await logAudit("event.create", req, "event", insert.lastID, created);
  return okResponse(res, created);
});

app.post("/api/v1/admin/events/bulk", requireAuth, requireAdmin, async (req, res) => {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const status = req.body && req.body.status;
  if (!["published", "closed"].includes(status)) {
    return failResponse(res, "INVALID_STATUS", "活动状态非法");
  }

  const ids = [];
  for (const rawId of rawIds) {
    const id = requirePositiveInt(rawId);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  if (!ids.length) {
    return failResponse(res, "INVALID_IDS", "活动 ID 无效");
  }

  const placeholder = ids.map(() => "?").join(",");
  const foundRows = await all(`SELECT id FROM events WHERE id IN (${placeholder})`, ids);
  const foundIds = foundRows.map((row) => row.id);
  if (!foundIds.length) {
    return failResponse(res, "NOT_FOUND", "活动不存在", 404);
  }

  const foundPlaceholder = foundIds.map(() => "?").join(",");
  await run(
    `UPDATE events SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${foundPlaceholder})`,
    [status, ...foundIds]
  );
  await logAudit("event.batch_status", req, "event", null, {
    ids: foundIds,
    status,
  });
  return okResponse(res, {
    updatedCount: foundIds.length,
    totalRequested: ids.length,
    status,
    ids: foundIds,
  });
});

app.patch("/api/v1/admin/events/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "活动 ID 不合法");
  }
  const event = await get("SELECT * FROM events WHERE id = ?", [id]);
  if (!event) {
    return failResponse(res, "NOT_FOUND", "活动不存在", 404);
  }
  const updates = {};
  const body = req.body || {};
  const keys = [
    "title",
    "summary",
    "start_time",
    "end_time",
    "location_name",
    "lat",
    "lng",
    "fee_type",
    "signup_type",
    "status",
    "capacity",
  ];
  keys.forEach((k) => {
    if (body[k] !== undefined) {
      updates[k] = body[k];
    }
  });
  if (updates.title && (String(updates.title).trim().length < 2 || String(updates.title).trim().length > 60)) {
    return failResponse(res, "INVALID_TITLE", "标题长度需 2-60 字符");
  }
  if (updates.capacity !== undefined) {
    const capacity = Number.parseInt(updates.capacity, 10);
    if (!Number.isInteger(capacity) || capacity < 0) {
      return failResponse(res, "INVALID_CAPACITY", "容量不能为负");
    }
    updates.capacity = capacity;
  }
  if (updates.signup_type !== undefined) {
    const normalizedSignupType = normalizeSignupType(updates.signup_type);
    if (!normalizedSignupType) {
      return failResponse(res, "INVALID_PARAMS", "报名方式非法");
    }
    updates.signup_type = normalizedSignupType;
  }

  if (updates.start_time !== undefined || updates.end_time !== undefined) {
    const nextStart = updates.start_time !== undefined ? updates.start_time : event.start_time;
    const nextEnd = updates.end_time !== undefined ? updates.end_time : event.end_time;
    const startTs = Date.parse(nextStart);
    const endTs = Date.parse(nextEnd);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || startTs >= endTs) {
      return failResponse(res, "INVALID_TIME", "活动时间非法");
    }
    if (startTs < Date.now()) {
      return failResponse(res, "INVALID_TIME", "活动不能早于当前时间");
    }
    if (updates.start_time !== undefined) {
      updates.start_time = new Date(startTs).toISOString();
    }
    if (updates.end_time !== undefined) {
      updates.end_time = new Date(endTs).toISOString();
    }
  }
  if (!Object.keys(updates).length) {
    return failResponse(res, "EMPTY_UPDATE", "无可更新字段");
  }
  const setParts = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  await run(
    `UPDATE events SET ${setParts}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...Object.keys(updates).map((k) => updates[k]), id]
  );
  const updated = await get("SELECT * FROM events WHERE id = ?", [id]);
  await logAudit("event.update", req, "event", id, updates);
  return okResponse(res, updated);
});

app.delete("/api/v1/admin/events/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "活动 ID 不合法");
  }
  const row = await get("SELECT * FROM events WHERE id = ?", [id]);
  if (!row) {
    return failResponse(res, "NOT_FOUND", "活动不存在", 404);
  }
  await run("DELETE FROM events WHERE id = ?", [id]);
  await logAudit("event.delete", req, "event", id);
  return okResponse(res, { id, deleted: true });
});

app.get("/api/v1/news", async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const sort = req.query.sort === "hot" ? "read_count DESC" : "published_at DESC";
  const where = ["1=1"];
  const params = [];
  if (req.auth?.role !== "admin" && req.auth?.role !== "owner") {
    where.push("status = 'published'");
  } else if (req.query.status) {
    where.push("status = ?");
    params.push(req.query.status);
  }
  if (q) {
    where.push("(title LIKE ? OR body LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const viewerId = req.auth?.id || null;
  const rows = await all(
    `SELECT n.id, n.title, n.body, n.category, n.tags, n.status, n.published_at, n.created_by, n.read_count, n.created_at, n.updated_at,
            (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'news' AND f.target_id = n.id) AS favorite_count,
            CASE WHEN ? IS NOT NULL THEN
              EXISTS(SELECT 1 FROM favorites f2 WHERE f2.user_id = ? AND f2.target_type = 'news' AND f2.target_id = n.id)
            ELSE 0 END AS is_favorited
     FROM news n ${whereSql}
     ORDER BY ${sort}
     LIMIT ? OFFSET ?`,
    [...params, viewerId, viewerId, pageSize, offset]
  );
  const totalRow = await get(
    `SELECT COUNT(*) AS total FROM news ${whereSql}`,
    params
  );
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/news/:id", async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "资讯 ID 不合法");
  }
  const viewerId = req.auth?.id || null;
  const row = await get(
    `SELECT n.*,
      (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'news' AND f.target_id = n.id) AS favorite_count,
      CASE WHEN ? IS NOT NULL THEN
        EXISTS(SELECT 1 FROM favorites f2 WHERE f2.user_id = ? AND f2.target_type = 'news' AND f2.target_id = n.id)
      ELSE 0 END AS is_favorited
     FROM news n WHERE n.id = ?`,
    [viewerId, viewerId, id]
  );
  if (!row) {
    return failResponse(res, "NOT_FOUND", "资讯不存在", 404);
  }
  if (row.status !== "published" && (!req.auth || !["admin", "owner"].includes(req.auth.role))) {
    return failResponse(res, "FORBIDDEN", "资讯不可见", 403);
  }
  await run("UPDATE news SET read_count = read_count + 1 WHERE id = ?", [id]);
  return okResponse(res, row);
});

app.post("/api/v1/admin/news", requireAuth, requireAdmin, async (req, res) => {
  const { title, body, category, tags, status } = req.body || {};
  const safeTitle = String(title || "").trim();
  const safeBody = String(body || "");
  if (safeTitle.length < 2 || safeTitle.length > 60) {
    return failResponse(res, "INVALID_TITLE", "标题长度需 2-60");
  }
  if (safeBody.length > 20000) {
    return failResponse(res, "INVALID_BODY", "资讯正文超出限制");
  }
  const safeStatus = ["draft", "published", "offline"].includes(status)
    ? status
    : "draft";
  const insert = await run(
    "INSERT INTO news (title, body, category, tags, status, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      safeTitle,
      safeBody,
      String(category || "general").trim(),
      String(tags || ""),
      safeStatus,
      safeStatus === "published" ? nowIso() : null,
      req.auth.id,
    ]
  );
  const created = await get("SELECT * FROM news WHERE id = ?", [insert.lastID]);
  await logAudit("news.create", req, "news", insert.lastID);
  return okResponse(res, created);
});

app.patch("/api/v1/admin/news/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "资讯 ID 不合法");
  }
  const row = await get("SELECT * FROM news WHERE id = ?", [id]);
  if (!row) {
    return failResponse(res, "NOT_FOUND", "资讯不存在", 404);
  }
  const updates = {};
  const body = req.body || {};
  if (body.title !== undefined) {
    const safeTitle = String(body.title).trim();
    if (safeTitle.length < 2 || safeTitle.length > 60) {
      return failResponse(res, "INVALID_TITLE", "标题长度需 2-60");
    }
    updates.title = safeTitle;
  }
  if (body.body !== undefined) {
    const safeBody = String(body.body);
    if (safeBody.length > 20000) {
      return failResponse(res, "INVALID_BODY", "资讯正文超出限制");
    }
    updates.body = safeBody;
  }
  if (body.category !== undefined) updates.category = String(body.category);
  if (body.tags !== undefined) updates.tags = String(body.tags);
  if (body.status !== undefined && ["draft", "published", "offline"].includes(body.status)) {
    updates.status = body.status;
    if (body.status === "published" && row.status !== "published") {
      updates.published_at = nowIso();
    }
  }
  if (!Object.keys(updates).length) {
    return failResponse(res, "EMPTY_UPDATE", "无可更新字段");
  }
  await run(
    `UPDATE news SET ${Object.keys(updates).map((k) => `${k} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...Object.values(updates), id]
  );
  const updated = await get("SELECT * FROM news WHERE id = ?", [id]);
  await logAudit("news.update", req, "news", id, updates);
  return okResponse(res, updated);
});

app.delete("/api/v1/admin/news/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "资讯 ID 不合法");
  }
  const row = await get("SELECT id FROM news WHERE id = ?", [id]);
  if (!row) {
    return failResponse(res, "NOT_FOUND", "资讯不存在", 404);
  }
  await run("DELETE FROM news WHERE id = ?", [id]);
  await logAudit("news.delete", req, "news", id);
  return okResponse(res, { id, deleted: true });
});

app.get("/api/v1/posts", async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const where = ["1=1"];
  const params = [];
  if (req.auth?.role !== "admin" && req.auth?.role !== "owner") {
    where.push("p.status = 'approved'");
  } else if (req.query.status) {
    where.push("p.status = ?");
    params.push(req.query.status);
  } else if (req.query.status === "all") {
    where.push("1=1");
  }
  if (q) {
    where.push("(p.title LIKE ? OR p.body LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    where.push("p.tags LIKE ?");
    params.push(`%${tag}%`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await all(
    `SELECT p.*, u.nickname AS author_nickname,
            (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'post' AND f.target_id = p.id) AS favorite_count
     FROM posts p
      LEFT JOIN users u ON u.id = p.author_id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM posts p ${whereSql}`, params);
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const replyCount = await get(
        "SELECT COUNT(*) AS total FROM comments WHERE post_id = ? AND status = 'approved'",
        [row.id]
      );
      const likeCount = await get(
        "SELECT COUNT(*) AS total FROM likes WHERE target_type = 'post' AND target_id = ?",
        [row.id]
      );
      const myFavorite = req.auth
        ? await get(
            "SELECT id FROM favorites WHERE user_id = ? AND target_type = 'post' AND target_id = ?",
            [req.auth.id, row.id]
          )
        : null;
      const isMine = req.auth?.id === row.author_id;
      return {
        ...row,
        reply_count: replyCount.total || 0,
        like_count: likeCount.total || 0,
        favorite_count: row.favorite_count || 0,
        is_favorited: !!myFavorite,
        isMine,
      };
    })
  );
  return okResponse(res, mapped, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/posts/:id", async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "帖子 ID 不合法");
  }
  const post = await get(
    `SELECT p.*, u.nickname AS author_nickname FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = ?`,
    [id]
  );
  if (!post) {
    return failResponse(res, "NOT_FOUND", "帖子不存在", 404);
  }
  if (post.status !== "approved" && (!req.auth || !["admin", "owner"].includes(req.auth.role)) && post.author_id !== req.auth?.id) {
    return failResponse(res, "FORBIDDEN", "帖子不可见", 403);
  }
  const comments = await all(
    `SELECT c.id, c.body, c.status, c.created_at, u.nickname AS author_nickname
     FROM comments c
     LEFT JOIN users u ON u.id = c.author_id
     WHERE c.post_id = ? AND c.status = 'approved'
     ORDER BY c.created_at DESC`,
    [id]
  );
  const likeCount = await get(
    "SELECT COUNT(*) AS total FROM likes WHERE target_type = 'post' AND target_id = ?",
    [id]
  );
  const favoriteCount = await get(
    "SELECT COUNT(*) AS total FROM favorites WHERE target_type = 'post' AND target_id = ?",
    [id]
  );
  const myLike = req.auth
    ? await get(
        "SELECT id FROM likes WHERE user_id = ? AND target_type = 'post' AND target_id = ?",
        [req.auth.id, id]
      )
    : null;
  const myFavorite = req.auth
    ? await get(
        "SELECT id FROM favorites WHERE user_id = ? AND target_type = 'post' AND target_id = ?",
        [req.auth.id, id]
      )
    : null;
  return okResponse(res, {
    ...post,
    like_count: likeCount.total || 0,
    favorite_count: favoriteCount.total || 0,
    is_liked: !!myLike,
    is_favorited: !!myFavorite,
    comments,
  });
});

app.post("/api/v1/posts", requireAuth, async (req, res) => {
  const { title, body, tags } = req.body || {};
  const safeTitle = String(title || "").trim();
  const safeBody = String(body || "").trim();
  if (safeTitle.length < 2 || safeTitle.length > 60) {
    return failResponse(res, "INVALID_TITLE", "标题长度需 2-60");
  }
  if (safeBody.length < 10 || safeBody.length > 5000) {
    return failResponse(res, "INVALID_BODY", "正文需 10-5000 字");
  }
  const safeTags = String(tags || "").trim();
  const insert = await run(
    "INSERT INTO posts (author_id, title, body, tags, status) VALUES (?, ?, ?, ?, ?)",
    [req.auth.id, safeTitle, safeBody, safeTags, "pending"]
  );
  const created = await get("SELECT * FROM posts WHERE id = ?", [insert.lastID]);
  await logAudit("post.create", req, "post", insert.lastID, { title: safeTitle });
  return okResponse(res, created);
});

app.post("/api/v1/posts/:id/comments", requireAuth, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  const body = String((req.body || {}).body || "").trim();
  if (!id) {
    return failResponse(res, "INVALID_ID", "帖子 ID 不合法");
  }
  if (!body || body.length < 2 || body.length > 2000) {
    return failResponse(res, "INVALID_COMMENT", "评论长度 2-2000");
  }
  const post = await get("SELECT * FROM posts WHERE id = ?", [id]);
  if (!post) {
    return failResponse(res, "NOT_FOUND", "帖子不存在", 404);
  }
  const insert = await run(
    "INSERT INTO comments (post_id, author_id, body, status) VALUES (?, ?, ?, 'approved')",
    [id, req.auth.id, body]
  );
  const created = await get("SELECT * FROM comments WHERE id = ?", [insert.lastID]);
  await logAudit("comment.create", req, "comment", insert.lastID, { post_id: id });
  return okResponse(res, created);
});

app.post("/api/v1/posts/:id/like", requireAuth, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  if (!id) {
    return failResponse(res, "INVALID_ID", "帖子 ID 不合法");
  }
  const post = await get("SELECT id FROM posts WHERE id = ?", [id]);
  if (!post) {
    return failResponse(res, "NOT_FOUND", "帖子不存在", 404);
  }
  const exists = await get(
    "SELECT id FROM likes WHERE user_id = ? AND target_type = 'post' AND target_id = ?",
    [req.auth.id, id]
  );
  if (exists) {
    await run("DELETE FROM likes WHERE id = ?", [exists.id]);
    const likeCount = await get(
      "SELECT COUNT(*) AS total FROM likes WHERE target_type = 'post' AND target_id = ?",
      [id]
    );
    await logAudit("post.unlike", req, "post", id);
    return okResponse(res, { post_id: id, liked: false, like_count: likeCount.total || 0 });
  }
  await run("INSERT INTO likes (user_id, target_type, target_id) VALUES (?, 'post', ?)", [
    req.auth.id,
    id,
  ]);
  const likeCount = await get(
    "SELECT COUNT(*) AS total FROM likes WHERE target_type = 'post' AND target_id = ?",
    [id]
  );
  await logAudit("post.like", req, "post", id);
  return okResponse(res, { post_id: id, liked: true, like_count: likeCount.total || 0 });
});

app.post("/api/v1/favorites/:targetType/:targetId/toggle", requireAuth, async (req, res) => {
  const { targetType, targetId } = req.params;
  const result = await toggleFavoriteInternal(req.auth.id, targetType, targetId);

  if (!result.ok) {
    return failResponse(res, result.code || "BAD_REQUEST", result.message || "请求参数错误",
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "INVALID_TARGET_ID" || result.code === "INVALID_TARGET_TYPE"
        ? 400
        : 400);
  }

  await logAudit(
    `favorite.${result.payload.favorited ? "add" : "remove"}`,
    req,
    result.payload.target_type,
    result.payload.target_id
  );

  return okResponse(res, result.payload);
});

app.post("/api/v1/posts/:id/favorite", requireAuth, async (req, res) => {
  const id = req.params.id;
  const result = await toggleFavoriteInternal(req.auth.id, "post", id);
  if (!result.ok) {
    return failResponse(res, result.code || "BAD_REQUEST", result.message || "请求参数错误");
  }
  await logAudit(
    `post.favorite.${result.payload.favorited ? "add" : "remove"}`,
    req,
    "post",
    id
  );
  return okResponse(res, result.payload);
});

app.post("/api/v1/posts/:id/report", requireAuth, async (req, res) => {
  const result = await reportTargetInternal(req.auth.id, "post", req.params.id, req.body?.reason);
  if (!result.ok) {
    const statusCode =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "INVALID_TARGET_ID" || result.code === "INVALID_TARGET_TYPE" || result.code === "INVALID_REPORT_REASON"
        ? 400
        : 400;
    return failResponse(res, result.code || "BAD_REQUEST", result.message || "请求参数错误", statusCode);
  }

  await logAudit("post.report", req, "report", result.payload?.id, { post_id: result.payload?.target_id });
  return okResponse(res, result.payload);
});

app.post("/api/v1/reports", requireAuth, async (req, res) => {
  const { target_type, target_id, reason } = req.body || {};
  const result = await reportTargetInternal(req.auth.id, target_type, target_id, reason);
  if (!result.ok) {
    const statusCode =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "INVALID_TARGET_ID" || result.code === "INVALID_TARGET_TYPE" || result.code === "INVALID_REPORT_REASON"
        ? 400
        : 400;
    return failResponse(res, result.code || "BAD_REQUEST", result.message || "请求参数错误", statusCode);
  }
  await logAudit("report.create", req, "report", result.payload?.id, {
    target_type: result.payload?.target_type,
    target_id: result.payload?.target_id,
  });
  return okResponse(res, result.payload);
});

app.post("/api/v1/admin/posts/:id/review", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  const status = req.body && req.body.status;
  const reason = req.body && req.body.reason;
  if (!id) {
    return failResponse(res, "INVALID_ID", "帖子 ID 不合法");
  }
  if (!["approved", "rejected", "offline"].includes(status)) {
    return failResponse(res, "INVALID_STATUS", "审核状态非法");
  }
  const post = await get("SELECT * FROM posts WHERE id = ?", [id]);
  if (!post) {
    return failResponse(res, "NOT_FOUND", "帖子不存在", 404);
  }
  await run("UPDATE posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    status,
    id,
  ]);
  const updated = await get("SELECT * FROM posts WHERE id = ?", [id]);
  await logAudit("post.review", req, "post", id, { status, reason });
  return okResponse(res, updated);
});

app.get("/api/v1/admin/reports", requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const targetType = typeof req.query.targetType === "string" ? req.query.targetType.trim() : "";
  const where = ["1=1"];
  const params = [];
  if (q) {
    where.push("(r.reason LIKE ? OR u.nickname LIKE ? OR CAST(r.target_id AS TEXT) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status && ["open", "resolved", "rejected"].includes(status)) {
    where.push("r.status = ?");
    params.push(status);
  }
  if (["post", "comment", "news", "event"].includes(targetType)) {
    where.push("r.target_type = ?");
    params.push(targetType);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await all(
    `SELECT r.*, u.nickname AS reporter_nickname,
            CASE r.target_type
              WHEN 'post' THEN (SELECT p.title FROM posts p WHERE p.id = r.target_id)
              WHEN 'news' THEN (SELECT n.title FROM news n WHERE n.id = r.target_id)
              WHEN 'event' THEN (SELECT e.title FROM events e WHERE e.id = r.target_id)
              WHEN 'comment' THEN (SELECT substr(c.body, 1, 80) FROM comments c WHERE c.id = r.target_id)
              ELSE ''
            END AS target_title,
            CASE r.target_type
              WHEN 'post' THEN ''
              WHEN 'news' THEN ''
              WHEN 'event' THEN ''
              WHEN 'comment' THEN (SELECT substr(c.body, 1, 80) FROM comments c WHERE c.id = r.target_id)
              ELSE ''
            END AS target_excerpt
       FROM reports r
       JOIN users u ON u.id = r.reporter_id
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM reports r ${whereSql}`, params);
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.post("/api/v1/admin/reports/:id/review", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  const status = req.body && req.body.status;
  if (!id) {
    return failResponse(res, "INVALID_ID", "举报记录 ID 不合法");
  }
  if (!["resolved", "rejected"].includes(status)) {
    return failResponse(res, "INVALID_STATUS", "处理状态非法");
  }
  const row = await get("SELECT id, target_type, target_id, status FROM reports WHERE id = ?", [id]);
  if (!row) {
    return failResponse(res, "NOT_FOUND", "举报记录不存在", 404);
  }

  await run("UPDATE reports SET status = ? WHERE id = ?", [status, id]);

  if (status === "resolved" && row.target_type && row.target_id) {
    const targetId = requirePositiveInt(row.target_id);
    const targetType = normalizeReportTargetType(row.target_type);
    if (targetType && targetId) {
      if (targetType === "post") {
        await run("UPDATE posts SET status = 'offline', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [targetId]);
      }
      if (targetType === "comment") {
        await run("UPDATE comments SET status = 'hidden' WHERE id = ?", [targetId]);
      }
      if (targetType === "news") {
        await run("UPDATE news SET status = 'offline', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [targetId]);
      }
      if (targetType === "event") {
        await run("UPDATE events SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [targetId]);
      }
    }
  }

  const updated = await get(
    `SELECT r.*, u.nickname AS reporter_nickname
       FROM reports r
      JOIN users u ON u.id = r.reporter_id
      WHERE r.id = ?`,
    [id]
  );
  await logAudit("report.review", req, "report", id, { status });
  return okResponse(res, updated);
});

app.get("/api/v1/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const where = ["1=1"];
  const params = [];
  if (q) {
    where.push("(u.phone LIKE ? OR u.email LIKE ? OR u.nickname LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const role = req.query.role ? String(req.query.role) : "";
  if (["user", "admin", "owner"].includes(role)) {
    where.push("u.role = ?");
    params.push(role);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const users = await all(
    `SELECT id, phone, email, nickname, role, status, created_at, updated_at
     FROM users u ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM users u ${whereSql}`, params);
  return okResponse(res, users, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.patch("/api/v1/admin/users/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  const status = req.body && req.body.status;
  if (!id) {
    return failResponse(res, "INVALID_ID", "用户 ID 不合法");
  }
  if (!["active", "suspended"].includes(status)) {
    return failResponse(res, "INVALID_STATUS", "用户状态非法");
  }
  const target = await get("SELECT * FROM users WHERE id = ?", [id]);
  if (!target) {
    return failResponse(res, "NOT_FOUND", "用户不存在", 404);
  }
  if (id === req.auth.id && status === "suspended") {
    return failResponse(res, "FORBIDDEN", "不能停用当前管理员账号");
  }
  await run("UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    status,
    id,
  ]);
  await logAudit("user.status", req, "user", id, { status });
  const updated = await get(
    "SELECT id, phone, email, nickname, role, status, updated_at FROM users WHERE id = ?",
    [id]
  );
  return okResponse(res, updated);
});

app.patch("/api/v1/admin/users/:id/role", requireAuth, requireAdmin, requireOwner, async (req, res) => {
  const id = requirePositiveInt(req.params.id);
  const role = req.body && req.body.role;
  if (!id) {
    return failResponse(res, "INVALID_ID", "用户 ID 不合法");
  }
  if (!role || !["user", "admin", "owner"].includes(role)) {
    return failResponse(res, "INVALID_ROLE", "角色非法");
  }
  const target = await get("SELECT id, role FROM users WHERE id = ?", [id]);
  if (!target) {
    return failResponse(res, "NOT_FOUND", "用户不存在", 404);
  }
  if (id === req.auth.id && role !== "owner") {
    return failResponse(res, "FORBIDDEN", "不能将当前 Owner 账号降级", 403);
  }

  if (target.role === "owner" && role !== "owner") {
    const ownerCount = await get("SELECT COUNT(*) AS total FROM users WHERE role = 'owner'");
    if ((ownerCount.total || 0) <= 1) {
      return failResponse(res, "FORBIDDEN", "至少保留一名 Owner");
    }
  }

  await run("UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    role,
    id,
  ]);
  await logAudit("user.role", req, "user", id, { role });
  const updated = await get(
    "SELECT id, phone, email, nickname, role, status, updated_at FROM users WHERE id = ?",
    [id]
  );
  return okResponse(res, updated);
});

app.get("/api/v1/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const targetType = typeof req.query.targetType === "string" ? req.query.targetType.trim() : "";
  const where = ["1=1"];
  const params = [];
  if (action) {
    where.push("action = ?");
    params.push(action);
  }
  if (targetType) {
    where.push("target_type = ?");
    params.push(targetType);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await all(
    `SELECT * FROM audit_logs ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`, params);
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/admin/events", requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const where = [];
  const params = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(title LIKE ? OR location_name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await all(
    `SELECT * FROM events ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM events ${whereSql}`, params);
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/admin/news", requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  const sort = req.query.sort === "hot" ? "read_count DESC" : "published_at DESC";
  const where = ["1=1"];
  const params = [];
  if (req.query.status && req.query.status !== "all") {
    where.push("status = ?");
    params.push(req.query.status);
  }
  if (q) {
    where.push("(title LIKE ? OR body LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await all(
    `SELECT id, title, body, category, tags, status, published_at, created_by, read_count, created_at, updated_at
     FROM news ${whereSql}
     ORDER BY ${sort}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM news ${whereSql}`, params);
  return okResponse(res, rows, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.get("/api/v1/admin/posts", requireAuth, requireAdmin, async (req, res) => {
  const { page, pageSize, offset } = parsePager(req);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const where = ["1=1"];
  const params = [];
  if (req.query.status && req.query.status !== "all") {
    where.push("p.status = ?");
    params.push(req.query.status);
  }
  if (q) {
    where.push("(p.title LIKE ? OR p.body LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    where.push("p.tags LIKE ?");
    params.push(`%${tag}%`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const rows = await all(
    `SELECT p.*, u.nickname AS author_nickname,
            (SELECT COUNT(*) FROM favorites f WHERE f.target_type = 'post' AND f.target_id = p.id) AS favorite_count
     FROM posts p
      LEFT JOIN users u ON u.id = p.author_id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const totalRow = await get(`SELECT COUNT(*) AS total FROM posts p ${whereSql}`, params);
  const mapped = await Promise.all(
    rows.map(async (row) => {
      const replyCount = await get(
        "SELECT COUNT(*) AS total FROM comments WHERE post_id = ? AND status = 'approved'",
        [row.id]
      );
      const likeCount = await get(
        "SELECT COUNT(*) AS total FROM likes WHERE target_type = 'post' AND target_id = ?",
        [row.id]
      );
      return {
        ...row,
        reply_count: replyCount.total || 0,
        like_count: likeCount.total || 0,
        favorite_count: row.favorite_count || 0,
        isMine: req.auth?.id === row.author_id,
      };
    })
  );
  return okResponse(res, mapped, {
    page,
    pageSize,
    total: totalRow.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow.total || 0) / pageSize)),
  });
});

app.use((req, res) => {
  return failResponse(res, "NOT_FOUND", "not found", 404);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return failResponse(res, "INTERNAL_ERROR", "服务异常", 500);
});

let server;
initializeSchema()
  .then(() => ensurePasswordColumns())
  .then(async () => {
    if (process.env.DEMO_SEED_ONLY === "true" && !demoSeedAllowed()) {
      throw new Error("DEMO_SEED_ENABLED=true is required for demo seeding");
    }
    if (demoSeedAllowed()) {
      await ensureDemoSeed();
    }
    if (process.env.DEMO_SEED_ONLY === "true") {
      await closeDb();
      return;
    }
    server = app.listen(PORT, HOST, () => {
      process.env.STARTED_AT = nowIso();
      console.log(`API ready: http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("db init failed:", error);
    process.exit(1);
  });

function shutdown(signal) {
  return async () => {
    console.log(`received ${signal}`);
    try {
      await closeDb();
      server?.close(() => {
        process.exit(0);
      });
    } catch (error) {
      console.error("shutdown error", error);
      process.exit(1);
    }
  };
}

process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));
