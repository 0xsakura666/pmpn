# Vercel / Railway 部署配置

部署前请在本机先跑通：`npm run build`、数据库用 `npx drizzle-kit push` 初始化。

---

## 一、Vercel

### 1. 连接仓库

1. 打开 [vercel.com](https://vercel.com) → 登录 → **Add New** → **Project**
2. 导入本仓库（GitHub/GitLab/Bitbucket）
3. Framework 选 **Next.js**（一般会自动识别）

### 2. 环境变量

在项目 **Settings → Environment Variables** 里添加（Production / Preview / Development 按需勾选）：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | Neon 等 PostgreSQL 连接串 |
| `AUTH_SECRET` | ✅ | 随机字符串，可用 `openssl rand -base64 32` 生成 |
| `NEXTAUTH_URL` | ✅ | 部署后的访问地址，如 `https://你的项目.vercel.app` |
| `POLYMARKET_API_KEY` | ✅ | Polymarket API Key |
| `POLYMARKET_SECRET` | ✅ | Polymarket Secret |
| `POLYMARKET_PASSPHRASE` | ✅ | Polymarket Passphrase |
| `POLYMARKET_API_URL` | 可选 | 默认 `https://clob.polymarket.com`，可不填 |
| `NEXT_PUBLIC_WS_URL` | 可选 | 默认已内置 CLOB WebSocket 地址，可不填 |

**注意：** 当前使用 Injected 钱包，无需 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`。

### 3. 部署

- 推送代码后自动部署，或 **Deployments** 里手动 **Redeploy**
- 首次部署后到 Neon 控制台执行一次表结构同步（或本机对生产库执行 `npx drizzle-kit push`，注意用生产 `DATABASE_URL`）

---

## 二、Railway

### 1. 创建项目

1. 打开 [railway.app](https://railway.app) → 登录
2. **New Project** → 选 **Deploy from GitHub repo**，选本仓库
3. Railway 会识别为 Next.js，自动配置构建和启动

### 2. 数据库（推荐用 Railway PostgreSQL）

1. 在当前 Project 里点 **+ New** → **Database** → **PostgreSQL**
2. 创建好后点进该服务 → **Variables** 或 **Connect** 里复制 `DATABASE_URL`（或 `POSTGRES_URL`，需改成 `DATABASE_URL` 使用）

若用外部库（如 Neon），则只填下面环境变量里的 `DATABASE_URL` 即可。

### 3. 环境变量

在 **Next.js 应用所在服务** → **Variables** 里添加：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ | Railway PostgreSQL 提供的连接串，或你自己的 Neon 等 |
| `AUTH_SECRET` | ✅ | 同上，`openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | 部署后的公网地址，如 `https://xxx.up.railway.app`（Railway 会分配） |
| `POLYMARKET_API_KEY` | ✅ | Polymarket API Key |
| `POLYMARKET_SECRET` | ✅ | Polymarket Secret |
| `POLYMARKET_PASSPHRASE` | ✅ | Polymarket Passphrase |
| `POLYMARKET_API_URL` | 可选 | 默认 `https://clob.polymarket.com` |
| `NEXT_PUBLIC_WS_URL` | 可选 | 默认已内置，可不填 |

### 4. 构建与启动

- **Build Command**: `npm run build`（默认一般已是）
- **Start Command**: `npm start`（默认一般已是）
- **Root Directory**: 若仓库不是根目录再填，否则留空

### 5. 首次数据库表结构

- 若用 Railway PostgreSQL：可在本机用 Railway 提供的 `DATABASE_URL` 执行一次  
  `npx drizzle-kit push`  
  或 Railway 的 **Run a command** / 一次性任务里执行（需安装依赖后执行同一命令）。

---

## 三、两边都要注意的

1. **NEXTAUTH_URL** 必须与最终访问的域名一致（含 `https://`），否则登录回调会失败。
2. **AUTH_SECRET** 生产环境务必用新生成的随机串，不要和本地相同。
3. **DATABASE_URL** 不要提交到 Git，只在 Vercel/Railway 控制台里配置。
4. Polymarket 三个密钥只放在服务端环境变量，不要设为 `NEXT_PUBLIC_*`。

按上面在 Vercel 或 Railway 配好环境变量并部署即可。
