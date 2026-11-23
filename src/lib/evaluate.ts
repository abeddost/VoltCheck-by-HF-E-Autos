import {
  COVER_PHOTO_KEY,
  SECTIONS,
  type CheckValue,
  type Field,
  type InspectionData,
  type LeadColumn,
  type Section,
} from "./checklist";
import { parseNumber } from "./format";

export interface PhotoRef {
  id: string;
  field_key: string;
}

export function visibleSections(data: InspectionData): Section[] {
  return SECTIONS.filter((s) => !s.showIf || s.showIf(data));
}

export function visibleFields(section: Section, data: InspectionData): Field[] {
  return section.fields.filter((f) => !f.showIf || f.showIf(data));
}

export function checkValue(data: InspectionData, key: string): CheckValue {
  const v = data[key];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as CheckValue) : {};
}

function isEmpty(value: unknown) {
  if (value === null || value === undefined || value === false) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function photoCounts(photos: PhotoRef[]) {
  const counts: Record<string, number> = {};
  for (const p of photos) counts[p.field_key] = (counts[p.field_key] ?? 0) + 1;
  return counts;
}

/** Whether a field counts as answered (for progress). Headings are ignored. */
export function isAnswered(field: Field, data: InspectionData, counts: Record<string, number>) {
  switch (field.type) {
    case "heading":
      return true;
    case "check":
      return !!checkValue(data, field.key).status;
    case "photo":
      return (counts[field.key] ?? 0) > 0;
    default:
      return !isEmpty(data[field.key]);
  }
}

export function sectionProgress(section: Section, data: InspectionData, counts: Record<string, number>) {
  const fields = visibleFields(section, data).filter((f) => f.type !== "heading");
  const done = fields.filter((f) => isAnswered(f, data, counts)).length;
  return { done, total: fields.length };
}

export interface Defect {
  section: Section;
  field: Field;
  value: CheckValue;
  cost: number;
}

export function defects(data: InspectionData): Defect[] {
  const out: Defect[] = [];
  for (const section of visibleSections(data)) {
    for (const field of visibleFields(section, data)) {
      if (field.type !== "check") continue;
      const value = checkValue(data, field.key);
      if (value.status === "minor" || value.status === "major") {
        out.push({ section, field, value, cost: parseNumber(value.cost, { integer: true }) ?? 0 });
      }
    }
  }
  return out;
}

export function repairTotal(data: InspectionData) {
  return defects(data).reduce((sum, d) => sum + d.cost, 0);
}

export interface Issue {
  sectionKey: string;
  message: string;
}

export function validate(data: InspectionData, photos: PhotoRef[]) {
  const counts = photoCounts(photos);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  if (isEmpty(data.vin) && isEmpty(data.plate)) errors.push({ sectionKey: "fahrzeug", message: "FIN oder Kennzeichen fehlt" });

  for (const section of visibleSections(data)) {
    let unchecked = 0;
    for (const field of visibleFields(section, data)) {
      if (field.type === "check") {
        const v = checkValue(data, field.key);
        if (!v.status) unchecked++;
        if ((v.status === "minor" || v.status === "major") && !(counts[field.key] > 0)) {
          warnings.push({ sectionKey: section.key, message: `Kein Foto vom Mangel: ${field.label}` });
        }
        continue;
      }
      if (!field.required) continue;
      if (field.type === "photo") {
        if (!(counts[field.key] > 0)) errors.push({ sectionKey: section.key, message: `Foto fehlt: ${field.label}` });
      } else if (isEmpty(data[field.key])) {
        errors.push({ sectionKey: section.key, message: field.requiredMessage ?? `${field.label} fehlt` });
      }
    }
    if (unchecked > 0) {
      warnings.push({ sectionKey: section.key, message: `${section.title}: ${unchecked} Punkt${unchecked === 1 ? "" : "e"} nicht bewertet` });
    }
  }

  const vin = typeof data.vin === "string" ? data.vin.replace(/\s/g, "") : "";
  if (vin && (vin.length !== 17 || /[IOQ]/.test(vin))) {
    warnings.push({ sectionKey: "fahrzeug", message: `FIN prüfen: ${vin.length} statt 17 Zeichen${/[IOQ]/.test(vin) ? ", enthält I/O/Q" : ""}` });
  }
  if (data.drive_type === "bev" && isEmpty(data.soh_percent)) {
    warnings.push({ sectionKey: "batterie", message: "Batterie-Gesundheit (SoH) nicht eingetragen" });
  }
  if (isEmpty(data.signature_path)) {
    warnings.push({ sectionKey: "abschluss", message: "Keine Unterschrift des Verkäufers" });
  }

  return { errors, warnings };
}

const INTEGER_COLUMNS: LeadColumn[] = ["mileage", "power_kw", "range_km", "asking_price", "suggested_price", "grade"];

/** Values for the real `leads` columns, derived from the form data. */
export function toLeadColumns(data: InspectionData) {
  const row: Record<string, unknown> = {};
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (!field.column) continue;
      const raw = data[field.key];
      let value: unknown;
      if (field.type === "number" || INTEGER_COLUMNS.includes(field.column)) {
        value = parseNumber(raw, { integer: INTEGER_COLUMNS.includes(field.column) });
      } else if (field.type === "month") {
        value = typeof raw === "string" && /^\d{4}-\d{2}/.test(raw) ? `${raw.slice(0, 7)}-01` : null;
      } else if (field.type === "boolean") {
        value = raw === true;
      } else {
        value = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
      }
      row[field.column] = value;
    }
  }
  const found = defects(data);
  row.repair_cost_total = found.reduce((sum, d) => sum + d.cost, 0);
  row.defect_count = found.length;
  return row;
}

export { COVER_PHOTO_KEY };
