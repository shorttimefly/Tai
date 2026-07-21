# AI City Circle（AI 活动/资讯/社区）

AI City Circle 是一个面向 AI CLUB 场景的轻量社区应用，包含三大核心能力：

- 活动：创建与报名活动、活动状态管理
- 资讯：发布、审核、阅读 AI 相关内容
- 交流：帖子发布、评论、收藏、举报、用户管理

该仓库为完整的 Web 全栈样例：

- 前端：React + Vite（H5 适配）
- 后端：Node.js + Express
- 存储：SQLite（`server/data/app.db`，默认本地开发数据库）

---

## 当前已实现功能

- 统一认证
  - 账号（邮箱 / 手机）+ 密码登录、注册
  - JWT + Refresh Token 双令牌
  - 角色：`user` / `admin` / `owner`
- 活动能力
  - 活动列表、活动详情
  - 站内/外部报名链路
  - 活动状态变更（管理员）
  - 批量下线、软删除、分页查询
- 资讯能力
  - 资讯列表/详情
  - 管理端发布与上下线
  - 状态控制：`draft / published / offline`
- 交流能力（UGC）
  - 帖子发布、审核与禁用
  - 评论、收藏、点赞、举报
- 管理端
  - 活动 / 资讯 / 帖子 / 用户 / 举报 / 审计日志管理
- 观测与安全
  - 基础请求错误码与操作日志
  - 简单审计记录（`audit_logs`）

---

## 目录结构

- `client/`：前端 React 源码
  - `client/src/App.jsx`：主应用逻辑
  - `client/src/styles.css`：界面样式（含赛博风格视觉）
- `server/`：后端 API 与数据库
  - `server/src/index.js`：API 路由与中间件
  - `server/src/database.js`：SQLite 连接与初始化
  - `server/schema.sql`：数据库结构
- `docker-compose.yml`：本地联调启动编排
- `data/`：本地示例数据库（建议不提交业务数据）

---

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 启动服务

```bash
# 后端
npm run dev:server

# 前端
npm run dev:client
```

### 3. 访问

- 前端：`http://localhost:5173`
- API 健康检查：`http://localhost:4000/api/v1/health`

---

## API 示例（关键接口）

### 认证

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### 活动

- `GET /api/v1/events`
- `GET /api/v1/events/:id`
- `POST /api/v1/events/:id/register`
- `DELETE /api/v1/events/:id/register`
- `POST /api/v1/admin/events`
- `PATCH /api/v1/admin/events/:id`

### 资讯

- `GET /api/v1/news`
- `GET /api/v1/news/:id`
- `POST /api/v1/admin/news`
- `PATCH /api/v1/admin/news/:id`

### 交流（帖子）

- `GET /api/v1/posts`
- `POST /api/v1/posts`
- `GET /api/v1/posts/:id`
- `POST /api/v1/posts/:id/comments`
- `POST /api/v1/posts/:id/favorite`

### 管理

- `GET /api/v1/admin/events`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/audit-logs`

---

## 本地演示账号（开发期）

- `admin@tai.demo` / `12345678`（owner）
- `organizer@tai.demo` / `12345678`（admin）
- `user@tai.demo` / `12345678`（user）

> 仅用于本地演示，生产环境请替换默认账号与初始化方式。

---

## 运行与数据建议

- SQLite 适合单机开发和演示；生产建议迁移到 MySQL/PostgreSQL。
- `data/*.db*` 已默认加入 `.gitignore`，防止本地运行文件误提交。
- 本项目目前以“可运行 MVP”优先，后续将继续向组件化、路由化、接口契约分层方向演进。
