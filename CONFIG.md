# 配置清单（本地 → Vercel + Neon）

按顺序做即可。

---

## 一、本地已就绪时

确认你有 `.env.local`，且包含：

- `DATABASE_URL`（Neon 连接串，从 [Neon Console](https://console.neon.tech) 复制）
- `AUTH_SECRET`（已生成即可）
- `NEXTAUTH_URL=http://localhost:3000`
- Polymarket 相关（若你有 Builder API 密钥）：`POLYMARKET_API_KEY`、`POLYMARKET_SECRET`、`POLYMARKET_PASSPHRASE`

本地跑通：

```bash
npm install
npx drizzle-kit push   # 初始化/同步数据库表
npm run dev             # 打开 http://localhost:3000
```

---

## 二、Vercel 项目

1. 打开 [vercel.com](https://vercel.com) → 登录 → **Add New** → **Project**
2. 导入本仓库（选 GitHub/GitLab 等）
3. 先不要点 Deploy，到 **Settings → Environment Variables** 配置完再部署

---

## 三、在 Vercel 里绑 Neon（推荐）

1. 在 Vercel 项目里点 **Storage**（或 **Integrations**）
2. 选 **Neon** → **Connect**，登录 Neon，选你 Launch 订阅下的项目
3. 绑定到当前 Vercel 项目
4. 绑定成功后，Vercel 会自动注入数据库相关变量；若变量名是 `POSTGRES_URL` 等，在 **Environment Variables** 里加一条：
   - 名称：`DATABASE_URL`
   - 值：与 Neon 提供的连接串一致（可从 Neon 控制台再复制一份）

---

## 四、在 Vercel 里填环境变量

在 **Settings → Environment Variables** 中新增（没有的话就填，已有则跳过）：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `DATABASE_URL` | Neon 连接串（若上面已通过 Storage 注入，可不再填） | Production, Preview |
| `AUTH_SECRET` | 生产用新密钥：终端执行 `openssl rand -base64 32` 得到 | Production, Preview |
| `NEXTAUTH_URL` | 部署后的访问地址，如 `https://你的项目.vercel.app`（**先部署一次再回来填**） | Production |
| `POLYMARKET_API_URL` | `https://clob.polymarket.com`（可选，代码有默认值） | 可选 |
| `NEXT_PUBLIC_WS_URL` | `wss://ws-subscriptions-clob.polymarket.com/ws/market`（可选） | 可选 |

若使用 Polymarket Builder API（下单/归因等），再增加：

| 变量名 | 值 |
|--------|-----|
| `POLYMARKET_API_KEY` | 你的 apiKey |
| `POLYMARKET_SECRET` | 你的 secret |
| `POLYMARKET_PASSPHRASE` | 你的 passphrase |

---

## 五、部署与首次数据库

1. 在 Vercel 点 **Deploy** 完成首次部署
2. 部署完成后记下域名，例如 `https://pmpn-xxx.vercel.app`
3. 回到 **Settings → Environment Variables**，把 `NEXTAUTH_URL` 设为该域名（若还没设）
4. 生产库表结构：用**生产环境的 `DATABASE_URL`** 在本地执行一次（不要用本地的开发库）：
   ```bash
   DATABASE_URL="你从 Neon 复制的生产连接串" npx drizzle-kit push
   ```
5. 在 Vercel **Deployments** 里对最新部署点 **Redeploy**，让新的 `NEXTAUTH_URL` 生效

---

## 六、检查

- 访问 `https://你的项目.vercel.app`，页面正常
- 连接钱包（浏览器扩展）能弹出并登录
- 若仍有 500 / 数据库错误，检查 Vercel 的 **Functions / Runtime Logs** 和 `DATABASE_URL` 是否生效

---

## 小结

| 位置 | 要配的 |
|------|--------|
| **本地** | `.env.local`（DATABASE_URL、AUTH_SECRET、NEXTAUTH_URL、Polymarket 等） |
| **Vercel** | Storage 绑 Neon → 环境变量补全（含 `NEXTAUTH_URL` 用正式域名）→ 部署 → 生产库 `drizzle-kit push` → 再 Redeploy |

当前方案：**Next.js 全栈在 Vercel，数据库用 Neon，不需要 Railway。**
