import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-[var(--bg-base)]">
      <div className="text-8xl font-bold text-[var(--text-disabled)] mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
        页面不存在
      </h1>
      <p className="text-[var(--text-muted)] mb-8 max-w-md">
        抱歉，您访问的页面不存在或已被移动
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-lg)] bg-[var(--brand-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
        >
          <Home className="w-4 h-4" />
          返回首页
        </Link>
        <Link
          href="/?search="
          className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Search className="w-4 h-4" />
          搜索市场
        </Link>
      </div>
    </div>
  );
}
