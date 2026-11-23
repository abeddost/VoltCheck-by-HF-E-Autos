"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  ArrowUpToLine,
  BatteryCharging,
  Camera,
  Car,
  CarFront,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  CloudOff,
  Cpu,
  Disc,
  FileText,
  Gauge,
  Lock,
  MessageSquareWarning,
  PlugZap,
  Send,
  Trash2,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { SECTIONS, type InspectionData, type Section } from "@/lib/checklist";
import {
  checkValue,
  defects,
  photoCounts,
  sectionProgress,
  toLeadColumns,
  validate,
  visibleFields,
  visibleSections,
} from "@/lib/evaluate";
import { cn, date, eur } from "@/lib/format";
import { uid } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, STATUS_META, leadTitle, type Lead, type PhotoView } from "@/lib/types";
import { deleteDraft } from "../actions";
import { FieldView, FormProvider } from "./fields";
import { PhotoProvider, usePhotoManager } from "./photos";

const ICONS: Record<string, LucideIcon> = {
  car: Car,
  file: FileText,
  battery: BatteryCharging,
  plug: PlugZap,
  carfront: CarFront,
  wheel: CircleDot,
  seat: Armchair,
  wrench: Wrench,
  lift: ArrowUpToLine,
  disc: Disc,
  gauge: Gauge,
  cpu: Cpu,
  camera: Camera,
  user: UserRound,
  flag: ClipboardCheck,
};

type SaveState = "saved" | "pending" | "saving" | "offline" | "error" | "locked";

const LABELS: Record<string, string> = Object.fromEntries(SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.label])));

export default function InspectionForm({
  lead,
  photos,
  signatureUrl: initialSignatureUrl,
  readOnly,
}: {
  lead: Lead;
  photos: PhotoView[];
  signatureUrl: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const backupKey = `voltcheck:draft:${lead.id}`;
  const sectionStoreKey = `voltcheck:section:${lead.id}`;

  // Restore unsynced local changes (e.g. after losing signal in the workshop).
  const [initial] = useState(() => {
    if (!readOnly) {
      try {
        const backup = JSON.parse(localStorage.getItem(backupKey) ?? "null") as { data: InspectionData; dirty: boolean; at: number } | null;
        if (backup?.dirty && backup.at > Date.parse(lead.updated_at)) return { data: backup.data, dirty: true };
      } catch {
        // ignore broken backup
      }
    }
    return { data: (lead.data ?? {}) as InspectionData, dirty: false };
  });

  const [data, setData] = useState<InspectionData>(initial.data);
  const [saveState, setSaveState] = useState<SaveState>(initial.dirty ? "pending" : "saved");
  const [active, setActive] = useState<string>(() => {
    try {
      return localStorage.getItem(sectionStoreKey) ?? SECTIONS[0].key;
    } catch {
      return SECTIONS[0].key;
    }
  });
  const [signatureUrl, setSignatureUrl] = useState(initialSignatureUrl);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const dataRef = useRef(initial.data);
  const dirtyRef = useRef(initial.dirty);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const photoManager = usePhotoManager({
    supabase,
    leadId: lead.id,
    initial: photos,
    initialCover: lead.cover_photo_path,
    readOnly,
    labels: LABELS,
  });
  const donePhotos = photoManager.items.filter((p) => p.state === "done");
  const counts = photoCounts(donePhotos);
  const uploading = photoManager.items.some((p) => p.state === "uploading");
  const failedUploads = photoManager.items.filter((p) => p.state === "error").length;

  const sections = visibleSections(data);
  const current = sections.find((s) => s.key === active) ?? sections[0];
  const index = sections.indexOf(current);

  // ---------------------------------------------------------------- saving
  function writeBackup(next: InspectionData, dirty: boolean) {
    try {
      localStorage.setItem(backupKey, JSON.stringify({ data: next, dirty, at: Date.now() }));
    } catch {
      // storage full or private mode: the server save still runs
    }
  }

  function schedule(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), ms);
  }

  async function save(): Promise<boolean> {
    if (readOnly) return true;
    while (inflight.current) await inflight.current;
    if (!dirtyRef.current) return true;

    const snapshot = dataRef.current;
    const run = (async () => {
      setSaveState("saving");
      const columns = toLeadColumns(snapshot);
      let result = await supabase.from("leads").update({ ...columns, data: snapshot }).eq("id", lead.id).select("id");
      if (result.error && /^(22|23)/.test(result.error.code ?? "")) {
        // a value does not fit its column: keep the answers safe anyway
        result = await supabase.from("leads").update({ data: snapshot }).eq("id", lead.id).select("id");
      }
      if (result.error) {
        setSaveState(navigator.onLine ? "error" : "offline");
        schedule(8000);
        return;
      }
      if (!result.data?.length) {
        setSaveState("locked");
        return;
      }
      if (dataRef.current === snapshot) {
        dirtyRef.current = false;
        writeBackup(snapshot, false);
        setSaveState("saved");
      }
    })();
    inflight.current = run;
    try {
      await run;
    } finally {
      inflight.current = null;
    }
    return !dirtyRef.current;
  }

  function setFields(patch: InspectionData) {
    if (readOnly) return;
    const next = { ...dataRef.current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    dataRef.current = next;
    dirtyRef.current = true;
    setData(next);
    writeBackup(next, true);
    setSaveState("pending");
    schedule(900);
  }

  const onOnline = useEffectEvent(() => {
    if (dirtyRef.current) void save();
  });
  const onMount = useEffectEvent(() => {
    if (dirtyRef.current) schedule(500);
  });

  useEffect(() => {
    onMount();
    const online = () => onOnline();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    // scroll only the chip bar sideways (scrollIntoView would also move the page)
    const chip = chipRefs.current[current.key];
    const bar = chip?.parentElement;
    if (chip && bar) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [current.key]);

  // ---------------------------------------------------------------- navigation
  function go(key: string) {
    setActive(key);
    try {
      localStorage.setItem(sectionStoreKey, key);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  }

  // ---------------------------------------------------------------- signature
  async function saveSignature(png: Blob) {
    const path = `${lead.id}/signature-${uid()}.png`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, png, { contentType: "image/png" });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
    const old = dataRef.current.signature_path;
    setFields({ signature_path: path });
    setSignatureUrl(URL.createObjectURL(png));
    if (typeof old === "string") void supabase.storage.from(PHOTO_BUCKET).remove([old]);
  }

  function clearSignature() {
    setFields({ signature_path: undefined });
    setSignatureUrl(null);
  }

  // ---------------------------------------------------------------- submit
  const { errors, warnings } = validate(data, donePhotos);

  async function submit() {
    if (uploading) {
      setSubmitError("Es werden noch Fotos hochgeladen. Bitte kurz warten.");
      return;
    }
    if (failedUploads > 0) {
      setSubmitError(`${failedUploads} Foto(s) nicht hochgeladen. Auf „Erneut“ tippen oder das Foto löschen.`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    if (timer.current) clearTimeout(timer.current);
    dirtyRef.current = true;
    const saved = await save();
    if (!saved) {
      setSubmitting(false);
      setSubmitError("Speichern fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.");
      return;
    }
    const { data: rows, error } = await supabase.from("leads").update({ status: "submitted" }).eq("id", lead.id).select("id");
    if (error || !rows?.length) {
      setSubmitting(false);
      setSubmitError(error ? error.message : "Einreichen nicht möglich (keine Berechtigung).");
      return;
    }
    try {
      localStorage.removeItem(backupKey);
      localStorage.removeItem(sectionStoreKey);
    } catch {
      // ignore
    }
    router.replace("/inspections");
    router.refresh();
  }

  function markRestOk(section: Section) {
    const patch: InspectionData = {};
    for (const field of visibleFields(section, data)) {
      if (field.type === "check" && !checkValue(data, field.key).status) {
        patch[field.key] = { ...checkValue(data, field.key), status: "ok" };
      }
    }
    setFields(patch);
  }

  const formApi = {
    data,
    readOnly,
    setField: (key: string, value: unknown) => setFields({ [key]: value }),
    signatureUrl,
    saveSignature,
    clearSignature,
  };

  const progress = sectionProgress(current, data, counts);
  const openChecks = visibleFields(current, data).filter((f) => f.type === "check" && !checkValue(data, f.key).status).length;
  const Icon = ICONS[current.icon] ?? ClipboardCheck;

  return (
    <FormProvider value={formApi}>
      <PhotoProvider value={photoManager.api}>
        {/* Top bar */}
        <div className="sticky top-16 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-3">
            <Link href="/inspections" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zurück zur Liste">
              <ArrowLeft className="size-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{leadTitle({ make: str(data.make), model: str(data.model), variant: null })}</div>
              <div className="truncate text-xs text-slate-500">{[str(data.plate), str(data.vin)].filter(Boolean).join(" · ") || "Noch keine Fahrzeugdaten"}</div>
            </div>
            <SaveIndicator state={readOnly ? "locked" : saveState} />
          </div>
          <nav className="no-scrollbar relative mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 py-2.5">
            {sections.map((section) => {
              const p = sectionProgress(section, data, counts);
              const complete = p.total > 0 && p.done === p.total;
              const hasError = errors.some((e) => e.sectionKey === section.key);
              const isActive = section.key === current.key;
              return (
                <button
                  key={section.key}
                  ref={(el) => {
                    chipRefs.current[section.key] = el;
                  }}
                  type="button"
                  onClick={() => go(section.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    isActive ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {complete ? (
                    <span className={cn("grid size-4 place-items-center rounded-full", isActive ? "bg-volt-400 text-navy-900" : "bg-volt-500 text-white")}>
                      <CheckCheck className="size-3" />
                    </span>
                  ) : hasError && !readOnly ? (
                    <span className="size-2 rounded-full bg-amber-500" />
                  ) : null}
                  {section.title}
                  <span className={isActive ? "text-white/60" : "text-slate-400"}>
                    {p.done}/{p.total}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-32">
          {readOnly ? (
            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <div>
                <span className="font-semibold">{STATUS_META[lead.status].label}</span>
                {lead.submitted_at ? ` · eingereicht am ${date(lead.submitted_at, true)}` : null}. Nur Ansicht – Änderungen sind nach dem Einreichen gesperrt.
              </div>
            </div>
          ) : null}

          {!readOnly && feedbackOf(data) ? (
            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-300">
              <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-bold">Rückmeldung vom Admin · {date(feedbackOf(data)!.at, true)}</div>
                <p className="mt-0.5 whitespace-pre-line">{feedbackOf(data)!.text}</p>
              </div>
            </div>
          ) : null}

          <div className="mb-5 flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-navy-900 text-volt-400">
              <Icon className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight">{current.title}</h1>
              <p className="text-sm text-slate-500">
                {progress.done} von {progress.total} erledigt
              </p>
            </div>
            {!readOnly && openChecks > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => markRestOk(current)} title="Alle noch offenen Punkte dieses Abschnitts auf OK setzen">
                <CheckCheck className="size-4 text-volt-600" />
                Rest OK
              </Button>
            ) : null}
          </div>

          {current.intro ? <p className="mb-5 rounded-2xl bg-white p-3.5 text-sm text-slate-600 ring-1 ring-slate-200/80">{current.intro}</p> : null}

          {current.key === "fotos" ? <MissingPhotos errors={errors} onGo={go} current={current.key} /> : null}
          {current.key === "abschluss" ? <Summary data={data} /> : null}

          <div className="space-y-4">
            {visibleFields(current, data).map((field) => (
              <FieldView key={field.key} field={field} />
            ))}
          </div>

          {current.key === "abschluss" && !readOnly ? (
            <SubmitPanel
              errors={errors}
              warnings={warnings}
              onGo={go}
              onSubmit={submit}
              submitting={submitting}
              submitError={submitError}
            />
          ) : null}

          {!readOnly && (current.key === "fahrzeug" || current.key === "abschluss") ? (
            <div className="mt-10 border-t border-slate-200 pt-6 text-center">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  if (!window.confirm("Diesen Entwurf mit allen Fotos endgültig löschen?")) return;
                  dirtyRef.current = false;
                  try {
                    localStorage.removeItem(backupKey);
                  } catch {
                    // ignore
                  }
                  startDelete(() => deleteDraft(lead.id));
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
              >
                {deleting ? <Spinner /> : <Trash2 className="size-4" />}
                Entwurf löschen
              </button>
            </div>
          ) : null}
        </main>

        {/* Bottom navigation */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Button variant="secondary" size="lg" disabled={index <= 0} onClick={() => go(sections[index - 1].key)} className="flex-1">
              <ChevronLeft className="size-5" />
              Zurück
            </Button>
            {index < sections.length - 1 ? (
              <Button size="lg" onClick={() => go(sections[index + 1].key)} className="min-w-0 flex-[2]">
                <span className="sm:hidden">Weiter</span>
                <span className="hidden truncate sm:inline">{sections[index + 1].title}</span>
                <ChevronRight className="size-5 shrink-0" />
              </Button>
            ) : !readOnly ? (
              <Button variant="volt" size="lg" onClick={submit} disabled={submitting || errors.length > 0} className="flex-[2]">
                {submitting ? <Spinner /> : <Send className="size-5" />}
                Einreichen
              </Button>
            ) : (
              <div className="flex-[2]" />
            )}
          </div>
        </div>
        {photoManager.lightbox}
      </PhotoProvider>
    </FormProvider>
  );
}

function feedbackOf(data: InspectionData) {
  const f = data.admin_feedback as { text?: unknown; at?: unknown } | undefined;
  return f && typeof f.text === "string" && f.text ? { text: f.text, at: typeof f.at === "string" ? f.at : null } : null;
}

function str(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; className: string; icon: React.ReactNode }> = {
    saved: { text: "Gespeichert", className: "text-volt-700", icon: <CheckCheck className="size-4" /> },
    pending: { text: "Speichert …", className: "text-slate-500", icon: <Spinner className="size-3.5" /> },
    saving: { text: "Speichert …", className: "text-slate-500", icon: <Spinner className="size-3.5" /> },
    offline: { text: "Offline – lokal gesichert", className: "text-amber-700", icon: <CloudOff className="size-4" /> },
    error: { text: "Nicht gespeichert – neuer Versuch …", className: "text-rose-600", icon: <AlertTriangle className="size-4" /> },
    locked: { text: "Gesperrt", className: "text-slate-500", icon: <Lock className="size-4" /> },
  };
  const s = map[state];
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5 text-xs font-semibold", s.className)} aria-live="polite">
      {s.icon}
      <span className="hidden sm:inline">{s.text}</span>
    </div>
  );
}

function MissingPhotos({ errors, onGo }: { errors: { sectionKey: string; message: string }[]; onGo: (key: string) => void; current: string }) {
  const missing = errors.filter((e) => e.message.startsWith("Foto fehlt"));
  if (missing.length === 0) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-2xl bg-volt-50 p-3.5 text-sm font-semibold text-volt-800 ring-1 ring-volt-200">
        <CheckCheck className="size-5" />
        Alle Pflichtfotos sind vorhanden.
      </div>
    );
  }
  return (
    <div className="mb-5 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
      <p className="mb-2 text-sm font-bold text-amber-900">Es fehlen noch {missing.length} Pflichtfotos:</p>
      <ul className="space-y-1">
        {missing.map((m) => (
          <li key={m.message}>
            <button type="button" onClick={() => onGo(m.sectionKey)} className="text-left text-sm text-amber-900 underline-offset-2 hover:underline">
              {m.message.replace("Foto fehlt: ", "")}
              <span className="text-amber-700/70"> · {SECTIONS.find((s) => s.key === m.sectionKey)?.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary({ data }: { data: InspectionData }) {
  const found = defects(data);
  const total = found.reduce((sum, d) => sum + d.cost, 0);
  const major = found.filter((d) => d.value.status === "major").length;
  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Mängel" value={String(found.length - major)} tone="amber" />
        <Stat label="Defekte" value={String(major)} tone="rose" />
        <Stat label="Reparatur ca." value={eur(total)} tone="navy" />
      </div>
      {found.length > 0 ? (
        <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/80">
          <p className="mb-2 text-sm font-bold">Gefundene Mängel</p>
          <ul className="divide-y divide-slate-100">
            {found.map((d) => (
              <li key={d.field.key} className="flex items-start gap-3 py-2 text-sm">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", d.value.status === "major" ? "bg-rose-600" : "bg-amber-400")} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.field.label}</div>
                  {d.value.note ? <div className="text-slate-500">{d.value.note}</div> : null}
                </div>
                <div className="shrink-0 font-semibold">{d.cost ? eur(d.cost) : "–"}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "amber" | "rose" | "navy" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    rose: "bg-rose-50 text-rose-800 ring-rose-200",
    navy: "bg-navy-900 text-white ring-navy-900",
  };
  return (
    <div className={cn("rounded-2xl p-3 ring-1", tones[tone])}>
      <div className="text-xs font-semibold opacity-75">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}

function SubmitPanel({
  errors,
  warnings,
  onGo,
  onSubmit,
  submitting,
  submitError,
}: {
  errors: { sectionKey: string; message: string }[];
  warnings: { sectionKey: string; message: string }[];
  onGo: (key: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}) {
  return (
    <div className="mt-8 rounded-3xl bg-navy-900 p-5 text-white">
      <h2 className="text-lg font-bold">Prüfung einreichen</h2>
      <p className="mt-1 text-sm text-white/70">Nach dem Einreichen erscheint das Fahrzeug als Lead beim Admin. Änderungen sind dann gesperrt.</p>

      {errors.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-3.5 text-navy-900">
          <p className="mb-2 text-sm font-bold text-rose-700">Noch erforderlich ({errors.length})</p>
          <IssueList issues={errors} onGo={onGo} dot="bg-rose-600" />
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="mt-3 rounded-2xl bg-white/10 p-3.5">
          <p className="mb-2 text-sm font-bold text-amber-300">Hinweise ({warnings.length})</p>
          <IssueList issues={warnings} onGo={onGo} dot="bg-amber-400" light />
        </div>
      ) : null}
      {submitError ? <p className="mt-3 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold">{submitError}</p> : null}

      <Button variant="volt" size="lg" className="mt-4 w-full" onClick={onSubmit} disabled={submitting || errors.length > 0}>
        {submitting ? <Spinner /> : <Send className="size-5" />}
        {errors.length > 0 ? "Erst Pflichtangaben ergänzen" : "Jetzt einreichen"}
      </Button>
    </div>
  );
}

function IssueList({ issues, onGo, dot, light }: { issues: { sectionKey: string; message: string }[]; onGo: (key: string) => void; dot: string; light?: boolean }) {
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li key={issue.sectionKey + issue.message}>
          <button
            type="button"
            onClick={() => onGo(issue.sectionKey)}
            className={cn("flex items-start gap-2 text-left text-sm hover:underline", light ? "text-white/85" : "text-navy-800")}
          >
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)} />
            {issue.message}
          </button>
        </li>
      ))}
    </ul>
  );
}
