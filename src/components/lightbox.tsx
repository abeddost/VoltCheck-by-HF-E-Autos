"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export interface LightboxItem {
  url: string;
  label?: string;
}

export function Lightbox({ items, start, onClose }: { items: LightboxItem[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const item = items[index];
  const count = items.length;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (event.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [count, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {item.label}
          <span className="ml-2 text-white/50">
            {index + 1} / {count}
          </span>
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Original öffnen">
          <Download className="size-5" />
        </a>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Schließen">
          <X className="size-6" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage */}
        <img src={item.url} alt={item.label ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="absolute top-1/2 left-2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Vorheriges Foto"
            >
              <ChevronLeft className="size-7" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Nächstes Foto"
            >
              <ChevronRight className="size-7" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
