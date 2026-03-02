"use client";

interface WhaleScoreProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function WhaleScore({ score, size = "md", showLabel = true }: WhaleScoreProps) {
  const tier = getWhaleScoreTier(score);
  
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold ${tier.bgClass} ${tier.textClass} relative`}
        style={{
          boxShadow: `0 0 ${size === "lg" ? 20 : 10}px ${tier.glowColor}`,
        }}
      >
        <span>{score}</span>
        {tier.icon && (
          <span className="absolute -top-1 -right-1 text-sm">{tier.icon}</span>
        )}
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className={`font-semibold ${tier.textClass}`}>{tier.label}</span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">巨鲸评分</span>
        </div>
      )}
    </div>
  );
}

export function WhaleScoreBadge({ score }: { score: number }) {
  const tier = getWhaleScoreTier(score);
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tier.bgClass} ${tier.textClass}`}
    >
      {tier.icon} {score}
    </span>
  );
}

export function WhaleScoreBar({ score }: { score: number }) {
  const tier = getWhaleScoreTier(score);
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className={tier.textClass}>{tier.label}</span>
        <span className="font-mono">{score}/100</span>
      </div>
      <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tier.barClass}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function getWhaleScoreTier(score: number) {
  if (score >= 90) {
    return {
      label: "超级巨鲸",
      icon: "🐋",
      bgClass: "bg-gradient-to-br from-[#FFD700] to-[#FFA500]",
      textClass: "text-[#FFD700]",
      barClass: "bg-gradient-to-r from-[#FFD700] to-[#FFA500]",
      glowColor: "rgba(255, 215, 0, 0.5)",
    };
  } else if (score >= 75) {
    return {
      label: "巨鲸",
      icon: "🐳",
      bgClass: "bg-gradient-to-br from-[var(--whale)] to-[#8B5CF6]",
      textClass: "text-[var(--whale)]",
      barClass: "bg-gradient-to-r from-[var(--whale)] to-[#8B5CF6]",
      glowColor: "rgba(59, 130, 246, 0.5)",
    };
  } else if (score >= 50) {
    return {
      label: "海豚",
      icon: "🐬",
      bgClass: "bg-gradient-to-br from-[#06B6D4] to-[#0891B2]",
      textClass: "text-[#06B6D4]",
      barClass: "bg-gradient-to-r from-[#06B6D4] to-[#0891B2]",
      glowColor: "rgba(6, 182, 212, 0.4)",
    };
  } else if (score >= 25) {
    return {
      label: "小鱼",
      icon: "🐟",
      bgClass: "bg-gradient-to-br from-[#22C55E] to-[#16A34A]",
      textClass: "text-[#22C55E]",
      barClass: "bg-gradient-to-r from-[#22C55E] to-[#16A34A]",
      glowColor: "rgba(34, 197, 94, 0.3)",
    };
  } else {
    return {
      label: "虾米",
      icon: "🦐",
      bgClass: "bg-gradient-to-br from-[hsl(var(--muted))] to-[hsl(var(--muted))]",
      textClass: "text-[hsl(var(--muted-foreground))]",
      barClass: "bg-[hsl(var(--muted-foreground))]",
      glowColor: "transparent",
    };
  }
}
