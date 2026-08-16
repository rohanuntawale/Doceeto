"use client";

import { useState } from "react";
import { MessageSquare, Search, UserX } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { AuthorChip } from "@/components/social/author-chip";
import { FollowButton } from "@/components/social/follow-button";
import {
  useBlocked,
  useFollowCounts,
  useGraph,
  usePeopleSearch,
  useSocialAction,
  useSuggestions,
} from "@/lib/hooks/social";
import { cn } from "@/lib/utils/cn";
import type { FollowStatus, SocialAuthor } from "@/lib/social/types";

type Section = "discover" | "followers" | "following" | "blocked";

/**
 * The graph, as four lists.
 *
 * "Message" only appears on a MUTUAL row, because that is the only row where
 * it would work. Offering it everywhere and letting the server refuse is how
 * you teach people that buttons in this app are unreliable — the gate is a
 * product rule, so it belongs in what the interface offers, not only in what
 * the server accepts.
 */
export function PeoplePanel({ onMessage }: { onMessage: (userId: string) => void }) {
  const [section, setSection] = useState<Section>("discover");
  const [query, setQuery] = useState("");
  const counts = useFollowCounts();
  const suggestions = useSuggestions();
  const followers = useGraph("followers");
  const following = useGraph("following");
  const blocked = useBlocked();
  const search = usePeopleSearch(query);

  const searching = query.trim().length >= 2;
  const list: (SocialAuthor & FollowStatus)[] = searching
    ? search.people
    : section === "followers"
      ? followers
      : section === "following"
        ? following
        : suggestions;

  const TABS: { id: Section; label: string; count?: number }[] = [
    { id: "discover", label: "Discover" },
    { id: "followers", label: "Followers", count: counts.followers },
    { id: "following", label: "Following", count: counts.following },
    { id: "blocked", label: "Blocked", count: blocked.length },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search colleagues by name or specialty…"
          className="h-11 w-full rounded-full border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta"
        />
      </div>

      {!searching && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                section === tab.id
                  ? "bg-terracotta text-on-accent"
                  : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="text-xs text-[var(--text-muted)]">
          {search.isLoading
            ? "Searching…"
            : // The total is shown even when it equals the page: "12 of 12" is
              // a fact, "12 results" with a hidden cap is a guess.
              `Showing ${search.people.length} of ${search.total}`}
        </p>
      )}

      {section === "blocked" && !searching ? (
        <BlockedList people={blocked} />
      ) : list.length === 0 ? (
        <EmptyState
          title={searching ? "No one matched that" : "Nobody to show yet"}
          desc={
            searching
              ? "Try a specialty, or part of a name."
              : section === "followers"
                ? "Post something, colleagues find you through the feed."
                : "Follow a few colleagues and their posts will fill your feed."
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {list.map((person) => (
              <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <AuthorChip author={person} />
                </div>
                {person.isMutual && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onMessage(person.id)}
                    aria-label={`Message ${person.name}`}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
                <FollowButton userId={person.id} status={person} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function BlockedList({ people }: { people: SocialAuthor[] }) {
  const { run } = useSocialAction();
  const toast = useToast();

  if (!people.length) {
    return (
      <EmptyState
        title="No one is blocked"
        desc="Blocking hides both of you from each other, everywhere on the network."
        icon={<UserX className="h-6 w-6" />}
      />
    );
  }

  return (
    <Card>
      <CardHeader label="Moderation" title="Blocked accounts" />
      <ul className="divide-y divide-[var(--border)]">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <AuthorChip author={person} />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await run("setBlock", { userId: person.id, blocked: false });
                  toast.push({ title: `Unblocked ${person.name}`, tone: "success" });
                } catch (err) {
                  toast.push({ title: (err as Error).message, tone: "error" });
                }
              }}
            >
              Unblock
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
