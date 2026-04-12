# Findings

- 首页 `src/app/(main)/page.tsx` 当前会同时写聚合缓存 `pmpn_events_cache_v9` 和大量 `event_${id}`，是 localStorage 空间增长的主因。
- 事件详情页 `src/app/(main)/events/[id]/page.tsx` 会读取并重写 `event_${id}`。
- 市场详情页 `src/app/(main)/markets/[id]/page.tsx` 会读取并重写 `market_${id}`。
- 仓库已存在非 localStorage 模式：
  - `src/app/providers.tsx` 中的全局 React Query `QueryClient`
  - `src/app/(main)/events/[id]/page.tsx` / `src/app/(main)/markets/[id]/page.tsx` 中的 `historyCacheRef`
  - `src/lib/server-memory-cache.ts` 的服务端 TTL 内存缓存
- Oracle 建议：停止将 market/event payload 持久化到 `localStorage`，改为客户端内存缓存 + 服务端已有缓存。
