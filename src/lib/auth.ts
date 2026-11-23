import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Role } from "./types";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role | null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const email = profile?.email ?? (typeof claims.email === "string" ? claims.email : "");
  return {
    id: claims.sub,
    email,
    name: profile?.full_name || email.split("@")[0] || "Benutzer",
    role: (profile?.role as Role | null) ?? null,
  };
});

/** Ensures a signed-in user with one of the given roles, otherwise redirects. */
export async function requireUser(roles: Role[] = ["admin", "mechanic"]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.role) redirect("/no-access");
  if (!roles.includes(user.role)) redirect("/");
  return user as CurrentUser & { role: Role };
}
