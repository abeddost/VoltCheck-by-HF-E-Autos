import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/** Supabase client acting as the signed-in user (row level security applies). */
export async function createClient() {
  // The session check reads the current time, so never pre-render anything that uses the user's session.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Privileged client using the secret key. Only for user management by admins.
 * Returns null when SUPABASE_SECRET_KEY is not configured.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !secret) return null;
  return createSupabaseClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
