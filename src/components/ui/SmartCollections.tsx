"use client";

import { useState } from "react";
import { WhaleScoreBadge } from "./WhaleScore";

interface Wallet {
  address: string;
  name?: string;
  whaleScore: number;
  winRate: number;
  totalPnl: number;
  totalTrades: number;
  tags: string[];
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  wallets: Wallet[];
  criteria?: {
    minWhaleScore?: number;
    minWinRate?: number;
    category?: string;
  };
  totalPnl: number;
  avgWinRate: number;
}

interface SmartCollectionsProps {
  collections: Collection[];
  onCreateCollection?: () => void;
  onCollectionClick?: (collection: Collection) => void;
}

export function SmartCollections({
  collections,
  onCreateCollection,
  onCollectionClick,
}: SmartCollectionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-['Space_Grotesk'] font-semibold">智能组合</h3>
        <button
          onClick={onCreateCollection}
          className="px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
        >
          + 新建组合
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            onClick={() => onCollectionClick?.(collection)}
          />
        ))}
      </div>

      {collections.length === 0 && (
        <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
          <p className="mb-2">暂无组合</p>
          <p className="text-sm">创建组合来分组和追踪钱包</p>
        </div>
      )}
    </div>
  );
}

function CollectionCard({
  collection,
  onClick,
}: {
  collection: Collection;
  onClick: () => void;
}) {
  const isProfitable = collection.totalPnl >= 0;

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-xl glass cursor-pointer hover:border-[hsl(var(--primary))] border border-transparent transition-all"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-semibold">{collection.name}</h4>
          {collection.description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              {collection.description}
            </p>
          )}
        </div>
        <span className="text-xs bg-[hsl(var(--muted))] px-2 py-1 rounded">
          {collection.wallets.length} 个钱包
        </span>
      </div>

      {collection.criteria && (
        <div className="flex flex-wrap gap-2 mb-3">
            {collection.criteria.minWhaleScore && (
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--whale)]/20 text-[var(--whale)]">
              评分 ≥ {collection.criteria.minWhaleScore}
            </span>
          )}
          {collection.criteria.minWinRate && (
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--up)]/20 text-[var(--up)]">
              胜率 ≥ {collection.criteria.minWinRate}%
            </span>
          )}
          {collection.criteria.category && (
            <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--muted))]">
              {collection.criteria.category}
            </span>
          )}
        </div>
      )}

      <div className="flex justify-between text-sm">
        <div>
          <span className="text-[hsl(var(--muted-foreground))]">总盈亏</span>
          <div className={`font-semibold ${isProfitable ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
            {isProfitable ? "+" : ""}${collection.totalPnl.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[hsl(var(--muted-foreground))]">平均胜率</span>
          <div className="font-semibold">{collection.avgWinRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Preview wallets */}
      <div className="mt-3 flex -space-x-2">
        {collection.wallets.slice(0, 5).map((wallet, i) => (
          <div
            key={wallet.address}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[var(--whale)] flex items-center justify-center text-xs font-bold border-2 border-[hsl(var(--background))]"
            title={wallet.name || wallet.address}
          >
            {wallet.whaleScore > 0 ? wallet.whaleScore : wallet.address.slice(2, 4)}
          </div>
        ))}
        {collection.wallets.length > 5 && (
          <div className="w-8 h-8 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs border-2 border-[hsl(var(--background))]">
            +{collection.wallets.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}

export function CreateCollectionModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description?: string; criteria: any }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minWhaleScore, setMinWhaleScore] = useState("");
  const [minWinRate, setMinWinRate] = useState("");

  if (!isOpen) return null;

  const handleCreate = () => {
    onCreate({
      name,
      description: description || undefined,
      criteria: {
        minWhaleScore: minWhaleScore ? parseInt(minWhaleScore) : undefined,
        minWinRate: minWinRate ? parseFloat(minWinRate) : undefined,
      },
    });
    setName("");
    setDescription("");
    setMinWhaleScore("");
    setMinWinRate("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-['Space_Grotesk'] font-semibold mb-4">
          创建智能组合
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[hsl(var(--muted-foreground))]">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：顶级巨鲸"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
            />
          </div>

          <div>
            <label className="text-sm text-[hsl(var(--muted-foreground))]">
              描述（可选）
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：评分大于80的钱包"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[hsl(var(--muted-foreground))]">
                最低巨鲸评分
              </label>
              <input
                type="number"
                value={minWhaleScore}
                onChange={(e) => setMinWhaleScore(e.target.value)}
                placeholder="0-100"
                min="0"
                max="100"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
              />
            </div>
            <div>
              <label className="text-sm text-[hsl(var(--muted-foreground))]">
                最低胜率 %
              </label>
              <input
                type="number"
                value={minWinRate}
                onChange={(e) => setMinWinRate(e.target.value)}
                placeholder="0-100"
                min="0"
                max="100"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-[hsl(var(--muted))] border border-[hsl(var(--border))] focus:outline-none focus:border-[hsl(var(--primary))]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name}
            className="flex-1 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
