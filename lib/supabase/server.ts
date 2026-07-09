import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/config";

/**
 * Server Supabase client for RSC / route handlers. Returns null in
 * demo mode. Cookie writes are wrapped in try/catch because RSC can
 * only read cookies — the middleware refreshes the session.
 */
export function getSupabaseServer() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: { name: string; value: string; options?: CookieOptions }[]) {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore.
        }
      },
    },
  });
}
