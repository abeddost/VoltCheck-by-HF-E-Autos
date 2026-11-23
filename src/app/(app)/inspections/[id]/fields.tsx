"use client";

import { createContext, use, useId, useState } from "react";
import { Check, MessageSquarePlus } from "lucide-react";
import { Input, Textarea, inputClass } from "@/components/ui";
import {
  STATUS_OPTIONS,
  type CheckStatus,
  type CheckValue,
  type Field,
  type InspectionData,
} from "@/lib/checklist";
import { checkValue } from "@/lib/evaluate";
import { cn } from "@/lib/format";
import { PhotoStrip, usePhotos } from "./photos";
import { SignaturePad } from "./signature-pad";

export interface FormApi {
  data: InspectionData;
  readOnly: boolean;
  setField: (key: string, value: unknown) => void;
  signatureUrl: string | null;
  saveSignature: (png: Blob) => Promise<void>;
  clearSignature: () => void;
}

const FormContext = createContext<FormApi | null>(null);

export function FormProvider({ value, children }: { value: FormApi; children: React.ReactNode }) {
  return <FormContext value={value}>{children}</FormContext>;
}

function useForm() {
  const ctx = use(FormContext);
  if (!ctx) throw new Error("useForm outside FormProvider");
  return ctx;
}

const monthSupported = (() => {
  if (typeof document === "undefined") return true;
  const input = document.createElement("input");
  input.setAttribute("type", "month");
  return input.type === "month";
})();

function FieldLabel({ field, htmlFor }: { field: Field; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1 text-sm font-semibold text-navy-800">
      {field.label}
      {field.required ? <span className="text-rose-500">*</span> : null}
    </label>
  );
}

function Hint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-slate-500">{children}</p>;
}

export function FieldView({ field }: { field: Field }) {
  switch (field.type) {
    case "heading":
      return (
        <div className="pt-4">
          <h3 className="text-base font-bold text-navy-900">{field.label}</h3>
          <Hint>{field.hint}</Hint>
        </div>
      );
    case "check":
      return <CheckItem field={field} />;
    case "photo":
      return (
        <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/80">
          <FieldLabel field={field} />
          <PhotoStrip fieldKey={field.key} required={field.required} big />
          <Hint>{field.hint}</Hint>
        </div>
      );
    case "signature":
      return <SignatureField field={field} />;
    case "select":
    case "multi":
      return <ChoiceField field={field} />;
    case "boolean":
      return <BooleanField field={field} />;
    default:
      return <InputField field={field} />;
  }
}

function InputField({ field }: { field: Field }) {
  const { data, setField, readOnly } = useForm();
  const id = useId();
  const raw = data[field.key];
  const value = typeof raw === "string" ? raw : raw === undefined || raw === null ? "" : String(raw);

  let control: React.ReactNode;
  if (field.type === "textarea") {
    control = (
      <Textarea id={id} rows={3} value={value} placeholder={field.placeholder} disabled={readOnly} onChange={(e) => setField(field.key, e.target.value)} />
    );
  } else if (field.type === "number") {
    control = (
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode={field.decimal ? "decimal" : "numeric"}
          value={value}
          placeholder={field.placeholder}
          disabled={readOnly}
          onChange={(e) => setField(field.key, e.target.value)}
          className={field.unit ? "pr-14" : undefined}
        />
        {field.unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-medium text-slate-400">{field.unit}</span>
        ) : null}
      </div>
    );
  } else if (field.type === "month") {
    control = (
      <Input
        id={id}
        type={monthSupported ? "month" : "text"}
        placeholder="JJJJ-MM"
        pattern="\d{4}-\d{2}"
        value={value}
        disabled={readOnly}
        onChange={(e) => setField(field.key, e.target.value)}
      />
    );
  } else if (field.type === "text") {
    const listId = field.suggestions ? `${id}-list` : undefined;
    control = (
      <>
        <Input
          id={id}
          type={field.inputMode === "email" ? "email" : field.inputMode === "tel" ? "tel" : "text"}
          inputMode={field.inputMode}
          autoCapitalize={field.uppercase ? "characters" : undefined}
          autoComplete="off"
          list={listId}
          value={value}
          placeholder={field.placeholder}
          disabled={readOnly}
          onChange={(e) => setField(field.key, field.uppercase ? e.target.value.toUpperCase() : e.target.value)}
          className={field.uppercase ? "font-mono tracking-wide uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case" : undefined}
        />
        {field.suggestions ? (
          <datalist id={listId}>
            {field.suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  }

  return (
    <div>
      <FieldLabel field={field} htmlFor={id} />
      {control}
      <Hint>{field.hint}</Hint>
    </div>
  );
}

function ChoiceField({ field }: { field: Field }) {
  const { data, setField, readOnly } = useForm();
  if (field.type !== "select" && field.type !== "multi") return null;
  const multi = field.type === "multi";
  const raw = data[field.key];
  const selected = multi ? (Array.isArray(raw) ? (raw as string[]) : []) : typeof raw === "string" ? [raw] : [];

  function toggle(value: string) {
    if (multi) {
      const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
      setField(field.key, next.length ? next : undefined);
    } else {
      setField(field.key, selected[0] === value ? undefined : value);
    }
  }

  return (
    <div>
      <FieldLabel field={field} />
      <div className="flex flex-wrap gap-2">
        {field.options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              disabled={readOnly}
              onClick={() => toggle(option.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors disabled:cursor-default",
                active
                  ? "bg-navy-900 text-white shadow-sm"
                  : "bg-white text-navy-800 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:text-slate-400",
              )}
            >
              {active && multi ? <Check className="size-4" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      <Hint>{field.hint}</Hint>
    </div>
  );
}

function BooleanField({ field }: { field: Field }) {
  const { data, setField, readOnly } = useForm();
  const checked = data[field.key] === true;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3.5 ring-1 transition-colors",
        checked ? "ring-volt-500 bg-volt-50/50" : "ring-slate-200",
        readOnly && "cursor-default",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-volt-600"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => setField(field.key, e.target.checked ? true : undefined)}
      />
      <span className="text-sm font-medium text-navy-900">
        {field.label}
        {field.required ? <span className="text-rose-500"> *</span> : null}
      </span>
    </label>
  );
}

function SignatureField({ field }: { field: Field }) {
  const { signatureUrl, saveSignature, clearSignature, readOnly } = useForm();
  return (
    <div>
      <FieldLabel field={field} />
      <SignaturePad imageUrl={signatureUrl} disabled={readOnly} onSave={saveSignature} onClear={clearSignature} />
    </div>
  );
}

const statusStyle: Record<CheckStatus, { active: string; ring: string }> = {
  ok: { active: "bg-volt-500 text-white", ring: "ring-volt-300" },
  minor: { active: "bg-amber-400 text-amber-950", ring: "ring-amber-300" },
  major: { active: "bg-rose-600 text-white", ring: "ring-rose-300" },
  na: { active: "bg-slate-500 text-white", ring: "ring-slate-300" },
};

function CheckItem({ field }: { field: Field }) {
  const { data, setField, readOnly } = useForm();
  const { items } = usePhotos();
  const [open, setOpen] = useState(false);
  if (field.type !== "check") return null;

  const value = checkValue(data, field.key);
  const photoCount = items.filter((p) => p.field_key === field.key).length;
  const isDefect = value.status === "minor" || value.status === "major";
  const expanded = open || isDefect || !!value.note || photoCount > 0;

  function set(change: Partial<CheckValue>) {
    const next: CheckValue = { ...value, ...change };
    for (const k of Object.keys(next) as (keyof CheckValue)[]) {
      if (next[k] === undefined || next[k] === "") delete next[k];
    }
    setField(field.key, Object.keys(next).length ? next : undefined);
  }

  function setMeasure(key: string, v: string) {
    const m = { ...(value.m ?? {}), [key]: v };
    if (!v) delete m[key];
    set({ m: Object.keys(m).length ? m : undefined });
  }

  return (
    <div className={cn("rounded-2xl bg-white p-3.5 ring-1 transition-shadow", value.status ? statusStyle[value.status].ring : "ring-slate-200/80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="leading-snug font-semibold text-navy-900">{field.label}</p>
          <Hint>{field.hint}</Hint>
        </div>
        {!expanded && !readOnly ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-navy-800"
            aria-label="Notiz oder Foto hinzufügen"
            title="Notiz / Foto"
          >
            <MessageSquarePlus className="size-5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={field.label}>
        {STATUS_OPTIONS.map((option) => {
          const active = value.status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={readOnly}
              title={option.label}
              onClick={() => set({ status: active ? undefined : option.value })}
              className={cn(
                "h-11 rounded-xl text-sm font-bold transition-colors disabled:cursor-default",
                active ? statusStyle[option.value].active : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-100",
                !active && readOnly && "opacity-50",
              )}
            >
              {option.short}
            </button>
          );
        })}
      </div>

      {field.measures?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {field.measures.map((m) => (
            <label key={m.key} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 ring-1 ring-slate-200 ring-inset focus-within:ring-2 focus-within:ring-volt-500">
              <span className="text-xs font-semibold whitespace-nowrap text-slate-500">{m.label}</span>
              <input
                type="text"
                inputMode={m.key === "dot" ? "numeric" : m.decimal ? "decimal" : "numeric"}
                value={value.m?.[m.key] ?? ""}
                placeholder={m.placeholder}
                disabled={readOnly}
                onChange={(e) => setMeasure(m.key, e.target.value)}
                className="h-10 w-full min-w-12 bg-transparent text-base text-navy-900 outline-none placeholder:text-slate-300 sm:text-sm"
              />
            </label>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-2">
          <textarea
            rows={2}
            value={value.note ?? ""}
            placeholder={isDefect ? "Was genau ist defekt?" : "Notiz"}
            disabled={readOnly}
            onChange={(e) => set({ note: e.target.value })}
            className={cn(inputClass, "resize-y")}
          />
          {isDefect ? (
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={value.cost ?? ""}
                placeholder="Geschätzte Reparaturkosten"
                disabled={readOnly}
                onChange={(e) => set({ cost: e.target.value })}
                className={cn(inputClass, "pr-10")}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm font-medium text-slate-400">€</span>
            </div>
          ) : null}
          <PhotoStrip fieldKey={field.key} required={isDefect} />
        </div>
      ) : null}
    </div>
  );
}
