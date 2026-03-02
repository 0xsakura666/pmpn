"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { WalletButton } from "@/components/auth/ConnectWallet";

export default function Home() {
  return (
    <main className="min-h-screen bg-[hsl(var(--background))]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--background))/0.8] backdrop-blur-xl border-b border-[hsl(var(--border))/0.5]">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-['Space_Grotesk'] text-xl font-bold">
              <span className="text-gradient">Tectonic</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/markets" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                市场
              </Link>
              <Link href="/smart-money" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                聪明钱
              </Link>
            </div>
          </div>
          <WalletButton />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[hsl(var(--primary))/0.1] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--whale)]/0.1 rounded-full blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 text-center">
          <h1 className="font-['Space_Grotesk'] text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            <span className="text-gradient">交易</span>
            <br />
            <span className="text-[hsl(var(--foreground))]">更快. 更精准. 更智能.</span>
          </h1>

          <p className="mt-8 text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Polymarket 专业交易终端，实时追踪聪明钱动向，一键跟单巨鲸交易
          </p>

          {/* Stats */}
          <div className="mt-12 flex items-center justify-center gap-16">
            <StatCounter label="交易量" value={12500000} prefix="$" />
            <StatCounter label="用户收益" value={850000} prefix="$" />
          </div>

          {/* CTA Buttons */}
          <div className="mt-12 flex items-center justify-center gap-4">
            <Link
              href="/markets"
              className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold text-lg shadow-lg shadow-[hsl(var(--primary))/0.25] hover:shadow-[hsl(var(--primary))/0.4] transition-all hover:scale-105"
            >
              开始交易
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link
              href="/smart-money"
              className="px-8 py-4 rounded-xl border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-semibold text-lg hover:bg-[hsl(var(--muted))] transition-colors"
            >
              了解更多
            </Link>
          </div>
        </div>
      </section>

      {/* Features Intro */}
      <section className="relative py-24 border-t border-[hsl(var(--border))/0.5]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold mb-4">
              预测市场专业工具
            </h2>
            <p className="text-xl text-[hsl(var(--muted-foreground))]">
              Tectonic 为您提供市场上最强大的预测市场交易工具
            </p>
          </div>

          {/* Mini Stats */}
          <div className="flex items-center justify-center gap-12 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient">10K+</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">活跃用户</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient">50+</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))] mt-1">市场覆盖</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1: Advanced Market View */}
      <section className="py-24 border-t border-[hsl(var(--border))/0.5]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="font-['Space_Grotesk'] text-3xl font-bold mb-6">
                专业市场视图
              </h3>
              <p className="text-[hsl(var(--muted-foreground))] mb-8">
                使用完整的市场数据进行交易。我们的专业工具让您快速切换视图，做出更快、更明智的决策。
              </p>
              <ul className="space-y-4">
                <FeatureItem text="快速了解任何市场中的交易者概况" />
                <FeatureItem text="高级交易分析和用户追踪" />
                <FeatureItem text="分析市场持仓变化，查看资金流向" />
              </ul>
              <Link
                href="/markets"
                className="inline-flex items-center mt-8 text-[hsl(var(--primary))] font-semibold hover:underline"
              >
                点击探索 →
              </Link>
            </div>
            <div className="glass rounded-2xl p-6 hover:border-[hsl(var(--primary))/0.5] transition-all cursor-pointer group">
              <div className="text-sm text-[hsl(var(--muted-foreground))] mb-4">市场分析预览</div>
              <div className="space-y-3">
                <MarketPreviewCard
                  title="Trump 2024"
                  yesPrice={0.52}
                  change={2.4}
                  volume="$4.2M"
                />
                <MarketPreviewCard
                  title="BTC $150K"
                  yesPrice={0.35}
                  change={-1.2}
                  volume="$2.1M"
                />
                <MarketPreviewCard
                  title="Fed Rate Cut"
                  yesPrice={0.78}
                  change={5.1}
                  volume="$890K"
                />
              </div>
              <div className="mt-4 text-center text-sm text-[hsl(var(--primary))] opacity-0 group-hover:opacity-100 transition-opacity">
                点击查看详情
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Smart Money Tracking */}
      <section className="py-24 border-t border-[hsl(var(--border))/0.5] bg-[hsl(var(--muted))/0.3]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 glass rounded-2xl p-6 hover:border-[var(--whale)]/0.5 transition-all cursor-pointer group">
              <div className="text-sm text-[hsl(var(--muted-foreground))] mb-4">聪明钱动态</div>
              <div className="space-y-3">
                <WhaleActivityCard
                  address="0x7a8...3f2"
                  action="BUY"
                  amount="$45,000"
                  market="Trump 2024"
                  score={92}
                />
                <WhaleActivityCard
                  address="0x9c2...1a5"
                  action="SELL"
                  amount="$28,000"
                  market="ETH $5K"
                  score={87}
                />
                <WhaleActivityCard
                  address="0x4e1...8d7"
                  action="BUY"
                  amount="$15,000"
                  market="Fed Rate"
                  score={85}
                />
              </div>
              <div className="mt-4 text-center text-sm text-[var(--whale)] opacity-0 group-hover:opacity-100 transition-opacity">
                点击查看更多
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="font-['Space_Grotesk'] text-3xl font-bold mb-6">
                聪明钱追踪
              </h3>
              <p className="text-[hsl(var(--muted-foreground))] mb-8">
                实时追踪巨鲸交易动态。Whale Score™ 评分系统帮助您识别最有价值的交易信号。
              </p>
              <ul className="space-y-4">
                <FeatureItem text="实时监控大额交易和巨鲸动向" />
                <FeatureItem text="Whale Score™ 0-100 评分系统" />
                <FeatureItem text="一键跟单，快速复制成功策略" />
              </ul>
              <Link
                href="/smart-money"
                className="inline-flex items-center mt-8 text-[var(--whale)] font-semibold hover:underline"
              >
                点击探索 →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Real-time Signals */}
      <section className="py-24 border-t border-[hsl(var(--border))/0.5]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="font-['Space_Grotesk'] text-3xl font-bold mb-6">
                实时信号推送
              </h3>
              <p className="text-[hsl(var(--muted-foreground))] mb-8">
                专为预测市场打造的最佳信号平台。通过将实时更新直接集成到市场中，使新闻交易变得无缝。
              </p>
              <ul className="space-y-4">
                <FeatureItem text="来自 X.com、Truth Social 等平台的新闻" />
                <FeatureItem text="直接关联相关市场，快速执行" />
                <FeatureItem text="语音提醒确保您不错过任何机会" />
              </ul>
              <Link
                href="/signals"
                className="inline-flex items-center mt-8 text-[var(--up)] font-semibold hover:underline"
              >
                点击探索 →
              </Link>
            </div>
            <div className="glass rounded-2xl p-6 hover:border-[var(--up)]/0.5 transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">实时信号</span>
                <span className="flex items-center gap-2 text-sm text-[var(--up)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--up)] animate-pulse" />
                  已连接
                </span>
              </div>
              <div className="space-y-3">
                <SignalCard
                  time="NOW"
                  title="Breaking: Fed signals potential rate cut"
                  market="Fed Rate Cut"
                  impact="high"
                />
                <SignalCard
                  time="2m"
                  title="Trump leads in latest poll"
                  market="Trump 2024"
                  impact="medium"
                />
                <SignalCard
                  time="5m"
                  title="BTC breaks $100K resistance"
                  market="BTC $150K"
                  impact="high"
                />
              </div>
              <div className="mt-4 text-center text-sm text-[var(--up)] opacity-0 group-hover:opacity-100 transition-opacity">
                点击查看更多
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-[hsl(var(--border))/0.5]">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-['Space_Grotesk'] text-4xl font-bold mb-8">
            准备好开始了吗？
          </h2>
          <Link
            href="/markets"
            className="inline-flex items-center px-10 py-5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[var(--whale)] text-white font-semibold text-xl shadow-lg shadow-[hsl(var(--primary))/0.25] hover:shadow-[hsl(var(--primary))/0.4] transition-all hover:scale-105"
          >
            开始交易
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[hsl(var(--border))/0.5]">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            © 2025 Tectonic. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

function StatCounter({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold font-mono text-gradient">
        {prefix}{formatNumber(count)}
      </div>
      <div className="text-sm text-[hsl(var(--muted-foreground))] mt-2">{label}</div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-[var(--up)] mt-1">✓</span>
      <span className="text-[hsl(var(--foreground))]">{text}</span>
    </li>
  );
}

function MarketPreviewCard({ title, yesPrice, change, volume }: { title: string; yesPrice: number; change: number; volume: string }) {
  const isUp = change >= 0;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))/0.5] hover:bg-[hsl(var(--muted))] transition-colors">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">{volume}</div>
      </div>
      <div className="text-right">
        <div className="font-mono font-bold">${yesPrice.toFixed(2)}</div>
        <div className={`text-sm ${isUp ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
          {isUp ? "+" : ""}{change.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function WhaleActivityCard({ address, action, amount, market, score }: { address: string; action: "BUY" | "SELL"; amount: string; market: string; score: number }) {
  const isBuy = action === "BUY";
  const scoreColor = score >= 90 ? "text-yellow-400 bg-yellow-400/20" : "text-[var(--whale)] bg-[var(--whale)]/20";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))/0.5] hover:bg-[hsl(var(--muted))] transition-colors">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-[hsl(var(--muted-foreground))]">{address}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isBuy ? "bg-[var(--up)]/20 text-[var(--up)]" : "bg-[var(--down)]/20 text-[var(--down)]"}`}>
          {action}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-semibold">{amount}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{market}</div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-bold ${scoreColor}`}>
          {score}
        </div>
      </div>
    </div>
  );
}

function SignalCard({ time, title, market, impact }: { time: string; title: string; market: string; impact: "high" | "medium" | "low" }) {
  const impactColor = impact === "high" ? "bg-[var(--up)]/20 text-[var(--up)]" : impact === "medium" ? "bg-yellow-400/20 text-yellow-400" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";

  return (
    <div className="p-3 rounded-lg bg-[hsl(var(--muted))/0.5] hover:bg-[hsl(var(--muted))] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{time}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${impactColor}`}>
          {impact === "high" ? "高影响" : impact === "medium" ? "中影响" : "低影响"}
        </span>
      </div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">关联市场: {market}</div>
    </div>
  );
}
