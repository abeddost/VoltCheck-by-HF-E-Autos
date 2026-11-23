import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Car, ChevronRight } from "lucide-react";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { date, km } from "@/lib/format";
import { signPaths } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { STATUS_META, leadTitle, type Lead } from "@/lib/types";
import { NewInspectionButton } from "./new-inspection-button";

export const metadata: Metadata = { title: "Meine Prüfungen" };

type Row = Pick<Lead, "id" | "status" | "make" | "model" | "variant" | "plate" | "mileage" | "updated_at" | "submitted_at" | "cover_photo_path" | "seller_name">;

export default function InspectionsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meine Prüfungen</h1>
          <p className="text-sm text-slate-500">Fahrzeuge prüfen und an den Admin senden.</p>
        </div>
        <NewInspectionButton />
      </div>
      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        }
      >
        <InspectionList />
      </Suspense>
    </main>
  );
}

async function InspectionList() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, status, make, model, variant, plate, mileage, updated_at, submitted_at, cover_photo_path, seller_name")
    .eq("mechanic_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Fehler beim Laden: {error.message}</p>;
  }

  const rows = (data ?? []) as Row[];
  const urls = await signPaths(supabase, rows.map((r) => r.cover_photo_path));
  const drafts = rows.filter((r) => r.status === "draft");
  const sent = rows.filter((r) => r.status !== "draft");

  if (rows.length === 0) {
    return (
      <EmptyState title="Noch keine Prüfungen">
        <p>Starte die erste Fahrzeugprüfung.</p>
        <div className="mt-4 flex justify-center">
          <NewInspectionButton large />
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-8">
      {drafts.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">In Arbeit ({drafts.length})</h2>
          <ul className="space-y-3">
            {drafts.map((row) => (
              <InspectionCard key={row.id} row={row} thumb={row.cover_photo_path ? urls.get(row.cover_photo_path) : undefined} />
            ))}
          </ul>
        </section>
      ) : null}
      {sent.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Eingereicht ({sent.length})</h2>
          <ul className="space-y-3">
            {sent.map((row) => (
              <InspectionCard key={row.id} row={row} thumb={row.cover_photo_path ? urls.get(row.cover_photo_path) : undefined} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function InspectionCard({ row, thumb }: { row: Row; thumb?: string }) {
  const sentBack = row.status === "draft" && !!row.submitted_at;
  const meta = sentBack ? { label: "Zur Überarbeitung", className: "bg-amber-50 text-amber-800 ring-amber-200" } : STATUS_META[row.status];
  return (
    <li>
      <Link
        href={`/inspections/${row.id}`}
        className="flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 transition hover:ring-slate-300 active:bg-slate-50"
      >
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
            <img src={thumb} alt="" className="size-full object-cover" />
          ) : (
            <Car className="size-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{leadTitle(row)}</span>
            <Badge className={meta.className}>{meta.label}</Badge>
          </div>
          <div className="mt-0.5 truncate text-sm text-slate-500">
            {[row.plate, row.mileage !== null ? km(row.mileage) : null, row.seller_name].filter(Boolean).join(" · ") || "Noch keine Daten"}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {row.status === "draft" && !sentBack ? `Zuletzt bearbeitet ${date(row.updated_at, true)}` : `Eingereicht ${date(row.submitted_at, true)}`}
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-slate-400" />
      </Link>
    </li>
  );
}
