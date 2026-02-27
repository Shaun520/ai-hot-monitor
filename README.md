# 🔥 AI Hot Monitor — AI 热点监控工具

> 自动发现热点、AI 智能分析真假与价值、多渠道实时推送通知

![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Tech Stack](https://img.shields.io/badge/Express-5-green?logo=express)
![Tech Stack](https://img.shields.io/badge/Prisma-6-purple?logo=prisma)
![Tech Stack](https://img.shields.io/badge/SQLite-lightgrey?logo=sqlite)
![Tech Stack](https://img.shields.io/badge/Socket.io-4-black?logo=socket.io)

## 📋 项目简介

作为 AI 编程博主，需要第一时间获取 AI 领域的热点信息（如大模型更新、行业动态等）。本工具实现了：

- **关键词监控** — 添加关键词，系统每 30 分钟自动检索多个数据源
- **AI 智能分析** — 利用 OpenRouter AI 判断信息真假、分析热点价值与相关性
- **多源聚合** — 同时抓取 Bing 搜索、中文搜索引擎和 Twitter/X 的数据
- **实时通知** — 通过 WebSocket 浏览器推送 + 邮件通知，第一时间获知热点
- **赛博朋克风 UI** — 暗色数据仪表盘，动效丰富、响应式设计

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 7 + TailwindCSS 4 + Framer Motion |
| 后端 | Node.js + Express 5 + TypeScript |
| 数据库 | SQLite + Prisma ORM |
| AI | OpenRouter API（支持多种模型） |
| 实时通信 | Socket.io |
| 定时任务 | node-cron（每 30 分钟） |
| 邮件 | Nodemailer（SMTP） |
| 搜索 | Bing/中文搜索爬虫 + Twitter API |

## 📁 项目结构

```
ai-hot-monitor/
├── client/                  # 前端（React + Vite）
│   └── src/
│       ├── components/      # UI 组件（含 aceternity 风格动效）
│       ├── services/        # API 调用 & WebSocket
│       └── utils/           # 工具函数
├── server/                  # 后端（Express）
│   ├── prisma/              # 数据库 Schema & 迁移
│   └── src/
│       ├── routes/          # REST API 路由
│       ├── services/        # 业务逻辑（搜索、AI、邮件）
│       ├── jobs/            # 定时任务
│       └── __tests__/       # 测试
├── docs/                    # 项目文档
│   ├── REQUIREMENTS.md      # 需求文档
│   └── API_INTEGRATION.md   # API 集成说明
└── skills/                  # Copilot Agent Skills
```

## 🚀 快速开始

### 前置要求

- Node.js ≥ 18
- npm / pnpm

### 1. 克隆项目

```bash
git clone https://github.com/your-username/ai-hot-monitor.git
cd ai-hot-monitor
```

### 2. 配置环境变量

```bash
cp server/.env.example server/.env
```

编辑 `server/.env`，填入你的配置：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# 服务器
PORT=3001
CLIENT_URL=http://localhost:5173

# OpenRouter AI（必需）
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Twitter API（可选，twitterapi.io）
TWITTER_API_KEY=your_twitter_api_key_here

# 邮件通知（可选）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
NOTIFY_EMAIL=notify_to@example.com
```

### 3. 安装依赖 & 初始化数据库

```bash
# 后端
cd server
npm install
npx prisma migrate dev

# 前端
cd ../client
npm install
```

### 4. 启动服务

```bash
# 后端（默认端口 3001）
cd server
npm run dev

# 前端（默认端口 5173）
cd client
npm run dev
```

打开浏览器访问 `http://localhost:5173` 即可使用。

## 📊 核心功能

### 关键词监控

1. 在界面中添加要监控的关键词
2. 系统每 30 分钟自动从多个数据源搜索相关内容
3. AI 分析内容的真实性、相关性和重要程度
4. 满足条件时自动推送通知

### 热点仪表盘

- 热度综合评分（基于点赞、转发、评论等加权计算）
- 按来源/重要性/时间范围/关键词多维过滤
- 支持多种排序方式
- 分页浏览历史热点

### 多数据源

| 数据源 | 方式 | 说明 |
|--------|------|------|
| Bing 搜索 | 网页爬虫 | 免费，无需 API Key |
| 中文搜索 | 网页爬虫 | 国内搜索引擎聚合 |
| Twitter/X | twitterapi.io | 需要 API Key（可选） |

### 通知方式

- **浏览器实时推送** — 基于 WebSocket，页面打开即可实时接收
- **邮件通知** — 配置 SMTP 后自动发送邮件（可选）

## 🧪 测试

```bash
cd server
npm test
```

## 📝 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET/POST | `/api/keywords` | 关键词 CRUD |
| GET | `/api/hotspots` | 热点列表（支持分页、过滤） |
| GET | `/api/hotspots/stats` | 热点统计 |
| POST | `/api/check-hotspots` | 手动触发热点检查 |
| GET/POST | `/api/notifications` | 通知管理 |
| GET/PUT | `/api/settings` | 系统设置 |

详细 API 文档见 [docs/API_INTEGRATION.md](docs/API_INTEGRATION.md)。

## 📄 License

ISC
