"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-[var(--bg-base)]">
      <div className="w-20 h-20 rounded-full bg-[var(--color-down-muted)] flex items-center justify-center mb-6">
        <AlertTriangle className="w-10 h-10 text-[var(--color-down)]" />
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
        出错了
      </h1>
      <p className="text-[var(--text-muted)] mb-2 max-w-md">
        应用程序遇到了意外错误
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--text-disabled)] mb-6 font-mono">
          错误 ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset} variant="primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
        <Link href="/">
          <Button variant="secondary">
            <Home className="w-4 h-4 mr-2" />
            返回首页
          </Button>
        </Link>
      </div>
    </div>
  );
}
