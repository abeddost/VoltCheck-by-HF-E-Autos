import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";
import { CreateMemberForm, MemberRow, type Member } from "./team-client";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight">Team</h1>
      <p className="mb-6 text-sm text-slate-500">Zugänge für Mechaniker und Admins verwalten.</p>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Team />
      </Suspense>
    </main>
  );
}

async function Team() {
  const me = await requireUser(["admin"]);
  const supabase = await createClient();
  const [{ data: profiles, error }, { data: leads }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at"),
    supabase.from("leads").select("mechanic_id"),
  ]);
  const counts = new Map<string, number>();
  for (const l of leads ?? []) if (l.mechanic_id) counts.set(l.mechanic_id, (counts.get(l.mechanic_id) ?? 0) + 1);

  const members: Member[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role: (p.role as Role | null) ?? null,
    created_at: p.created_at,
    leadCount: counts.get(p.id) ?? 0,
  }));
  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="px-5 py-2">
        {error ? <p className="py-4 text-sm text-rose-700">Fehler: {error.message}</p> : null}
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} isMe={m.id === me.id} />
          ))}
        </ul>
      </Card>
      <div className="space-y-4">
        {!hasSecret ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            Zum Anlegen, Löschen und Passwort-Ändern wird der <b>Secret Key</b> von Supabase gebraucht: in <code>.env.local</code> als{" "}
            <code>SUPABASE_SECRET_KEY</code> eintragen (Supabase → Project Settings → API Keys).
          </p>
        ) : null}
        <CreateMemberForm />
      </div>
    </div>
  );
}
