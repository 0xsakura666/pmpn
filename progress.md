# Progress

## Session Log
- 已完成代码路径审计，确认问题源于多个页面对 `localStorage` 的重复 payload 缓存。
- 已收集现有 React Query、页面内 Map 缓存、服务端内存缓存的实现证据。
- 已将首页 `pmpn_events_cache_v9` 与 `event_*` 缓存迁移为 QueryClient 会话内缓存，并在首页写入时 seed 事件详情缓存。
- 已将事件详情 `event_*` 缓存迁移为 QueryClient 会话内缓存。
- 已将市场详情 `market_*` 缓存迁移为 QueryClient 会话内缓存。
- 已新增 legacy cleanup helper，在客户端首次命中相关页面时清除历史 `pmpn_events_cache_v9` / `event_*` / `market_*` 键。
- 已完成静态检查、构建与浏览器自动化验证。
