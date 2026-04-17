# 部署教程

当前仓库更适合拆成 3 个部分部署：

1. `Neon`：PostgreSQL 数据库
2. `Railway`：常驻运行 `collector`，持续采集短期市场 1s K 线
3. `Vercel`：部署 Next.js 前端和 API routes

这也是当前代码最匹配的生产方案：

- 前端页面和 API routes 在 Vercel 上运行
- `collector` 不是 HTTP 服务，而是一个长期运行的 Node worker
- 前端和 collector 共用同一个 `DATABASE_URL`
- 短周期图表会优先读取 collector 写入的 `intraday_market_bars` 表

## 0. 先说结论

部署顺序建议固定为：

1. 先在 Neon 建库
2. 用生产库连接串执行一次 `drizzle-kit push`
3. 在 Railway 把 collector 跑起来
4. 最后在 Vercel 部署前端

如果只部署 Vercel、不跑 collector，站点也能打开，但分钟级/短周期图表会更多依赖 Polymarket 官方历史接口，体验会差一些。

## 1. 数据库部署到 Neon

### 1.1 创建数据库

1. 打开 [Neon](https://neon.com)
2. 创建一个 Project
3. 在项目里创建数据库，默认库名直接用 Neon 生成的即可
4. 进入 `Dashboard -> Connect`
5. 复制 PostgreSQL 连接串

建议直接使用 Neon 提供的连接串，并保留 `sslmode=require`。

### 1.2 把表结构初始化进去

在本地仓库根目录执行：

```bash
DATABASE_URL="替换成你的 Neon 连接串" npx drizzle-kit push
```

这一步会把当前 `src/db/schema.ts` 里的表推到 Neon，包括：

- 业务表
- `intraday_market_bars` 短期 K 线表

如果这一步没做，Railway 上的 collector 启动后会因为目标表不存在而无法正常写入。

### 1.3 Neon 需要记住的环境变量

Neon 本身不需要你额外“填变量”，核心是把连接串复制给别的平台：

| 变量名 | 用在哪 | 是否必填 | 说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | Vercel、Railway | 必填 | 直接填 Neon 提供的 PostgreSQL 连接串 |

## 2. 后端 collector 部署到 Railway

### 2.1 collector 是什么

当前仓库里的 collector 是这个脚本：

- [scripts/polymarket-intraday-collector.mjs](/Users/0xsakura/Documents/GitHub/pmpn/scripts/polymarket-intraday-collector.mjs)

它会：

- 扫描 Polymarket 短期市场
- 订阅 WebSocket 行情
- 持续写入 `intraday_market_bars`
- 给前端短周期图表提供更细的历史数据

### 2.2 这个仓库已经为 Railway 准备好了什么

仓库根目录已经有：

- [nixpacks.toml](/Users/0xsakura/Documents/GitHub/pmpn/nixpacks.toml)

里面默认把 Railway 启动命令设成了：

```toml
[start]
cmd = "npm run collector:intraday"
```

也就是说，Railway 这边最适合只拿它来跑 collector。

### 2.3 Railway 部署步骤

1. 打开 [Railway](https://railway.app)
2. 新建 Project
3. 选择 `Deploy from GitHub repo`
4. 导入当前仓库
5. 让 Railway 以仓库根目录部署
6. 如果 Railway 没自动识别到 `nixpacks.toml`，手动确认：
   `Start Command = npm run collector:intraday`

### 2.4 Railway 环境变量

在 Railway 这个 collector 服务里，至少填写下面这些：

| 变量名 | 是否必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 必填 | 无 | 直接填 Neon 连接串 |
| `POLYMARKET_GAMMA_API` | 可选 | `https://gamma-api.polymarket.com` | 拉取市场列表用 |
| `NEXT_PUBLIC_WS_URL` | 可选 | `wss://ws-subscriptions-clob.polymarket.com/ws/market` | collector 也会复用这个变量名来连接 Polymarket WebSocket |
| `INTRADAY_COLLECTOR_SHORT_TERM_HOURS` | 可选 | `36` | 只跟踪未来多少小时内结束/开赛的短期市场 |
| `INTRADAY_COLLECTOR_MAX_MARKETS` | 可选 | `120` | 最多同时跟踪多少个 token |
| `INTRADAY_COLLECTOR_REFRESH_MS` | 可选 | `300000` | 刷新市场列表的间隔，单位毫秒 |
| `INTRADAY_COLLECTOR_RETENTION_HOURS` | 可选 | `12` | 市场过期后保留多少小时再清理 |
| `INTRADAY_COLLECTOR_FETCH_TIMEOUT_MS` | 可选 | `12000` | collector 请求 Polymarket API 的超时时间 |

推荐先只填下面这组最小可运行配置：

```env
DATABASE_URL=postgresql://...
POLYMARKET_GAMMA_API=https://gamma-api.polymarket.com
NEXT_PUBLIC_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
INTRADAY_COLLECTOR_SHORT_TERM_HOURS=36
INTRADAY_COLLECTOR_MAX_MARKETS=120
INTRADAY_COLLECTOR_REFRESH_MS=300000
INTRADAY_COLLECTOR_RETENTION_HOURS=12
```

### 2.5 Railway 里怎么验证 collector 已经正常运行

看 Railway 日志，应该能看到 collector 已启动并开始刷新 tracked tokens。

另外，当前前端还提供了一个健康检查接口：

- [src/app/api/collector/health/route.ts](/Users/0xsakura/Documents/GitHub/pmpn/src/app/api/collector/health/route.ts)

等 Vercel 也部署好后，可以访问：

```text
https://你的前端域名/api/collector/health
```

如果 collector 正常写库，这个接口会返回：

- 最新 bucket 时间
- 最近 5/15/60 分钟写入行数
- 当前活跃 token 数

## 3. 前端部署到 Vercel

### 3.1 Vercel 部署步骤

1. 打开 [Vercel](https://vercel.com)
2. 选择 `Add New -> Project`
3. 导入当前仓库
4. 框架会自动识别为 Next.js
5. 在点击部署前，先把环境变量配好
6. 然后再执行首次部署

### 3.2 当前前端真正会读取的环境变量

按当前源码，Vercel 侧推荐分成 4 类看。

#### 必填

| 变量名 | 是否必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 必填 | 服务端 routes 需要它连接 Neon |

#### 推荐填写

| 变量名 | 是否推荐 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | 推荐 | 钱包配置会读取它作为站点 URL，建议填正式域名，比如 `https://your-app.vercel.app` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | 推荐 | 如果你要支持 WalletConnect / Reown，建议填写正式 project id |

#### 可选

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `POLYMARKET_API_URL` | `https://clob.polymarket.com` | CLOB API 地址 |
| `POLYMARKET_GAMMA_API` | `https://gamma-api.polymarket.com` | Gamma API 地址 |
| `POLYMARKET_DATA_API` | `https://data-api.polymarket.com` | Data API 地址 |
| `NEXT_PUBLIC_WS_URL` | `wss://ws-subscriptions-clob.polymarket.com/ws/market` | 浏览器实时行情 WebSocket |

#### 当前代码里未使用，不用填

下面这些变量在旧文档里出现过，但当前运行时代码没有实际读取：

| 变量名 |
| --- |
| `AUTH_SECRET` |
| `NEXTAUTH_URL` |
| `POLYMARKET_API_KEY` |
| `POLYMARKET_SECRET` |
| `POLYMARKET_PASSPHRASE` |
| `POLYMARKET_BUILDER_API_KEY` |
| `POLYMARKET_BUILDER_SECRET` |
| `POLYMARKET_BUILDER_PASSPHRASE` |
| `POLYMARKET_TIMEOUT` |
| `REDIS_URL` |

当前项目虽然安装了 `next-auth` 依赖，但实际认证流程走的是自定义 cookie，不是 NextAuth。

### 3.3 Vercel 最小可运行变量

如果你要先把站点跑起来，Vercel 里最少可以填：

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://你的项目域名.vercel.app
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=你的-reown-project-id
```

如果你不使用 WalletConnect，也可以先不填 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`，但生产环境不建议一直留空。

### 3.4 首次部署后检查什么

1. 首页是否能正常打开
2. 市场列表是否能加载
3. 市场详情页图表是否正常返回数据
4. `/api/collector/health` 是否能看到数据库状态

## 4. 建议直接照抄的最终配置

### 4.1 Neon

```env
DATABASE_URL=postgresql://<neon-connection-string>
```

### 4.2 Railway collector

```env
DATABASE_URL=postgresql://<neon-connection-string>
POLYMARKET_GAMMA_API=https://gamma-api.polymarket.com
NEXT_PUBLIC_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
INTRADAY_COLLECTOR_SHORT_TERM_HOURS=36
INTRADAY_COLLECTOR_MAX_MARKETS=120
INTRADAY_COLLECTOR_REFRESH_MS=300000
INTRADAY_COLLECTOR_RETENTION_HOURS=12
INTRADAY_COLLECTOR_FETCH_TIMEOUT_MS=12000
```

### 4.3 Vercel

```env
DATABASE_URL=postgresql://<neon-connection-string>
NEXT_PUBLIC_APP_URL=https://你的项目域名.vercel.app
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=你的-reown-project-id
POLYMARKET_API_URL=https://clob.polymarket.com
POLYMARKET_GAMMA_API=https://gamma-api.polymarket.com
POLYMARKET_DATA_API=https://data-api.polymarket.com
NEXT_PUBLIC_WS_URL=wss://ws-subscriptions-clob.polymarket.com/ws/market
```

## 5. 常见坑

### 5.1 只建库但没 push schema

现象：

- Vercel 页面能打开
- Railway collector 启动失败，或者健康检查没有数据

处理：

```bash
DATABASE_URL="你的 Neon 连接串" npx drizzle-kit push
```

### 5.2 在 Vercel 上没填 `DATABASE_URL`

现象：

- 和数据库相关的接口会退化
- `/api/collector/health` 返回 `disabled`

### 5.3 Railway 和 Vercel 用了不同数据库

现象：

- collector 看起来在跑
- 前端却读不到 intraday 数据

处理：

- 确认两个平台里的 `DATABASE_URL` 完全一致

### 5.4 沿用旧文档里的 NextAuth 变量

现象：

- 填了很多变量，但实际上对当前版本没有影响

处理：

- 以本文件为准
- 当前版本不依赖 `AUTH_SECRET` / `NEXTAUTH_URL`

## 6. 部署完成后的验收顺序

1. 访问 Vercel 站点首页
2. 打开一个市场详情页
3. 访问 `/api/collector/health`
4. 看 Railway 日志里是否持续有采集输出
5. 确认 Vercel 和 Railway 用的是同一个 `DATABASE_URL`

## 7. 相关文件

- [nixpacks.toml](/Users/0xsakura/Documents/GitHub/pmpn/nixpacks.toml)
- [vercel.json](/Users/0xsakura/Documents/GitHub/pmpn/vercel.json)
- [scripts/polymarket-intraday-collector.mjs](/Users/0xsakura/Documents/GitHub/pmpn/scripts/polymarket-intraday-collector.mjs)
- [src/db/schema.ts](/Users/0xsakura/Documents/GitHub/pmpn/src/db/schema.ts)
- [src/app/api/collector/health/route.ts](/Users/0xsakura/Documents/GitHub/pmpn/src/app/api/collector/health/route.ts)

## 8. 官方文档

- [Vercel: Deploying a Next.js app](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel: Environment Variables](https://vercel.com/docs/environment-variables)
- [Railway: Variables](https://docs.railway.com/guides/variables)
- [Railway: Nixpacks](https://docs.railway.com/guides/nixpacks)
- [Neon: Connect to your database](https://neon.com/docs/get-started-with-neon/connect-neon)
