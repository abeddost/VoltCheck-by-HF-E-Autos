import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BatteryCharging, History, Mail, Phone } from "lucide-react";
import { PhotoGrid, type GridPhoto } from "@/components/photo-grid";
import { Badge, Card, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SECTIONS, STATUS_OPTIONS, optionLabel, type Field, type InspectionData } from "@/lib/checklist";
import { checkValue, defects, visibleFields, visibleSections } from "@/lib/evaluate";
import { cn, date, eur, km, monthYear, num, parseNumber } from "@/lib/format";
import { signPaths, signPhotos } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import {
  DRIVE_LABEL,
  RECOMMENDATION_META,
  STATUS_META,
  leadTitle,
  sohClass,
  type Lead,
  type LeadPhoto,
  type PhotoView,
} from "@/lib/types";
import { AdminPanel } from "./admin-panel";

export const metadata: Metadata = { title: "Lead" };

export default function LeadPage({ params }: PageProps<"/admin/leads/[id]">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-72" />
            <Skeleton className="h-40" />
          </div>
        }
      >
        <LeadDetail params={params} />
      </Suspense>
    </main>
  );
}

const LABELS: Record<string, string> = {
  // photo fields that were removed from the form, so older inspections keep readable labels
  foto_fin: "Foto FIN",
  foto_schluessel: "Foto Schlüssel",
  ...Object.fromEntries(SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.label]))),
};

function toGrid(photos: PhotoView[]): GridPhoto[] {
  return photos.map((p) => ({ id: p.id, url: p.url, thumbUrl: p.thumbUrl, label: LABELS[p.field_key] ?? p.field_key }));
}

async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(["admin"]);
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*, mechanic:profiles!leads_mechanic_id_fkey(full_name, email)")
    .eq("id", id)
    .maybeSingle<Lead & { mechanic: { full_name: string | null; email: string | null } | null }>();
  if (!lead) notFound();

  const { data: photoRows } = await supabase.from("lead_photos").select("*").eq("lead_id", id).order("created_at");
  const photos = await signPhotos(supabase, (photoRows ?? []) as LeadPhoto[]);
  const signatureUrl = lead.signature_path ? ((await signPaths(supabase, [lead.signature_path])).get(lead.signature_path) ?? null) : null;

  const data = (lead.data ?? {}) as InspectionData;
  const byField = new Map<string, PhotoView[]>();
  for (const p of photos) byField.set(p.field_key, [...(byField.get(p.field_key) ?? []), p]);

  const standardKeys = SECTIONS.find((s) => s.key === "fotos")!.fields.map((f) => f.key);
  const standardPhotos = standardKeys.flatMap((k) => byField.get(k) ?? []);
  const found = defects(data);
  const status = STATUS_META[lead.status];
  const rec = lead.recommendation ? RECOMMENDATION_META[lead.recommendation] : null;

  // Same car inspected before? (matching FIN or plate)
  const matchers = [
    lead.vin ? `vin.eq."${lead.vin.replace(/"/g, "")}"` : null,
    lead.plate ? `plate.eq."${lead.plate.replace(/"/g, "")}"` : null,
  ].filter(Boolean);
  const { data: history } = matchers.length
    ? await supabase
        .from("leads")
        .select("id, status, created_at, submitted_at, mileage, offer_price, purchase_price")
        .neq("id", id)
        .or(matchers.join(","))
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };
  const feedback = data.admin_feedback as { text?: string; at?: string } | undefined;

  const facts: [string, string][] = [
    ["Erstzulassung", monthYear(lead.first_registration)],
    ["Kilometerstand", km(lead.mileage)],
    ["Antrieb", lead.drive_type ? DRIVE_LABEL[lead.drive_type] : "–"],
    ["Leistung", lead.power_kw ? `${lead.power_kw} kW (${Math.round(lead.power_kw * 1.36)} PS)` : "–"],
    ["Farbe", lead.color ?? "–"],
    ["Halter", typeof data.previous_owners === "string" && data.previous_owners ? data.previous_owners : "–"],
    ["HU bis", monthYear(data.hu_due)],
    ["FIN", lead.vin ?? "–"],
  ];
  if (!lead.drive_type || lead.drive_type === "bev" || lead.drive_type === "phev") {
    facts.push(
      ["Batterie", lead.battery_capacity_kwh ? `${num(lead.battery_capacity_kwh)} kWh` : "–"],
      ["Reichweite 100 %", lead.range_km ? `${lead.range_km} km` : "–"],
      ["Batterie-Besitz", lead.battery_ownership === "rented" ? "Mietbatterie" : lead.battery_ownership === "owned" ? "Kaufbatterie" : "–"],
    );
  }

  return (
    <div>
      <Link href="/admin" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-900">
        <ArrowLeft className="size-4" />
        Alle Leads
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{leadTitle(lead)}</h1>
            <Badge className={status.className}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-slate-500">{[lead.variant, lead.plate].filter(Boolean).join(" · ") || "–"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.soh_percent !== null ? (
            <Badge className={cn("px-3 py-1 text-sm", sohClass(lead.soh_percent))}>
              <BatteryCharging className="size-4" />
              SoH {num(lead.soh_percent)} %
            </Badge>
          ) : null}
          {rec ? <Badge className={cn("px-3 py-1 text-sm", rec.className)}>{rec.label}</Badge> : null}
        </div>
      </div>

      {history && history.length > 0 ? (
        <div className="mb-6 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300">
          <p className="flex items-center gap-2 font-bold text-amber-950">
            <History className="size-5 text-amber-600" />
            Dieses Fahrzeug wurde schon {history.length}× geprüft
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/admin/leads/${h.id}`} className="text-amber-950 underline-offset-2 hover:underline">
                  {date(h.submitted_at ?? h.created_at)} · {STATUS_META[h.status as Lead["status"]].label} · {km(h.mileage)}
                  {h.purchase_price ? ` · gekauft für ${eur(h.purchase_price)}` : h.offer_price ? ` · Angebot ${eur(h.offer_price)}` : ""}
                </Link>
                {h.mileage !== null && lead.mileage !== null && h.mileage > lead.mileage ? (
                  <span className="ml-2 font-bold text-rose-700">km-Stand war damals höher!</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {standardPhotos.length > 0 ? (
            <PhotoGrid photos={toGrid(standardPhotos)} featureFirst />
          ) : (
            <Card className="p-6 text-center text-sm text-slate-500">Keine Pflichtfotos vorhanden.</Card>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Verkäufer will" value={eur(lead.asking_price)} />
            <Kpi label="Mechaniker empfiehlt" value={eur(lead.suggested_price)} dark />
            <Kpi label="Reparatur ca." value={eur(lead.repair_cost_total)} sub={`${lead.defect_count} ${lead.defect_count === 1 ? "Mangel" : "Mängel"}`} />
            <Kpi label="Gesamtnote" value={lead.grade ? `${lead.grade} / 5` : "–"} sub={rec?.label} />
          </div>

          <Card className="print-break-avoid p-5">
            <h2 className="mb-3 text-base font-bold">Fahrzeugdaten</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                  <dd className="truncate font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {lead.mechanic_notes ? (
            <Card className="print-break-avoid p-5">
              <h2 className="mb-2 text-base font-bold">Notizen des Mechanikers</h2>
              <p className="text-sm whitespace-pre-line text-slate-700">{lead.mechanic_notes}</p>
            </Card>
          ) : null}

          <Card className="p-5">
            <h2 className="mb-3 text-base font-bold">
              Mängel <span className="font-medium text-slate-400">({found.length})</span>
            </h2>
            {found.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Mängel erfasst.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {found.map((d) => (
                  <li key={d.field.key} className="print-break-avoid py-3">
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", d.value.status === "major" ? "bg-rose-600" : "bg-amber-400")} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{d.field.label}</div>
                        <div className="text-xs text-slate-500">
                          {d.section.title} · {d.value.status === "major" ? "Schwerer Mangel" : "Leichter Mangel"}
                          {measuresText(d.field, d.value.m)}
                        </div>
                        {d.value.note ? <p className="mt-1 text-sm text-slate-700">{d.value.note}</p> : null}
                        {byField.get(d.field.key)?.length ? (
                          <div className="mt-2">
                            <PhotoGrid photos={toGrid(byField.get(d.field.key)!)} size="sm" />
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 font-bold">{d.cost ? eur(d.cost) : "–"}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-3">
            <h2 className="text-base font-bold">Vollständiges Prüfprotokoll</h2>
            {visibleSections(data)
              .filter((s) => s.key !== "fotos" && s.key !== "verkaeufer")
              .map((section) => (
                <details key={section.key} className="group rounded-2xl bg-white ring-1 ring-slate-200/80 open:shadow-sm" open={section.key === "batterie"}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 font-semibold">
                    {section.title}
                    <SectionCounts fields={visibleFields(section, data)} data={data} />
                  </summary>
                  <div className="divide-y divide-slate-100 border-t border-slate-100 px-5">
                    {visibleFields(section, data)
                      .filter((f) => f.type !== "heading" && f.type !== "signature")
                      .map((field) => (
                        <FieldRow key={field.key} field={field} data={data} photos={byField.get(field.key) ?? []} />
                      ))}
                  </div>
                </details>
              ))}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="no-print">
            <AdminPanel
              lead={{ id: lead.id, status: lead.status, offer_price: lead.offer_price, purchase_price: lead.purchase_price, admin_notes: lead.admin_notes }}
            />
          </div>

          <Card className="print-break-avoid p-5">
            <h2 className="mb-3 text-base font-bold">Verkäufer</h2>
            <div className="space-y-2 text-sm">
              <div className="text-base font-semibold">{lead.seller_name ?? "–"}</div>
              <div className="text-slate-500">
                {lead.seller_type === "dealer" ? "Händler" : lead.seller_type === "private" ? "Privat" : ""}
                {typeof data.seller_address === "string" && data.seller_address ? ` · ${data.seller_address}` : ""}
              </div>
              {lead.seller_phone ? (
                <a href={`tel:${lead.seller_phone}`} className="flex items-center gap-2 font-semibold text-navy-700 hover:underline">
                  <Phone className="size-4" />
                  {lead.seller_phone}
                </a>
              ) : null}
              {lead.seller_email ? (
                <a href={`mailto:${lead.seller_email}`} className="flex items-center gap-2 font-semibold text-navy-700 hover:underline">
                  <Mail className="size-4" />
                  {lead.seller_email}
                </a>
              ) : null}
              <div className="pt-2">
                <span className="text-slate-500">Preisvorstellung: </span>
                <span className="font-semibold">{eur(lead.asking_price)}</span>
                {data.price_negotiable === "yes" ? <span className="text-slate-500"> VB</span> : null}
              </div>
            </div>
          </Card>

          <Card className="print-break-avoid p-5">
            <h2 className="mb-3 text-base font-bold">Selbstauskunft</h2>
            <ul className="space-y-1.5 text-sm">
              <Declaration ok={data.decl_accident_free === true} text="Unfallfrei" />
              <Declaration ok={data.decl_mileage === true} text="Kilometerstand korrekt" />
              <Declaration ok={data.decl_no_finance === true} text="Keine Finanzierung / Rechte Dritter" />
              <Declaration ok={lead.gdpr_consent} text="DSGVO-Einwilligung" />
            </ul>
            {typeof data.decl_defects === "string" && data.decl_defects ? (
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <span className="font-semibold">Angegebene Mängel: </span>
                {data.decl_defects}
              </p>
            ) : null}
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
              <img src={signatureUrl} alt="Unterschrift" className="mt-3 h-28 w-full rounded-xl bg-slate-50 object-contain ring-1 ring-slate-200" />
            ) : (
              <p className="mt-3 text-sm text-slate-400">Keine Unterschrift</p>
            )}
          </Card>

          <Card className="p-5 text-sm">
            <h2 className="mb-3 text-base font-bold">Prüfung</h2>
            <dl className="space-y-1.5">
              <Meta label="Mechaniker" value={lead.mechanic?.full_name ?? "–"} />
              <Meta label="Angelegt" value={date(lead.created_at, true)} />
              <Meta label="Eingereicht" value={date(lead.submitted_at, true)} />
              <Meta label="Geändert" value={date(lead.updated_at, true)} />
              <Meta label="Fotos" value={String(photos.length)} />
            </dl>
            {feedback?.text ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
                <span className="font-semibold">Letzte Rückmeldung an den Mechaniker</span>
                {feedback.at ? ` (${date(feedback.at, true)})` : ""}: {feedback.text}
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, dark }: { label: string; value: string; sub?: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-4 ring-1", dark ? "bg-navy-900 text-white ring-navy-900" : "bg-white ring-slate-200/80")}>
      <div className={cn("text-xs font-semibold", dark ? "text-white/60" : "text-slate-500")}>{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub ? <div className={cn("text-xs", dark ? "text-white/60" : "text-slate-500")}>{sub}</div> : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Declaration({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("grid size-5 place-items-center rounded-full text-xs font-bold", ok ? "bg-volt-500 text-white" : "bg-slate-200 text-slate-500")}>
        {ok ? "✓" : "–"}
      </span>
      <span className={ok ? "text-navy-900" : "text-slate-500"}>{text}</span>
    </li>
  );
}

function measuresText(field: Field, m?: Record<string, string>) {
  if (field.type !== "check" || !field.measures || !m) return "";
  const parts = field.measures.filter((x) => m[x.key]).map((x) => `${m[x.key]} ${x.label}`);
  return parts.length ? ` · ${parts.join(", ")}` : "";
}

function SectionCounts({ fields, data }: { fields: Field[]; data: InspectionData }) {
  let minor = 0;
  let major = 0;
  for (const f of fields) {
    if (f.type !== "check") continue;
    const s = checkValue(data, f.key).status;
    if (s === "minor") minor++;
    if (s === "major") major++;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {major ? <Badge className="bg-rose-50 text-rose-700 ring-rose-200">{major} Defekt</Badge> : null}
      {minor ? <Badge className="bg-amber-50 text-amber-800 ring-amber-200">{minor} Mangel</Badge> : null}
      {!major && !minor ? <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">OK</Badge> : null}
    </span>
  );
}

const STATUS_CHIP: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  minor: "bg-amber-50 text-amber-800 ring-amber-200",
  major: "bg-rose-50 text-rose-700 ring-rose-200",
  na: "bg-slate-100 text-slate-600 ring-slate-200",
};

function FieldRow({ field, data, photos }: { field: Field; data: InspectionData; photos: PhotoView[] }) {
  let value: React.ReactNode;
  const raw = data[field.key];

  if (field.type === "check") {
    const v = checkValue(data, field.key);
    const label = STATUS_OPTIONS.find((o) => o.value === v.status)?.label;
    value = (
      <div className="flex flex-col items-end gap-1 text-right">
        {label ? <Badge className={STATUS_CHIP[v.status!]}>{label}</Badge> : <span className="text-slate-400">nicht bewertet</span>}
        {measuresText(field, v.m) ? <span className="text-xs text-slate-500">{measuresText(field, v.m).slice(3)}</span> : null}
      </div>
    );
    const note = v.note;
    return (
      <div className="py-2.5">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm text-slate-700">{field.label}</span>
          {value}
        </div>
        {note ? <p className="mt-1 text-sm text-slate-500">{note}</p> : null}
        {v.cost ? <p className="text-xs font-semibold text-slate-600">ca. {eur(parseNumber(v.cost, { integer: true }))}</p> : null}
        {photos.length ? (
          <div className="mt-2">
            <PhotoGrid photos={toGrid(photos)} size="sm" />
          </div>
        ) : null}
      </div>
    );
  }

  if (field.type === "photo") {
    return (
      <div className="py-2.5">
        <div className="mb-2 text-sm text-slate-700">{field.label}</div>
        {photos.length ? <PhotoGrid photos={toGrid(photos)} size="sm" /> : <span className="text-sm text-slate-400">Kein Foto</span>}
      </div>
    );
  }

  if (field.type === "boolean") value = raw === true ? "Ja" : "–";
  else if (field.type === "month") value = monthYear(raw);
  else if (field.type === "select" || field.type === "multi") value = raw ? optionLabel(field, raw) : "–";
  else if (field.type === "number") value = raw ? `${raw}${field.unit ? ` ${field.unit}` : ""}` : "–";
  else value = typeof raw === "string" && raw.trim() ? raw : "–";

  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-slate-700">{field.label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium whitespace-pre-line">{value}</span>
    </div>
  );
}
