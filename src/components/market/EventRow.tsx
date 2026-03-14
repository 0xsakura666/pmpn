"use client";

import { memo } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import type { EventGroup } from "./types";

export const EventRow = memo(function EventRow({ event }: { event: EventGroup }) {
  const primary = event.markets[0];
  const yp = Math.round(primary.yesPrice * 100);
  const eventLink = `/events/${event.id}`;
  const primaryMarketLink = primary?.conditionId ? `/markets/${primary.conditionId}` : eventLink;

  return (
    <Link href={eventLink} className="block">
      <div className="group grid grid-cols-[1fr_100px_100px_100px_140px] items-center gap-4 rounded-[var(--radius-xl)] border border-transparent px-4 py-3.5 transition-all hover:border-[var(--border-default)] hover:bg-[var(--bg-elevated)]">
        <div className="flex items-start gap-3 min-w-0">
          {event.image && (
            <img src={event.image} alt="" className="h-7 w-7 shrink-0 rounded-[var(--radius-md)] object-cover mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {event.title}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-disabled)]">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {event.daysLeft}天
              </span>
              {event.isShortTerm && (
                <Badge variant="success" size="xs">
                  短期
                </Badge>
              )}
              {event.markets.length > 1 && (
                <Badge variant="default" size="xs">
                  {event.markets.length} 个市场
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[var(--color-up)]">{yp}%</span>
            <span className="text-[11px] text-[var(--text-disabled)]">Yes</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div className="h-full rounded-full bg-[var(--color-up)]" style={{ width: `${yp}%` }} />
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-[var(--text-muted)]">{formatMoney(event.volume24h)}</p>
          <p className="text-[11px] text-[var(--text-disabled)]">24h</p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm text-[var(--text-muted)]">{formatMoney(event.totalVolume)}</p>
          <p className="text-[11px] text-[var(--text-disabled)]">总量</p>
        </div>

        <div className="flex items-center justify-end gap-2" onClick={(e) => e.preventDefault()}>
          <Link href={primaryMarketLink}>
            <Button variant="success" size="xs">
              Yes {yp}¢
            </Button>
          </Link>
          <Link href={primaryMarketLink}>
            <Button variant="danger" size="xs">
              No {100 - yp}¢
            </Button>
          </Link>
        </div>
      </div>
    </Link>
  );
});
