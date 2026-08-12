"use client";

import { Eye, Search, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthorChip } from "@/components/social/author-chip";
import { useEngagement } from "@/lib/hooks/social";
import { timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { EngagementMetric } from "@/lib/social/types";

/**
 * "How you're doing" — the last seven days against the seven before.
 *
 * Four numbers, each with the comparison that makes it mean something: 40
 * profile views is neither good nor bad until you know last week was 12. The
 * server zeroes this payload rather than failing if the events table has a
 * problem, so these cards render even when the analytics behind them don't.
 */
export function EngagementPanel() {
  const data = useEngagement();
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Profile views" icon={Eye} metric={data.profileViews} />
        <Metric label="Post impressions" icon={TrendingUp} metric={data.postImpressions} />
        <Metric label="Search appearances" icon={Search} metric={data.searchAppearances} />
        <Metric label="New followers" icon={UserPlus} metric={data.followerGrowth} />
      </div>

      <Card>
        <CardHeader
          label={`${data.uniqueViewers} in total`}
          title="Who viewed your profile"
        />
        {data.recentViewers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No profile views yet"
              desc="Posting and commenting is what puts you in front of colleagues."
              icon={<Users className="h-6 w-6" />}
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.recentViewers.map((viewer) => (
              <li key={viewer.id} className="px-4 py-3">
                <AuthorChip author={viewer} at={viewer.viewedAt} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Metric({
  label,
  icon: Icon,
  metric,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  metric: EngagementMetric;
}) {
  const up = metric.trendPct >= 0;
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Icon className="h-4 w-4" />
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className="mt-2 font-serif text-2xl tabular-nums text-[var(--text)]">{metric.current}</p>
      {/* Only shown when there is something to compare against — "+100% on 0"
          is technically the rule and rhetorically a lie. */}
      {(metric.previous > 0 || metric.current > 0) && (
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[11px]",
            up ? "text-status-ok" : "text-status-critical",
          )}
        >
          <Trend className="h-3 w-3" />
          {up ? "+" : ""}
          {metric.trendPct}% vs last week
        </p>
      )}
    </Card>
  );
}
