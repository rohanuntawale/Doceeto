"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/config";

/**
 * Browser Supabase client. Returns null in demo mode so callers can
 * fall back to the demo engine without throwing.
 */
export function getSupabaseBrowser() {
  if (!isSupabaseConfigured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
