import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BatteryCharging, Car, Download, Search, Wrench } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, EmptyState, Skeleton, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { cn, date, eur, km, monthYear, num } from "@/lib/format";
import { signPaths } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_LABEL, RECOMMENDATION_META, STATUS_META, leadTitle, sohClass, type Lead, type LeadStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Leads" };

const TABS: { key: string; label: string; statuses: LeadStatus[] | null }[] = [
  { key: "active", label: "Aktiv", statuses: ["submitted", "in_review", "offer_sent"] },
  { key: "submitted", label: "Neu", statuses: ["submitted"] },
  { key: "in_review", label: "In Prüfung", statuses: ["in_review"] },
  { key: "offer_sent", label: "Angebot", statuses: ["offer_sent"] },
  { key: "bought", label: "Gekauft", statuses: ["bought"] },
  { key: "rejected", label: "Abgelehnt", statuses: ["rejected"] },
  { key: "draft", label: "Entwürfe", statuses: ["draft"] },
  { key: "all", label: "Alle", statuses: null },
];

type Row = Pick<
  Lead,
  | "id" | "status" | "make" | "model" | "variant" | "plate" | "vin" | "first_registration" | "mileage" | "drive_type"
  | "soh_percent" | "recommendation" | "suggested_price" | "asking_price" | "offer_price" | "repair_cost_total"
  | "defect_count" | "cover_photo_path" | "seller_name" | "submitted_at" | "updated_at"
> & { mechanic: { full_name: string | null } | null };

export default function AdminLeadsPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <Suspense
        fallback={
          <div className="space-y-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        }
      >
        <Leads searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function clean(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);
}

async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await requireUser(["admin"]);
  const tabKey = typeof sp.status === "string" && TABS.some((t) => t.key === sp.status) ? sp.status : "active";
  const tab = TABS.find((t) => t.key === tabKey)!;
  const q = typeof sp.q === "string" ? clean(sp.q) : "";

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select(
      "id, status, make, model, variant, plate, vin, first_registration, mileage, drive_type, soh_percent, recommendation, suggested_price, asking_price, offer_price, repair_cost_total, defect_count, cover_photo_path, seller_name, submitted_at, updated_at, mechanic:profiles!leads_mechanic_id_fkey(full_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(300);
  if (tab.statuses) query = query.in("status", tab.statuses);
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      ["plate", "vin", "make", "model", "seller_name", "seller_phone"].map((c) => `${c}.ilike.${like}`).join(","),
    );
  }

  const [{ data, error }, { data: statusRows }] = await Promise.all([
    query,
    supabase.from("leads").select("status, updated_at, purchase_price"),
  ]);
  const counts: Record<string, number> = {};
  for (const r of statusRows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const tabCount = (t: (typeof TABS)[number]) =>
    t.statuses ? t.statuses.reduce((s, st) => s + (counts[st] ?? 0), 0) : (statusRows?.length ?? 0);

  const month = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(new Date());
  const boughtThisMonth = (statusRows ?? []).filter((r) => r.status === "bought" && String(r.updated_at).startsWith(month));
  const boughtSum = boughtThisMonth.reduce((sum, r) => sum + (r.purchase_price ?? 0), 0);

  const rows = (data ?? []) as unknown as Row[];
  const thumbs = await signPaths(supabase, rows.map((r) => r.cover_photo_path));

  return (
    <>
      <AutoRefresh seconds={30} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500">Vom Mechaniker geprüfte Fahrzeuge. Aktualisiert sich automatisch.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
        <a
          href={`/admin/export?status=${tabKey}`}
          className={buttonClass("secondary", "md", "h-11")}
          title="Aktuelle Ansicht als CSV für Excel herunterladen"
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Export</span>
        </a>
        <form className="relative w-full sm:w-80" action="/admin">
          <input type="hidden" name="status" value={tabKey} />
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Kennzeichen, FIN, Modell, Verkäufer …"
            className="h-11 w-full rounded-xl bg-white pr-3 pl-10 text-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-volt-500"
          />
        </form>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Neue Leads" value={String(counts.submitted ?? 0)} hint="warten auf Prüfung" accent />
        <Kpi label="In Bearbeitung" value={String((counts.in_review ?? 0) + (counts.offer_sent ?? 0))} hint={`${counts.offer_sent ?? 0} mit Angebot`} />
        <Kpi label="Gekauft diesen Monat" value={String(boughtThisMonth.length)} hint={boughtSum ? eur(boughtSum) : "–"} />
        <Kpi label="Beim Mechaniker" value={String(counts.draft ?? 0)} hint="Entwürfe in Arbeit" />
      </div>

      <nav className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = t.key === tabKey;
          const href = `/admin?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                active ? "bg-navy-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
              )}
            >
              {t.label}
              <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-white/15" : "bg-slate-100 text-slate-500")}>{tabCount(t)}</span>
            </Link>
          );
        })}
      </nav>

      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Fehler beim Laden: {error.message}</p> : null}

      {rows.length === 0 && !error ? (
        <EmptyState title={q ? "Keine Treffer" : "Keine Leads in dieser Ansicht"}>
          {q ? "Suchbegriff ändern oder Filter wechseln." : "Sobald der Mechaniker eine Prüfung einreicht, erscheint sie hier."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <LeadRow key={row.id} row={row} thumb={row.cover_photo_path ? thumbs.get(row.cover_photo_path) : undefined} />
          ))}
        </ul>
      )}
    </>
  );
}

function LeadRow({ row, thumb }: { row: Row; thumb?: string }) {
  const status = STATUS_META[row.status];
  const rec = row.recommendation ? RECOMMENDATION_META[row.recommendation] : null;
  const facts = [
    row.plate,
    row.first_registration ? `EZ ${monthYear(row.first_registration)}` : null,
    row.mileage !== null ? km(row.mileage) : null,
    row.drive_type ? DRIVE_LABEL[row.drive_type] : null,
  ].filter(Boolean);

  return (
    <li>
      <Link
        href={`/admin/leads/${row.id}`}
        className="flex flex-col gap-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 transition hover:shadow-md hover:ring-slate-300 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="grid aspect-[4/3] w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 sm:w-36">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
              <img src={thumb} alt="" className="size-full object-cover" />
            ) : (
              <Car className="size-8" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-bold">{leadTitle(row)}</span>
              <Badge className={status.className}>{status.label}</Badge>
            </div>
            {row.variant ? <div className="truncate text-sm text-slate-500">{row.variant}</div> : null}
            <div className="mt-1 truncate text-sm text-slate-600">{facts.join(" · ") || "–"}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {row.soh_percent !== null ? (
                <Badge className={sohClass(row.soh_percent)}>
                  <BatteryCharging className="size-3.5" />
                  SoH {num(row.soh_percent)} %
                </Badge>
              ) : null}
              {rec ? <Badge className={rec.className}>{rec.label}</Badge> : null}
              {row.defect_count > 0 ? (
                <Badge className="bg-white text-slate-600 ring-slate-200">
                  <Wrench className="size-3.5" />
                  {row.defect_count} {row.defect_count === 1 ? "Mangel" : "Mängel"} · {eur(row.repair_cost_total)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm sm:w-[360px] sm:shrink-0">
          <Price label="Verkäufer will" value={row.asking_price} />
          <Price label="Mechaniker empf." value={row.suggested_price} highlight />
          <Price label="Unser Angebot" value={row.offer_price} />
          <div className="col-span-3 text-xs text-slate-400">
            {row.mechanic?.full_name ?? "–"} · {row.submitted_at ? `eingereicht ${date(row.submitted_at, true)}` : `bearbeitet ${date(row.updated_at, true)}`}
            {row.seller_name ? ` · ${row.seller_name}` : ""}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4 ring-1", accent ? "bg-navy-900 text-white ring-navy-900" : "bg-white ring-slate-200/80")}>
      <div className={cn("text-xs font-semibold", accent ? "text-white/60" : "text-slate-500")}>{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className={cn("text-xs", accent ? "text-volt-300" : "text-slate-500")}>{hint}</div>
    </div>
  );
}

function Price({ label, value, highlight }: { label: string; value: number | null; highlight?: boolean }) {
  return (
    <div className={cn("rounded-xl px-2.5 py-2", highlight ? "bg-navy-900 text-white" : "bg-slate-50")}>
      <div className={cn("text-[11px] font-semibold", highlight ? "text-white/60" : "text-slate-500")}>{label}</div>
      <div className="font-bold">{eur(value)}</div>
    </div>
  );
}
