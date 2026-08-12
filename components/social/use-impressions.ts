"use client";

import { useCallback, useEffect, useRef } from "react";
import { socialAction } from "@/lib/hooks/social";

/**
 * Post impressions — "this was actually seen", not "this was in the response".
 *
 * THE 50% RULE. A post counts once it is at least half visible. Counting on
 * render would credit every post the feed fetched, including the twenty below
 * the fold that nobody scrolled to, which makes the number meaningless. Half
 * the card on screen is the cheapest honest proxy for "a person looked at it".
 *
 * ONCE PER MOUNT. The seen set lives for the life of the feed, so scrolling up
 * and back down does not re-count. The server de-duplicates per day on top of
 * that (the deterministic event id), so this is belt and braces — but the belt
 * saves the requests.
 *
 * BATCHED AND DEBOUNCED. Ids collect for ~1.5s and go in one POST. Scrolling
 * fast past thirty posts is one request, not thirty.
 *
 * The server decides whose impression it is: it maps each post id to its
 * author and skips the reader's own. The client never says who owns what.
 */
const FLUSH_MS = 1500;
const VISIBLE_RATIO = 0.5;

export function useImpressions() {
  const seen = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const elements = useRef<Map<Element, string>>(new Map());

  const flush = useCallback(() => {
    timer.current = null;
    const postIds = [...pending.current];
    pending.current.clear();
    if (!postIds.length) return;
    // Fire and forget. A dropped analytics batch is not worth a retry, a
    // toast, or a single line of error handling on the reader's screen.
    void socialAction("recordImpressions", { postIds }).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < VISIBLE_RATIO) continue;
          const postId = elements.current.get(entry.target);
          if (!postId || seen.current.has(postId)) continue;
          seen.current.add(postId);
          pending.current.add(postId);
          // Stop watching the moment it counts — an observer per post for the
          // life of the feed is the expensive part, not the callback.
          io.unobserve(entry.target);
          elements.current.delete(entry.target);
        }
        if (pending.current.size && !timer.current) {
          timer.current = setTimeout(flush, FLUSH_MS);
        }
      },
      { threshold: VISIBLE_RATIO },
    );
    observer.current = io;

    return () => {
      io.disconnect();
      observer.current = null;
      if (timer.current) clearTimeout(timer.current);
      // Whatever was collected but not yet sent still counts — the reader saw
      // it before navigating away.
      flush();
    };
  }, [flush]);

  /** Ref callback for a post card. */
  return useCallback((postId: string) => {
    return (node: HTMLElement | null) => {
      if (!node || !observer.current || seen.current.has(postId)) return;
      elements.current.set(node, postId);
      observer.current.observe(node);
    };
  }, []);
}
