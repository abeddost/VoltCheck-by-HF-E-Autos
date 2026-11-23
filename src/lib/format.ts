/** Parses German number input: "12.500" -> 12500, "6,5" -> 6.5 */
export function parseNumber(raw: unknown, { integer = false } = {}): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? (integer ? Math.round(raw) : raw) : null;
  let s = String(raw).trim().replace(/\s|€|%/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (integer && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.round(n) : n;
}

const eurFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const intFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const decFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export const eur = (n: number | null | undefined) => (n === null || n === undefined ? "–" : eurFormat.format(n));
export const km = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${intFormat.format(n)} km`);
export const num = (n: number | null | undefined, digits: 0 | 1 = 1) =>
  n === null || n === undefined ? "–" : (digits === 0 ? intFormat : decFormat).format(n);

export function date(value: string | null | undefined, withTime = false) {
  if (!value) return "–";
  const d = new Date(value);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Berlin",
  });
}

/** "2021-03" or "2021-03-01" -> "03/2021" */
export function monthYear(value: unknown) {
  if (!value) return "–";
  const m = /^(\d{4})-(\d{2})/.exec(String(value));
  return m ? `${m[2]}/${m[1]}` : String(value);
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
