import { useEffect, useMemo, useState } from "react";

const fallback = {
  events: [
    { id: 1, title: "同城 AI 夜谈", start_time: "2026-08-01T11:00:00Z", end_time: "2026-08-01T13:00:00Z", location_name: "静安", capacity: 30, reg_count: 8, status: "published", organizer_name: "AI City Circle", summary: "和同城创作者聊聊 AI 如何真正进入工作与生活。", distance_km: 2.4 },
    { id: 2, title: "Agent 开放实验室", start_time: "2026-08-04T06:30:00Z", end_time: "2026-08-04T09:00:00Z", location_name: "徐汇", capacity: 40, reg_count: 32, status: "published", organizer_name: "Prompt Club", summary: "带着真实问题来，一起做能运行的 AI Agent。", distance_km: 4.8 },
    { id: 3, title: "生成式影像放映会", start_time: "2026-08-09T11:00:00Z", end_time: "2026-08-09T13:00:00Z", location_name: "黄浦", capacity: 24, reg_count: 24, status: "published", organizer_name: "Pixels & People", summary: "作品、工具和创作者的面对面交流。", distance_km: 6.1 },
  ],
  news: [
    { id: 1, title: "本周 AI：从模型能力到真实工作流", summary: "值得花时间读的产品更新、研究突破和本地实践。", source_name: "AI City 编辑部", category: "每周观察", published_at: "2026-07-22T02:00:00Z", body: "AI 的价值正在从单点能力走向更稳定的工作流。我们整理了这一周最值得持续关注的变化，并把讨论留给每一个正在实践的人。" },
    { id: 2, title: "为什么小团队开始重新设计自己的 AI 协作方式", summary: "不是再加一个聊天窗口，而是重建任务、知识和反馈的关系。", source_name: "Local Signals", category: "产品", published_at: "2026-07-21T05:00:00Z", body: "当工具开始参与项目推进，团队需要重新定义信息如何流动、决策如何被记录，以及谁对结果负责。" },
    { id: 3, title: "城市里的 AI 社群，正在发生什么", summary: "从线下读书会到深夜 Demo Night，连接比技术清单更重要。", source_name: "Community Notes", category: "社区", published_at: "2026-07-20T10:00:00Z", body: "真正可持续的社区并不靠热闹，而是让人与人之间的下一次连接自然发生。" },
  ],
  posts: [
    { id: 1, author_name: "Mori", author_initial: "M", title: "第一次把 Agent 接进真实项目后，我学到的三件事", body: "最难的不是模型能力，而是边界、观察和让人知道它正在做什么。这里记录一下我们从 Demo 到稳定流程的几个转折点。", tags: ["Agent", "实战"], comment_count: 12, like_count: 38, created_at: "2026-07-22T03:20:00Z" },
    { id: 2, author_name: "阿芷", author_initial: "Z", title: "想找一起做 AI 影像小项目的同城朋友", body: "我在尝试把生成式影像做成一个小型线下放映。会用到一点声音、文字和视觉工具，欢迎有兴趣的人一起碰面聊聊。", tags: ["创作", "同城"], comment_count: 8, like_count: 21, created_at: "2026-07-21T12:10:00Z" },
    { id: 3, author_name: "Niko", author_initial: "N", title: "你们会怎样给团队里的 AI 输出做质量判断？", body: "除了“感觉还不错”，有没有一套轻量、可以重复使用的判断标准？我在整理一份团队评审清单。", tags: ["讨论", "工作流"], comment_count: 19, like_count: 42, created_at: "2026-07-21T07:30:00Z" },
  ],
};

const iconPath = {
  calendar: "M6 2v4m12-4v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  pin: "M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z M12 10a2.5 2.5 0 1 0 0 .01Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  news: "M4 5h16v15H4z M7 8h7 M7 12h10 M7 16h8",
  message: "M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-4.3-1L3 20l1.4-4.1A8.2 8.2 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z",
  user: "M20 21a8 8 0 0 0-16 0 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  arrow: "M19 12H5 M12 19l-7-7 7-7",
  plus: "M12 5v14 M5 12h14",
  share: "M16 5l3-3 3 3 M19 2v13 M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3",
  spark: "m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z",
  clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  settings: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 2-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V20h-2.8v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2-2 .06-.06A1.7 1.7 0 0 0 7.52 15a1.7 1.7 0 0 0-1.55-1H5.9v-2.8h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2-2 .06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1-1.55V4.9H15v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2 2-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1h.09V14h-.09a1.7 1.7 0 0 0-1.69 1Z",
};

function Icon({ name, size = 20 }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath[name] || iconPath.spark} /></svg>;
}

function readResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload && payload.data)) return payload.data;
  if (payload && payload.data) return payload.data;
  return payload;
}

async function getCollection(resource) {
  try {
    const response = await fetch("/api/v1/" + resource);
    if (!response.ok) throw new Error("网络请求失败");
    const payload = await response.json();
    const data = readResponse(payload);
    return Array.isArray(data) && data.length ? data : fallback[resource];
  } catch {
    return fallback[resource];
  }
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (next) => {
    if (next === path) return;
    window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return [path, navigate];
}

function useCollection(resource, enabled) {
  const [state, setState] = useState({ loading: enabled, data: fallback[resource], error: false });
  useEffect(() => {
    let active = true;
    if (!enabled) return undefined;
    setState((previous) => ({ ...previous, loading: true }));
    getCollection(resource).then((data) => {
      if (active) setState({ loading: false, data, error: false });
    }).catch(() => {
      if (active) setState({ loading: false, data: fallback[resource], error: true });
    });
    return () => { active = false; };
  }, [resource, enabled]);
  return state;
}

function LinkCard({ href, label, children, navigate, className = "" }) {
  return <a className={"content-card " + className} href={href} aria-label={label} onClick={(event) => { event.preventDefault(); navigate(href); }}>{children}</a>;
}

function Meta({ icon, children }) {
  return <span className="meta"><Icon name={icon} size={16} />{children}</span>;
}

function PageHeader({ title, action, children }) {
  return <header className="page-header"><div><h1>{title}</h1>{children}</div>{action}</header>;
}

function EventList({ events, loading, navigate }) {
  return <section className="feed-section" aria-label="活动列表">
    <div className="section-label"><span>近期活动</span><i /></div>
    {loading ? <Skeleton count={3} /> : events.map((event, index) => {
      const remaining = Math.max(0, Number(event.capacity || 0) - Number(event.reg_count || event.registration_count || 0));
      return <LinkCard key={event.id} href={"/events/" + event.id} label={event.title} navigate={navigate} className={index === 0 ? "event-card featured-card" : "event-card"}>
        <div className="event-cover"><span>{index === 0 ? "本周推荐" : "AI CLUB"}</span><Icon name="spark" size={22} /></div>
        <div className="card-body">
          <span className="eyebrow">{event.status === "published" ? "开放报名" : "活动更新"}</span>
          <h2>{event.title}</h2>
          <p>{event.summary || "与同城 AI 创作者面对面，交换问题、方法和新的连接。"}</p>
          <div className="meta-row"><Meta icon="calendar">{formatDate(event.start_time)}</Meta><Meta icon="pin">{event.location_name || "城市待定"}</Meta></div>
          <div className="meta-row compact"><Meta icon="users">{remaining > 0 ? "余 " + remaining + " 位" : "名额已满"}</Meta>{event.distance_km ? <Meta icon="pin">{event.distance_km} km</Meta> : null}</div>
        </div>
      </LinkCard>;
    })}
  </section>;
}

function EventsPage({ events, loading, navigate }) {
  return <main className="page events-page">
    <section className="brand-hero">
      <div className="hero-copy"><span className="hero-kicker">AI CITY CIRCLE</span><h1>AI 正在发生<br />就在你身边</h1><p>发现同城 AI 活动，带着问题来，带着新的连接离开。</p></div>
      <div className="dog-mark" aria-label="AI 城市圈小狗品牌图形"><span className="dog-ear left" /><span className="dog-ear right" /><span className="dog-eye left" /><span className="dog-eye right" /><span className="dog-nose" /></div>
    </section>
    <EventList events={events} loading={loading} navigate={navigate} />
  </main>;
}

function NewsPage({ news, loading, navigate }) {
  return <main className="page">
    <PageHeader title="资讯" />
    <section className="feed-section">
      <div className="section-label"><span>最新</span><i /></div>
      {loading ? <Skeleton count={3} /> : news.map((item, index) => <LinkCard key={item.id} href={"/news/" + item.id} label={item.title} navigate={navigate} className={"news-card " + (index === 0 ? "featured-card" : "")}>
        <div className="news-orbit"><span>{String(index + 1).padStart(2, "0")}</span></div>
        <div className="card-body">
          <span className="eyebrow">{item.category || "AI 观察"}</span>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
          <div className="meta-row"><Meta icon="news">{item.source_name || "AI City 编辑部"}</Meta><Meta icon="clock">{relativeTime(item.published_at)}</Meta></div>
        </div>
      </LinkCard>)}
    </section>
  </main>;
}

function CommunityPage({ posts, loading, navigate, protect }) {
  return <main className="page">
    <PageHeader title="交流" action={<button className="icon-button" aria-label="发布帖子" onClick={() => protect("/compose")}><Icon name="plus" /></button>} />
    <section className="feed-section">
      <div className="section-label"><span>正在讨论</span><i /></div>
      {loading ? <Skeleton count={3} /> : posts.map((post) => <LinkCard key={post.id} href={"/posts/" + post.id} label={post.title} navigate={navigate} className="post-card">
        <div className="author-line"><span className="avatar">{post.author_initial || post.author_name?.slice(0, 1) || "A"}</span><span>{post.author_name || "AI City Member"}</span><span className="dot">·</span><span>{relativeTime(post.created_at)}</span></div>
        <div className="card-body"><h2>{post.title}</h2><p>{post.body}</p><div className="tag-row">{(post.tags || []).slice(0, 2).map((tag) => <span key={tag} className="tag">#{tag}</span>)}</div><div className="post-stats"><Meta icon="heart">{post.like_count || 0}</Meta><Meta icon="message">{post.comment_count || 0}</Meta></div></div>
      </LinkCard>)}
    </section>
  </main>;
}

function DetailShell({ type, item, navigate, protect, loggedIn }) {
  if (!item) return <NotFound navigate={navigate} />;
  const isEvent = type === "event";
  const isNews = type === "news";
  const title = item.title;
  const action = () => {
    if (!loggedIn) return protect(window.location.pathname);
    window.alert(isEvent ? "报名已记录，稍后可在“我的活动”查看。" : isNews ? "已收藏到我的收藏。" : "已更新互动状态。");
  };
  return <main className="detail-page">
    <header className="detail-header"><button className="icon-button" aria-label="返回" onClick={() => navigate(isEvent ? "/events" : isNews ? "/news" : "/community")}><Icon name="arrow" /></button><button className="icon-button" aria-label="分享"><Icon name="share" /></button></header>
    {isEvent ? <div className="detail-cover"><span>AI CITY<br />NIGHT</span><Icon name="spark" size={44} /></div> : null}
    <article className="detail-content">
      <span className="eyebrow">{isEvent ? "开放报名" : isNews ? item.category || "AI 观察" : "交流"}</span>
      <h1>{title}</h1>
      {isEvent ? <div className="detail-meta-grid"><Meta icon="calendar">{formatFullDate(item.start_time)}</Meta><Meta icon="pin">{item.location_name || "城市待定"}</Meta><Meta icon="users">余 {Math.max(0, (item.capacity || 0) - (item.reg_count || 0))} 位</Meta></div> : null}
      {!isEvent && !isNews ? <div className="author-line detail-author"><span className="avatar">{item.author_initial || "A"}</span><span>{item.author_name || "AI City Member"}</span><span className="dot">·</span><span>{relativeTime(item.created_at)}</span></div> : null}
      {isNews ? <div className="article-byline"><Meta icon="news">{item.source_name || "AI City 编辑部"}</Meta><Meta icon="clock">{formatDate(item.published_at)}</Meta></div> : null}
      <p className="lead">{item.summary || item.body}</p>
      <div className="prose"><p>{item.body || "这场活动留给愿意实践的人。我们会从具体问题出发，交流方法、失败和下一步可发生的合作。"} </p><p>{isEvent ? "请在出发前确认时间和地点。报名成功后，活动凭证会出现在“我的活动”。" : isNews ? "如果这条资讯对你有启发，欢迎进入关联讨论，把具体问题和自己的实践带回来。" : "你可以在下方回复，或者把这次讨论收藏起来，稍后继续。"} </p></div>
      {isNews ? <section className="related-block"><h2>关联讨论</h2><button className="quiet-action" onClick={() => protect("/compose")}>发起一条讨论 <Icon name="arrow" size={17} /></button></section> : null}
      {!isNews && !isEvent ? <Comments protect={protect} /> : null}
      {isNews ? <section className="related-block"><h2>继续阅读</h2><p>更多值得读、值得聊的 AI 变化正在发生。</p></section> : null}
    </article>
    <footer className="detail-actionbar">{isEvent ? <button className="primary-button" onClick={action}>立即报名</button> : isNews ? <button className="secondary-button" onClick={action}><Icon name="bookmark" />收藏</button> : <><button className="secondary-button" onClick={action}><Icon name="heart" />{item.like_count || 0}</button><button className="primary-button" onClick={() => protect(window.location.pathname + "#reply")}>回复</button></>}</footer>
  </main>;
}

function Comments({ protect }) {
  return <section className="comments"><div className="section-label"><span>回复</span><i /></div><article className="comment"><span className="avatar small">N</span><div><strong>Niko</strong><p>很期待看到更多来自真实项目的复盘。</p><span>2 小时前</span></div></article><article className="comment"><span className="avatar small">J</span><div><strong>Jun</strong><p>这正是我最近在解决的问题，收藏了。</p><span>昨天</span></div></article><button className="reply-field" onClick={() => protect(window.location.pathname + "#reply")}>写下你的回复...</button></section>;
}

function MePage({ loggedIn, navigate, protect }) {
  if (!loggedIn) return <main className="page me-guest"><div className="guest-dog"><Icon name="spark" size={36} /></div><h1>和同城的人<br />一起把 AI 做出来</h1><p>登录后可以报名活动、发布想法，并把每一次连接留在这里。</p><button className="primary-button" onClick={() => navigate("/auth/login")}>登录 / 注册</button></main>;
  const rows = [["我的活动", "calendar", "/me/events"], ["我的帖子", "message", "/me/posts"], ["我的收藏", "bookmark", "/me/favorites"], ["消息中心", "news", "/me/notifications"], ["资料与安全", "settings", "/me/security"]];
  return <main className="page"><section className="profile-card"><span className="avatar profile-avatar">C</span><div><h1>Circle Member</h1><p>正在上海，把想法做成相遇。</p></div><button className="icon-button" aria-label="编辑资料" onClick={() => navigate("/me/profile")}><Icon name="settings" /></button></section><section className="me-menu">{rows.map(([label, icon, href]) => <button key={href} onClick={() => navigate(href)}><span><Icon name={icon} />{label}</span><Icon name="arrow" size={17} /></button>)}</section></main>;
}

function AuthPage({ mode, navigate, onAuthenticated }) {
  const isLogin = mode === "login";
  const [message, setMessage] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!form.get("account") || !form.get("password")) return setMessage("请填写账号和密码");
    localStorage.setItem("tai_session", "member");
    onAuthenticated(true);
    const returnTo = localStorage.getItem("tai_return") || "/me";
    localStorage.removeItem("tai_return");
    navigate(returnTo);
  };
  return <main className="auth-page"><button className="back-text" onClick={() => navigate("/events")}><Icon name="arrow" size={18} />返回</button><section className="auth-panel"><span className="hero-kicker">AI CITY CIRCLE</span><h1>{isLogin ? "欢迎回来" : "加入这座城市"}</h1><p>{isLogin ? "继续你正在发生的连接。" : "用一个账号，开始新的相遇。"}</p><form onSubmit={submit}><label>账号<input name="account" autoComplete="username" placeholder="用户名或邮箱" /></label>{!isLogin ? <label>昵称<input name="nickname" autoComplete="nickname" placeholder="怎么称呼你" /></label> : null}<label>密码<input name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} placeholder="至少 8 位字符" /></label>{!isLogin ? <label>确认密码<input name="passwordConfirm" type="password" autoComplete="new-password" placeholder="再次输入密码" /></label> : null}{message ? <p className="form-error" role="alert">{message}</p> : null}<button className="primary-button" type="submit">{isLogin ? "登录" : "创建账号"}</button></form><button className="text-button" onClick={() => navigate(isLogin ? "/auth/register" : "/auth/login")}>{isLogin ? "还没有账号？注册" : "已有账号？登录"}</button></section></main>;
}

function ComposePage({ navigate, protect, loggedIn }) {
  const [saved, setSaved] = useState(false);
  if (!loggedIn) { protect("/compose"); return null; }
  return <main className="compose-page"><header className="detail-header"><button className="icon-button" aria-label="返回" onClick={() => navigate("/community")}><Icon name="arrow" /></button><button className="text-button" onClick={() => setSaved(true)}>保存草稿</button></header><section className="compose-content"><span className="eyebrow">发起交流</span><input className="title-input" aria-label="帖子标题" placeholder="你想和大家聊什么？" /><textarea aria-label="帖子正文" placeholder="把问题、观察或正在做的事写下来..." rows={10} /><div className="tag-row"><span className="tag">#同城</span><span className="tag">#AI</span><button className="tag add-tag"><Icon name="plus" size={14} />话题</button></div>{saved ? <p className="saved-state">草稿已保存</p> : null}<button className="primary-button" onClick={() => navigate("/community")}>发布帖子</button></section></main>;
}

function SubPage({ title, navigate }) {
  return <main className="page"><PageHeader title={title} action={<button className="icon-button" aria-label="返回" onClick={() => navigate("/me")}><Icon name="arrow" /></button>} /><section className="empty-state"><Icon name="spark" size={30} /><h2>这里会留下你的记录</h2><p>完成活动报名、发布观点或收藏内容后，它们会出现在这里。</p></section></main>;
}

function NotFound({ navigate }) {
  return <main className="page"><section className="empty-state"><Icon name="spark" size={30} /><h1>这条连接不在这里</h1><p>内容可能已下线，或者链接已经失效。</p><button className="primary-button" onClick={() => navigate("/events")}>回到活动</button></section></main>;
}

function Skeleton({ count }) {
  return <div className="skeletons">{Array.from({ length: count }).map((_, index) => <div className="skeleton" key={index}><i /><i /><i /></div>)}</div>;
}

function BottomNav({ path, navigate }) {
  const items = [["活动", "calendar", "/events"], ["资讯", "news", "/news"], ["交流", "message", "/community"], ["我的", "user", "/me"]];
  const active = path.startsWith("/events") ? "/events" : path.startsWith("/news") ? "/news" : path.startsWith("/community") || path.startsWith("/posts") ? "/community" : "/me";
  return <nav className="bottom-nav" aria-label="主导航">{items.map(([label, icon, href]) => <button key={href} className={active === href ? "active" : ""} onClick={() => navigate(href)}><Icon name={icon} size={22} /><span>{label}</span></button>)}</nav>;
}

function formatDate(value) {
  if (!value) return "时间待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待定";
  return (date.getMonth() + 1) + "月" + date.getDate() + "日";
}

function formatFullDate(value) {
  if (!value) return "时间待定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待定";
  return (date.getMonth() + 1) + "月" + date.getDate() + "日 " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
}

function relativeTime(value) {
  if (!value) return "刚刚";
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 3600000) return "刚刚";
  if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
  return Math.floor(diff / 86400000) + " 天前";
}

export default function App() {
  const [path, navigate] = usePath();
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem("tai_session") === "member");
  const eventState = useCollection("events", path === "/events");
  const newsState = useCollection("news", path === "/news");
  const postState = useCollection("posts", path === "/community");
  const protect = (returnTo) => {
    if (loggedIn) return navigate(returnTo);
    localStorage.setItem("tai_return", returnTo);
    navigate("/auth/login");
  };
  const route = useMemo(() => {
    if (path === "/events") return <EventsPage events={eventState.data} loading={eventState.loading} navigate={navigate} />;
    if (path === "/news") return <NewsPage news={newsState.data} loading={newsState.loading} navigate={navigate} />;
    if (path === "/community") return <CommunityPage posts={postState.data} loading={postState.loading} navigate={navigate} protect={protect} />;
    if (path === "/me") return <MePage loggedIn={loggedIn} navigate={navigate} protect={protect} />;
    if (path === "/auth/login") return <AuthPage mode="login" navigate={navigate} onAuthenticated={setLoggedIn} />;
    if (path === "/auth/register") return <AuthPage mode="register" navigate={navigate} onAuthenticated={setLoggedIn} />;
    if (path === "/compose") return <ComposePage navigate={navigate} protect={protect} loggedIn={loggedIn} />;
    if (path.startsWith("/events/")) return <DetailShell type="event" item={fallback.events.find((item) => String(item.id) === path.split("/").pop()) || eventState.data.find((item) => String(item.id) === path.split("/").pop())} navigate={navigate} protect={protect} loggedIn={loggedIn} />;
    if (path.startsWith("/news/")) return <DetailShell type="news" item={fallback.news.find((item) => String(item.id) === path.split("/").pop()) || newsState.data.find((item) => String(item.id) === path.split("/").pop())} navigate={navigate} protect={protect} loggedIn={loggedIn} />;
    if (path.startsWith("/posts/")) return <DetailShell type="post" item={fallback.posts.find((item) => String(item.id) === path.split("/").pop()) || postState.data.find((item) => String(item.id) === path.split("/").pop())} navigate={navigate} protect={protect} loggedIn={loggedIn} />;
    if (path.startsWith("/me/")) return <SubPage title={path.includes("events") ? "我的活动" : path.includes("posts") ? "我的帖子" : path.includes("favorites") ? "我的收藏" : path.includes("notifications") ? "消息中心" : "资料与安全"} navigate={navigate} />;
    return <NotFound navigate={navigate} />;
  }, [path, eventState.data, eventState.loading, newsState.data, newsState.loading, postState.data, postState.loading, loggedIn]);
  const isTopLevel = ["/events", "/news", "/community", "/me"].includes(path);
  return <div className="app-shell">{route}{isTopLevel ? <BottomNav path={path} navigate={navigate} /> : null}</div>;
}
