import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DRIVE_LABEL, RECOMMENDATION_META, STATUS_META, type Lead } from "@/lib/types";

type Row = Lead & { mechanic: { full_name: string | null } | null };

const COLUMNS: [string, (r: Row) => unknown][] = [
  ["Status", (r) => STATUS_META[r.status].label],
  ["Eingereicht", (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "")],
  ["Marke", (r) => r.make],
  ["Modell", (r) => r.model],
  ["Variante", (r) => r.variant],
  ["Kennzeichen", (r) => r.plate],
  ["FIN", (r) => r.vin],
  ["Erstzulassung", (r) => (r.first_registration ? r.first_registration.slice(0, 7) : "")],
  ["Kilometerstand", (r) => r.mileage],
  ["Antrieb", (r) => (r.drive_type ? DRIVE_LABEL[r.drive_type] : "")],
  ["SoH %", (r) => r.soh_percent],
  ["Reichweite km", (r) => r.range_km],
  ["Batterie", (r) => (r.battery_ownership === "rented" ? "Miete" : r.battery_ownership === "owned" ? "Kauf" : "")],
  ["Empfehlung", (r) => (r.recommendation ? RECOMMENDATION_META[r.recommendation].label : "")],
  ["Note", (r) => r.grade],
  ["Mängel", (r) => r.defect_count],
  ["Reparaturkosten €", (r) => r.repair_cost_total],
  ["Preisvorstellung €", (r) => r.asking_price],
  ["Empfohlener Preis €", (r) => r.suggested_price],
  ["Angebot €", (r) => r.offer_price],
  ["Kaufpreis €", (r) => r.purchase_price],
  ["Verkäufer", (r) => r.seller_name],
  ["Telefon", (r) => r.seller_phone],
  ["E-Mail", (r) => r.seller_email],
  ["Mechaniker", (r) => r.mechanic?.full_name],
  ["Link", (r) => `/admin/leads/${r.id}`],
];

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  const s = typeof value === "number" ? String(value).replace(".", ",") : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV for Excel (semicolon separated, UTF-8 with BOM). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new NextResponse("Kein Zugriff", { status: 403 });

  const status = request.nextUrl.searchParams.get("status");
  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("*, mechanic:profiles!leads_mechanic_id_fkey(full_name)")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(5000);
  if (status && status !== "all") {
    query = status === "active" ? query.in("status", ["submitted", "in_review", "offer_sent"]) : query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });

  const origin = request.nextUrl.origin;
  const lines = [COLUMNS.map(([h]) => cell(h)).join(";")];
  for (const row of (data ?? []) as Row[]) {
    lines.push(COLUMNS.map(([h, get]) => cell(h === "Link" ? `${origin}${get(row)}` : get(row))).join(";"));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="voltcheck-leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
