# Task Plan

## Goal
将首页事件列表、事件详情、市场详情中的大对象缓存从 `localStorage` 迁移到不占 `localStorage` 的方案，复用现有 React Query 与内存缓存模式，消除浏览器配额错误。

## Phases
- [completed] 确认现有缓存模式与最小改造点
- [completed] 实现 React Query / 内存缓存替代并移除 `localStorage` 写入
- [completed] 运行验证并记录结果

## Files in Scope
- `src/app/(main)/page.tsx`
- `src/app/(main)/events/[id]/page.tsx`
- `src/app/(main)/markets/[id]/page.tsx`
- `src/app/providers.tsx`
- `src/hooks/useEvents.ts` (仅参考，尽量不改)

## Decisions
- 不再将 `event_*`、`market_*`、`pmpn_events_cache_v9` 写入浏览器 `localStorage`
- 优先使用现有 `QueryClient` 作为客户端会话内缓存
- 保留现有 `historyCacheRef` 与 API 层 `server-memory-cache`

## Risks
- 刷新页面后不再恢复旧 payload，需要重新请求
- 详情页与首页缓存结构不同，需分别设计 query key 与 seed 逻辑

## Verification Summary
- 定向 grep 确认首页、事件详情、市场详情不再直接读写 `event_*` / `market_*` / `pmpn_events_cache_v9`
- `npx eslint` 运行通过，无新增错误，仅保留目标文件中的既有 warning
- `npm run build` 通过
- 浏览器自动化验证通过：首页、事件详情、市场详情均可加载，且三处页面下 `localStorage` 中目标 payload keys 均为空
