import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const PAGE_SIZE = 10;
const POST_PREVIEW_LENGTH = 120;
const POST_TITLE_MIN = 2;
const POST_TITLE_MAX = 60;
const POST_BODY_MIN = 10;
const POST_BODY_MAX = 5000;
const COMMENT_BODY_MIN = 2;
const COMMENT_BODY_MAX = 2000;
const AUTH_PASSWORD_MIN = 6;
const AUTH_ACCOUNT_MIN = 3;
const PUBLISH_DRAFT_KEY = "tai_city_publish_draft_v1";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{6,20}$/;
const SIGNUP_METHOD_LABELS = {
  manual: "平台内报名",
  invite: "外部报名",
};
const DEMO_CREDENTIALS = [
  { role: "owner", account: "admin@tai.demo", password: "12345678", desc: "管理员" },
  { role: "admin", account: "organizer@tai.demo", password: "12345678", desc: "活动管理员" },
  { role: "user", account: "user@tai.demo", password: "12345678", desc: "普通用户" },
];
const FAVORITE_TARGET_TYPES = ["post", "news", "event"];
const REPORTABLE_TARGET_TYPES = ["post", "comment", "news", "event"];
const DETAIL_TARGET_LABEL = {
  post: "帖子",
  news: "资讯",
  event: "活动",
};

function toApiError(err) {
  if (!err) {
    return "请求失败";
  }
  if (err.error && err.error.message) {
    return String(err.error.message);
  }
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  if (typeof err === "string" && err.trim()) {
    return err.trim();
  }
  return "请求失败";
}

function buildActionError(prefix, err) {
  const title = String(prefix || "操作").trim() || "操作";
  const normalized = /失败$/.test(title) ? title : `${title}失败`;
  return `${normalized}：${toApiError(err)}`;
}

function previewText(value, maxLength) {
  const raw = String(value || "");
  if (raw.length <= maxLength) {
    return { text: raw, overflow: false };
  }
  return { text: `${raw.slice(0, maxLength)}…`, overflow: true };
}

function toTextForShare(type, value) {
  const fallback = {
    post: "帖子",
    news: "资讯",
    event: "活动",
  };
  const text = String(value || "").trim();
  return text || fallback[type] || "AI City Circle";
}

async function parseJson(response) {
  return response
    .json()
    .catch(() => ({ ok: false, error: { message: "无法解析响应内容" } }));
}

function resolveToken() {
  return localStorage.getItem("accessToken") || "";
}

function toDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
}

function toTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDistance(value) {
  if (!Number.isFinite(value)) return "";
  return `${Number(value).toFixed(1)} km`;
}

function normalizeText(value, max) {
  if (!value) return "";
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function shortMetaText(value, max) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

function normalizeFavoriteTargetType(value) {
  return FAVORITE_TARGET_TYPES.includes(String(value || "")) ? String(value) : "";
}

function normalizeReportTargetType(value) {
  return REPORTABLE_TARGET_TYPES.includes(String(value || "")) ? String(value) : "";
}

function normalizeAuthAccount(value) {
  const raw = String(value || "").trim();
  return raw.toLowerCase();
}

function validateAuthIdentity(raw) {
  const account = normalizeAuthAccount(raw);
  if (!account || account.length < AUTH_ACCOUNT_MIN) {
    return { ok: false, message: "请输入 3-50 位手机号或邮箱" };
  }
  if (account.includes("@") && !EMAIL_PATTERN.test(account)) {
    return { ok: false, message: "邮箱格式不正确" };
  }
  if (!account.includes("@") && !PHONE_PATTERN.test(account)) {
    return { ok: false, message: "手机号格式不正确（建议输入 6-20 位数字）" };
  }
  return { ok: true, value: account };
}

function normalizeTagItems(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }
  const parts = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const tags = [];
  const seen = new Set();
  for (const part of parts) {
    if (!seen.has(part)) {
      seen.add(part);
      tags.push(part.slice(0, 16));
    }
    if (tags.length >= 8) {
      break;
    }
  }
  return tags;
}

function normalizeTagInput(value) {
  return normalizeTagItems(value).join(", ");
}

function favoriteActionKey(type, id) {
  const safeType = normalizeFavoriteTargetType(type);
  const safeId = Number.parseInt(id, 10);
  if (!safeType || !Number.isInteger(safeId) || safeId <= 0) {
    return "";
  }
  return `${safeType}:${safeId}`;
}

function isAdminRole(role) {
  return role === "admin" || role === "owner";
}

function emptyPageState() {
  return {
    rows: [],
    meta: null,
    loading: false,
    page: 1,
  };
}

function statusLabel(type, status) {
  if (type === "event") {
    if (status === "published") return "发布中";
    if (status === "draft") return "草稿";
    if (status === "ended") return "已结束";
    if (status === "closed") return "已截止";
    if (status === "canceled") return "已取消";
    return status || "-";
  }
  if (type === "news") {
    if (status === "published") return "已发布";
    if (status === "draft") return "草稿";
    if (status === "offline") return "已下线";
    return status || "-";
  }
  if (type === "post") {
    if (status === "pending") return "待审核";
    if (status === "approved") return "已发布";
    if (status === "rejected") return "已驳回";
    if (status === "offline") return "已下线";
    return status || "-";
  }
  if (type === "user") {
    if (status === "active") return "正常";
    if (status === "suspended") return "封禁";
    return status || "-";
  }
  if (type === "report") {
    if (status === "open") return "待处理";
    if (status === "resolved") return "已处理";
    if (status === "rejected") return "已驳回";
    return status || "-";
  }
  return status || "-";
}

function signupTypeLabel(value) {
  return SIGNUP_METHOD_LABELS[value] || "未知方式";
}

function feeTypeLabel(value) {
  return value === "paid" ? "付费活动" : "免费活动";
}

function signupState(item, me) {
  const endTimeExpired =
    item && item.end_time ? new Date(item.end_time) <= new Date() : false;
  if (["ended", "canceled", "closed"].includes(item.status) || endTimeExpired) {
    return {
      disabled: true,
      label: "该活动已结束",
      action: "ended",
    };
  }

  const capacity = Number(item.capacity || 0);
  const regCount = Number(item.reg_count || 0);
  const isRegistered = item.is_registered === 1 || item.is_registered === true;
  if (isRegistered) {
    return {
      disabled: false,
      label: "已报名",
      action: "cancel",
    };
  }

  if (capacity > 0 && regCount >= capacity) {
    return {
      disabled: true,
      label: "名额已满",
      action: "full",
    };
  }

  if (!me) {
    return {
      disabled: false,
      label: "",
      action: "login",
    };
  }

  if (item.signup_type === "invite") {
    return {
      disabled: false,
      label: "查看报名方式",
      action: "invite",
    };
  }

  return {
    disabled: false,
    label: "立即报名",
    action: "join",
  };
}

function Pager({ meta, page, onPrev, onNext }) {
  const totalPages = meta?.totalPages || 1;
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button onClick={onPrev} disabled={page <= 1}>
        上一页
      </button>
      <span>
        {page} / {totalPages}
      </span>
      <button onClick={onNext} disabled={page >= totalPages}>
        下一页
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [appReady, setAppReady] = useState(false);

  const [toast, setToast] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authSubmitFingerprint, setAuthSubmitFingerprint] = useState("");
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [publishSubmitFingerprint, setPublishSubmitFingerprint] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSubmitFingerprint, setCommentSubmitFingerprint] = useState("");

  const [me, setMe] = useState(null);

  const [homeTab, setHomeTab] = useState("events");
  const [events, setEvents] = useState(emptyPageState());
  const [news, setNews] = useState(emptyPageState());
  const [posts, setPosts] = useState(emptyPageState());

  const [profilePanel, setProfilePanel] = useState("posts");
  const [profileFavType, setProfileFavType] = useState("post");
  const [profilePosts, setProfilePosts] = useState(emptyPageState());
  const [profileRegistrations, setProfileRegistrations] = useState(emptyPageState());
  const [profileFavorites, setProfileFavorites] = useState(emptyPageState());

  const [adminTab, setAdminTab] = useState("events");
  const [adminFilters, setAdminFilters] = useState({
    events: { q: "", status: "" },
    news: { q: "", status: "", category: "", sort: "latest" },
    posts: { q: "", status: "", tag: "" },
    users: { q: "", role: "" },
    audit: { q: "", action: "", targetType: "", status: "" },
    reports: { q: "", targetType: "", status: "" },
  });
  const [adminData, setAdminData] = useState({
    events: emptyPageState(),
    news: emptyPageState(),
    posts: emptyPageState(),
    users: emptyPageState(),
  });
  const [adminSelectedEvents, setAdminSelectedEvents] = useState([]);
  const [adminAuditData, setAdminAuditData] = useState(emptyPageState());
  const [adminReportsData, setAdminReportsData] = useState(emptyPageState());

  const [adminEventForm, setAdminEventForm] = useState({
    editingId: null,
    title: "",
    summary: "",
    start_time: "",
    end_time: "",
    location_name: "",
    capacity: "",
    fee_type: "free",
    signup_type: "manual",
    status: "draft",
    lat: "",
    lng: "",
  });

  const [adminNewsForm, setAdminNewsForm] = useState({
    editingId: null,
    title: "",
    body: "",
    category: "general",
    tags: "",
    status: "draft",
  });

  const [userProfileForm, setUserProfileForm] = useState({
    nickname: "",
    avatar_url: "",
  });

  const [authForm, setAuthForm] = useState({
    account: "",
    password: "",
    confirmPassword: "",
    nickname: "",
  });

  const [publishForm, setPublishForm] = useState({
    title: "",
    body: "",
    tags: "",
  });

  const [detailEvent, setDetailEvent] = useState(null);
  const [detailNews, setDetailNews] = useState(null);
  const [detailPost, setDetailPost] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [relatedNews, setRelatedNews] = useState([]);
  const [detailLoadingType, setDetailLoadingType] = useState("");
  const [detailLoadError, setDetailLoadError] = useState("");
  const [homeLoadError, setHomeLoadError] = useState({
    events: "",
    news: "",
    posts: "",
  });

  const [favoriteActionLoading, setFavoriteActionLoading] = useState({});

  const [loadingAdminForm, setLoadingAdminForm] = useState(false);
  const [adminRoleLoading, setAdminRoleLoading] = useState({});

  function pushToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  function showError(prefix, err) {
    pushToast(buildActionError(prefix, err));
  }

  async function apiRequest(path, init = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    };

    const token = resolveToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const raw = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });

    const payload = await parseJson(raw);

    if (raw.status === 401 && !init._retry) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const refreshPayload = await parseJson(refreshRes);

      if (refreshRes.ok && refreshPayload?.ok && refreshPayload.data?.accessToken) {
        localStorage.setItem("accessToken", refreshPayload.data.accessToken);
        if (refreshPayload.data.refreshToken) {
          localStorage.setItem("refreshToken", refreshPayload.data.refreshToken);
        }
        return apiRequest(path, { ...init, _retry: true });
      }
      }
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setMe(null);
      setPendingAction("登录态已失效，请重新登录");
      setView("profile");
    }

    if (!raw.ok || !payload?.ok) {
      throw new Error(toApiError(payload));
    }

    return payload;
  }

  function resolveLocation() {
    if (!navigator.geolocation) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          resolve(null);
        },
        { timeout: 2000, maximumAge: 15000 }
      );
    });
  }

  async function loadMe() {
    const token = resolveToken();
    if (!token) {
      setMe(null);
      return;
    }

    try {
      const payload = await apiRequest("/api/v1/user/me");
      setMe(payload.data || null);
      setUserProfileForm({
        nickname: payload.data?.nickname || "",
        avatar_url: payload.data?.avatar_url || "",
      });
    } catch (_err) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setMe(null);
    }
  }

  async function refreshSession() {
    await loadMe();
  }

  function setAuthModeSafe(nextMode) {
    setAuthMode(nextMode);
    setAuthForm((prev) => ({
      ...prev,
      password: "",
      confirmPassword: "",
      nickname: nextMode === "register" ? prev.nickname : "",
    }));
  }

  function requireLogin(message = "请先登录") {
    if (!me) {
      setPendingAction(message);
      setView("profile");
      pushToast(message);
      return false;
    }
    return true;
  }

  async function loadEvents(page = 1) {
    const targetPage = Math.max(1, Number(page) || 1);
    setEvents((prev) => ({ ...prev, loading: true }));
    setHomeLoadError((prev) => ({ ...prev, events: "" }));

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });

      const payload = await apiRequest(`/api/v1/events?${params.toString()}`);
      setEvents({
        rows: payload.data || [],
        meta: payload.meta || null,
        loading: false,
        page: targetPage,
      });
    } catch (err) {
      setEvents((prev) => ({ ...prev, loading: false, rows: [] }));
      setHomeLoadError((prev) => ({ ...prev, events: "网络异常，重试" }));
      showError("活动列表加载失败", err);
    }
  }

  async function loadNews(page = 1) {
    const targetPage = Math.max(1, Number(page) || 1);
    setNews((prev) => ({ ...prev, loading: true }));
    setHomeLoadError((prev) => ({ ...prev, news: "" }));

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
        sort: "latest",
      });

      const payload = await apiRequest(`/api/v1/news?${params.toString()}`);
      setNews({
        rows: payload.data || [],
        meta: payload.meta || null,
        loading: false,
        page: targetPage,
      });
    } catch (err) {
      setNews((prev) => ({ ...prev, loading: false, rows: [] }));
      setHomeLoadError((prev) => ({ ...prev, news: "网络异常，重试" }));
      showError("资讯列表加载失败", err);
    }
  }

  async function loadPosts(page = 1) {
    const targetPage = Math.max(1, Number(page) || 1);
    setPosts((prev) => ({ ...prev, loading: true }));
    setHomeLoadError((prev) => ({ ...prev, posts: "" }));

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });

      const payload = await apiRequest(`/api/v1/posts?${params.toString()}`);
      setPosts({
        rows: payload.data || [],
        meta: payload.meta || null,
        loading: false,
        page: targetPage,
      });
    } catch (err) {
      setPosts((prev) => ({ ...prev, loading: false, rows: [] }));
      setHomeLoadError((prev) => ({ ...prev, posts: "网络异常，重试" }));
      showError("帖子列表加载失败", err);
    }
  }

  async function loadHomeData(page = 1) {
    if (homeTab === "events") {
      return loadEvents(page);
    }
    if (homeTab === "news") {
      return loadNews(page);
    }
    return loadPosts(page);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PUBLISH_DRAFT_KEY);
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw);
      setPublishForm((prev) => ({
        ...prev,
        title: String(data?.title || "").slice(0, POST_TITLE_MAX),
        body: String(data?.body || "").slice(0, POST_BODY_MAX),
        tags: String(data?.tags || ""),
      }));
    } catch (_err) {
      // ignore malformed draft
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      PUBLISH_DRAFT_KEY,
      JSON.stringify({
        title: publishForm.title,
        body: publishForm.body,
        tags: publishForm.tags,
      })
    );
  }, [publishForm.title, publishForm.body, publishForm.tags]);

  async function loadProfilePosts(page = 1) {
    if (!me?.id) return;
    const targetPage = Math.max(1, Number(page) || 1);
    setProfilePosts((prev) => ({ ...prev, loading: true }));

    try {
      const payload = await apiRequest(
        `/api/v1/user/${me.id}/posts?page=${targetPage}&pageSize=${PAGE_SIZE}`
      );
      setProfilePosts({
        rows: payload.data || [],
        meta: payload.meta || null,
        loading: false,
        page: targetPage,
      });
    } catch (err) {
      setProfilePosts((prev) => ({ ...prev, loading: false, rows: [] }));
      showError("我的帖子加载失败", err);
    }
  }

  async function loadProfileRegistrations(page = 1) {
    if (!me?.id) return;
    const targetPage = Math.max(1, Number(page) || 1);
    setProfileRegistrations((prev) => ({ ...prev, loading: true }));

    try {
      const payload = await apiRequest(
        `/api/v1/user/${me.id}/registrations?page=${targetPage}&pageSize=${PAGE_SIZE}`
      );
      setProfileRegistrations({
        rows: payload.data || [],
        meta: payload.meta || null,
        loading: false,
        page: targetPage,
      });
    } catch (err) {
      setProfileRegistrations((prev) => ({ ...prev, loading: false, rows: [] }));
      showError("我的报名加载失败", err);
    }
  }

  async function loadProfileFavorites(page = 1, type = profileFavType) {
    if (!me?.id) return;
    const targetPage = Math.max(1, Number(page) || 1);
    setProfileFavorites((prev) => ({ ...prev, loading: true }));

    try {
      const payload = await apiRequest(
        `/api/v1/user/${me.id}/favorites?targetType=${encodeURIComponent(
          type
        )}&page=${targetPage}&pageSize=${PAGE_SIZE}`
      );
      setProfileFavorites({
        rows: payload.data || [],
        meta: payload.meta || null,
        loading: false,
        page: targetPage,
      });
    } catch (err) {
      setProfileFavorites((prev) => ({ ...prev, loading: false, rows: [] }));
      showError("我的收藏加载失败", err);
    }
  }

  async function loadAdminData(tab = adminTab, page = 1, filterOverride = null) {
    if (!me || !isAdminRole(me.role)) {
      return;
    }

    const withOverride = (next) => ({
      ...(adminFilters?.[tab] || {}),
      ...(next || {}),
    });

    if (tab === "events") {
      const targetPage = Math.max(1, Number(page) || 1);
      setAdminData((prev) => ({ ...prev, events: { ...prev.events, loading: true } }));
      const filters = withOverride(filterOverride);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.status.trim()) params.set("status", filters.status.trim());

      try {
        const payload = await apiRequest(`/api/v1/admin/events?${params.toString()}`);
        const rows = Array.isArray(payload.data) ? payload.data : [];
        setAdminData((prev) => ({
          ...prev,
          events: {
            rows,
            meta: payload.meta || null,
            loading: false,
            page: targetPage,
          },
        }));
        setAdminSelectedEvents((prev) =>
          prev.filter((id) => rows.some((row) => Number(row.id) === id))
        );
      } catch (err) {
        setAdminData((prev) => ({ ...prev, events: { ...prev.events, loading: false, rows: [] } }));
        showError("活动管理加载失败", err);
      }
      return;
    }

    if (tab === "news") {
      const targetPage = Math.max(1, Number(page) || 1);
      setAdminData((prev) => ({ ...prev, news: { ...prev.news, loading: true } }));
      const filters = withOverride(filterOverride);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
        sort: filters.sort || "latest",
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.status.trim()) params.set("status", filters.status.trim());
      if (filters.category.trim()) params.set("category", filters.category.trim());

      try {
        const payload = await apiRequest(`/api/v1/admin/news?${params.toString()}`);
        setAdminData((prev) => ({
          ...prev,
          news: {
            rows: payload.data || [],
            meta: payload.meta || null,
            loading: false,
            page: targetPage,
          },
        }));
      } catch (err) {
        setAdminData((prev) => ({ ...prev, news: { ...prev.news, loading: false, rows: [] } }));
        showError("资讯管理加载失败", err);
      }
      return;
    }

    if (tab === "posts") {
      const targetPage = Math.max(1, Number(page) || 1);
      setAdminData((prev) => ({ ...prev, posts: { ...prev.posts, loading: true } }));
      const filters = withOverride(filterOverride);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.status.trim()) params.set("status", filters.status.trim());
      if (filters.tag.trim()) params.set("tag", filters.tag.trim());

      try {
        const payload = await apiRequest(`/api/v1/admin/posts?${params.toString()}`);
        setAdminData((prev) => ({
          ...prev,
          posts: {
            rows: payload.data || [],
            meta: payload.meta || null,
            loading: false,
            page: targetPage,
          },
        }));
      } catch (err) {
        setAdminData((prev) => ({ ...prev, posts: { ...prev.posts, loading: false, rows: [] } }));
        showError("帖子管理加载失败", err);
      }
      return;
    }

    if (tab === "users") {
      const targetPage = Math.max(1, Number(page) || 1);
      setAdminData((prev) => ({ ...prev, users: { ...prev.users, loading: true } }));
      const filters = withOverride(filterOverride);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.role.trim()) params.set("role", filters.role);

      try {
        const payload = await apiRequest(`/api/v1/admin/users?${params.toString()}`);
        setAdminData((prev) => ({
          ...prev,
          users: {
            rows: payload.data || [],
            meta: payload.meta || null,
            loading: false,
            page: targetPage,
          },
        }));
      } catch (err) {
        setAdminData((prev) => ({ ...prev, users: { ...prev.users, loading: false, rows: [] } }));
        showError("用户管理加载失败", err);
      }
      return;
    }

    if (tab === "audit") {
      const targetPage = Math.max(1, Number(page) || 1);
      setAdminAuditData((prev) => ({ ...prev, loading: true }));
      const filters = withOverride(filterOverride);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.action.trim()) params.set("action", filters.action.trim());
      if (filters.targetType.trim()) params.set("targetType", filters.targetType.trim());

      try {
        const payload = await apiRequest(`/api/v1/admin/audit-logs?${params.toString()}`);
        setAdminAuditData({
          rows: payload.data || [],
          meta: payload.meta || null,
          loading: false,
          page: targetPage,
        });
      } catch (err) {
        setAdminAuditData((prev) => ({ ...prev, loading: false, rows: [] }));
        showError("审计日志加载失败", err);
      }
      return;
    }

    if (tab === "reports") {
      const targetPage = Math.max(1, Number(page) || 1);
      setAdminReportsData((prev) => ({ ...prev, loading: true }));
      const filters = withOverride(filterOverride);
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.targetType.trim()) params.set("targetType", filters.targetType.trim());
      if (filters.status.trim()) params.set("status", filters.status.trim());

      try {
        const payload = await apiRequest(`/api/v1/admin/reports?${params.toString()}`);
        setAdminReportsData({
          rows: payload.data || [],
          meta: payload.meta || null,
          loading: false,
          page: targetPage,
        });
      } catch (err) {
        setAdminReportsData((prev) => ({ ...prev, loading: false, rows: [] }));
        showError("举报记录加载失败", err);
      }
      return;
    }

    showError("管理页签未知", new Error("未知管理页签"));
    return;
  }

  function updateAdminFilter(tab, next) {
    const nextPage = Number(next?.page) >= 1 ? Number(next.page) : 1;
    const filteredNext = {
      ...(adminFilters[tab] || {}),
      ...(next || {}),
    };
    delete filteredNext.page;
    setAdminFilters((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], ...filteredNext },
    }));
    if (tab === "events") {
      setAdminSelectedEvents([]);
    }
    loadAdminData(tab, nextPage, filteredNext);
  }

  function switchAdminTab(nextTab) {
    if (nextTab !== "events") {
      setAdminSelectedEvents([]);
    }
    setAdminTab(nextTab);
  }

  async function submitAuth(mode) {
    const modeName = mode === "register" ? "register" : "login";
    const identityResult = validateAuthIdentity(authForm.account);
    const password = String(authForm.password || "").trim();
    const confirmPassword = String(authForm.confirmPassword || "").trim();
    const nickname = String(authForm.nickname || "").trim();
    const fingerprint = `${modeName}|${identityResult.value || ""}|${password}`;

    if (!identityResult.ok) {
      pushToast(identityResult.message || "请输入有效账号");
      return;
    }
    if (!password) {
      pushToast("请先填写密码");
      return;
    }
    if (password.length < AUTH_PASSWORD_MIN) {
      pushToast(`密码至少 ${AUTH_PASSWORD_MIN} 位`);
      return;
    }
    if (modeName === "register" && !confirmPassword) {
      pushToast("请先填写确认密码");
      return;
    }
    if (modeName === "register" && password !== confirmPassword) {
      pushToast("两次密码输入不一致");
      return;
    }
    if (modeName === "register" && nickname && (nickname.length < 2 || nickname.length > 20)) {
      pushToast("昵称长度需 2-20 字符");
      return;
    }
    if (authSubmitting || authSubmitFingerprint === fingerprint) {
      pushToast("正在处理中，请勿重复提交");
      return;
    }

    const url = modeName === "register" ? "/api/v1/auth/register" : "/api/v1/auth/login";
    const body =
      modeName === "register"
        ? {
            account: identityResult.value,
            password,
            nickname,
          }
        : {
            account: identityResult.value,
            password,
          };

    setAuthSubmitting(true);
    setAuthSubmitFingerprint(fingerprint);
    try {
      const raw = await fetch(`${API_BASE}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await parseJson(raw);
      if (!raw.ok || !payload?.ok) {
        throw new Error(toApiError(payload));
      }

      localStorage.setItem("accessToken", payload.data.accessToken);
      localStorage.setItem("refreshToken", payload.data.refreshToken);
      setAuthForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
      await loadMe();
      pushToast(modeName === "register" ? "注册并登录成功" : "登录成功");
      if (pendingAction) {
        pushToast(pendingAction);
      }
      setPendingAction("");
      setView("home");
    } catch (err) {
      showError(modeName === "register" ? "注册失败" : "登录失败", err);
    } finally {
      setAuthSubmitting(false);
      setAuthSubmitFingerprint("");
    }
  }

  async function logout() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        await apiRequest("/api/v1/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      } catch (_err) {
        // ignore
      }
    }

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setMe(null);
    setDetailEvent(null);
    setDetailNews(null);
    setDetailPost(null);
    pushToast("已退出登录");
    setView("profile");
  }

  async function seedDemoContent() {
    if (!me || !isAdminRole(me.role)) {
      pushToast("请先登录管理员账号");
      return;
    }

    try {
      const payload = await apiRequest("/api/v1/admin/seed-demo", {
        method: "POST",
      });
      pushToast(
        `演示数据就绪（活动 ${payload.data.totals.events} · 资讯 ${payload.data.totals.news} · 帖子 ${payload.data.totals.posts}）`
      );
      await loadHomeData(1);
      await loadAdminData("events", 1);
      await loadAdminData("news", 1);
      await loadAdminData("posts", 1);
    } catch (err) {
      showError("演示数据初始化失败", err);
    }
  }

  function goProfilePanel(panel) {
    setProfilePanel(panel);
    if (!me?.id) return;
    if (panel === "posts") {
      loadProfilePosts(1);
      return;
    }
    if (panel === "registrations") {
      loadProfileRegistrations(1);
      return;
    }
    loadProfileFavorites(1, profileFavType);
  }

  function clearAdminForms() {
    setAdminEventForm({
      editingId: null,
      title: "",
      summary: "",
      start_time: "",
      end_time: "",
      location_name: "",
      capacity: "",
      fee_type: "free",
      signup_type: "manual",
      status: "draft",
      lat: "",
      lng: "",
    });

    setAdminNewsForm({
      editingId: null,
      title: "",
      body: "",
      category: "general",
      tags: "",
      status: "draft",
    });
  }

  function toggleAdminEventSelection(eventId, checked) {
    const targetId = Number(eventId);
    if (!Number.isFinite(targetId)) {
      return;
    }
    setAdminSelectedEvents((prev) => {
      if (checked) {
        return prev.includes(targetId) ? prev : [...prev, targetId];
      }
      return prev.filter((id) => id !== targetId);
    });
  }

  function toggleAdminSelectAllEvents() {
    const currentIds = adminData.events.rows
      .map((item) => Number(item.id))
      .filter((id) => Number.isFinite(id));
    setAdminSelectedEvents((prev) => {
      const allSelected =
        currentIds.length > 0 && currentIds.every((id) => prev.includes(id));
      if (allSelected) {
        return [];
      }
      return currentIds;
    });
  }

  async function batchUpdateAdminEvents(status) {
    if (!adminSelectedEvents.length) {
      pushToast("请先选择活动");
      return;
    }
    if (!window.confirm(`确认将 ${adminSelectedEvents.length} 个活动设为 ${statusLabel("event", status)}？`)) {
      return;
    }
    try {
      await apiRequest("/api/v1/admin/events/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids: adminSelectedEvents,
          status,
        }),
      });
      await loadAdminData("events", adminData.events.page);
      setAdminSelectedEvents([]);
      pushToast(`已执行批量${statusLabel("event", status)}`);
    } catch (err) {
      showError("批量操作失败", err);
    }
  }

  async function loadEventDetail(id) {
    setDetailLoadingType("event");
    setDetailLoadError("");
    setDetailEvent(null);
    setDetailNews(null);
    setDetailPost(null);
    setPostComments([]);
    setRelatedNews([]);
    try {
      const payload = await apiRequest(`/api/v1/events/${id}`);
      setDetailEvent(payload.data || null);
    } catch (err) {
      setDetailLoadError("活动详情加载失败");
      throw err;
    }
  }

  async function loadNewsDetail(id) {
    setDetailLoadingType("news");
    setDetailLoadError("");
    setDetailNews(null);
    setRelatedNews([]);
    try {
      const payload = await apiRequest(`/api/v1/news/${id}`);
      const data = payload.data || null;
      setDetailNews(data);

      if (data?.id) {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "5",
          sort: "latest",
        });
        if (data.category && data.category !== "all") {
          params.set("category", data.category);
        }

        try {
          const relatedPayload = await apiRequest(`/api/v1/news?${params.toString()}`);
          const rows = Array.isArray(relatedPayload.data) ? relatedPayload.data : [];
          setRelatedNews(rows.filter((item) => item?.id !== data.id).slice(0, 4));
        } catch (_err) {
          setRelatedNews([]);
        }
      } else {
        setRelatedNews([]);
      }
    } catch (err) {
      setDetailLoadError("资讯详情加载失败");
      throw err;
    }
  }

  async function loadPostDetail(id) {
    setDetailLoadingType("post");
    setDetailLoadError("");
    setDetailPost(null);
    setPostComments([]);
    try {
      const payload = await apiRequest(`/api/v1/posts/${id}`);
      const data = payload.data || {};
      setDetailPost(data);
      setPostComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (err) {
      setDetailLoadError("帖子详情加载失败");
      throw err;
    }
  }

  function closeAllDetails() {
    setDetailLoadingType("");
    setDetailLoadError("");
    setDetailEvent(null);
    setDetailNews(null);
    setDetailPost(null);
    setPostComments([]);
    setCommentDraft("");
    setRelatedNews([]);
  }

  async function openPostById(id) {
    const nextId = Number.parseInt(id, 10);
    if (!Number.isInteger(nextId) || nextId <= 0) {
      showError("帖子详情", new Error("无效帖子 ID"));
      return;
    }

    closeAllDetails();
    loadPostDetail(nextId).catch((err) => {
      showError("帖子详情加载失败", err);
    });
  }

  async function registerEvent(eventItem) {
    if (!requireLogin("请先登录后报名")) {
      return;
    }

    const state = signupState(eventItem, me);
    if (state.disabled) {
      return;
    }

    try {
      if (state.action === "cancel") {
        await apiRequest(`/api/v1/events/${eventItem.id}/register`, { method: "DELETE" });
        pushToast("已取消报名");
      } else if (state.action === "join") {
        await apiRequest(`/api/v1/events/${eventItem.id}/register`, { method: "POST" });
        pushToast("报名成功");
      } else if (state.action === "invite") {
        const place = eventItem.location_name || "AI CLUB 活动点";
        const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(place)}`;
        window.open(mapUrl, "_blank");
        pushToast("已打开外部活动链接入口（按活动要求完成报名）");
      } else if (state.action === "login") {
        setView("profile");
      }

      await loadHomeData(events.page);
      await loadProfileRegistrations(1);
      if (detailEvent?.id === eventItem.id) {
        await loadEventDetail(eventItem.id);
      }
    } catch (err) {
      showError("操作失败", err);
    }
  }

  async function openEventFromHome(item) {
    const id = Number.parseInt(item?.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      showError("活动详情", new Error("无效活动 ID"));
      return;
    }

    closeAllDetails();
    loadEventDetail(id).catch((err) => {
      showError("活动详情打开失败", err);
    });
  }

  async function openNewsFromHome(item) {
    const id = Number.parseInt(item?.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      showError("资讯详情", new Error("无效资讯 ID"));
      return;
    }

    closeAllDetails();
    loadNewsDetail(id).catch((err) => {
      showError("资讯详情打开失败", err);
    });
  }

  async function likePost() {
    if (!detailPost || !requireLogin("登录后可点赞")) {
      return;
    }

    try {
      const payload = await apiRequest(`/api/v1/posts/${detailPost.id}/like`, {
        method: "POST",
      });
      const data = payload.data || {};
      setDetailPost((prev) =>
        prev
          ? {
              ...prev,
              is_liked: data.liked,
              like_count: data.like_count,
            }
          : prev
      );
      const newRows = posts.rows.map((row) =>
        row.id === detailPost.id
          ? {
              ...row,
              like_count: data.like_count,
            }
          : row
      );
      setPosts((prev) => ({ ...prev, rows: newRows }));
    } catch (err) {
      showError("点赞失败", err);
    }
  }

  async function toggleFavorite(targetType, targetId) {
    const safeType = normalizeFavoriteTargetType(targetType);
    const safeId = Number.parseInt(targetId, 10);
    if (!safeType || !safeId || !Number.isInteger(safeId) || safeId <= 0) {
      return;
    }
    if (!requireLogin("登录后可收藏")) {
      return;
    }
    const actionKey = favoriteActionKey(safeType, safeId);
    if (!actionKey) {
      return;
    }

    setFavoriteActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const payload = await apiRequest(`/api/v1/favorites/${safeType}/${safeId}/toggle`, {
        method: "POST",
      });
      const data = payload.data || {};
      const next = {
        is_favorited: !!data.favorited,
        favorite_count: data.favorite_count || 0,
      };

      if (safeType === "post") {
        setDetailPost((prev) => (prev?.id === safeId ? { ...prev, ...next } : prev));
        setPosts((prev) => ({
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === safeId ? { ...row, ...next } : row
          ),
        }));
      }
      if (safeType === "event") {
        setDetailEvent((prev) => (prev?.id === safeId ? { ...prev, ...next } : prev));
        setEvents((prev) => ({
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === safeId ? { ...row, ...next } : row
          ),
        }));
        setProfileFavorites((prev) => ({
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === safeId ? { ...row, ...next } : row
          ),
        }));
      }
      if (safeType === "news") {
        setDetailNews((prev) => (prev?.id === safeId ? { ...prev, ...next } : prev));
        setNews((prev) => ({
          ...prev,
          rows: prev.rows.map((row) =>
            row.id === safeId ? { ...row, ...next } : row
          ),
        }));
      }

      pushToast(next.is_favorited ? "收藏成功" : "已取消收藏");
    } catch (err) {
      showError("收藏失败", err);
    } finally {
      setFavoriteActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  }

  async function favoritePost() {
    if (!detailPost?.id) {
      return;
    }
    return toggleFavorite("post", detailPost.id);
  }

  async function favoriteEvent() {
    if (!detailEvent?.id) {
      return;
    }
    return toggleFavorite("event", detailEvent.id);
  }

  async function favoriteNews() {
    if (!detailNews?.id) {
      return;
    }
    return toggleFavorite("news", detailNews.id);
  }

  async function commentPost() {
    if (!detailPost || !requireLogin("登录后可评论")) {
      return;
    }
    const text = commentDraft.trim();
    const fingerprint = `${detailPost.id}:${text}`;
    if (!text || text.length < COMMENT_BODY_MIN) {
      pushToast("评论至少 2 字符");
      return;
    }
    if (text.length > COMMENT_BODY_MAX) {
      pushToast(`评论不能超过 ${COMMENT_BODY_MAX} 字`);
      return;
    }
    if (commentSubmitting || commentSubmitFingerprint === fingerprint) {
      pushToast("评论提交中，请勿重复提交");
      return;
    }

    const optimisticId = `temp_comment_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const optimisticComment = {
      id: optimisticId,
      body: text,
      author_nickname: me?.nickname || "我",
      created_at: new Date().toISOString(),
      status: "approved",
      isOptimistic: true,
    };
    setPostComments((prev) => [optimisticComment, ...prev].slice(0, 20));
    setCommentDraft("");
    setCommentSubmitFingerprint(fingerprint);

    setCommentSubmitting(true);
    try {
      const payload = await apiRequest(`/api/v1/posts/${detailPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      if (payload?.data) {
        const commentItem = payload.data;
        const withAuthor = {
          ...commentItem,
          author_nickname: me?.nickname || "我",
          isOptimistic: false,
        };
        setPostComments((prev) =>
          prev.map((item) => (item.id === optimisticId ? withAuthor : item))
        );
      } else {
        setPostComments((prev) => prev.filter((item) => item.id !== optimisticId));
      }
      pushToast("评论已发布");
      try {
        await loadPostDetail(detailPost.id);
        await loadPosts(posts.page);
      } catch (err) {
        showError("评论详情刷新", err);
      }
    } catch (err) {
      showError("评论发布失败", err);
      setPostComments((prev) => prev.filter((item) => item.id !== optimisticId));
      setCommentDraft(text);
    } finally {
      setCommentSubmitting(false);
      setCommentSubmitFingerprint("");
    }
  }

  async function reportContent(targetType, targetId) {
    const safeType = normalizeReportTargetType(targetType);
    const safeId = Number.parseInt(targetId, 10);
    if (!safeType || !safeId || !Number.isInteger(safeId) || safeId <= 0) {
      return;
    }
    if (!requireLogin("登录后可举报")) {
      return;
    }

    const reason = window.prompt(`请输入举报 ${DETAIL_TARGET_LABEL[safeType] || "内容"} 的原因（2-200 字）`);
    if (reason === null) {
      return;
    }
    const safeReason = String(reason).trim();
    if (safeReason.length < 2 || safeReason.length > 200) {
      pushToast("举报原因需 2-200 字");
      return;
    }

    try {
      await apiRequest("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({
          target_type: safeType,
          target_id: safeId,
          reason: safeReason,
        }),
      });
      pushToast("已提交举报，请耐心等待处理");
    } catch (err) {
      showError("举报提交失败", err);
    }
  }

  async function reportPost() {
    if (!detailPost?.id) {
      return;
    }
    return reportContent("post", detailPost.id);
  }

  async function reportNews() {
    if (!detailNews?.id) {
      return;
    }
    return reportContent("news", detailNews.id);
  }

  async function reportEvent() {
    if (!detailEvent?.id) {
      return;
    }
    return reportContent("event", detailEvent.id);
  }

  async function publishPost() {
    if (!requireLogin("登录后可发布")) {
      return;
    }

    const title = publishForm.title.trim();
    const body = publishForm.body.trim();
    const tags = normalizeTagInput(publishForm.tags);
    const fingerprint = `${title}|${body}|${tags}`;

    if (title.length < POST_TITLE_MIN || title.length > POST_TITLE_MAX) {
      pushToast(`标题长度需 ${POST_TITLE_MIN}-${POST_TITLE_MAX}`);
      return;
    }
    if (body.length < POST_BODY_MIN || body.length > POST_BODY_MAX) {
      pushToast(`内容长度需 ${POST_BODY_MIN}-${POST_BODY_MAX}`);
      return;
    }
    if (publishSubmitting || publishSubmitFingerprint === fingerprint) {
      pushToast("发布请求处理中，请勿重复提交");
      return;
    }

    setPublishSubmitting(true);
    setPublishSubmitFingerprint(fingerprint);
    try {
      await apiRequest("/api/v1/posts", {
        method: "POST",
        body: JSON.stringify({ title, body, tags }),
      });
      setPublishForm({ title: "", body: "", tags: "" });
      localStorage.removeItem(PUBLISH_DRAFT_KEY);
      pushToast("发布成功，等待审核");
      await loadPosts(1);
      setView("home");
      setHomeTab("posts");
    } catch (err) {
      showError("发布失败", err);
    } finally {
      setPublishSubmitting(false);
      setPublishSubmitFingerprint("");
    }
  }

  async function saveProfile() {
    if (!me) {
      return;
    }

    const nickname = userProfileForm.nickname.trim();
    const avatar_url = userProfileForm.avatar_url.trim();

    if (nickname && (nickname.length < 2 || nickname.length > 20)) {
      pushToast("昵称长度需 2-20");
      return;
    }

    try {
      const payload = await apiRequest("/api/v1/user/me", {
        method: "PATCH",
        body: JSON.stringify({
          nickname,
          avatar_url,
        }),
      });
      setMe(payload.data);
      pushToast("资料已更新");
    } catch (err) {
      showError("资料更新失败", err);
    }
  }

  async function saveAdminEvent() {
    const payload = {
      title: adminEventForm.title.trim(),
      summary: adminEventForm.summary.trim(),
      start_time: adminEventForm.start_time,
      end_time: adminEventForm.end_time,
      location_name: adminEventForm.location_name.trim(),
      capacity: Number(adminEventForm.capacity || 0),
      fee_type: adminEventForm.fee_type,
      signup_type: adminEventForm.signup_type,
      status: adminEventForm.status,
      lat: adminEventForm.lat === "" ? null : Number(adminEventForm.lat),
      lng: adminEventForm.lng === "" ? null : Number(adminEventForm.lng),
    };

    if (!payload.title || payload.title.length < 2 || payload.title.length > 60) {
      pushToast("活动标题需 2-60 字");
      return;
    }
    if (!payload.start_time || !payload.end_time || !payload.location_name) {
      pushToast("请完整填写活动必填项");
      return;
    }

    const start = Date.parse(payload.start_time);
    const end = Date.parse(payload.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      pushToast("活动时间非法");
      return;
    }
    if (start < Date.now()) {
      pushToast("活动开始时间不能早于当前");
      return;
    }
    if (Number.isFinite(payload.capacity) && payload.capacity < 0) {
      pushToast("活动容量不能为负数");
      return;
    }

    if (payload.lat !== null && (!Number.isFinite(payload.lat) || !Number.isFinite(Number(adminEventForm.lng)))) {
      pushToast("经纬度输入有误");
      return;
    }

    try {
      setLoadingAdminForm(true);
      const body = {
        title: payload.title,
        summary: payload.summary,
        start_time: payload.start_time,
        end_time: payload.end_time,
        location_name: payload.location_name,
        capacity: payload.capacity,
        fee_type: payload.fee_type,
        signup_type: payload.signup_type,
        status: payload.status,
      };
      if (payload.lat !== null && payload.lng !== null) {
        body.lat = payload.lat;
        body.lng = payload.lng;
      }

      if (adminEventForm.editingId) {
        await apiRequest(`/api/v1/admin/events/${adminEventForm.editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        pushToast("活动已更新");
      } else {
        await apiRequest("/api/v1/admin/events", {
          method: "POST",
          body: JSON.stringify(body),
        });
        pushToast("活动已创建");
      }
      clearAdminForms();
      await loadAdminData("events", adminData.events.page);
    } catch (err) {
      showError("活动保存失败", err);
    } finally {
      setLoadingAdminForm(false);
    }
  }

  function fillAdminEventForm(row) {
    const signupType =
      row.signup_type === "invite" ? "link" : row.signup_type || "manual";

    setAdminEventForm({
      editingId: row.id,
      title: row.title || "",
      summary: row.summary || "",
      start_time: row.start_time ? String(row.start_time).replace(" ", "T").slice(0, 16) : "",
      end_time: row.end_time ? String(row.end_time).replace(" ", "T").slice(0, 16) : "",
      location_name: row.location_name || "",
      capacity: row.capacity != null ? String(row.capacity) : "",
      fee_type: row.fee_type || "free",
      signup_type: signupType,
      status: row.status || "draft",
      lat: row.lat != null ? String(row.lat) : "",
      lng: row.lng != null ? String(row.lng) : "",
    });
    setAdminTab("events");
    setView("admin");
  }

  async function changeEventStatus(id, status) {
    if (!window.confirm(`确认将该活动设为 ${statusLabel("event", status)}？`)) {
      return;
    }

    try {
      await apiRequest(`/api/v1/admin/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAdminData("events", adminData.events.page);
    } catch (err) {
      showError("操作失败", err);
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm("确认删除该活动？")) {
      return;
    }

    try {
      await apiRequest(`/api/v1/admin/events/${id}`, { method: "DELETE" });
      await loadAdminData("events", adminData.events.page);
      pushToast("活动已删除");
    } catch (err) {
      showError("删除失败", err);
    }
  }

  async function saveAdminNews() {
    const title = adminNewsForm.title.trim();
    const body = adminNewsForm.body.trim();
    if (!title || title.length < 2 || title.length > 60) {
      pushToast("资讯标题至少 2 字，最多 60 字");
      return;
    }
    if (body.length > 20000) {
      pushToast("资讯内容最多 20000 字");
      return;
    }

    try {
      const bodyPayload = {
        title,
        body,
        category: adminNewsForm.category || "general",
        tags: adminNewsForm.tags || "",
        status: adminNewsForm.status || "draft",
      };

      if (adminNewsForm.editingId) {
        await apiRequest(`/api/v1/admin/news/${adminNewsForm.editingId}`, {
          method: "PATCH",
          body: JSON.stringify(bodyPayload),
        });
        pushToast("资讯已更新");
      } else {
        await apiRequest("/api/v1/admin/news", {
          method: "POST",
          body: JSON.stringify(bodyPayload),
        });
        pushToast("资讯已发布");
      }
      clearAdminForms();
      await loadAdminData("news", adminData.news.page);
    } catch (err) {
      showError("资讯保存失败", err);
    }
  }

  function fillAdminNewsForm(row) {
    setAdminNewsForm({
      editingId: row.id,
      title: row.title || "",
      body: row.body || "",
      category: row.category || "general",
      tags: row.tags || "",
      status: row.status || "draft",
    });
    setView("admin");
    setAdminTab("news");
  }

  async function reviewPost(id, status) {
    try {
      if (!window.confirm(`确认将该帖子设为 ${statusLabel("post", status)}？`)) {
        return;
      }
      await apiRequest(`/api/v1/admin/posts/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await loadAdminData("posts", adminData.posts.page);
      pushToast("帖子状态更新成功");
    } catch (err) {
      showError("审核失败", err);
    }
  }

  async function reviewReport(id, status) {
    if (!window.confirm(`确认将该举报标记为 ${status === "resolved" ? "已处理" : "已驳回"}？`)) {
      return;
    }

    try {
      await apiRequest(`/api/v1/admin/reports/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await loadAdminData("reports", adminReportsData.page || 1);
      pushToast("举报处理成功");
    } catch (err) {
      showError("举报处理失败", err);
    }
  }

  async function openReportedTarget(item) {
    const safeType = normalizeReportTargetType(item?.target_type);
    const safeId = Number.parseInt(item?.target_id, 10);
    if (!safeType || !Number.isInteger(safeId) || safeId <= 0) {
      pushToast("举报目标信息不完整");
      return;
    }

    if (safeType === "post") {
      await openPostById(safeId);
      return;
    }
    if (safeType === "news") {
      await openNewsFromHome({ id: safeId });
      return;
    }
    if (safeType === "event") {
      await openEventFromHome({ id: safeId });
      return;
    }
    if (safeType === "comment") {
      pushToast("评论暂不支持直接进入详情页，可前往对应帖子查看");
      return;
    }
    pushToast("不支持的举报目标类型");
  }

  async function changeUserStatus(id, status) {
    if (!window.confirm(`确认将该用户设为 ${statusLabel("user", status)}？`)) {
      return;
    }

    setAdminRoleLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await apiRequest(`/api/v1/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadAdminData("users", adminData.users.page);
      pushToast("用户状态更新成功");
    } catch (err) {
      showError("用户状态变更失败", err);
    } finally {
      setAdminRoleLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function changeUserRole(id, role) {
    if (!window.confirm(`确认将该用户设置为 ${role === "owner" ? "Owner" : role === "admin" ? "管理员" : "普通用户"}？`)) {
      return;
    }

    setAdminRoleLoading((prev) => ({ ...prev, [`${id}:role`]: true }));
    try {
      await apiRequest(`/api/v1/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await loadAdminData("users", adminData.users.page);
      pushToast("角色更新成功");
    } catch (err) {
      showError("角色更新失败", err);
    } finally {
      setAdminRoleLoading((prev) => ({ ...prev, [`${id}:role`]: false }));
    }
  }

  function copyShare(item) {
    const type = item?.target_type || item?._shareType || "post";
    const title = toTextForShare(type, item?.title || item?.summary);
    const id = String(item?.id || "");
    const url = `${location.origin}${location.pathname}?view=${type}-${id}`;
    const text = `${title}\n${url}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => pushToast("链接已复制"))
        .catch(() => {
          pushToast("复制失败，请手动复制");
        });
      return;
    }

    pushToast("当前环境不支持一键复制");
  }

  async function ensureProfileAfterLogin() {
    if (view === "profile") {
      if (profilePanel === "posts") {
        await loadProfilePosts(1);
      } else if (profilePanel === "registrations") {
        await loadProfileRegistrations(1);
      } else {
        await loadProfileFavorites(1, profileFavType);
      }
    }
  }

  async function applySharedView(raw) {
    const safeRaw = String(raw || "").trim();
    if (!safeRaw) {
      return;
    }

    let decoded = safeRaw;
    try {
      decoded = decodeURIComponent(safeRaw);
    } catch (_err) {
      decoded = safeRaw;
    }

    const [rawType = "", rawId = ""] = decoded.split("-");
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      pushToast("分享链接参数无效");
      return;
    }

    const type = String(rawType).toLowerCase();
    if (type === "event") {
      await openEventFromHome({ id });
      return;
    }
    if (type === "news") {
      await openNewsFromHome({ id });
      return;
    }
    if (type === "post") {
      await openPostById(id);
      return;
    }
    if (type === "detail") {
      await openPostById(id);
      return;
    }

    pushToast("分享类型不支持");
  }

  function changeView(next) {
    if (["events", "news", "posts"].includes(next)) {
      setHomeTab(next);
      setView("home");
      loadHomeData(1);
      return;
    }

    setView(next);
    if (next === "profile" && !me) {
      setPendingAction("请先登录");
    }
    if (next === "profile" && me) {
      ensureProfileAfterLogin();
    }
    if (next === "admin" && me && isAdminRole(me.role)) {
      loadAdminData(adminTab, 1);
    }
    if (next === "home") {
      loadHomeData(1);
    }
  }

  useEffect(() => {
    (async () => {
      await loadMe();
      const shared = new URLSearchParams(window.location.search).get("view");
      if (shared) {
        await applySharedView(shared);
      }
      setAppReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!appReady || view !== "home") {
      return;
    }

    if (homeTab === "events") {
      loadEvents(1);
      return;
    }
    if (homeTab === "news") {
      loadNews(1);
      return;
    }
    loadPosts(1);
  }, [appReady, view, homeTab]);

  useEffect(() => {
    if (!appReady || view !== "profile" || !me) {
      return;
    }

    if (profilePanel === "posts") {
      loadProfilePosts(1);
      return;
    }
    if (profilePanel === "registrations") {
      loadProfileRegistrations(1);
      return;
    }
    loadProfileFavorites(1, profileFavType);
  }, [appReady, view, me?.id, profilePanel, profileFavType]);

  useEffect(() => {
    if (!appReady || view !== "admin" || !me || !isAdminRole(me.role)) {
      return;
    }
    loadAdminData(adminTab, 1);
  }, [appReady, view, me?.id, adminTab]);

  const bottomItems = [
    { key: "events", label: "活动", emoji: "🎉" },
    { key: "news", label: "资讯", emoji: "📰" },
    { key: "posts", label: "交流", emoji: "💬" },
    { key: "profile", label: "我的", emoji: "👤" },
  ];
  const activeBottomTab =
    view === "home"
      ? homeTab
      : view === "profile" || view === "admin" || view === "publish"
      ? "profile"
      : view;

  if (!appReady) {
    return (
      <main className="app-shell">
        <section className="panel">
          <p>加载中...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {view === "home" && (
        <>
          <section className="hero">
            <p className="home-kicker">AI City Circle</p>
            <h1>AI 城市社区 HUB</h1>
            <p>活动速览 · 资讯速递 · 交流共创</p>
            <p className="hero-slogan">
              本地化发现 + 可信内容审核 + 社区互动一体化
            </p>
          </section>

          <section className="panel compact">
            {homeTab === "events" && (
              <>
                {events.loading && <p className="muted">加载中...</p>}
                {!!homeLoadError.events && <p className="error-text">{homeLoadError.events}</p>}
                {!events.loading && events.rows.length === 0 && (
                  <p className="muted">先去发布一条你身边的 AI 活动吧</p>
                )}
                <section className="mini-list">
                  {events.rows.map((item) => {
                    const state = signupState(item, me);
                    return (
                      <article
                        className="card clickable-card"
                        key={item.id}
                        onClick={() => openEventFromHome(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openEventFromHome(item);
                          }
                        }}
                      >
                        <div className="card-head">
                          <strong className="card-title">{item.title}</strong>
                          <span className="pill">{statusLabel("event", item.status)}</span>
                        </div>
                        <p className="content-summary">{item.summary || "暂无简介"}</p>
                        <div className="meta-row compact-meta">
                          <span className="meta-item">
                            <span className="meta-icon">🕒</span>
                            {toDateTime(item.start_time)}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">📍</span>
                            {shortMetaText(item.location_name, 13)}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">👥</span>
                            {item.reg_count || 0}/{item.capacity > 0 ? item.capacity : "∞"}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">🚀</span>
                            {signupTypeLabel(item.signup_type)} · {feeTypeLabel(item.fee_type)}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">📡</span>
                            {formatDistance(item.distance_km || null) || "—"}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">💙</span>
                            {item.favorite_count || 0}
                          </span>
                        </div>
                        {state.action !== "login" ? (
                          <div className="row-actions">
                            <button onClick={(event) => {
                              event.stopPropagation();
                              registerEvent(item);
                            }} disabled={state.disabled}>
                              {state.label}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
                <Pager
                  meta={events.meta}
                  page={events.page}
                  onPrev={() => loadEvents(Math.max(1, events.page - 1))}
                  onNext={() => loadEvents(events.page + 1)}
                />
              </>
            )}

            {homeTab === "news" && (
              <>
                {news.loading && <p className="muted">加载中...</p>}
                {!!homeLoadError.news && <p className="error-text">{homeLoadError.news}</p>}
                {!news.loading && news.rows.length === 0 && (
                  <p className="muted">暂无资讯，先去发布一条你身边的 AI 资讯</p>
                )}
                <section className="mini-list">
                  {news.rows.map((item) => (
                    <article
                      className="card clickable-card"
                      key={item.id}
                      onClick={() => openNewsFromHome(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openNewsFromHome(item);
                        }
                      }}
                    >
                      <div className="card-head">
                        <strong className="card-title">{item.title}</strong>
                        <span className="pill">{statusLabel("news", item.status)}</span>
                      </div>
                      <p className="content-summary">{normalizeText(item.body, 90)}</p>
                        <div className="meta-row compact-meta">
                          <span className="meta-item">
                            <span className="meta-icon">🏷️</span>
                            {item.category || "未分类"}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">💙</span>
                            {item.favorite_count || 0}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">🔥</span>
                            {item.read_count || 0}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">🕒</span>
                            {toDateTime(item.published_at || item.created_at)}
                          </span>
                          <span className="meta-item">
                          <span className="meta-icon">🧩</span>
                          <span className="meta-subtle">{shortMetaText(item.tags, 10)}</span>
                        </span>
                        </div>
                    </article>
                  ))}
                </section>
                <Pager
                  meta={news.meta}
                  page={news.page}
                  onPrev={() => loadNews(Math.max(1, news.page - 1))}
                  onNext={() => loadNews(news.page + 1)}
                />
              </>
            )}

            {homeTab === "posts" && (
              <>
                {posts.loading && <p className="muted">加载中...</p>}
                {!!homeLoadError.posts && <p className="error-text">{homeLoadError.posts}</p>}
                {!posts.loading && posts.rows.length === 0 && (
                  <p className="muted">先发布第一条帖子吧</p>
                )}
                <section className="mini-list">
                  {posts.rows.map((item) => {
                    const preview = previewText(item.body, POST_PREVIEW_LENGTH);
                    return (
                      <article
                        className="card clickable-card"
                        key={item.id}
                        onClick={() => openPostById(item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openPostById(item.id);
                          }
                        }}
                    >
                      <div className="card-head">
                        <strong className="card-title">{item.title}</strong>
                        <span className="pill">{statusLabel("post", item.status)}</span>
                      </div>
                        <p className="content-summary">{preview.text}</p>
                        <div className="meta-row compact-meta">
                          <span className="meta-item">
                            <span className="meta-icon">🏷️</span>
                            {shortMetaText(item.tags || "无", 14)}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">👤</span>
                            {item.author_nickname || "匿名"}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">💬</span>
                            {item.reply_count || 0}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">⭐</span>
                            {item.like_count || 0}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">💙</span>
                            {item.favorite_count || 0}
                          </span>
                          <span className="meta-item">
                            <span className="meta-icon">🕒</span>
                            {toDateTime(item.created_at)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </section>
                <Pager
                  meta={posts.meta}
                  page={posts.page}
                  onPrev={() => loadPosts(Math.max(1, posts.page - 1))}
                  onNext={() => loadPosts(posts.page + 1)}
                />
              </>
            )}
          </section>
        </>
      )}

      {view === "publish" && (
        <section className="panel">
          <h3>发布内容</h3>
          <p className="muted">按规则支持标题/正文/标签（待审核后展示）</p>
          <p className="muted">
            {`标题 ${publishForm.title.length}/${POST_TITLE_MAX} · 正文 ${publishForm.body.length}/${POST_BODY_MAX} · 标签 ${
              normalizeTagItems(publishForm.tags).length ? `${normalizeTagItems(publishForm.tags).length} 项` : "0 项"
            }`}
          </p>
          <input
            value={publishForm.title}
            onChange={(event) =>
              setPublishForm((prev) => ({ ...prev, title: event.target.value.slice(0, POST_TITLE_MAX) }))
            }
            placeholder="标题（2-60 字）"
            maxLength={POST_TITLE_MAX}
          />
          <textarea
            rows={7}
            value={publishForm.body}
            onChange={(event) =>
              setPublishForm((prev) => ({ ...prev, body: event.target.value.slice(0, POST_BODY_MAX) }))
            }
            placeholder="正文（10-5000 字）"
            maxLength={POST_BODY_MAX}
          />
          <input
            value={publishForm.tags}
            onChange={(event) =>
              setPublishForm((prev) => ({ ...prev, tags: event.target.value }))
            }
            placeholder="标签，多个用逗号分隔"
          />
          <div className="row-actions">
            <button onClick={publishPost} disabled={publishSubmitting}>
              {publishSubmitting ? "发布中..." : "发布帖子"}
            </button>
            <button className="ghost-btn" onClick={() => setView("home")}>
              先不发
            </button>
          </div>
          <p className="muted">草稿已自动保存，图片上传后续版本接入</p>
        </section>
      )}

      {view === "profile" && (
        <section className="panel">
          {!me && (
            <div className="auth">
              <div className="segment-nav">
                <button
                  className={`segment-chip ${authMode === "login" ? "active" : ""}`}
                  onClick={() => setAuthModeSafe("login")}
                >
                  登录
                </button>
                <button
                  className={`segment-chip ${authMode === "register" ? "active" : ""}`}
                  onClick={() => setAuthModeSafe("register")}
                >
                  注册
                </button>
              </div>
              <input
                value={authForm.account}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, account: event.target.value }))
                }
                placeholder="账号（邮箱 / 手机）"
              />
              <input
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((prev) => ({ ...prev, password: event.target.value }))
                }
                type="password"
                placeholder="密码（6 位以上）"
              />
              {authMode === "register" ? (
                <>
                  <input
                    value={authForm.confirmPassword}
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    type="password"
                    placeholder="确认密码"
                  />
                  <input
                    value={authForm.nickname}
                    onChange={(event) =>
                      setAuthForm((prev) => ({ ...prev, nickname: event.target.value }))
                    }
                    placeholder="昵称（选填，用于注册）"
                  />
                </>
              ) : null}
              <div className="card">
                <p className="muted text-gap-sm">演示账号（本地）</p>
                <section className="mini-list compact-meta">
                  {DEMO_CREDENTIALS.map((item) => (
                    <article className="card" key={item.account}>
                      <div className="card-head">
                        <strong>{item.desc}</strong>
                        <span className="pill">{item.role}</span>
                      </div>
                      <p className="meta-row">
                        <span className="meta-item">
                          <span className="meta-icon">📮</span>
                          {item.account}
                        </span>
                        <span className="meta-item">
                          <span className="meta-icon">🔑</span>
                          {item.password}
                        </span>
                      </p>
                        <div className="row-actions">
                          <button
                            className="ghost-btn"
                            onClick={() =>
                              setAuthForm((prev) => ({
                                ...prev,
                                account: item.account,
                                password: "",
                                confirmPassword: "",
                                nickname: item.role === "user" ? "用户演示" : "",
                              }))
                            }
                          >
                            一键填入
                          </button>
                      </div>
                    </article>
                  ))}
                </section>
                <p className="muted">登录与注册均为「邮箱/手机号 + 密码」，当前不需要验证码。</p>
                <div className="row-actions">
                  <button onClick={() => submitAuth(authMode)} disabled={authSubmitting}>
                    {authSubmitting
                      ? "处理中..."
                      : authMode === "register"
                      ? "注册并登录"
                      : "登录"}
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      setAuthForm({
                        account: "",
                        password: "",
                        confirmPassword: "",
                        nickname: "",
                      });
                    }}
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>
          )}

          {me && (
            <>
              <div className="profile-head">
                <div>
                  <strong>{me.nickname || "未设置昵称"}</strong>
                  <p className="muted">身份：{me.role || "user"}</p>
                </div>
                <button onClick={logout}>退出登录</button>
              </div>

              <div className="segment-nav">
                <button
                  className={`segment-chip ${profilePanel === "posts" ? "active" : ""}`}
                  onClick={() => goProfilePanel("posts")}
                >
                  我发布的帖子
                </button>
                <button
                  className={`segment-chip ${profilePanel === "registrations" ? "active" : ""}`}
                  onClick={() => goProfilePanel("registrations")}
                >
                  我报名的活动
                </button>
                <button
                  className={`segment-chip ${profilePanel === "favorites" ? "active" : ""}`}
                  onClick={() => goProfilePanel("favorites")}
                >
                  我的收藏
                </button>
              </div>

              <section className="panel compact">
                <h4>编辑资料</h4>
                <input
                  value={userProfileForm.nickname}
                  onChange={(event) =>
                    setUserProfileForm((prev) => ({ ...prev, nickname: event.target.value }))
                  }
                  placeholder="昵称（2-20）"
                />
                <input
                  value={userProfileForm.avatar_url}
                  onChange={(event) =>
                    setUserProfileForm((prev) => ({ ...prev, avatar_url: event.target.value }))
                  }
                  placeholder="头像地址（可选）"
                />
                <div className="row-actions">
                  <button onClick={saveProfile}>保存资料</button>
                </div>
              </section>

              {profilePanel === "posts" && (
                <>
                  {profilePosts.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {profilePosts.rows.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-head">
                          <strong className="card-title">{item.title}</strong>
                          <span className="pill">{statusLabel("post", item.status)}</span>
                        </div>
                        <p className="content-summary">{normalizeText(item.body, 80)}</p>
                        <div className="meta-row">
                          <span>{toDateTime(item.created_at)}</span>
                        </div>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={profilePosts.meta}
                    page={profilePosts.page}
                    onPrev={() => loadProfilePosts(Math.max(1, profilePosts.page - 1))}
                    onNext={() => loadProfilePosts(profilePosts.page + 1)}
                  />
                </>
              )}

              {profilePanel === "registrations" && (
                <>
                  {profileRegistrations.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {profileRegistrations.rows.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-head">
                          <strong className="card-title">{item.title || "活动"}</strong>
                          <span className="pill">{item.status}</span>
                        </div>
                        <p className="content-summary">{normalizeText(item.summary || "", 70)}</p>
                        <p className="muted">报名时间：{toDateTime(item.created_at)}</p>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={profileRegistrations.meta}
                    page={profileRegistrations.page}
                    onPrev={() =>
                      loadProfileRegistrations(Math.max(1, profileRegistrations.page - 1))
                    }
                    onNext={() => loadProfileRegistrations(profileRegistrations.page + 1)}
                  />
                </>
              )}

              {profilePanel === "favorites" && (
                <>
                  <div className="toolbar">
                    <select
                      value={profileFavType}
                      onChange={(event) => setProfileFavType(event.target.value)}
                    >
                      <option value="post">帖子</option>
                      <option value="news">资讯</option>
                      <option value="event">活动</option>
                    </select>
                  </div>
                  {profileFavorites.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {profileFavorites.rows.map((item) => (
                      <article className="card" key={`${item.target_type}-${item.id}`}>
                        <div className="card-head">
                          <strong className="card-title">{item.title || "（已下线）"}</strong>
                          <span className="pill">{item.target_type}</span>
                        </div>
                        <p className="content-summary">{normalizeText(item.body || "", 80)}</p>
                        <p className="muted">{toDateTime(item.created_at)}</p>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={profileFavorites.meta}
                    page={profileFavorites.page}
                    onPrev={() => loadProfileFavorites(Math.max(1, profileFavorites.page - 1), profileFavType)}
                    onNext={() => loadProfileFavorites(profileFavorites.page + 1, profileFavType)}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}

      {view === "admin" && (
        <section className="panel admin-panel">
          {!me || !isAdminRole(me.role) ? (
            <p className="muted">当前账号无管理员权限</p>
          ) : (
            <>
              <div className="segment-nav">
                <button
                  className={`segment-chip ${adminTab === "events" ? "active" : ""}`}
                  onClick={() => switchAdminTab("events")}
                >
                  活动管理
                </button>
                <button
                  className={`segment-chip ${adminTab === "news" ? "active" : ""}`}
                  onClick={() => switchAdminTab("news")}
                >
                  资讯管理
                </button>
                <button
                  className={`segment-chip ${adminTab === "posts" ? "active" : ""}`}
                  onClick={() => switchAdminTab("posts")}
                >
                  帖子管理
                </button>
                <button
                  className={`segment-chip ${adminTab === "users" ? "active" : ""}`}
                  onClick={() => switchAdminTab("users")}
                >
                  用户管理
                </button>
                <button
                  className={`segment-chip ${adminTab === "audit" ? "active" : ""}`}
                  onClick={() => switchAdminTab("audit")}
                >
                  审计日志
                </button>
                <button
                  className={`segment-chip ${adminTab === "reports" ? "active" : ""}`}
                  onClick={() => switchAdminTab("reports")}
                >
                  举报处理
                </button>
              </div>
              <div className="row-actions">
                <button className="ghost-btn" onClick={seedDemoContent}>
                  一键补齐演示数据
                </button>
              </div>

              {adminTab === "events" && (
                <>
                  <section className="panel compact">
                    <h3>活动发布 / 编辑</h3>
                    <input
                      value={adminEventForm.title}
                      onChange={(event) =>
                        setAdminEventForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="标题（2-60）"
                    />
                    <textarea
                      rows={3}
                      value={adminEventForm.summary}
                      onChange={(event) =>
                        setAdminEventForm((prev) => ({ ...prev, summary: event.target.value }))
                      }
                      placeholder="简介"
                    />
                    <div className="toolbar">
                      <input
                        type="datetime-local"
                        value={adminEventForm.start_time}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, start_time: event.target.value }))
                        }
                      />
                      <input
                        type="datetime-local"
                        value={adminEventForm.end_time}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, end_time: event.target.value }))
                        }
                      />
                    </div>
                    <input
                      value={adminEventForm.location_name}
                      onChange={(event) =>
                        setAdminEventForm((prev) => ({ ...prev, location_name: event.target.value }))
                      }
                      placeholder="活动地点"
                    />
                    <div className="toolbar">
                      <input
                        value={adminEventForm.capacity}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, capacity: event.target.value }))
                        }
                        placeholder="容量"
                      />
                      <select
                        value={adminEventForm.fee_type}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, fee_type: event.target.value }))
                        }
                      >
                        <option value="free">免费</option>
                        <option value="paid">付费</option>
                      </select>
                      <select
                        value={adminEventForm.signup_type}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, signup_type: event.target.value }))
                        }
                      >
                        <option value="manual">手动</option>
                        <option value="link">跳转</option>
                      </select>
                      <select
                        value={adminEventForm.status}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                      >
                        <option value="draft">草稿</option>
                        <option value="published">发布</option>
                        <option value="closed">报名截止</option>
                      </select>
                    </div>
                    <div className="toolbar">
                      <input
                        value={adminEventForm.lat}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, lat: event.target.value }))
                        }
                        placeholder="纬度（选填）"
                      />
                      <input
                        value={adminEventForm.lng}
                        onChange={(event) =>
                          setAdminEventForm((prev) => ({ ...prev, lng: event.target.value }))
                        }
                        placeholder="经度（选填）"
                      />
                    </div>
                    <div className="row-actions">
                      <button onClick={saveAdminEvent} disabled={loadingAdminForm}>
                        {adminEventForm.editingId ? "更新活动" : "创建活动"}
                      </button>
                      <button className="ghost-btn" onClick={clearAdminForms}>
                        重置
                      </button>
                    </div>
                  </section>

                  <div className="toolbar">
                    <input
                      value={adminFilters.events.q}
                      onChange={(event) =>
                        updateAdminFilter("events", { q: event.target.value, page: 1 })
                      }
                      placeholder="活动搜索"
                    />
                    <select
                      value={adminFilters.events.status}
                      onChange={(event) =>
                        updateAdminFilter("events", {
                          status: event.target.value,
                          page: 1,
                        })
                      }
                    >
                      <option value="">全部状态</option>
                      <option value="draft">草稿</option>
                      <option value="published">发布</option>
                      <option value="closed">截止</option>
                      <option value="ended">已结束</option>
                    </select>
                    <label className="event-select-wrap">
                      <input
                        type="checkbox"
                        className="event-select"
                        checked={
                          adminData.events.rows.length > 0 &&
                          adminData.events.rows.every((item) =>
                            adminSelectedEvents.includes(Number(item.id))
                          )
                        }
                        onChange={toggleAdminSelectAllEvents}
                        aria-label="全选当前页活动"
                      />
                      全选当前页
                    </label>
                    <button
                      className="ghost-btn"
                      disabled={!adminSelectedEvents.length}
                      onClick={() => batchUpdateAdminEvents("published")}
                    >
                      批量发布
                    </button>
                    <button
                      className="ghost-btn"
                      disabled={!adminSelectedEvents.length}
                      onClick={() => batchUpdateAdminEvents("closed")}
                    >
                      批量下线
                    </button>
                  </div>

                  {adminData.events.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {adminData.events.rows.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-head">
                          <label className="event-select-wrap">
                            <input
                              type="checkbox"
                              className="event-select"
                              checked={adminSelectedEvents.includes(Number(item.id))}
                              onChange={(event) =>
                                toggleAdminEventSelection(Number(item.id), event.target.checked)
                              }
                              aria-label={`选择活动：${item.title || "活动"}`}
                            />
                            <strong className="card-title">{item.title}</strong>
                          </label>
                          <span className="pill">{statusLabel("event", item.status)}</span>
                        </div>
                        <p className="content-summary">{normalizeText(item.location_name, 80)}</p>
                        <p className="muted">容量：{item.capacity || 0}</p>
                        <div className="row-actions">
                          <button
                            className="ghost-btn"
                            onClick={() => fillAdminEventForm(item)}
                          >
                            编辑
                          </button>
                          <button
                            className="ghost-btn"
                            onClick={() => changeEventStatus(item.id, "published")}
                          >
                            发布
                          </button>
                          <button
                            className="ghost-btn"
                            onClick={() => changeEventStatus(item.id, "closed")}
                          >
                            截止
                          </button>
                          <button
                            className="ghost-btn"
                            onClick={() => deleteEvent(item.id)}
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    ))}
                  </section>

                  <Pager
                    meta={adminData.events.meta}
                    page={adminData.events.page}
                    onPrev={() => loadAdminData("events", Math.max(1, adminData.events.page - 1))}
                    onNext={() => loadAdminData("events", adminData.events.page + 1)}
                  />
                </>
              )}

              {adminTab === "news" && (
                <>
                  <section className="panel compact">
                    <h3>资讯发布 / 编辑</h3>
                    <input
                      value={adminNewsForm.title}
                      onChange={(event) =>
                        setAdminNewsForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="标题"
                    />
                    <textarea
                      rows={5}
                      value={adminNewsForm.body}
                      onChange={(event) =>
                        setAdminNewsForm((prev) => ({ ...prev, body: event.target.value }))
                      }
                      placeholder="正文"
                    />
                    <div className="toolbar">
                      <input
                        value={adminNewsForm.category}
                        onChange={(event) =>
                          setAdminNewsForm((prev) => ({ ...prev, category: event.target.value }))
                        }
                        placeholder="分类"
                      />
                      <input
                        value={adminNewsForm.tags}
                        onChange={(event) =>
                          setAdminNewsForm((prev) => ({ ...prev, tags: event.target.value }))
                        }
                        placeholder="标签"
                      />
                      <select
                        value={adminNewsForm.status}
                        onChange={(event) =>
                          setAdminNewsForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                      >
                        <option value="draft">草稿</option>
                        <option value="published">发布</option>
                        <option value="offline">下线</option>
                      </select>
                    </div>
                    <div className="row-actions">
                      <button onClick={saveAdminNews}>保存资讯</button>
                      <button className="ghost-btn" onClick={clearAdminForms}>
                        清空
                      </button>
                    </div>
                  </section>

                  <div className="toolbar">
                    <input
                      value={adminFilters.news.q}
                      onChange={(event) =>
                        updateAdminFilter("news", { q: event.target.value, page: 1 })
                      }
                      placeholder="资讯搜索"
                    />
                    <select
                      value={adminFilters.news.status}
                      onChange={(event) =>
                        updateAdminFilter("news", { status: event.target.value, page: 1 })
                      }
                    >
                      <option value="">全部状态</option>
                      <option value="draft">草稿</option>
                      <option value="published">发布</option>
                      <option value="offline">下线</option>
                    </select>
                    <select
                      value={adminFilters.news.sort}
                      onChange={(event) =>
                        updateAdminFilter("news", { sort: event.target.value, page: 1 })
                      }
                    >
                      <option value="latest">最新</option>
                      <option value="hot">热门</option>
                    </select>
                  </div>

                  {adminData.news.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {adminData.news.rows.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-head">
                          <strong className="card-title">{item.title}</strong>
                          <span className="pill">{statusLabel("news", item.status)}</span>
                        </div>
                        <p className="muted">栏目：{item.category}</p>
                        <p className="content-summary">{normalizeText(item.body, 70)}</p>
                        <div className="row-actions">
                          <button onClick={() => fillAdminNewsForm(item)}>编辑</button>
                          <button
                            className="ghost-btn"
                            onClick={async () => {
                              if (!window.confirm("确认删除该资讯？")) return;
                              try {
                                await apiRequest(`/api/v1/admin/news/${item.id}`, {
                                  method: "DELETE",
                                });
                                await loadAdminData("news", adminData.news.page);
                              } catch (err) {
                                showError("删除失败", err);
                              }
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={adminData.news.meta}
                    page={adminData.news.page}
                    onPrev={() => loadAdminData("news", Math.max(1, adminData.news.page - 1))}
                    onNext={() => loadAdminData("news", adminData.news.page + 1)}
                  />
                </>
              )}

              {adminTab === "posts" && (
                <>
                  <div className="toolbar">
                    <input
                      value={adminFilters.posts.q}
                      onChange={(event) =>
                        updateAdminFilter("posts", { q: event.target.value, page: 1 })
                      }
                      placeholder="帖子搜索"
                    />
                    <select
                      value={adminFilters.posts.status}
                      onChange={(event) =>
                        updateAdminFilter("posts", { status: event.target.value, page: 1 })
                      }
                    >
                      <option value="">全部状态</option>
                      <option value="pending">待审核</option>
                      <option value="approved">已发布</option>
                      <option value="rejected">已驳回</option>
                      <option value="offline">下线</option>
                    </select>
                    <input
                      value={adminFilters.posts.tag}
                      onChange={(event) =>
                        updateAdminFilter("posts", { tag: event.target.value, page: 1 })
                      }
                      placeholder="标签"
                    />
                  </div>

                  {adminData.posts.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {adminData.posts.rows.map((item) => (
                      <article
                        className="card clickable-card"
                        key={item.id}
                        onClick={() => openPostById(item.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openPostById(item.id);
                          }
                        }}
                      >
                        <div className="card-head">
                          <strong className="card-title">{item.title}</strong>
                          <span className="pill">{statusLabel("post", item.status)}</span>
                        </div>
                        <p className="content-summary">标签：{item.tags || "无"}</p>
                        <p className="content-summary">作者：{item.author_nickname || "未知"}</p>
                        <div className="row-actions compact-actions">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              reviewPost(item.id, "approved");
                            }}
                          >
                            通过
                          </button>
                          <button
                            className="ghost-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              reviewPost(item.id, "rejected");
                            }}
                          >
                            驳回
                          </button>
                          <button
                            className="ghost-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              reviewPost(item.id, "offline");
                            }}
                          >
                            下架
                          </button>
                        </div>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={adminData.posts.meta}
                    page={adminData.posts.page}
                    onPrev={() => loadAdminData("posts", Math.max(1, adminData.posts.page - 1))}
                    onNext={() => loadAdminData("posts", adminData.posts.page + 1)}
                  />
                </>
              )}

              {adminTab === "users" && (
                <>
                  <div className="toolbar">
                    <input
                      value={adminFilters.users.q}
                      onChange={(event) =>
                        updateAdminFilter("users", { q: event.target.value, page: 1 })
                      }
                      placeholder="用户搜索"
                    />
                    <select
                      value={adminFilters.users.role}
                      onChange={(event) =>
                        updateAdminFilter("users", { role: event.target.value, page: 1 })
                      }
                    >
                      <option value="">全部角色</option>
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>

                  {adminData.users.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                  {adminData.users.rows.map((item) => (
                    <article className="card" key={item.id}>
                      <div className="card-head">
                        <strong className="card-title">{item.nickname || item.phone || item.email || `用户 ${item.id}`}</strong>
                        <span className="pill">{statusLabel("user", item.status)}</span>
                      </div>
                      <p className="content-summary">{item.phone || item.email || "未设置联系方式"}</p>
                      <p className="muted">角色：{item.role || "user"}</p>
                      <div className="row-actions">
                          <button
                          className="ghost-btn"
                            onClick={() => changeUserStatus(item.id, "active")}
                            disabled={adminRoleLoading[item.id] || item.status === "active"}
                          >
                            解封
                          </button>
                          <button
                            onClick={() => changeUserStatus(item.id, "suspended")}
                            disabled={adminRoleLoading[item.id] || item.status === "suspended"}
                          >
                            封禁
                          </button>
                          {me?.role === "owner" && item.id !== me.id && (
                            <label className="role-switch">
                              <span>角色</span>
                              <select
                                value={item.role || "user"}
                                disabled={adminRoleLoading[`${item.id}:role`]}
                                onChange={(event) =>
                                  changeUserRole(item.id, event.target.value)
                                }
                              >
                                <option value="user">普通用户</option>
                                <option value="admin">管理员</option>
                                <option value="owner">Owner</option>
                              </select>
                            </label>
                          )}
                        </div>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={adminData.users.meta}
                    page={adminData.users.page}
                    onPrev={() => loadAdminData("users", Math.max(1, adminData.users.page - 1))}
                    onNext={() => loadAdminData("users", adminData.users.page + 1)}
                  />
                </>
              )}

              {adminTab === "audit" && (
                <>
                  <div className="toolbar">
                    <input
                      value={adminFilters.audit.q}
                      onChange={(event) =>
                        updateAdminFilter("audit", { q: event.target.value, page: 1 })
                      }
                      placeholder="搜索操作日志"
                    />
                    <input
                      value={adminFilters.audit.action}
                      onChange={(event) =>
                        updateAdminFilter("audit", { action: event.target.value, page: 1 })
                      }
                      placeholder="动作类型关键词"
                    />
                    <input
                      value={adminFilters.audit.targetType}
                      onChange={(event) =>
                        updateAdminFilter("audit", { targetType: event.target.value, page: 1 })
                      }
                      placeholder="目标类型"
                    />
                  </div>

                  {adminAuditData.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {adminAuditData.rows.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-head">
                          <strong className="card-title">动作：{item.action}</strong>
                          <span className="pill">ID:{item.id}</span>
                        </div>
                        <p className="muted">目标：{item.target_type || "-"} {item.target_id || ""}</p>
                        <p className="muted">traceId：{item.trace_id || "-"}</p>
                        <p className="muted">时间：{toDateTime(item.created_at)}</p>
                        {item.payload ? <p className="muted">参数：{item.payload}</p> : null}
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={adminAuditData.meta}
                    page={adminAuditData.page}
                    onPrev={() => loadAdminData("audit", Math.max(1, adminAuditData.page - 1))}
                    onNext={() => loadAdminData("audit", adminAuditData.page + 1)}
                  />
                </>
              )}

              {adminTab === "reports" && (
                <>
                  <div className="toolbar">
                    <input
                      value={adminFilters.reports.q}
                      onChange={(event) =>
                        updateAdminFilter("reports", { q: event.target.value, page: 1 })
                      }
                      placeholder="检索举报内容"
                    />
                    <select
                      value={adminFilters.reports.status}
                      onChange={(event) =>
                        updateAdminFilter("reports", { status: event.target.value, page: 1 })
                      }
                    >
                      <option value="">全部状态</option>
                      <option value="open">待处理</option>
                      <option value="resolved">已处理</option>
                      <option value="rejected">已驳回</option>
                    </select>
                    <input
                      value={adminFilters.reports.targetType}
                      onChange={(event) =>
                        updateAdminFilter("reports", { targetType: event.target.value, page: 1 })
                      }
                      placeholder="目标类型"
                    />
                  </div>

                  {adminReportsData.loading && <p className="muted">加载中...</p>}
                  <section className="mini-list">
                    {adminReportsData.rows.map((item) => (
                      <article className="card" key={item.id}>
                        <div className="card-head">
                          <strong className="card-title">
                            举报 #{item.id} · {item.target_type} #{item.target_id}
                          </strong>
                          <span className="pill">{statusLabel("report", item.status || "open")}</span>
                        </div>
                        <p className="muted">举报人：{item.reporter_nickname || "匿名"}</p>
                        <p className="muted">
                          目标内容：{item.target_title || item.target_excerpt || "-"}
                        </p>
                        <p>原因：{item.reason}</p>
                        <div className="row-actions">
                          <button
                            className="ghost-btn"
                            onClick={() => openReportedTarget(item)}
                          >
                            查看原文
                          </button>
                          {item.status === "open" && (
                            <>
                              <button onClick={() => reviewReport(item.id, "resolved")}>处理</button>
                              <button className="ghost-btn" onClick={() => reviewReport(item.id, "rejected")}>
                                驳回
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </section>
                  <Pager
                    meta={adminReportsData.meta}
                    page={adminReportsData.page}
                    onPrev={() => loadAdminData("reports", Math.max(1, adminReportsData.page - 1))}
                    onNext={() => loadAdminData("reports", adminReportsData.page + 1)}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}

      {(detailEvent || detailLoadingType === "event") && (
        <section className="panel detail-modal" role="dialog" aria-modal="true">
          <header className="detail-head">
            <strong>{detailEvent?.title || "活动详情"}</strong>
            <button onClick={closeAllDetails}>关闭</button>
          </header>
          {detailLoadingType === "event" && !detailEvent && !detailLoadError && (
            <p className="muted">加载中...</p>
          )}
          {detailLoadError && <p className="error-text">{detailLoadError}</p>}
          {detailEvent && (
            <>
              <p className="detail-body-text">{detailEvent.summary || "-"}</p>
              <p className="detail-meta">
                <span className="meta-item">
                  <span className="meta-icon">🕒</span>
                  {toDateTime(detailEvent.start_time)} ~ {toTime(detailEvent.end_time)}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">📍</span>
                  {detailEvent.location_name || "未填写"}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">👥</span>
                  {detailEvent.reg_count || 0}/{detailEvent.capacity || "无上限"}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">🧾</span>
                  {statusLabel("event", detailEvent.status)}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">💙</span>
                  {detailEvent.favorite_count || 0}
                </span>
              </p>
              <div className="row-actions detail-actions">
                {(() => {
                  const state = signupState(detailEvent, me);
                  if (state.action === "login") {
                    return null;
                  }
                  return (
                    <button onClick={() => registerEvent(detailEvent)} disabled={state.disabled}>
                      {state.label}
                    </button>
                  );
                })()}
                <button
                  onClick={favoriteEvent}
                  disabled={favoriteActionLoading[favoriteActionKey("event", detailEvent?.id)]}
                >
                  {favoriteActionLoading[favoriteActionKey("event", detailEvent?.id)]
                    ? "处理中"
                    : detailEvent?.is_favorited
                    ? "取消收藏"
                    : "收藏"}
                </button>
                <button className="ghost-btn" onClick={reportEvent}>
                  举报
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {(detailNews || detailLoadingType === "news") && (
        <section className="panel detail-modal" role="dialog" aria-modal="true">
          <header className="detail-head">
            <strong>{detailNews?.title || "资讯详情"}</strong>
            <button onClick={closeAllDetails}>
              关闭
            </button>
          </header>
          {detailLoadingType === "news" && !detailNews && !detailLoadError && <p className="muted">加载中...</p>}
          {detailLoadError && <p className="error-text">{detailLoadError}</p>}
          {detailNews && (
            <>
              <p className="detail-meta">
                <span className="meta-item">
                  <span className="meta-icon">🏷️</span>
                  {detailNews.category || "未分类"}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">🕒</span>
                  {toDateTime(detailNews.created_at)}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">🔥</span>
                  {detailNews.read_count || 0}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">💙</span>
                  {detailNews.favorite_count || 0}
                </span>
              </p>
              <p className="detail-body-text">{detailNews.body}</p>
              <div className="row-actions detail-actions">
                <button
                  onClick={favoriteNews}
                  disabled={favoriteActionLoading[favoriteActionKey("news", detailNews?.id)]}
                >
                  {favoriteActionLoading[favoriteActionKey("news", detailNews?.id)]
                    ? "处理中"
                    : detailNews?.is_favorited
                    ? "取消收藏"
                    : "收藏"}
                </button>
                <button className="ghost-btn" onClick={reportNews}>
                  举报
                </button>
              </div>

              {!!relatedNews.length && (
                <section className="related-news">
                  <h4>相关阅读</h4>
                  <section className="mini-list">
                    {relatedNews.map((item) => (
                      <article
                        className="card clickable-card"
                        key={item.id}
                        onClick={() => openNewsFromHome(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openNewsFromHome(item);
                          }
                        }}
                      >
                        <div className="card-head">
                          <strong className="card-title">{item.title}</strong>
                          <span className="pill">{statusLabel("news", item.status)}</span>
                        </div>
                        <p className="content-summary">{normalizeText(item.summary || item.body, 70)}</p>
                      </article>
                    ))}
                  </section>
                </section>
              )}
            </>
          )}
        </section>
      )}

      {(detailPost || detailLoadingType === "post") && (
        <section className="panel detail-modal" role="dialog" aria-modal="true">
          <header className="detail-head">
            <strong>{detailPost?.title || "帖子详情"}</strong>
            <button onClick={closeAllDetails}>关闭</button>
          </header>
          {detailLoadingType === "post" && !detailPost && !detailLoadError && <p className="muted">加载中...</p>}
          {detailLoadError && <p className="error-text">{detailLoadError}</p>}
          {detailPost && (
            <>
              <p className="detail-body-text">{detailPost.body}</p>
              <p className="detail-meta">
                <span className="meta-item">
                  <span className="meta-icon">👤</span>
                  {detailPost.author_nickname || "匿名"}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">💬</span>
                  {detailPost.reply_count || 0}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">⭐</span>
                  {detailPost.like_count || 0}
                </span>
                <span className="meta-item">
                  <span className="meta-icon">💙</span>
                  {detailPost.favorite_count || 0}
                </span>
              </p>
              <div className="row-actions detail-actions">
                <button onClick={likePost}>
                  {detailPost?.is_liked ? "取消点赞" : "点赞"}（{detailPost.like_count || 0}）
                </button>
                <button className="ghost-btn" onClick={favoritePost}>
                  {favoriteActionLoading[favoriteActionKey("post", detailPost?.id)]
                    ? "处理中"
                    : detailPost.is_favorited
                    ? "取消收藏"
                    : "收藏"}
                </button>
                <button className="ghost-btn" onClick={reportPost}>
                  举报
                </button>
              </div>

              <h4>评论</h4>
              {!postComments.length && <p className="muted">暂无评论</p>}
              <section className="mini-list">
                {postComments.map((item) => (
                  <article className="card" key={item.id}>
                    <p>
                      <strong>{item.author_nickname || "匿名"}</strong>：{item.body}
                    </p>
                  </article>
                ))}
              </section>

              <div className="row-actions">
                <textarea
                  rows={2}
                  value={commentDraft}
                  maxLength={COMMENT_BODY_MAX}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="写评论（登录用户可见）"
                />
                <button
                  onClick={commentPost}
                  disabled={commentSubmitting || commentDraft.trim().length < COMMENT_BODY_MIN}
                >
                  {commentSubmitting ? "发表中..." : "发表评论"}
                </button>
              </div>
              <p className="muted">
                {`评论字数 ${commentDraft.length}/${COMMENT_BODY_MAX}`}
              </p>
            </>
          )}
        </section>
      )}

      <nav className="bottom-nav" aria-label="主导航">
        {bottomItems.map((item) => (
          <button
            key={item.key}
            className={activeBottomTab === item.key ? "active-nav" : ""}
            onClick={() => {
              changeView(item.key);
            }}
            aria-label={item.label}
          >
            <span>{item.emoji}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>

      {view !== "publish" && (
        <button
          className="float-btn"
          onClick={() => changeView("publish")}
          aria-label="快捷发布"
        >
          +
        </button>
      )}

      {!!toast && <div className="toast">{toast}</div>}
    </main>
  );
}
