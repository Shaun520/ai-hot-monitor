# AI Hot Monitor

基于 AI 的全网热点监控工具：配置关键词后，系统自动从多个信息源聚合抓取内容，利用 AI 进行真假识别、相关性分析与智能摘要，并通过 WebSocket 实时推送和邮件通知。

## 项目介绍

### 主要功能

1. **关键词监控**：配置监控关键词，支持激活 / 暂停，可随时调整监控范围
2. **多源聚合抓取**：自动从 Twitter、Bing、HackerNews、搜狗、B 站等 8+ 信息源聚合内容
3. **AI 智能分析**：查询扩展（Query Expansion）、真假识别、相关性分析、智能摘要，支持 OpenRouter 与阿里云百炼 DashScope 两种 AI 提供商
4. **多维度筛选排序**：按来源、重要性、时间范围筛选，按热度、相关性、时间排序
5. **全网聚合搜索**：输入关键词从多个数据源聚合搜索
6. **实时通知**：WebSocket 实时推送 + 邮件通知，不错过任何重要热点

### 目标用户

- 需要第一时间追踪技术热点和行业动态的开发者
- 关注 AI 大模型、前沿科技资讯的技术爱好者
- 需要监控特定关键词舆情、竞品动态的产品 / 运营人员
- 希望学习全栈开发、爬虫聚合、AI 应用集成的学习者

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite 7、TypeScript、Tailwind CSS 4、Socket.io-client、Framer Motion |
| 后端 | Express 5、TypeScript、Socket.io、node-cron |
| 数据库 | Prisma 6 + SQLite |
| AI | OpenAI SDK（OpenRouter / 阿里云百炼 DashScope 兼容接入） |
| 数据抓取 | axios、cheerio |
| 工程化 | pnpm monorepo、Vitest、ESLint、tsx |

## 项目结构

采用 pnpm workspace 的 monorepo 结构：

```
ai-hot-monitor/
├── apps/
│   ├── client/          # 前端应用（React 19 + Vite 7）
│   │   └── src/
│   ├── server/          # 后端服务（Express 5 + Prisma 6）
│   │   ├── src/
│   │   │   ├── routes/      # API 路由
│   │   │   ├── services/    # 搜索、AI 分析、通知等业务逻辑
│   │   │   ├── jobs/        # 定时任务
│   │   │   └── __tests__/   # 单元测试（Vitest）
│   │   └── prisma/          # 数据库 schema 与迁移
├── docs/                # 项目文档
└── skills/              # Agent Skills 技能包
```

## 快速开始

### 前置条件

- Node.js ≥ 18（推荐 20 LTS）
- pnpm ≥ 8（`npm install -g pnpm`）
- 一个 AI API Key：[OpenRouter](https://openrouter.ai/settings/keys)（必需）或 [阿里云百炼](https://bailian.console.aliyun.com/)（可选替代）

### 1. 克隆并安装依赖

```bash
git clone https://github.com/Shaun520/ai-hot-monitor.git
cd ai-hot-monitor
pnpm install
```

### 2. 配置环境变量

```bash
cp apps/server/.env.example apps/server/.env
```

编辑 `apps/server/.env`，至少填入 AI API Key：

```bash
# AI 提供商：openrouter（默认）或 dashscope（阿里云百炼）
AI_PROVIDER=openrouter

# 方式一：OpenRouter
OPENROUTER_API_KEY=sk-or-v1-你的key

# 方式二：阿里云百炼
# DASHSCOPE_API_KEY=你的key

# Twitter API Key（可选，不填则不抓取 Twitter 数据源）
TWITTER_API_KEY=你的key
```

### 3. 初始化数据库并启动

```bash
# 初始化数据库（SQLite，无需额外安装）
pnpm --filter server db:generate
pnpm --filter server db:push

# 一条命令同时启动前后端
pnpm dev
```

也可以用 `pnpm dev:server` 和 `pnpm dev:client` 分别启动。

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:5173 |
| 后端 API | http://localhost:3001 |

## 使用方法

1. 打开 http://localhost:5173 ，在输入框中添加要监控的关键词（如 `AI`、`Claude`）
2. 系统自动从多个信息源抓取相关内容，AI 分析后热点结果会出现在信息流中
3. 使用筛选栏按来源、重要性、时间范围过滤结果，切换热度 / 相关性 / 时间排序
4. 发现高重要性热点时，浏览器实时推送，配置 SMTP 后还会收到邮件通知
5. 通过「全网搜索」功能可随时对任意关键词做聚合搜索

### 常用命令

```bash
pnpm dev                  # 并行启动前后端
pnpm dev:server           # 只启动后端
pnpm dev:client           # 只启动前端
pnpm build                # 构建所有应用
pnpm test                 # 运行单元测试（Vitest）
pnpm --filter server db:push       # 同步数据库 schema
pnpm --filter server db:studio     # 打开 Prisma Studio 管理数据
pnpm --filter server db:migrate    # 运行数据库迁移
```

更多细节见 [本地运行指南](docs/LOCAL_SETUP.md) 与 [项目文档](docs/README.md)。

## 贡献指南

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库并创建特性分支：`git checkout -b feature/your-feature`
2. 提交前请确保代码通过检查：
   ```bash
   pnpm test
   pnpm --filter client lint
   pnpm build
   ```
3. 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范（如 `feat:`、`fix:`、`chore:` 前缀）
4. 发起 Pull Request，描述清楚改动内容和动机

## 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 致谢

项目灵感与初始架构来自 [张三](https://github.com/Shaun520) 的 [AI 热点监控工具](https://github.com/Shaun520/ai-hot-monitor) 教学项目，在此基础完成了 monorepo 工程化改造、AI 提供商扩展（阿里云百炼）与持续迭代。
