# AI City Circle 完整产品与实施规格

文档状态：Approved Baseline
方案：B - 社区增强方案
更新时间：2026-07-22
适用范围：用户 Web、H5、管理端、服务端、数据库、Demo 数据、测试验收、后续 MCP/SKILL 接入
文档性质：长期产品基线，不以 MVP 或 V1 为终点

---

## 1. 文档目标

本 Spec 用于统一产品、UI、前端、后端、数据库、测试与运营的交付口径。实现过程中不得仅完成页面外壳，也不得以“接口已存在”代替用户闭环验收。

本项目要交付的是一个可持续运营的本地 AI 社区产品：

1. 用户可以发现本地或附近的 AI 活动，查看完整信息并完成报名。
2. 用户可以稳定获取最新 AI 资讯，并从资讯进入相关社区讨论。
3. 用户可以发帖、回复、点赞、收藏、举报，并在个人主页持续追踪自己的行为。
4. 管理员可以创建和管理活动、资讯、帖子、评论、举报与用户。
5. 公开内容未来可通过 MCP 或 SKILL 被 AI 读取，写操作必须受身份、权限和审计约束。

### 1.1 已确认的产品决策

1. 使用单一深色主题，不提供浅色主题和主题切换按钮。
2. H5 底部一级导航固定为：活动、资讯、交流、我的。
3. 不使用验证码登录或注册。认证方式为账号加密码。
4. 游客可浏览公开内容；需要身份的动作在触发时进入登录。
5. 登录成功后返回原页面、原滚动位置，并继续一次原动作。
6. 活动、资讯、交流是三个独立一级场景，不在内容区域重复放 tabs 或类型 chips。
7. 列表卡片整体可点击，不显示“查看详情”。
8. 列表内容区不堆叠按钮；报名、收藏、回复等操作主要在详情页完成。
9. 页面不显示“赛博紫 H5”“UGC 模块”等面向开发或设计的描述性术语。
10. 视觉采用“克制的赛博朋克小狗”：深黑紫、透明毛玻璃、少量荧光、统一图标和清晰内容层级。
11. MCP/SKILL 在架构和数据权限上预留，当前阶段不实现运行时接入。

### 1.2 禁止回归项

以下任一内容重新出现，均视为实现回归：

1. 验证码输入框、发送验证码按钮或 send-code 接口被前端调用。
2. 浅色主题、主题切换按钮或根据系统自动切换为浅色。
3. 顶部独立 topbar 品牌卡片。
4. 内容区 tabs、活动/资讯/交流 chips 或重复模块切换器。
5. 常驻全局搜索、类型筛选、时间排序三联工具条。
6. Hero 区“查看附近活动”“浏览交流”等重复 CTA。
7. 卡片内“查看详情”“需要登录”“登录/注册”等冗余按钮。
8. 每张卡片使用完整高亮边框、双重边框或多层发光描边。
9. 使用 Emoji 代替结构化图标。
10. 扫描线、持续 glitch、循环扫光、频闪或影响正文阅读的动效。

---

## 2. 产品定位

### 2.1 一句话定位

AI City Circle 是一个连接本地 AI 活动、最新资讯和真实交流的城市社区。

### 2.2 品牌主张

品牌名：AI City Circle
中文显示名：AI 城市圈
品牌 Slogan：AI 正在发生，就在你身边

Slogan 只在活动首页的品牌首屏、品牌落地页和分享物料中使用，不作为每页重复说明。

### 2.3 产品飞轮

1. 最新资讯吸引用户持续浏览。
2. 高质量帖子把资讯转化为观点与关系。
3. 本地活动把线上关系转化为线下连接。
4. 活动参与者回到社区发布复盘和照片。
5. 复盘内容反向提升活动和社区的可信度。

### 2.4 目标用户

1. AI 初学者：希望找到本地活动和可信入门内容。
2. AI 从业者：希望获取资讯、交换经验、建立同城连接。
3. 活动组织者：希望发布活动、管理报名、触达参与者。
4. 内容编辑：希望发布和维护 AI 资讯。
5. 社区管理员：希望治理帖子、评论、举报和用户。

### 2.5 非目标

当前不做：

1. 即时聊天、群聊和音视频直播。
2. 完整电商、支付、退款和发票。
3. 复杂推荐模型或基于画像的自动决策。
4. 小程序和原生 App。
5. AI 自动代发内容。
6. MCP/SKILL 的真实写入执行。

这些非目标不代表永久放弃，后续路线图中应保留接口和数据扩展能力。

---

## 3. 成功标准

### 3.1 北极星指标

每周完成一次有效社区行为的活跃用户数。有效社区行为包括：

1. 成功报名或签到活动。
2. 发布通过审核的帖子。
3. 发布未被删除的有效回复。
4. 收藏资讯、帖子或活动后再次访问详情。

### 3.2 核心业务指标

| 指标 | 定义 |
| --- | --- |
| 7 日激活率 | 注册后 7 日内完成报名、发帖或回复的用户数 / 注册用户数 |
| 活动详情转化率 | 报名成功独立用户数 / 活动详情独立访客数 |
| 报名到场率 | 已签到人数 / 已确认报名人数 |
| 讨论转化率 | 产生点赞、收藏或回复的帖子详情访客 / 帖子详情访客 |
| 有效回复率 | 24 小时内获得有效回复的新帖子数 / 新帖子数 |
| 资讯回访率 | 收藏资讯后 7 日内再次打开的用户数 / 收藏资讯用户数 |
| D7 留存 | 注册第 7 日仍有有效行为的用户数 / 当日新增用户数 |
| 举报处理 P95 | 从举报创建到管理员首次处置的 95 分位时长 |

### 3.3 体验质量指标

1. 移动端 LCP 不高于 2.5 秒。
2. CLS 小于 0.1。
3. INP 不高于 200 毫秒。
4. Lighthouse Accessibility 不低于 90。
5. 核心写接口成功率不低于 99.5%。
6. 核心读接口 P95 不高于 800 毫秒。
7. 320px 至 1440px 不出现非预期横向滚动。

---

## 4. 角色与权限

### 4.1 用户角色

| 角色 | 主要权限 |
| --- | --- |
| Guest | 浏览已发布活动、资讯、帖子和公开用户主页 |
| Member | Guest 权限，加报名、发帖、回复、点赞、收藏、举报、管理本人内容 |
| Organizer | Member 权限，加管理本人创建的活动和报名名单 |
| Editor | Member 权限，加创建、编辑、定时发布和下线资讯 |
| Moderator | Member 权限，加审核帖子和评论、处理举报 |
| Admin | Organizer、Editor、Moderator 权限，加用户状态和普通角色管理 |
| Owner | 全部权限，加 Owner 管理和系统级配置 |

### 4.2 权限硬约束

1. Admin 不能授予或撤销 Owner。
2. 系统不能停用、删除或降级最后一名 Owner。
3. Organizer 只能管理自己创建或被授权协作的活动。
4. Editor 不能处理用户封禁和举报。
5. Moderator 不能修改活动、资讯和系统配置。
6. 所有管理操作在服务端再次校验，不信任前端隐藏按钮。
7. 封禁、下线、驳回、删除、取消活动和角色变更必须填写原因。
8. 管理动作必须记录操作者、目标、前后状态、原因、时间和 requestId。

---

## 5. 信息架构与路由

### 5.1 用户端一级结构

| 一级入口 | 默认路由 | 核心任务 |
| --- | --- | --- |
| 活动 | /events | 发现附近和即将开始的活动 |
| 资讯 | /news | 浏览最新 AI 资讯 |
| 交流 | /community | 浏览、发布和参与讨论 |
| 我的 | /me | 管理身份、报名、内容、收藏和消息 |

### 5.2 主要路由

| 页面 | 路由 |
| --- | --- |
| 活动列表 | /events |
| 活动详情 | /events/:eventId |
| 报名凭证 | /events/:eventId/ticket |
| 资讯列表 | /news |
| 资讯详情 | /news/:newsId |
| 交流列表 | /community |
| 帖子详情 | /posts/:postId |
| 发布帖子 | /compose |
| 编辑帖子 | /posts/:postId/edit |
| 登录 | /auth/login |
| 注册 | /auth/register |
| 找回密码 | /auth/recover |
| 公开主页 | /u/:userId |
| 我的主页 | /me |
| 我的活动 | /me/events |
| 我的帖子 | /me/posts |
| 我的回复 | /me/replies |
| 我的收藏 | /me/favorites |
| 草稿箱 | /me/drafts |
| 消息中心 | /me/notifications |
| 资料设置 | /me/profile |
| 安全设置 | /me/security |
| 管理端 | /admin |

### 5.3 导航规则

1. 底部导航只用于四个一级页面。
2. 详情页和编辑页使用全屏任务布局，不重复展示底部导航。
3. 详情页必须有清晰返回按钮。
4. 从列表进入详情后返回，恢复原 Tab、滚动位置和已加载列表。
5. 通过分享链接直接进入详情时，返回按钮回到对应一级列表。
6. 浏览器刷新详情 URL 后，页面可以独立恢复，不依赖上一页内存状态。
7. 桌面端在 1024px 及以上使用左侧一级导航；信息层级不改变。

---

## 6. 全局交互规则

### 6.1 内容优先

1. 整张内容卡片是详情入口。
2. 列表卡片不显示“查看详情”。
3. 列表不显示报名、收藏、分享等操作按钮。
4. 帖子列表可显示互动数字，但只作为信息，不作为多个独立按钮。
5. 每个视口最多一个主要 CTA。
6. 明显可点击的卡片提供按下反馈、鼠标指针和键盘焦点。

### 6.2 登录拦截

登录拦截仅在用户触发受保护动作时发生，不在浏览阶段强制登录。

必须记录：

1. returnTo：原始 URL。
2. scrollPosition：原页面滚动位置。
3. pendingAction：报名、点赞、收藏、回复、举报或发布。
4. pendingPayload：允许恢复的非敏感输入，例如回复草稿。
5. expiresAt：待执行动作有效期，默认 30 分钟。

登录成功后：

1. 返回原页面。
2. 恢复滚动位置。
3. 恢复输入。
4. 自动执行一次 pendingAction。
5. pendingAction 成功或明确失败后删除，防止刷新重复执行。

### 6.3 异步反馈

1. 请求超过 300 毫秒时显示局部加载状态。
2. 写按钮请求中禁用并显示进度，不允许重复点击。
3. 成功 Toast 显示 3 秒，不抢占焦点。
4. 错误信息必须说明原因和恢复方式。
5. 乐观更新失败时回滚数量和状态。
6. 表单失败保留所有合法输入。

### 6.4 页面通用状态

每个列表和详情必须实现：

1. 首次加载骨架。
2. 加载更多状态。
3. 首次空态。
4. 筛选或搜索无结果。
5. 网络离线。
6. 请求超时和重试。
7. 401 登录过期。
8. 403 无权限。
9. 404 已删除或不存在。
10. 410 已下线。
11. 409 状态冲突。
12. 429 操作过频。

---

## 7. 视觉设计系统

### 7.1 设计方向

名称：Neon Canine Glass
关键词：深黑紫、城市夜色、透明毛玻璃、克制荧光、可亲近的赛博小狗、内容优先
主题：仅深色

小狗形象只允许出现在：

1. 活动页品牌首屏。
2. 首次空态。
3. 报名或发布成功反馈。
4. 新用户首次引导。
5. 品牌分享图。

小狗不得出现在每张卡片、每个按钮或管理端数据表中。

### 7.2 颜色 Token

| Token | 值 | 用途 |
| --- | --- | --- |
| color-bg-base | #070611 | 页面底色 |
| color-bg-elevated | #100C1D | 抬升区域 |
| color-surface-1 | rgba(25, 18, 43, 0.72) | 常规卡片 |
| color-surface-2 | rgba(35, 25, 57, 0.82) | 浮层和详情底栏 |
| color-primary | #A98BFF | 主品牌紫 |
| color-primary-strong | #8B5CFF | 主按钮和选中态 |
| color-cyan | #53E7FF | 信息和链接 |
| color-magenta | #FF5BD6 | 少量品牌高光 |
| color-success | #72F2A5 | 成功 |
| color-warning | #FFC96B | 警告 |
| color-danger | #FF6B8A | 错误和危险动作 |
| color-text-1 | #F7F4FF | 主文字 |
| color-text-2 | #C4BDD5 | 次文字 |
| color-text-3 | #8C849F | 弱文字 |
| color-divider | rgba(197, 171, 255, 0.12) | 分隔线 |
| color-focus | #53E7FF | 键盘焦点 |

颜色约束：

1. 正文与背景对比度不低于 4.5:1。
2. 大字号和图形元素对比度不低于 3:1。
3. 状态不能只用颜色表达，必须同时有文字或图标。
4. 荧光仅用于主动作、选中、焦点和关键状态。
5. 普通卡片不使用高亮完整边框。

### 7.3 字体

1. 品牌和英文标题：Oxanium，自托管 WOFF2。
2. 中文和通用 UI：Noto Sans SC，自托管关键字重。
3. 数字、日期和容量：JetBrains Mono。
4. 字体加载使用 font-display: swap。
5. 中文正文不使用等宽字体。

### 7.4 字号阶梯

| 角色 | 移动端 | 桌面端 | 行高 |
| --- | --- | --- | --- |
| Brand Display | 32px | 44px | 1.15 |
| Detail H1 | 28px | 36px | 1.25 |
| Page Title | 24px | 30px | 1.3 |
| Section Title | 20px | 22px | 1.35 |
| Card Title | 17px | 18px | 1.4 |
| Body | 16px | 16px | 1.7 |
| Meta | 13px | 14px | 1.5 |
| Tag | 12px | 12px | 1 |

活动、资讯、交流相同层级字号偏差不得超过 1px。

### 7.5 间距与尺寸

1. 基础间距：4、8、12、16、20、24、32、40、48px。
2. H5 页面左右边距：16px；414px 及以上为 20px。
3. 桌面内容区最大宽度：1200px。
4. 长正文最大宽度：720px。
5. 卡片圆角：18px。
6. 重点卡片和大浮层圆角：24px。
7. 输入框和主按钮高度：48px。
8. 最小触控区域：44 x 44px。
9. 相邻触控目标间距：至少 8px。

### 7.6 图标

1. 统一使用 Lucide 线性 SVG。
2. 元信息图标：16px。
3. 按钮图标：20px。
4. 底部导航图标：22px。
5. 描边：1.75px。
6. 同一层级不得混用填充和线性图标。
7. 图标按钮必须有 aria-label。

推荐映射：

| 信息 | 图标 |
| --- | --- |
| 时间 | CalendarDays |
| 地点 | MapPin |
| 距离 | Navigation |
| 名额 | Users |
| 费用 | Ticket |
| 来源 | Newspaper |
| 浏览 | Eye |
| 回复 | MessageCircle |
| 点赞 | Heart |
| 收藏 | Bookmark |
| 举报 | Flag |

### 7.7 卡片规范

共同骨架：

1. 可选封面。
2. 最多两个标签。
3. 标题。
4. 摘要或结构化元信息。
5. 来源、作者或时间。

视觉规则：

1. 卡片使用半透明表面、轻阴影和顶部高光建立层级。
2. 常规卡片无完整亮边框。
3. 选中、焦点或重要状态才显示细描边。
4. 卡片内部不再嵌套多个卡片。
5. 卡片标题最多两行，摘要最多三行。
6. 标签高度统一为 24px。
7. 同一卡片标签最多两个，多余标签在详情展示。

### 7.8 毛玻璃

毛玻璃只用于：

1. H5 底部导航。
2. 详情页固定动作栏。
3. Modal、Sheet、Popover。
4. 活动页品牌首屏的局部表面。

普通列表卡片不依赖高强度 blur。低性能设备和 reduced-transparency 环境必须降级为不透明表面。

### 7.9 动效

1. 页面进入：220 至 280ms，仅 opacity 和 transform。
2. 卡片按下反馈：80 至 120ms。
3. Sheet 进入：240ms；退出：180ms。
4. 列表首屏最多 6 项使用 30ms 轻微 stagger。
5. 动效必须可中断，不阻塞点击。
6. prefers-reduced-motion 下取消位移、缩放和 stagger。
7. 禁止循环动效、频闪、持续发光脉冲和正文 glitch。

### 7.10 响应式

必须验收宽度：320、375、414、768、1024、1440px。

| 范围 | 布局 |
| --- | --- |
| 320-767 | 单列 H5、底部导航、全屏详情 |
| 768-1023 | 居中单列或双列列表，底部导航仍可用 |
| 1024-1439 | 左侧导航、中央内容、可选右侧关联信息 |
| 1440+ | 最大 1200px 内容画布，长正文仍限制 720px |

固定导航必须为内容预留 safe-area 和底部空间。横屏不得遮挡输入框或固定动作栏。

---

## 8. 用户端页面规格

## 8.1 活动列表

目标：用户在 10 秒内判断“什么时候、在哪里、是否值得去、是否还有名额”。

页面结构：

1. 品牌首屏：AI 城市圈、Slogan、克制的小狗品牌视觉。
2. 重点活动：最多 1 个运营置顶活动。
3. 即将开始：按开始时间升序。
4. 附近活动：获得定位权限时按距离展示；未授权时按当前城市展示。
5. 已结束活动：默认不进入首屏，可在独立归档入口查看。

列表默认不显示搜索筛选工具条。搜索和筛选作为独立图标入口打开全屏搜索或底部 Sheet，不占用内容首屏。

活动卡片字段：

1. cover_url。
2. status_label。
3. title。
4. start_time。
5. location_name。
6. distance_km，可空。
7. remaining_capacity。
8. organizer_name。

不显示：

1. 查看详情按钮。
2. 报名按钮。
3. 需要登录按钮。
4. 长篇活动说明。

排序规则：

1. 运营置顶。
2. 已登录用户已报名且未开始的活动。
3. 未来 7 天即将开始。
4. 距离优先。
5. 发布时间倒序。

定位规则：

1. 首次访问不强制弹权限。
2. 用户主动点击“附近”时请求浏览器定位。
3. 拒绝后保存选择，并提供城市手动选择。
4. 距离仅用于排序和展示，不保存精确用户轨迹。

## 8.2 活动详情

页面顺序：

1. 返回和分享。
2. 封面、活动状态。
3. 标题。
4. 时间、地点、距离、名额、费用。
5. 主办方。
6. 活动亮点。
7. 详细介绍。
8. 议程。
9. 报名说明。
10. 地图和路线。
11. 参与者头像摘要，用户可选择不公开参与状态。
12. 相关推荐。
13. 固定底部动作栏。

固定动作栏只有一个主动作：

| 状态 | 主动作 |
| --- | --- |
| 可报名 | 立即报名 |
| 已报名 | 查看报名凭证 |
| 已候补 | 查看候补状态 |
| 名额已满且可候补 | 加入候补 |
| 名额已满且不可候补 | 名额已满，禁用 |
| 报名截止 | 报名已截止，禁用 |
| 活动进行中 | 活动进行中，禁用 |
| 已结束 | 活动已结束，禁用 |
| 已取消 | 活动已取消，禁用 |

活动详情必须支持独立 URL、刷新恢复、分享预览和服务端状态重新确认。

## 8.3 活动报名

报名流程：

1. 用户点击主动作。
2. 未登录则进入登录，成功后回跳并继续。
3. 若活动无扩展问题，直接确认报名。
4. 若有扩展问题，打开报名 Sheet 或独立表单。
5. 服务端事务内校验活动状态、截止时间、名额、重复报名和用户状态。
6. 成功后显示报名成功状态和小狗确认插画。
7. 进入报名凭证。
8. “我的活动”立即可见。

报名凭证包含：

1. 活动标题和封面。
2. 报名状态。
3. 活动时间和地点。
4. 报名编号。
5. 签到二维码，启用签到时显示。
6. 加入日历。
7. 路线。
8. 取消报名。

取消规则：

1. 取消前二次确认。
2. 显示活动规定的取消截止时间。
3. 取消成功后释放名额。
4. 有候补时按队列顺序转为 confirmed。
5. 被转正用户收到通知。
6. 连续请求必须幂等。

并发规则：

1. 不允许“先计数再插入”的非事务写法。
2. 容量检查和报名写入必须在同一事务。
3. 超卖冲突返回 409 EVENT_CAPACITY_EXCEEDED。
4. 客户端刷新最新余位并显示可恢复提示。

## 8.4 资讯列表

目标：快速阅读最新 AI 资讯，不被按钮和装饰打断。

页面结构：

1. 简洁页标题“资讯”。
2. 重点资讯最多 1 条。
3. 最新资讯时间流。
4. 专题入口，只有存在运营专题时显示。

资讯卡片字段：

1. cover_url，可空。
2. category。
3. title。
4. summary，两行。
5. source_name。
6. published_at。

列表不显示收藏、分享、评论或查看详情按钮。

排序规则：

1. 置顶且未过期。
2. published_at 倒序。
3. 相同时间按 public_id 稳定排序。

## 8.5 资讯详情

页面顺序：

1. 返回和分享。
2. 栏目。
3. 标题。
4. 来源、作者、发布时间和更新时间。
5. 编辑摘要。
6. 正文。
7. 原文链接，存在时显示。
8. 收藏动作。
9. 相关阅读。
10. 关联讨论。

正文规则：

1. 支持标题、段落、列表、引用、代码块、图片和链接。
2. 所有 HTML 服务端净化。
3. 外链标识来源域名并在新窗口打开。
4. 图片声明尺寸，避免布局偏移。
5. 长正文桌面宽度不超过 720px。

关联讨论不直接复制资讯评论区。管理员或用户可以发起独立帖子并关联资讯，讨论沉淀在交流板块。

## 8.6 交流列表

页面结构：

1. 简洁页标题“交流”。
2. 发布入口，仅一个图标加文字按钮或悬浮按钮。
3. 推荐帖子，最多 2 条。
4. 最新帖子流。

帖子卡片字段：

1. 作者头像、昵称。
2. 发布时间。
3. 标题。
4. 正文摘要，最多三行。
5. 第一张图片或媒体摘要。
6. 最多两个话题。
7. 点赞数和回复数，仅作轻量信息。

卡片不显示查看详情、阅读全文、回复、收藏等按钮。

## 8.7 发布和编辑帖子

字段：

| 字段 | 规则 |
| --- | --- |
| title | 必填，4-80 个字符 |
| body | 必填，10-10000 个字符 |
| media | 选填，最多 5 张图片，每张不超过 5MB |
| tags | 1-3 个，从已存在话题选择或申请新话题 |
| linked_news_id | 选填，关联一条资讯 |
| linked_event_id | 选填，关联一场活动 |

流程：

1. 未登录点击发布，登录后回到编辑器。
2. 输入后 2 秒防抖保存本地草稿。
3. 已登录时每 30 秒保存服务端草稿。
4. 离开未保存内容时提示。
5. 提交中禁用重复提交。
6. 低风险用户可直接 published；需要审核时进入 pending。
7. 发布成功跳转帖子详情。
8. 待审核内容在本人详情显示状态，但不对其他用户公开。
9. 我的帖子同步出现。

编辑规则：

1. 仅作者、Moderator、Admin、Owner 可编辑。
2. 作者编辑已发布帖子后，根据风控配置保持 published 或重新 pending。
3. 使用 version 和 If-Match 防止覆盖更新。
4. 冲突返回 409 VERSION_CONFLICT，并允许用户复制当前输入。

删除规则：

1. 作者执行软删除。
2. 管理员执行 hidden 或 soft delete，并记录原因。
3. 有回复的帖子保留“内容已删除”上下文，不破坏评论引用。

## 8.8 帖子详情与回复

页面顺序：

1. 返回和更多菜单。
2. 作者信息。
3. 标题、正文、图片、关联资讯或活动。
4. 点赞和收藏。
5. 评论排序。
6. 评论树。
7. 固定回复输入栏。
8. 相关帖子。

评论规则：

1. 一级评论加一层回复，视觉最多两级。
2. 数据可保存 parent_comment_id 和 reply_to_user_id。
3. 回复超过两级时仍折叠到所属一级评论下。
4. 默认按创建时间正序；可切换热门，但不在首屏放常驻切换器。
5. 用户回复后定位并短暂高亮自己的回复。
6. 回复失败保留输入。
7. 删除评论保留“内容已删除”占位。
8. hidden 评论仅作者和管理员可见状态说明。

点赞与收藏：

1. 使用显式 PUT 创建、DELETE 删除，不使用 toggle。
2. 重复请求返回同一最终状态。
3. 客户端可以乐观更新，失败必须回滚。

举报：

1. 更多菜单进入举报 Sheet。
2. 原因：垃圾广告、辱骂骚扰、违法违规、虚假信息、隐私泄露、其他。
3. 其他原因必须填写说明。
4. 同一用户对同一目标只能存在一个未关闭举报。
5. 举报后不自动隐藏内容，除非命中明确安全规则。

## 8.9 我的

游客态：

1. 小狗身份插画。
2. 一句价值说明。
3. 唯一主按钮“登录 / 注册”。
4. 不显示“需要登录”等重复占位按钮。

登录态：

1. 头像、昵称、简介和公开主页入口。
2. 消息中心和未读数。
3. 我的活动。
4. 我的帖子。
5. 我的回复。
6. 我的收藏。
7. 草稿箱。
8. 资料设置。
9. 安全设置。
10. 退出登录。

退出登录放在安全设置底部，不与普通导航混排。

## 8.10 公开用户主页

公开字段：

1. 头像。
2. 昵称。
3. 简介。
4. 城市，可由用户关闭。
5. 加入时间。
6. 公开帖子。
7. 用户选择公开的活动参与摘要。

永不公开：

1. 手机号。
2. 邮箱。
3. 密码或认证方式。
4. 收藏。
5. 举报。
6. 登录设备和 IP。
7. 管理审计信息。

## 8.11 消息中心

消息类型：

1. 新回复。
2. 被点赞。
3. 活动时间或地点变更。
4. 报名确认、候补转正、活动取消。
5. 帖子或评论审核结果。
6. 举报处理结果。
7. 系统通知。

功能：

1. 单条已读。
2. 全部已读。
3. 按类型查看，作为二级 Sheet 或独立页面。
4. 点击通知进入对应内容并定位。
5. 我的 Tab 仅在有未读时显示角标。

---

## 9. 账号与会话

### 9.1 注册

必填字段：

1. username：4-24 位，字母、数字和下划线，大小写不敏感唯一。
2. nickname：2-20 个可见字符。
3. password：8-72 个字符。
4. password_confirm：必须一致。
5. 同意服务条款和隐私政策。

选填字段：

1. email：用于接收重置链接和重要通知。
2. city。

不包含手机号验证码、邮箱验证码或图形验证码。遭遇自动化攻击时使用速率限制、蜜罐字段和风险挑战，不改变主流程。

注册成功：

1. 创建用户和凭据。
2. 创建会话。
3. 自动登录。
4. 返回触发注册前的页面。
5. 继续 pendingAction。

### 9.2 登录

字段：

1. identifier：用户名或已绑定邮箱。
2. password。
3. 显示或隐藏密码。

要求：

1. 支持浏览器密码管理器和 autocomplete。
2. 错误文案不泄露账号是否存在。
3. 连续失败触发账号加 IP 组合限流。
4. 失败不清空 identifier。
5. 登录成功轮换 refresh token。

### 9.3 密码找回

不使用验证码。

1. 已绑定邮箱用户收到一次性签名重置链接。
2. 链接有效期 30 分钟且只能使用一次。
3. 未绑定邮箱用户由管理员核验后生成一次性重置链接。
4. 重置成功撤销所有旧会话。

### 9.4 会话

1. 密码使用 Argon2id 哈希，不使用 SHA-256 加盐作为密码哈希。
2. access token 短期有效。
3. refresh token 使用 HttpOnly、Secure、SameSite=Lax Cookie。
4. refresh token 仅保存哈希，执行轮换和复用检测。
5. 用户角色和状态在高风险动作前读取最新服务端状态。
6. 支持退出当前设备和退出全部设备。
7. JWT_SECRET 在生产环境必须显式配置，不允许默认值启动。

---

## 10. 管理端

### 10.1 管理端视觉

管理端与用户端共享颜色、字体和状态 Token，但采用高密度桌面布局：

1. 左侧导航。
2. 顶部页面标题和唯一主要动作。
3. 表格、筛选栏和抽屉编辑。
4. 不复用用户端大卡片瀑布流。
5. 危险动作使用独立区域和清晰确认。
6. 768px 以下只保证应急可用，主要目标为 1024px 以上。

### 10.2 管理首页

展示：

1. 今日新增用户。
2. 待审核帖子和评论。
3. 未处理举报。
4. 即将开始活动。
5. 今日发布资讯。
6. 关键异常和审计告警。

不将管理首页做成纯装饰数据大屏。

### 10.3 活动管理

功能：

1. 创建、编辑、复制活动。
2. 草稿、定时发布、立即发布、关闭、取消、归档。
3. 设置主办方、协作者、时间、地点、经纬度、容量、候补、报名截止和费用说明。
4. 配置报名问题。
5. 查看报名名单。
6. 手动确认、拒绝、取消报名。
7. 导出 CSV。
8. 签到。
9. 活动变更通知。

取消活动必须：

1. 填写原因。
2. 显示受影响报名人数。
3. 二次确认。
4. 批量通知报名用户。
5. 写入审计。

### 10.4 资讯管理

功能：

1. 创建、编辑、预览、定时发布、立即发布、下线、归档。
2. 管理来源、作者、原文 URL、栏目、标签和封面。
3. Markdown 或受控富文本编辑。
4. 设置置顶和置顶失效时间。
5. 关联社区讨论。
6. 查看阅读和收藏数据。

资讯下线保留历史记录，不硬删除。

### 10.5 帖子和评论管理

功能：

1. 待审核队列。
2. 已发布、已驳回、已隐藏、已删除筛选。
3. 查看上下文，不脱离原帖审核评论。
4. 通过、驳回、隐藏、恢复。
5. 批量操作。
6. 操作原因模板和自定义原因。
7. 通知作者。

### 10.6 举报管理

处理流程：

1. open。
2. in_review。
3. resolved、rejected 或 duplicate。

处置动作：

1. 不处理并驳回。
2. 隐藏内容。
3. 删除内容。
4. 警告用户。
5. 临时封禁。
6. 永久封禁。
7. 合并重复举报。

管理员必须看到目标内容、上下文、历史举报、作者历史处置和操作审计。

### 10.7 用户管理

功能：

1. 关键词搜索。
2. 状态、角色、注册时间筛选。
3. 查看公开资料和治理摘要。
4. active、suspended、deleted 状态流转。
5. 分配非 Owner 角色。
6. 撤销全部会话。
7. 生成一次性密码重置链接。
8. 查看与用户有关的审计记录。

不得在列表直接展示密码、Token、完整邮箱、完整手机号或 IP。

### 10.8 审计日志

字段：

1. actor_id。
2. actor_role。
3. action。
4. target_type。
5. target_id。
6. before_snapshot。
7. after_snapshot。
8. reason。
9. request_id。
10. ip_hash。
11. user_agent_summary。
12. created_at。

审计日志仅追加，不提供普通删除。敏感字段在写入前脱敏。

---

## 11. 领域状态机

### 11.1 用户

active 可转 suspended 或 deleted。
suspended 可转 active 或 deleted。
deleted 不恢复登录，可按数据保留规则匿名化。

### 11.2 活动发布状态

draft -> scheduled -> published -> closed -> archived
draft -> published
published -> canceled -> archived

活动时间阶段不存储，由时间推导：

1. upcoming：当前时间早于 start_time。
2. ongoing：当前时间位于 start_time 和 end_time 之间。
3. ended：当前时间晚于 end_time。

### 11.3 报名

pending -> confirmed
pending -> rejected
pending -> canceled
confirmed -> canceled
confirmed -> checked_in
confirmed -> no_show
waitlisted -> confirmed
waitlisted -> canceled

### 11.4 资讯

draft -> scheduled -> published -> offline -> archived
draft -> published
offline -> published，仅允许管理员恢复并记录原因

### 11.5 帖子

draft -> pending -> published
pending -> rejected
published -> pending，作者重大编辑时
published -> hidden -> published
published -> deleted
rejected -> draft，允许作者修改后再次提交

### 11.6 评论

pending -> published
pending -> hidden
published -> hidden -> published
published -> deleted

### 11.7 举报

open -> in_review -> resolved
open -> in_review -> rejected
open -> duplicate

---

## 12. 数据模型

生产目标数据库为 PostgreSQL。当前 SQLite 可继续用于本地 Demo 和迁移过渡，但新领域模型必须使用可迁移的数据类型和显式约束。

所有业务实体建议包含：

1. id：内部主键。
2. public_id：对外不可枚举 ID。
3. version：乐观锁版本。
4. created_at。
5. updated_at。
6. deleted_at，可空。

### 12.1 用户域

users：

1. id。
2. public_id，唯一。
3. username_normalized，唯一。
4. nickname。
5. avatar_url。
6. bio。
7. city_code。
8. city_public。
9. status。
10. created_at、updated_at、deleted_at。

user_credentials：

1. user_id，唯一。
2. password_hash。
3. password_changed_at。
4. email_normalized，可空唯一。
5. email_verified_at，可空。
6. failed_login_count。
7. locked_until。

user_sessions：

1. id、public_id。
2. user_id。
3. refresh_token_hash。
4. token_family_id。
5. expires_at。
6. revoked_at。
7. revoke_reason。
8. last_seen_at。
9. device_summary。

roles、user_roles：

1. role_code 唯一。
2. user_id 加 role_id 唯一。
3. granted_by。
4. granted_at。

### 12.2 活动域

events：

1. public_id。
2. title、summary、body。
3. cover_url。
4. organizer_id。
5. start_time、end_time。
6. timezone，默认 Asia/Shanghai。
7. registration_deadline。
8. location_name、address。
9. city_code。
10. latitude、longitude。
11. capacity。
12. waitlist_capacity。
13. fee_type、fee_description。
14. status。
15. publish_at。
16. cancel_reason。
17. version、时间字段、deleted_at。

约束：

1. end_time > start_time。
2. registration_deadline <= start_time。
3. capacity >= 0。
4. waitlist_capacity >= 0。
5. latitude 位于 -90 到 90。
6. longitude 位于 -180 到 180。
7. organizer 删除时不得与 NOT NULL 加 SET NULL 冲突；应归档组织者身份或限制删除。

event_registrations：

1. public_id。
2. event_id。
3. user_id。
4. status。
5. queue_position，可空。
6. registration_code，唯一。
7. confirmed_at、canceled_at、checked_in_at。
8. cancel_reason。
9. created_at、updated_at。

唯一约束：event_id 加 user_id。
索引：event_id 加 status，user_id 加 status。

registration_questions、registration_answers 用于活动自定义报名信息。答案按最小必要原则保存。

### 12.3 内容域

news：

1. public_id。
2. title、summary、body。
3. cover_url。
4. category_id。
5. source_name、source_url、author_name。
6. status。
7. publish_at、published_at。
8. pinned_until。
9. created_by、updated_by。
10. version、时间字段、deleted_at。

posts：

1. public_id。
2. author_id。
3. title、body。
4. status。
5. moderation_reason。
6. linked_news_id，可空。
7. linked_event_id，可空。
8. published_at。
9. version、时间字段、deleted_at。

comments：

1. public_id。
2. post_id。
3. author_id。
4. parent_comment_id，可空。
5. root_comment_id，可空。
6. reply_to_user_id，可空。
7. body。
8. status。
9. moderation_reason。
10. version、时间字段、deleted_at。

media_assets：

1. public_id。
2. owner_id。
3. storage_key。
4. mime_type。
5. byte_size。
6. width、height。
7. sha256。
8. scan_status。
9. created_at、deleted_at。

tags、content_tags：

1. tag slug 和 name 唯一。
2. content_type、content_id、tag_id 组合唯一。
3. 不再用逗号字符串存储标签。

### 12.4 互动域

使用显式关系表，避免无法建立外键的泛化 target_type 加 target_id。

1. post_likes。
2. event_favorites。
3. news_favorites。
4. post_favorites。
5. content_views。

每类互动使用 user_id 加目标 id 唯一约束。

### 12.5 治理与基础设施

reports：

1. public_id。
2. reporter_id。
3. target_type。
4. target_public_id。
5. reason_code。
6. details。
7. status。
8. duplicate_of。
9. created_at、updated_at。

moderation_cases、moderation_decisions：

1. 聚合举报。
2. 记录证据快照。
3. 记录决定、原因、操作者和状态变化。

notifications：

1. user_id。
2. type。
3. actor_id，可空。
4. target_type、target_public_id。
5. title、body。
6. read_at。
7. created_at。

idempotency_keys：

1. user_id 或 client_id。
2. key。
3. request_hash。
4. response_status。
5. response_body。
6. expires_at。

outbox_events：

1. event_type。
2. aggregate_type、aggregate_id。
3. payload。
4. published_at。
5. retry_count。

用于事务提交后可靠生成通知、统计和未来 MCP 事件。

---

## 13. API 契约

### 13.1 通用约定

基础路径：/api/v1

成功响应：

    {
      "ok": true,
      "data": {},
      "meta": {
        "requestId": "req_xxx",
        "nextCursor": null
      }
    }

错误响应：

    {
      "ok": false,
      "error": {
        "code": "EVENT_CAPACITY_EXCEEDED",
        "message": "活动名额刚刚报满",
        "details": {},
        "requestId": "req_xxx"
      }
    }

约定：

1. 用户信息流使用游标分页。
2. 管理端表格可使用 page 和 pageSize。
3. 时间统一传 ISO 8601，业务时区默认 Asia/Shanghai。
4. 外部 API 只暴露 public_id。
5. 创建类接口支持 Idempotency-Key。
6. 编辑类接口支持 If-Match 或 version。
7. 点赞和收藏使用 PUT/DELETE，不使用 toggle。

### 13.2 认证接口

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | /auth/register | Guest | 账号密码注册 |
| POST | /auth/login | Guest | 账号密码登录 |
| POST | /auth/refresh | Session | 轮换刷新令牌 |
| POST | /auth/logout | Member | 退出当前设备 |
| POST | /auth/logout-all | Member | 退出全部设备 |
| POST | /auth/recover | Guest | 发送密码重置链接 |
| POST | /auth/reset-password | Recovery token | 重置密码 |
| PATCH | /me/password | Member | 修改密码 |
| GET | /me/sessions | Member | 查看会话 |
| DELETE | /me/sessions/:sessionId | Member | 撤销会话 |

不得提供 /auth/send-code。

### 13.3 用户接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /me | 当前用户资料 |
| PATCH | /me | 更新当前用户资料 |
| GET | /me/events | 我的报名 |
| GET | /me/posts | 我的帖子 |
| GET | /me/replies | 我的回复 |
| GET | /me/favorites | 我的收藏 |
| GET | /me/drafts | 草稿 |
| GET | /me/notifications | 消息 |
| PUT | /me/notifications/:id/read | 单条已读 |
| PUT | /me/notifications/read-all | 全部已读 |
| GET | /users/:userId | 公开主页 |
| GET | /users/:userId/posts | 公开帖子 |

### 13.4 活动接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /events | 已发布活动列表 |
| GET | /events/:eventId | 活动详情 |
| POST | /events/:eventId/registrations | 报名或候补 |
| GET | /events/:eventId/registration | 当前用户报名状态 |
| DELETE | /events/:eventId/registration | 取消报名 |
| GET | /events/:eventId/ticket | 报名凭证 |

### 13.5 资讯接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /news | 资讯列表 |
| GET | /news/:newsId | 资讯详情 |
| PUT | /news/:newsId/favorite | 收藏 |
| DELETE | /news/:newsId/favorite | 取消收藏 |

### 13.6 帖子和评论接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /posts | 帖子流 |
| POST | /posts | 创建草稿或提交帖子 |
| GET | /posts/:postId | 帖子详情 |
| PATCH | /posts/:postId | 编辑帖子 |
| DELETE | /posts/:postId | 删除本人帖子 |
| GET | /posts/:postId/comments | 评论列表 |
| POST | /posts/:postId/comments | 发表评论或回复 |
| PATCH | /comments/:commentId | 编辑本人评论 |
| DELETE | /comments/:commentId | 删除本人评论 |
| PUT | /posts/:postId/like | 点赞 |
| DELETE | /posts/:postId/like | 取消点赞 |
| PUT | /posts/:postId/favorite | 收藏 |
| DELETE | /posts/:postId/favorite | 取消收藏 |
| POST | /reports | 举报 |

### 13.7 管理接口

| 资源 | 核心接口 |
| --- | --- |
| 活动 | GET/POST /admin/events，GET/PATCH /admin/events/:id，POST publish/close/cancel/archive |
| 报名 | GET /admin/events/:id/registrations，PATCH registration 状态，POST check-in，GET export |
| 资讯 | GET/POST /admin/news，GET/PATCH /admin/news/:id，POST publish/offline/archive |
| 帖子 | GET /admin/posts，POST /admin/posts/:id/approve 或 reject/hide/restore |
| 评论 | GET /admin/comments，POST /admin/comments/:id/approve 或 hide/restore |
| 举报 | GET /admin/reports，GET /admin/reports/:id，POST resolve/reject/duplicate |
| 用户 | GET /admin/users，GET /admin/users/:id，PATCH status，PATCH roles，POST revoke-sessions |
| 审计 | GET /admin/audit-logs |

管理动作不能只靠 PATCH 任意 status，必须使用表达业务意图的动作端点或严格状态转换校验。

### 13.8 核心错误码

| HTTP | code | 场景 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | 字段校验失败 |
| 401 | AUTH_REQUIRED | 未登录 |
| 401 | SESSION_EXPIRED | 会话过期 |
| 401 | TOKEN_REUSE_DETECTED | 刷新令牌复用 |
| 403 | PERMISSION_DENIED | 无权限 |
| 403 | USER_SUSPENDED | 用户被封禁 |
| 404 | RESOURCE_NOT_FOUND | 不存在 |
| 409 | VERSION_CONFLICT | 编辑版本冲突 |
| 409 | IDEMPOTENCY_CONFLICT | 相同 Key 请求体不同 |
| 409 | ALREADY_REGISTERED | 已报名 |
| 409 | EVENT_CAPACITY_EXCEEDED | 名额已满 |
| 409 | INVALID_STATE_TRANSITION | 非法状态变化 |
| 410 | CONTENT_OFFLINE | 内容已下线 |
| 422 | REGISTRATION_CLOSED | 报名已截止 |
| 429 | RATE_LIMITED | 操作过频 |

---

## 14. 搜索、排序和推荐

### 14.1 搜索

搜索是独立入口，不作为每页常驻工具条。

可搜索：

1. 活动标题、摘要、地点、主办方。
2. 资讯标题、摘要、正文、来源。
3. 帖子标题、正文、话题、作者昵称。

本地 SQLite 使用 FTS5；PostgreSQL 使用全文索引。搜索结果必须先做内容状态和权限过滤。

### 14.2 附近活动

1. PostgreSQL 阶段使用 PostGIS。
2. 查询按用户给定坐标和半径执行。
3. 不把全部活动读入内存后再分页。
4. 没有定位时按 city_code 和时间排序。
5. 位置只在请求期间使用，不默认保存用户精确坐标。

### 14.3 推荐

首期使用可解释规则：

1. 运营置顶。
2. 时间新鲜度。
3. 城市和距离。
4. 用户已收藏话题。
5. 互动质量。

推荐结果不得绕过内容状态和封禁规则。后续模型推荐必须保留可关闭、可解释和隐私边界。

---

## 15. 内容治理

### 15.1 发布审核

1. 新用户、近期违规用户和高风险内容进入 pending。
2. 低风险成员可以直接 published。
3. 自动规则只做分流，不直接替代管理员最终处置。
4. 作者始终能在“我的帖子”看到待审核和驳回状态。
5. 驳回必须给出原因和修改入口。

### 15.2 内容可见性

1. published：所有用户可见。
2. pending：作者和管理员可见。
3. rejected：作者和管理员可见。
4. hidden：作者看到状态说明，其他用户不可见。
5. deleted：按上下文保留占位。

未发布或已下线内容不得被其他用户通过详情接口、公开主页、搜索、推荐、点赞、收藏或评论访问。

### 15.3 申诉

完整产品路线必须包含申诉：

1. 用户对封禁、帖子驳回和内容下线发起申诉。
2. 申诉不能由原处置人单独终审。
3. 申诉结果通知用户并写审计。

---

## 16. Demo 数据

Demo 数据必须显式执行，不能在所有环境启动时自动写入。

### 16.1 环境规则

1. 仅当 DEMO_SEED_ENABLED=true 时允许执行。
2. NODE_ENV=production 时默认拒绝执行。
3. Seed 可重复运行且不产生重复数据。
4. Demo 账号和密码不得用于生产。

### 16.2 Demo 账号

| 角色 | 账号 | 本地 Demo 密码 |
| --- | --- | --- |
| Owner | owner_demo | TaiDemo#2026 |
| Admin | admin_demo | TaiDemo#2026 |
| Organizer | organizer_demo | TaiDemo#2026 |
| Editor | editor_demo | TaiDemo#2026 |
| Moderator | moderator_demo | TaiDemo#2026 |
| Member | member_demo | TaiDemo#2026 |

### 16.3 Demo 内容规模

1. 12 场活动：草稿、定时、可报名、将满、已满、候补、进行中、结束、取消等状态。
2. 20 条资讯：不同栏目、来源、置顶、定时、下线状态。
3. 30 篇帖子：纯文字、图片、关联资讯、关联活动、待审核、驳回和隐藏状态。
4. 50 条评论和回复。
5. 8 个话题。
6. 15 条通知。
7. 6 条举报和不同处理状态。
8. 每个角色至少 1 个可用于验收的完整行为链。

### 16.4 Demo 内容质量

1. 使用真实可读的中文标题和正文，不使用 lorem ipsum。
2. 时间分布在过去 30 天和未来 60 天。
3. 地点包含同城多个区域和可计算距离的坐标。
4. 图片使用本地可控素材或稳定资源。
5. 数据能覆盖所有空态、满员、候补、审核和下线场景。

---

## 17. 安全与隐私

### 17.1 安全

1. Argon2id 密码哈希。
2. 登录、注册、找回密码和写接口限流。
3. CORS 使用显式白名单。
4. 生产环境无默认 JWT 密钥。
5. Refresh token 轮换和复用检测。
6. CSRF 防护适配 Cookie 策略。
7. 富文本服务端净化，防止存储型 XSS。
8. 上传校验 MIME、大小、尺寸、扩展名和恶意内容。
9. 数据库参数化查询。
10. 管理端权限服务端校验。
11. 高风险写操作事务化和幂等。
12. 敏感日志脱敏，不记录密码、Cookie、Token 和完整认证头。

### 17.2 隐私

1. 只收集完成功能所需的数据。
2. 精确定位不默认持久化。
3. 用户可控制城市和活动参与状态是否公开。
4. 删除账号后按保留策略匿名化公开内容。
5. 导出报名名单只对有权限的 Organizer 和管理员开放。
6. MCP/SKILL 不返回用户私密资料、报名名单、会话和审计敏感字段。

---

## 18. 可访问性

1. 所有触控目标至少 44 x 44px。
2. 正文至少 16px。
3. 普通文本对比度至少 4.5:1。
4. 页面标题层级连续。
5. 图标按钮有 aria-label。
6. 表单字段有可见 label，不只用 placeholder。
7. 字段错误位于对应字段下方，并用 aria-live 宣告。
8. 键盘焦点可见。
9. Modal 和 Sheet 有焦点陷阱、关闭方式和返回焦点。
10. 路由切换后焦点移动到主内容标题。
11. 支持 prefers-reduced-motion。
12. 颜色不是唯一状态表达。
13. 图片有 alt；装饰图使用空 alt。
14. 动态 Toast 不抢焦点。

---

## 19. 性能与可观测性

### 19.1 前端性能

1. 路由级代码拆分。
2. 图片使用 AVIF/WebP 和响应式尺寸。
3. 首屏外图片懒加载。
4. 图片预留 aspect-ratio。
5. 骨架尺寸与真实内容一致。
6. 只预加载关键字体。
7. 列表超过 50 项时评估虚拟化。
8. 不使用造成重排的动画。

### 19.2 服务端性能

1. 消除帖子列表 N+1 查询。
2. 数据库完成分页、全文搜索和距离筛选。
3. 列表只返回卡片所需字段。
4. 详情和列表使用不同查询模型。
5. 热点公开内容允许短期缓存。
6. 状态相关响应必须防止错误缓存。

### 19.3 可观测性

每个请求记录：

1. requestId。
2. route。
3. statusCode。
4. durationMs。
5. actorId，脱敏。
6. errorCode。

关键业务事件：

1. registration_created。
2. registration_canceled。
3. waitlist_promoted。
4. post_submitted。
5. post_published。
6. comment_created。
7. report_created。
8. moderation_decided。
9. session_reuse_detected。

---

## 20. MCP 与 SKILL 预留

### 20.1 原则

1. MCP/SKILL 复用应用服务层，不直接查询数据库。
2. 首批只读开放已发布活动、资讯和帖子。
3. 所有内容遵循与 Web 相同的可见性规则。
4. 不向 AI 返回用户私密资料、报名记录、未审核内容和管理信息。
5. 写入能力未来必须使用带 Scope 的身份和审计。

### 20.2 预留只读能力

1. list_events：按城市、时间、距离查询公开活动。
2. get_event：读取公开活动详情和报名方式。
3. list_news：查询最新公开资讯。
4. get_news：读取公开资讯详情。
5. list_posts：查询公开帖子。
6. get_post：读取公开帖子及公开评论。

### 20.3 未来写能力

1. register_event。
2. create_post。
3. create_comment。
4. favorite_content。

未来写能力要求：

1. 明确用户授权。
2. Scope 最小化。
3. 幂等键。
4. 风险动作二次确认。
5. 完整审计。
6. 返回与 Web 一致的错误码。

---

## 21. 当前实现差距与改造边界

当前项目已有账号密码认证、活动、报名、资讯、帖子、评论、点赞、收藏、举报、用户管理和审计的原型能力，可以复用业务认知，但不能继续在单文件结构上堆叠功能。

必须纳入改造：

1. 前端拆分 App 中的路由、页面、领域组件和共享 UI。
2. 活动、资讯、帖子详情共用统一详情骨架，但保留各自内容模块。
3. 服务端按 auth、users、events、news、community、moderation、admin 模块拆分。
4. 密码哈希升级为 Argon2id。
5. 生产 JWT 密钥改为强制配置。
6. 报名和刷新令牌轮换改为事务。
7. 修复未审核或下线内容的越权可见性。
8. 互动表从泛化目标迁移为显式外键关系。
9. 标签从逗号字符串迁移为关系表。
10. 硬删除迁移为软删除和状态流转。
11. 列表查询消除 N+1。
12. Demo seed 改为显式命令和环境开关。

### 21.1 架构选择

采用模块化单体：

1. 一个 Web 前端。
2. 一个管理前端入口，可共享 UI Token。
3. 一个模块化 API 服务。
4. PostgreSQL 作为生产目标数据库。
5. 对象存储保存图片。
6. Outbox 驱动通知、统计和未来 AI 接口事件。

在业务规模和团队规模不足以证明必要前，不拆微服务。

---

## 22. 实施里程碑

本路线图覆盖完整产品，不在 V1 停止。每个里程碑都必须形成可独立验收的结果。

### Milestone 0：契约与工程基线

1. 冻结本 Spec。
2. 拆分前后端模块边界。
3. 建立数据库迁移机制。
4. 建立统一 API 响应和错误码。
5. 建立设计 Token 和共享组件。
6. 建立 Demo seed 命令。

验收：旧功能仍可访问，新模块可独立测试，禁止回归项不再出现。

### Milestone 1：统一用户端视觉与导航

1. 四个一级入口。
2. 删除重复导航和冗余按钮。
3. 统一卡片、字号、标签、图标和详情骨架。
4. 完成 H5 与桌面响应式。
5. 完成加载、空态、错误态。

验收：UI Agent 进行第一轮真实浏览器验收。

### Milestone 2：账号与会话闭环

1. 账号密码注册登录。
2. 无验证码。
3. 登录回跳和 pendingAction。
4. 安全会话、改密、退出全部设备。
5. 密码重置链接。

验收：注册、登录、回跳、会话撤销、攻击和边界用例全部通过。

### Milestone 3：活动闭环

1. 活动列表和详情。
2. 附近活动。
3. 报名、候补、取消、凭证。
4. 我的活动。
5. 管理端活动、报名名单和签到。
6. 活动变更通知。

验收：并发不超卖，用户端和管理端状态一致。

### Milestone 4：交流闭环

1. 帖子流和详情。
2. 草稿、发布、编辑、删除。
3. 评论、回复、点赞、收藏。
4. 我的帖子、回复、收藏和草稿。
5. 审核、举报、下线和恢复。
6. 消息通知。

验收：发布和回复可追踪，内容权限无泄漏。

### Milestone 5：资讯闭环

1. 最新资讯列表和详情。
2. 来源、栏目、专题、置顶和定时发布。
3. 收藏和我的收藏。
4. 关联讨论。
5. 管理端编辑、预览、发布和下线。

验收：正文阅读体验、来源可信度和发布状态完整。

### Milestone 6：治理与运营

1. RBAC。
2. 举报案件和申诉。
3. 审计日志。
4. 指标面板。
5. 全文搜索。
6. 性能和安全加固。

验收：越权、重复举报、审计完整性和搜索状态过滤通过。

### Milestone 7：AI 开放能力

1. 只读 MCP。
2. API Client 和 Scope。
3. AI 调用审计和限流。
4. 受控写 SKILL。

验收：AI 与 Web 使用同一权限和状态规则，私密数据不泄漏。

### Milestone 8：规模化

1. 推荐策略迭代。
2. 活动组织者协作。
3. 城市和主题社区。
4. 内容申诉和治理 SLA。
5. 对象存储和 CDN。
6. 容量、备份和灾难恢复。

---

## 23. Agent 分工与质量门禁

### 23.1 主 Agent

1. 维护本 Spec 和里程碑。
2. 裁决跨模块契约。
3. 集成前端、后端和数据库改动。
4. 运行最终集成验证。
5. 对完成声明负责。

### 23.2 UI Agent

UI Agent 负责设计质量，不负责替代业务测试。

实现前：

1. 审查页面信息架构。
2. 确认设计 Token、组件状态和响应式规则。
3. 标记重复导航、冗余按钮和不一致组件。

实现完成后只进行一轮正式浏览器验收：

1. 320、375、414、768、1024、1440px。
2. 活动、资讯、交流、我的。
3. 登录注册。
4. 三类详情。
5. 发帖和回复。
6. 管理端关键页。
7. 加载、空态、错误态。
8. 字号、标签、图标、卡片、边框和按钮一致性。
9. Console、Network、Lighthouse 和 Core Web Vitals。

UI Agent 输出按 P0、P1、P2 分级的问题清单。主 Agent 直接修复和复验，不建立无限审查循环。

### 23.3 产品 Agent

1. 校验关键路径和状态闭环。
2. 校验文案是否面向用户。
3. 校验异常和恢复路径。
4. 校验“我的”是否能追踪关键动作结果。

### 23.4 架构 Agent

1. 校验数据约束、事务、幂等和权限。
2. 校验 API 契约和错误码。
3. 校验迁移和回滚。
4. 校验 MCP/SKILL 的数据边界。

---

## 24. 测试矩阵

### 24.1 认证

1. 正常注册和登录。
2. 用户名大小写唯一。
3. 弱密码和超长密码。
4. 错误密码限流。
5. 会话刷新和轮换。
6. Refresh token 重放。
7. 封禁用户登录和已有会话。
8. 退出当前设备和全部设备。
9. 重置链接过期和重复使用。
10. 全流程不存在验证码。

### 24.2 活动

1. 可报名。
2. 重复报名。
3. 最后一个名额并发竞争。
4. 满员候补。
5. 候补转正。
6. 报名截止。
7. 活动取消。
8. 取消报名。
9. 签到和重复签到。
10. 我的活动同步。

### 24.3 资讯

1. 发布和定时发布。
2. 下线后不可公开访问。
3. 置顶过期。
4. 来源和原文链接。
5. 正文净化。
6. 收藏幂等。
7. 关联讨论。

### 24.4 社区

1. 草稿恢复。
2. 发布成功和待审核。
3. 编辑版本冲突。
4. 删除上下文。
5. 一级评论和回复。
6. 回复定位。
7. 点赞和收藏幂等。
8. 重复举报。
9. 未审核内容越权访问。
10. 下线内容搜索和公开主页泄漏。

### 24.5 RBAC

1. Guest 写操作。
2. Member 访问管理端。
3. Organizer 修改他人活动。
4. Editor 处理举报。
5. Moderator 修改资讯。
6. Admin 授予 Owner。
7. 停用最后一名 Owner。
8. 角色变更后的旧 Token。

### 24.6 UI

1. 六档宽度无横向滚动。
2. 固定导航不遮挡内容。
3. 字号和标签一致。
4. 44px 触控目标。
5. 键盘导航。
6. reduced-motion。
7. 浏览器刷新详情。
8. 列表返回恢复。
9. 登录回跳。
10. 网络失败后恢复。

### 24.7 MCP/SKILL

1. 只返回 published 内容。
2. 不返回用户隐私。
3. 被封禁用户的受限行为。
4. Scope 越权。
5. 幂等写。
6. 审计完整。
7. 搜索权限过滤。

---

## 25. 最终验收标准

只有同时满足以下条件，才能声明完整产品阶段完成：

1. 四个一级入口顺序和视觉一致。
2. 登录注册无验证码，回跳和待执行动作正确。
3. 活动报名、取消、候补、凭证和我的活动形成闭环。
4. 发帖、回帖、审核、举报、通知和我的内容形成闭环。
5. 资讯发布、阅读、收藏、关联讨论和管理形成闭环。
6. 活动、资讯、帖子详情有完整内容、状态、主动作、关联内容和错误恢复。
7. 管理端可管理活动、资讯、帖子、评论、举报、用户和角色。
8. 核心动作数据库、API 和前端状态一致。
9. 报名并发不超卖。
10. 点赞、收藏、写入和刷新令牌操作具备幂等或事务保护。
11. 未审核、下线和私密内容不通过任何公开入口泄漏。
12. 所有危险管理动作有原因、确认和审计。
13. Demo 数据覆盖主要状态，Demo seed 不在生产自动运行。
14. 320 至 1440px 的视觉和交互验收通过。
15. 不存在禁止回归项。
16. UI Agent 完成一轮正式浏览器验收，P0 和 P1 问题清零。
17. 自动化测试、浏览器测试、安全测试和数据库迁移测试通过。
18. README、环境配置、管理员账号初始化和部署说明与真实实现一致。

---

## 26. Definition of Done

单个功能只有满足以下条件才算完成：

1. 用户路径可从入口走到明确结果。
2. 结果可在“我的”或管理端追踪。
3. 页面包含加载、空态、错误和无权限状态。
4. 服务端校验权限和状态。
5. 数据库有约束、索引和迁移。
6. 写操作处理重复提交和并发。
7. 管理动作记录审计。
8. 有正常、边界、失败和越权测试。
9. H5 和桌面端视觉一致。
10. UI Agent 的验收标准已满足。

本 Spec 的任何删减都必须记录原因和影响，不能以“先做 V1”为理由静默删除关键闭环。
