"use client";

import { useState } from "react";
import { cn } from "@/lib/format";
import { Lightbox } from "./lightbox";

export interface GridPhoto {
  id: string;
  url: string | null;
  thumbUrl: string | null;
  label: string;
}

export function PhotoGrid({ photos, size = "md", featureFirst = false }: { photos: GridPhoto[]; size?: "sm" | "md"; featureFirst?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const viewable = photos.filter((p) => p.url || p.thumbUrl);
  if (viewable.length === 0) return null;

  return (
    <>
      <div className={cn("grid gap-2", size === "sm" ? "grid-cols-[repeat(auto-fill,minmax(72px,1fr))]" : "grid-cols-2 sm:grid-cols-4")}>
        {viewable.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpen(i)}
            className={cn(
              "group relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200",
              size === "sm" ? "aspect-square" : "aspect-[4/3]",
              featureFirst && i === 0 && "col-span-2 row-span-2",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage */}
            <img
              src={(featureFirst && i === 0 ? photo.url : photo.thumbUrl) ?? photo.url ?? ""}
              alt={photo.label}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
            {size === "md" ? (
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-left text-xs font-medium text-white">
                {photo.label}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {open !== null ? (
        <Lightbox
          items={viewable.map((p) => ({ url: (p.url ?? p.thumbUrl) as string, label: p.label }))}
          start={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
