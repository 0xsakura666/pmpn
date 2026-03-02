"use client";

import Link from "next/link";
import { WalletButton } from "@/components/auth/ConnectWallet";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-['Space_Grotesk'] text-xl font-bold text-gradient">
              Tectonic
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/markets" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                市场
              </Link>
              <Link href="/smart-money" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                聪明钱
              </Link>
              <Link href="/signals" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                信号
              </Link>
            </div>
          </div>
          <WalletButton />
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] via-transparent to-[hsl(var(--accent)/0.1)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[hsl(var(--accent)/0.2)] via-transparent to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight sm:text-6xl">
              <span className="text-gradient">Tectonic</span>
            </h1>
            <p className="mt-2 text-xl text-[hsl(var(--muted-foreground))]">
              Polymarket 专业交易终端
            </p>
            <p className="mt-6 text-lg leading-8 text-[hsl(var(--muted-foreground))]">
              实时K线图表 · 聪明钱追踪 · 一键跟单 · Whale Score™ 评分系统
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/markets"
                className="rounded-lg bg-[hsl(var(--primary))] px-6 py-3 text-sm font-semibold text-[hsl(var(--primary-foreground))] shadow-sm hover:opacity-90 transition-opacity glow-primary"
              >
                开始交易
              </Link>
              <Link
                href="/smart-money"
                className="rounded-lg border border-[hsl(var(--border))] px-6 py-3 text-sm font-semibold hover:bg-[hsl(var(--muted))] transition-colors"
              >
                查看聪明钱 →
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon="📈"
                title="K线图表"
                description="专业级TradingView图表，支持多种技术指标"
              />
              <FeatureCard
                icon="🐋"
                title="Whale Score™"
                description="0-100评分系统，识别高确信度交易者"
              />
              <FeatureCard
                icon="⚡"
                title="实时信号"
                description="聪明钱动态实时推送，一键跟单"
              />
              <FeatureCard
                icon="🔥"
                title="热力图"
                description="市场资金流向可视化，捕捉趋势"
              />
            </div>
          </div>

          {/* Live Signals Preview */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="glass rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-['Space_Grotesk'] text-xl font-semibold">
                  📡 实时信号
                </h2>
                <span className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="h-2 w-2 rounded-full bg-[var(--up)] animate-pulse" />
                  已连接
                </span>
              </div>

              <div className="space-y-4">
                <SignalPreview
                  address="0x7a8...3f2"
                  action="BUY"
                  amount="$45,000"
                  market="Trump 2024 - Yes"
                  price="$0.62"
                  score={87}
                  time="NOW"
                />
                <SignalPreview
                  address="0x9c2...1a5"
                  action="SELL"
                  amount="$12,000"
                  market="ETH ETF - No"
                  price="$0.22"
                  score={74}
                  time="2m ago"
                />
                <SignalPreview
                  address="0x4e1...8d7"
                  action="BUY"
                  amount="$8,500"
                  market="Fed Rate Cut - Yes"
                  price="$0.45"
                  score={71}
                  time="5m ago"
                />
              </div>
            </div>
          </div>

          {/* Market Heatmap Preview */}
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="glass rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-['Space_Grotesk'] text-xl font-semibold">
                  📊 市场热力图
                </h2>
                <div className="flex gap-2 text-xs">
                  <button className="px-3 py-1 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">成交量</button>
                  <button className="px-3 py-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">资金流</button>
                  <button className="px-3 py-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">趋势</button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <HeatmapCard category="政治" change={24} volume="$4.2M" color="up" />
                <HeatmapCard category="体育" change={-5} volume="$890K" color="down" />
                <HeatmapCard category="加密货币" change={12} volume="$2.1M" color="up" />
                <HeatmapCard category="科技" change={3} volume="$340K" color="neutral" />
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">巨鲸 vs 散户</span>
                  <div className="flex-1 mx-4 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div className="h-full w-[82%] bg-[var(--whale)] rounded-full" />
                  </div>
                  <span className="font-mono text-[var(--whale)]">82%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">净流入</span>
                  <div className="flex-1 mx-4 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div className="h-full w-[68%] bg-[var(--up)] rounded-full" />
                  </div>
                  <span className="font-mono text-[var(--up)]">+$1.2M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="glass rounded-xl p-6 hover:border-[hsl(var(--primary)/0.5)] transition-colors">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-['Space_Grotesk'] font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
    </div>
  );
}

function SignalPreview({
  address,
  action,
  amount,
  market,
  price,
  score,
  time,
}: {
  address: string;
  action: "BUY" | "SELL";
  amount: string;
  market: string;
  price: string;
  score: number;
  time: string;
}) {
  const isBuy = action === "BUY";
  const scoreColor = score >= 85 ? "text-yellow-400" : score >= 70 ? "text-[var(--whale)]" : "text-[hsl(var(--muted-foreground))]";
  const scoreBg = score >= 85 ? "bg-yellow-400/20 border-yellow-400/30" : score >= 70 ? "bg-[var(--whale)]/20 border-[var(--whale)]/30" : "bg-[hsl(var(--muted))] border-[hsl(var(--border))]";

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--muted)/0.5)] hover:bg-[hsl(var(--muted))] transition-colors">
      <div className="flex items-center gap-4">
        <span className="text-xs text-[hsl(var(--muted-foreground))] w-16">{time}</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{address}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isBuy ? "bg-[var(--up)]/20 text-[var(--up)]" : "bg-[var(--down)]/20 text-[var(--down)]"}`}>
              {action} {amount}
            </span>
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {market} @ {price}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1 rounded-full border ${scoreBg}`}>
          <span className={`font-mono text-sm font-semibold ${scoreColor}`}>{score}</span>
        </div>
        <button className="text-xs text-[hsl(var(--primary))] hover:underline">跟单</button>
      </div>
    </div>
  );
}

function HeatmapCard({
  category,
  change,
  volume,
  color,
}: {
  category: string;
  change: number;
  volume: string;
  color: "up" | "down" | "neutral";
}) {
  const colorClass = color === "up" ? "border-[var(--up)]/50 bg-[var(--up)]/10" : color === "down" ? "border-[var(--down)]/50 bg-[var(--down)]/10" : "border-[hsl(var(--border))] bg-[hsl(var(--muted))]";
  const changeColor = change >= 0 ? "text-[var(--up)]" : "text-[var(--down)]";

  return (
    <div className={`rounded-xl p-4 border ${colorClass} transition-colors hover:opacity-80`}>
      <div className="text-sm font-medium">{category}</div>
      <div className={`text-lg font-bold font-mono ${changeColor}`}>
        {change >= 0 ? "+" : ""}{change}%
      </div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{volume}</div>
    </div>
  );
}
