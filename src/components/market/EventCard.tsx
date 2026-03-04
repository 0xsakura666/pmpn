"use client";

import { memo } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
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
    const np = 100 - yp;
    return (
      <Card hover padding="lg" className="group flex h-full flex-col">
        <Link href={primaryLink} className="mb-4 flex items-start gap-3">
          {event.image && (
            <img src={event.image} alt="" className="h-8 w-8 shrink-0 rounded-[var(--radius-lg)] object-cover" />
          )}
          <h3 className="text-[15px] font-semibold leading-snug text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
            {event.title}
          </h3>
        </Link>

        <div className="flex flex-1 flex-col justify-end">
          <div className="mb-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Link href={primaryLink} className="flex-1">
              <Button variant="success" fullWidth size="md">
                买入 Yes
              </Button>
            </Link>
            <Link href={primaryLink} className="flex-1">
              <Button variant="danger" fullWidth size="md">
                买入 No
              </Button>
            </Link>
          </div>

          <div className="mb-4 flex justify-between text-xs">
            <span className="text-[var(--text-subtle)]">Yes {yp}%</span>
            <span className="text-[var(--text-subtle)]">No {np}%</span>
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
        <h3 className="text-[15px] font-semibold leading-snug text-[var(--text-secondary)] line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
          {event.title}
        </h3>
      </Link>

      <div className="mb-3 flex flex-1 flex-col gap-2.5">
        {displayMarkets.map((m) => {
          const yp = Math.round(m.yesPrice * 100);
          const label = getSubMarketLabel(m.question, event.title) || m.question;
          const mLink = m.conditionId ? `/markets/${m.conditionId}` : "#";
          return (
            <div key={m.conditionId} className="flex items-center gap-2">
              <Link
                href={mLink}
                className="min-w-0 flex-1 truncate text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {label}
              </Link>
              <span className="shrink-0 w-12 text-right text-sm font-semibold text-[var(--text-primary)]">
                {yp}%
              </span>
              <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                <Link href={mLink}>
                  <Badge variant="success" size="sm">Yes</Badge>
                </Link>
                <Link href={mLink}>
                  <Badge variant="error" size="sm">No</Badge>
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
