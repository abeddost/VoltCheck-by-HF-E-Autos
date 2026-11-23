"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { removeLeadFiles } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

export async function createInspection() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").insert({ mechanic_id: user.id }).select("id").single();
  if (error || !data) throw new Error(`Prüfung konnte nicht angelegt werden: ${error?.message ?? "unbekannter Fehler"}`);
  redirect(`/inspections/${data.id}`);
}

export async function deleteDraft(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("id, status, mechanic_id").eq("id", id).maybeSingle();
  if (!lead) redirect("/inspections");
  if (lead.status !== "draft" || (lead.mechanic_id !== user.id && user.role !== "admin")) {
    throw new Error("Nur eigene Entwürfe können gelöscht werden.");
  }
  await removeLeadFiles(supabase, id);
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
  redirect("/inspections");
}
