import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET, type LeadPhoto, type PhotoView } from "./types";

const SIGNED_URL_SECONDS = 60 * 60 * 4;

/** Creates temporary URLs for private files. Returns path -> url. */
export async function signPaths(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, SIGNED_URL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

export async function signPhotos(supabase: SupabaseClient, photos: LeadPhoto[]): Promise<PhotoView[]> {
  const urls = await signPaths(supabase, photos.flatMap((p) => [p.path, p.thumb_path]));
  return photos.map((p) => ({
    ...p,
    url: urls.get(p.path) ?? null,
    thumbUrl: (p.thumb_path ? urls.get(p.thumb_path) : null) ?? urls.get(p.path) ?? null,
  }));
}

/** Removes all files of a lead from storage (folder = lead id). */
export async function removeLeadFiles(supabase: SupabaseClient, leadId: string) {
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(leadId, { limit: 100 });
    if (error || !data || data.length === 0) return;
    const { error: removeError } = await bucket.remove(data.map((f) => `${leadId}/${f.name}`));
    if (removeError || data.length < 100) return;
  }
}
