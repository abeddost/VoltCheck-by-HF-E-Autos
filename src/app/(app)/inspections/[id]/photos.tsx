"use client";

import { createContext, use, useEffect, useEffectEvent, useRef, useState } from "react";
import { AlertTriangle, Camera, RotateCw, X } from "lucide-react";
import { Lightbox, type LightboxItem } from "@/components/lightbox";
import { Spinner } from "@/components/ui";
import { COVER_PHOTO_KEY } from "@/lib/checklist";
import { cn } from "@/lib/format";
import { compressImage, uid } from "@/lib/image";
import { queueDelete, queueList, queuePut } from "@/lib/photo-queue";
import type { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, type PhotoView } from "@/lib/types";

type Supabase = ReturnType<typeof createClient>;

export interface PhotoItem {
  id: string;
  field_key: string;
  path: string | null;
  thumb_path: string | null;
  url: string | null;
  thumbUrl: string | null;
  state: "done" | "uploading" | "error";
  error?: string;
  /** original picture, kept until the upload succeeded */
  file?: Blob;
}

interface PhotoApi {
  items: PhotoItem[];
  readOnly: boolean;
  add: (fieldKey: string, files: File[]) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  view: (fieldKey: string, id: string) => void;
}

const PhotoContext = createContext<PhotoApi | null>(null);

export function usePhotos() {
  const ctx = use(PhotoContext);
  if (!ctx) throw new Error("usePhotos outside PhotoProvider");
  return ctx;
}

function fieldLabel(fieldKey: string, labels: Record<string, string>) {
  return labels[fieldKey] ?? fieldKey;
}

export function usePhotoManager({
  supabase,
  leadId,
  initial,
  initialCover,
  readOnly,
  labels,
}: {
  supabase: Supabase;
  leadId: string;
  initial: PhotoView[];
  initialCover: string | null;
  readOnly: boolean;
  labels: Record<string, string>;
}) {
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initial.map((p) => ({
      id: p.id,
      field_key: p.field_key,
      path: p.path,
      thumb_path: p.thumb_path,
      url: p.url,
      thumbUrl: p.thumbUrl,
      state: "done" as const,
    })),
  );
  const itemsRef = useRef(items);
  const coverRef = useRef(initialCover);
  const [viewer, setViewer] = useState<{ items: LightboxItem[]; start: number } | null>(null);

  function patch(id: string, change: Partial<PhotoItem>) {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...change } : item));
      itemsRef.current = next;
      return next;
    });
  }

  async function setCover(thumbPath: string | null) {
    coverRef.current = thumbPath;
    await supabase.from("leads").update({ cover_photo_path: thumbPath }).eq("id", leadId);
  }

  async function upload(id: string, fieldKey: string, file: Blob) {
    try {
      const [full, thumb] = await Promise.all([compressImage(file, 1920, 0.82), compressImage(file, 480, 0.72)]);
      const base = `${leadId}/${fieldKey}-${id}`;
      const path = `${base}.jpg`;
      const thumbPath = `${base}_t.jpg`;
      const bucket = supabase.storage.from(PHOTO_BUCKET);
      for (const [target, blob] of [
        [path, full],
        [thumbPath, thumb],
      ] as const) {
        const { error } = await bucket.upload(target, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error && !/exist/i.test(error.message)) throw error;
      }
      const { error } = await supabase
        .from("lead_photos")
        .insert({ id, lead_id: leadId, field_key: fieldKey, path, thumb_path: thumbPath });
      if (error && error.code !== "23505") throw error;

      patch(id, {
        state: "done",
        error: undefined,
        file: undefined,
        path,
        thumb_path: thumbPath,
        url: URL.createObjectURL(full),
        thumbUrl: URL.createObjectURL(thumb),
      });
      void queueDelete(id);
      if (fieldKey === COVER_PHOTO_KEY || !coverRef.current) await setCover(thumbPath);
    } catch (e) {
      patch(id, { state: "error", error: e instanceof Error ? e.message : "Upload fehlgeschlagen" });
    }
  }

  async function add(fieldKey: string, files: File[]) {
    if (readOnly) return;
    const created = files.map((file) => ({
      id: uid(),
      field_key: fieldKey,
      path: null,
      thumb_path: null,
      url: null,
      thumbUrl: URL.createObjectURL(file),
      state: "uploading" as const,
      file,
    }));
    setItems((prev) => {
      const next = [...prev, ...created];
      itemsRef.current = next;
      return next;
    });
    // keep the originals on the phone until uploaded, then upload one by one (low memory)
    await Promise.all(created.map((item) => queuePut({ id: item.id, leadId, fieldKey, blob: item.file })));
    for (const item of created) await upload(item.id, fieldKey, item.file);
  }

  function retry(id: string) {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item?.file) return;
    patch(id, { state: "uploading", error: undefined });
    void upload(id, item.field_key, item.file);
  }

  async function remove(id: string) {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item || readOnly) return;
    if (!window.confirm("Foto löschen?")) return;
    void queueDelete(id);
    if (item.path) {
      const { error } = await supabase.from("lead_photos").delete().eq("id", id);
      if (error) {
        window.alert(`Löschen fehlgeschlagen: ${error.message}`);
        return;
      }
      await supabase.storage.from(PHOTO_BUCKET).remove([item.path, item.thumb_path].filter((p): p is string => !!p));
    }
    const rest = itemsRef.current.filter((i) => i.id !== id);
    itemsRef.current = rest;
    setItems(rest);
    if (item.thumb_path && item.thumb_path === coverRef.current) {
      const nextCover =
        rest.find((i) => i.field_key === COVER_PHOTO_KEY && i.thumb_path)?.thumb_path ??
        rest.find((i) => i.state === "done" && i.thumb_path)?.thumb_path ??
        null;
      await setCover(nextCover);
    }
  }

  // Photos that were taken but not uploaded yet (e.g. page reloaded without signal)
  const restore = useEffectEvent(async () => {
    const pending = await queueList(leadId);
    const known = new Set(itemsRef.current.map((i) => i.id));
    const restored: PhotoItem[] = pending
      .filter((p) => !known.has(p.id))
      .map((p) => ({
        id: p.id,
        field_key: p.fieldKey,
        path: null,
        thumb_path: null,
        url: null,
        thumbUrl: URL.createObjectURL(p.blob),
        state: "uploading",
        file: p.blob,
      }));
    if (restored.length === 0) return;
    setItems((prev) => {
      const next = [...prev, ...restored];
      itemsRef.current = next;
      return next;
    });
    for (const item of restored) await upload(item.id, item.field_key, item.file!);
  });

  const retryFailed = useEffectEvent(() => {
    for (const item of itemsRef.current) if (item.state === "error" && item.file) retry(item.id);
  });

  useEffect(() => {
    if (readOnly) return;
    void restore();
    const online = () => retryFailed();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [readOnly]);

  function view(fieldKey: string, id: string) {
    const list = itemsRef.current.filter((i) => i.field_key === fieldKey && (i.url || i.thumbUrl));
    const start = Math.max(0, list.findIndex((i) => i.id === id));
    setViewer({
      items: list.map((i) => ({ url: (i.url ?? i.thumbUrl) as string, label: fieldLabel(fieldKey, labels) })),
      start,
    });
  }

  const api: PhotoApi = {
    items,
    readOnly,
    add: (fieldKey, files) => void add(fieldKey, files),
    remove: (id) => void remove(id),
    retry,
    view,
  };

  const lightbox = viewer ? <Lightbox items={viewer.items} start={viewer.start} onClose={() => setViewer(null)} /> : null;

  return { api, lightbox, items };
}

export function PhotoProvider({ value, children }: { value: PhotoApi; children: React.ReactNode }) {
  return <PhotoContext value={value}>{children}</PhotoContext>;
}

export function PhotoStrip({ fieldKey, required, big }: { fieldKey: string; required?: boolean; big?: boolean }) {
  const { items, readOnly, add, remove, retry, view } = usePhotos();
  const inputRef = useRef<HTMLInputElement>(null);
  const mine = items.filter((i) => i.field_key === fieldKey);
  const size = big ? "size-24" : "size-20";

  return (
    <div className="flex flex-wrap gap-2">
      {mine.map((item) => (
        <div key={item.id} className={cn("relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200", size)}>
          {item.thumbUrl ? (
            <button type="button" onClick={() => view(fieldKey, item.id)} className="size-full" aria-label="Foto ansehen">
              {/* eslint-disable-next-line @next/next/no-img-element -- local/signed URLs */}
              <img src={item.thumbUrl} alt="" className="size-full object-cover" />
            </button>
          ) : null}
          {item.state === "uploading" ? (
            <div className="absolute inset-0 grid place-items-center bg-white/60 text-navy-900">
              <Spinner className="size-6" />
            </div>
          ) : null}
          {item.state === "error" ? (
            <button
              type="button"
              onClick={() => retry(item.id)}
              title={item.error}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-rose-600/85 text-[11px] font-semibold text-white"
            >
              <RotateCw className="size-5" />
              Erneut
            </button>
          ) : null}
          {!readOnly && item.state !== "uploading" ? (
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
              aria-label="Foto löschen"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-semibold transition-colors",
              size,
              required && mine.length === 0
                ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "border-slate-300 bg-white text-slate-500 hover:border-volt-500 hover:text-volt-700",
            )}
          >
            <Camera className="size-6" />
            Foto
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (files.length) add(fieldKey, files);
            }}
          />
        </>
      ) : mine.length === 0 ? (
        <span className="flex items-center gap-1.5 text-sm text-slate-400">
          {required ? <AlertTriangle className="size-4 text-amber-500" /> : null}
          Kein Foto
        </span>
      ) : null}
    </div>
  );
}
