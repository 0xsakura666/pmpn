"use client";

import { memo } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { getCompactOutcomeLabel, normalizeOutcomeLabel } from "@/lib/outcome-label";
import type { EventGroup } from "./types";

function getSubMarketLabel(question: string, eventTitle: string): string {
  if (!question || question === eventTitle) return "";
  const titleBase = eventTitle.replace(/[.…?!]+$/g, "").trim().toLowerCase();
  const qClean = question.replace(/\?$/, "").trim();
  const qLower = qClean.toLowerCase();
  if (titleBase.length > 5 && qLower.startsWith(titleBase)) {
    const suffix = qClean.slice(titleBase.length).trim();
    if (suffix) return suffix;
  }
  if (qClean.length > 28) return qClean.slice(0, 25) + "...";
  return qClean;
}

export const EventCard = memo(function EventCard({ event }: { event: EventGroup }) {
  const isSingle = event.markets.length === 1;
  const primary = event.markets[0];
  const displayMarkets = event.markets.slice(0, 2);
  const remaining = event.markets.length - 2;
  const primaryLink = primary?.conditionId ? `/markets/${primary.conditionId}` : "#";

  if (isSingle) {
    const yp = Math.round(primary.yesPrice * 100);
    const np = Math.round(primary.noPrice * 100);
    const yesLabel = normalizeOutcomeLabel(primary.yesLabel, "Yes");
    const noLabel = normalizeOutcomeLabel(primary.noLabel, "No");
    const yesCompact = getCompactOutcomeLabel(yesLabel, 11);
    const noCompact = getCompactOutcomeLabel(noLabel, 11);
    return (
      <Card hover padding="lg" className="group flex h-full flex-col">
        <Link href={primaryLink} className="mb-4 flex items-start gap-3">
          {event.image && (
            <img src={event.image} alt="" className="h-8 w-8 shrink-0 rounded-[var(--radius-lg)] object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1">
              {event.isShortTerm && (
                <div className="inline-flex rounded-full bg-[var(--brand-primary-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)]">
                  短期
                </div>
              )}
              {event.category && event.category !== "其他" && (
                <div className="inline-flex rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                  {event.category}
                </div>
              )}
            </div>
            <h3 className="text-[15px] font-semibold leading-snug text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
              {event.title}
            </h3>
          </div>
        </Link>

        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-4 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
            <Link href={primaryLink} className="block min-w-0">
              <div className="rounded-[18px] border border-[var(--color-up)]/20 bg-[var(--color-up-muted)]/70 p-3 transition-all hover:border-[var(--color-up)]/35 hover:bg-[var(--color-up-muted)]">
                <div className="truncate text-[11px] font-medium text-[var(--color-up)]" title={yesLabel}>{yesCompact}</div>
                <div className="mt-1 text-2xl font-bold leading-none text-[var(--text-primary)]">{yp}%</div>
                <div className="mt-2 text-[11px] text-[var(--text-subtle)]">买入 {yesCompact}</div>
              </div>
            </Link>
            <Link href={primaryLink} className="block min-w-0">
              <div className="rounded-[18px] border border-[var(--color-down)]/20 bg-[var(--color-down-muted)]/70 p-3 transition-all hover:border-[var(--color-down)]/35 hover:bg-[var(--color-down-muted)]">
                <div className="truncate text-[11px] font-medium text-[var(--color-down)]" title={noLabel}>{noCompact}</div>
                <div className="mt-1 text-2xl font-bold leading-none text-[var(--text-primary)]">{np}%</div>
                <div className="mt-2 text-[11px] text-[var(--text-subtle)]">买入 {noCompact}</div>
              </div>
            </Link>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-[16px] bg-[var(--bg-elevated)] px-3 py-2 text-xs">
            <span className="truncate text-[var(--text-subtle)]" title={yesLabel}>{yesLabel}</span>
            <span className="mx-3 h-3 w-px shrink-0 bg-[var(--border-default)]" />
            <span className="truncate text-right text-[var(--text-subtle)]" title={noLabel}>{noLabel}</span>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
            <span className="text-xs text-[var(--text-disabled)]">成交量 {formatMoney(event.totalVolume)}</span>
            <button
              className="text-[var(--text-disabled)] transition-colors hover:text-[var(--text-primary)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Bookmark className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const eventLink = `/events/${event.id}`;

  return (
    <Card hover padding="lg" className="group flex h-full flex-col">
      <Link href={eventLink} className="mb-4 flex items-start gap-3">
        {event.image && (
          <img src={event.image} alt="" className="h-8 w-8 shrink-0 rounded-[var(--radius-lg)] object-cover" />
        )}
        <div className="min-w-0 flex-1">
          {event.isShortTerm && (
            <div className="mb-1 inline-flex rounded-full bg-[var(--brand-primary-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)]">
              短期
            </div>
          )}
          <h3 className="text-[15px] font-semibold leading-snug text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
            {event.title}
          </h3>
        </div>
      </Link>

      <div className="mb-3 flex flex-1 flex-col gap-2.5">
        {displayMarkets.map((m) => {
          const yp = Math.round(m.yesPrice * 100);
          const np = Math.round(m.noPrice * 100);
          const label = getSubMarketLabel(m.question, event.title) || m.question;
          const yesLabel = normalizeOutcomeLabel(m.yesLabel, "Yes");
          const noLabel = normalizeOutcomeLabel(m.noLabel, "No");
          const yesCompact = getCompactOutcomeLabel(yesLabel, 8);
          const noCompact = getCompactOutcomeLabel(noLabel, 8);
          const mLink = m.conditionId ? `/markets/${m.conditionId}` : "#";
          return (
            <div key={m.conditionId} className="rounded-[16px] bg-[var(--bg-elevated)] p-2.5">
              <div className="flex items-center gap-2">
                <Link
                  href={mLink}
                  className="min-w-0 flex-1 truncate text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {label}
                </Link>
                <span className="shrink-0 text-sm font-semibold text-[var(--text-primary)]">{yp}%</span>
              </div>
              <div className="mt-2 flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Link href={mLink} className="min-w-0 flex-1">
                  <Badge variant="success" size="sm" className="flex w-full justify-between px-2" title={yesLabel}>
                    <span className="truncate">{yesCompact}</span>
                    <span className="ml-1 shrink-0">{yp}%</span>
                  </Badge>
                </Link>
                <Link href={mLink} className="min-w-0 flex-1">
                  <Badge variant="error" size="sm" className="flex w-full justify-between px-2" title={noLabel}>
                    <span className="truncate">{noCompact}</span>
                    <span className="ml-1 shrink-0">{np}%</span>
                  </Badge>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3 mt-auto">
        <Link href={eventLink} className="text-xs text-[var(--text-disabled)] hover:text-[var(--brand-primary)] transition-colors">
          {remaining > 0 && `+${remaining} 个市场 · `}成交量 {formatMoney(event.totalVolume)}
        </Link>
        <button
          className="text-[var(--text-disabled)] transition-colors hover:text-[var(--text-primary)]"
          onClick={(e) => e.stopPropagation()}
        >
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
});
