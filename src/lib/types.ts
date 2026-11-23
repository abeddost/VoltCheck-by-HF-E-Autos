import type { InspectionData } from "./checklist";

export type Role = "admin" | "mechanic";

export type LeadStatus = "draft" | "submitted" | "in_review" | "offer_sent" | "bought" | "rejected";

export interface Lead {
  id: string;
  status: LeadStatus;
  mechanic_id: string | null;
  vin: string | null;
  plate: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  drive_type: "bev" | "phev" | "hev" | "ice" | null;
  first_registration: string | null;
  mileage: number | null;
  power_kw: number | null;
  color: string | null;
  battery_capacity_kwh: number | null;
  soh_percent: number | null;
  range_km: number | null;
  battery_ownership: "owned" | "rented" | "unknown" | null;
  seller_name: string | null;
  seller_phone: string | null;
  seller_email: string | null;
  seller_type: "private" | "dealer" | null;
  asking_price: number | null;
  grade: number | null;
  recommendation: "buy" | "buy_with_discount" | "dont_buy" | null;
  suggested_price: number | null;
  repair_cost_total: number;
  defect_count: number;
  mechanic_notes: string | null;
  gdpr_consent: boolean;
  signature_path: string | null;
  cover_photo_path: string | null;
  data: InspectionData;
  admin_notes: string | null;
  offer_price: number | null;
  purchase_price: number | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadPhoto {
  id: string;
  lead_id: string;
  field_key: string;
  path: string;
  thumb_path: string | null;
  created_at: string;
}

/** Photo as handed to client components, with temporary signed URLs. */
export interface PhotoView extends LeadPhoto {
  url: string | null;
  thumbUrl: string | null;
}

export const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  draft: { label: "Entwurf", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  submitted: { label: "Neu", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  in_review: { label: "In Prüfung", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  offer_sent: { label: "Angebot gemacht", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  bought: { label: "Gekauft", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected: { label: "Abgelehnt", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const STATUS_ORDER: LeadStatus[] = ["submitted", "in_review", "offer_sent", "bought", "rejected", "draft"];

export const RECOMMENDATION_META: Record<NonNullable<Lead["recommendation"]>, { label: string; className: string }> = {
  buy: { label: "Kaufen", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  buy_with_discount: { label: "Kaufen mit Abzug", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  dont_buy: { label: "Nicht kaufen", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export const DRIVE_LABEL: Record<NonNullable<Lead["drive_type"]>, string> = {
  bev: "Elektro",
  phev: "Plug-in-Hybrid",
  hev: "Hybrid",
  ice: "Verbrenner",
};

export function leadTitle(lead: Pick<Lead, "make" | "model" | "variant">) {
  const name = [lead.make, lead.model].filter(Boolean).join(" ");
  return name || "Neues Fahrzeug";
}

export const PHOTO_BUCKET = "lead-photos";

export function sohClass(soh: number) {
  if (soh >= 90) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (soh >= 80) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}
