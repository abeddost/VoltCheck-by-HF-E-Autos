"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { removeLeadFiles } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus } from "@/lib/types";

const STATUSES: LeadStatus[] = ["draft", "submitted", "in_review", "offer_sent", "bought", "rejected"];

export interface AdminUpdate {
  status: LeadStatus;
  offer_price: number | null;
  purchase_price: number | null;
  admin_notes: string | null;
  /** message for the mechanic when the lead goes back to draft */
  feedback?: string | null;
}

export async function updateLeadAdmin(id: string, input: AdminUpdate): Promise<{ error?: string }> {
  await requireUser(["admin"]);
  if (!STATUSES.includes(input.status)) return { error: "Ungültiger Status" };
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    status: input.status,
    offer_price: input.offer_price,
    purchase_price: input.purchase_price,
    admin_notes: input.admin_notes?.trim() || null,
  };
  const feedback = input.feedback?.trim();
  if (input.status === "draft" && feedback) {
    // stored with the answers so the mechanic sees it in the form
    const { data: current } = await supabase.from("leads").select("data").eq("id", id).single();
    update.data = { ...(current?.data ?? {}), admin_feedback: { text: feedback, at: new Date().toISOString() } };
  }
  const { error } = await supabase.from("leads").update(update).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function deleteLead(id: string) {
  await requireUser(["admin"]);
  const supabase = await createClient();
  await removeLeadFiles(supabase, id);
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
  redirect("/admin");
}
