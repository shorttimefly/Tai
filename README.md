# Tai Fullstack Starter

可直接运行的全栈起步项目，默认提供 **项目管理** 的 CRUD 示例（后端 + 前端 + SQLite + Docker）。

## 当前实现状态（已完成）

- 后端：Express + SQLite
- 前端：React + Vite
- 数据：本地 SQLite 文件 `server/data/app.db`
- 契约：
  - `GET /api/health` 健康检查
  - `GET /api/projects` 项目列表（分页/搜索）
  - `POST /api/projects` 新建
  - `PATCH /api/projects/:id` 修改
  - `DELETE /api/projects/:id` 删除

后端统一返回结构：

- 成功：`{ "ok": true, "data": ... , "meta": ... }`
- 失败：`{ "ok": false, "error": { "code": "...", "message": "..." } }`

> 注意：目前未发现可对齐的外部 Spec，如你有正式业务 spec，请贴出后我会按 spec 直接收敛。

## 目录

- `server/` 后端服务与数据库
- `client/` 前端
- `docker-compose.yml` 容器启动配置
- `README.md` 说明文件

## 本地运行

1. 安装依赖

```bash
npm run install:all
```

2. 启动后端（新终端）

```bash
npm run dev:server
```

3. 启动前端（新终端）

```bash
npm run dev:client
```

4. 访问

- 前端：`http://localhost:5173`
- 健康检查：`http://localhost:4000/api/health`

## Docker 运行

```bash
docker compose up --build
```

## 关键约束

- `projects.status` 受数据库约束，仅允许：`active`、`archived`
- 项目名称长度：1~80 字符
- ID 仅接受正整数
- 列表支持参数：
  - `page`: 页码（默认 1）
  - `pageSize`: 每页数量（1~100，默认 20）
  - `q`: 搜索关键词（按项目名）

## 注意项

- 当前数据库是 SQLite，已开启 `WAL` + `busy_timeout`，适合单实例开发/验证场景。
- 你若要接入生产级并发，建议切到 PostgreSQL 或 MySQL 并加鉴权。
