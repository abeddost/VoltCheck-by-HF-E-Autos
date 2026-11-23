"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export interface ActionResult {
  error?: string;
  ok?: string;
}

const NO_SECRET =
  "SUPABASE_SECRET_KEY fehlt. Bitte den Secret Key aus Supabase (Project Settings → API Keys) in .env.local eintragen.";

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "mechanic";
}

export async function createMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireUser(["admin"]);
  const admin = createAdminClient();
  if (!admin) return { error: NO_SECRET };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role");

  if (!email.includes("@")) return { error: "Bitte eine gültige E-Mail eingeben." };
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  if (!isRole(role)) return { error: "Bitte eine Rolle wählen." };

  const fullName = name || email.split("@")[0];
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { role },
  });
  if (error || !data.user) {
    const message = error?.message ?? "unbekannter Fehler";
    return { error: /already|exists|registered/i.test(message) ? "Diese E-Mail ist bereits registriert." : message };
  }
  // Supabase stores app_metadata after the insert trigger ran, so set the role on the profile here.
  const { error: roleError } = await admin.from("profiles").update({ role, full_name: fullName }).eq("id", data.user.id);
  if (roleError) return { error: `Zugang angelegt, aber Rolle nicht gesetzt: ${roleError.message}` };
  refresh();
  return { ok: `${name || email} wurde angelegt. Zugangsdaten jetzt an die Person weitergeben.` };
}

export async function setMemberRole(userId: string, role: Role): Promise<ActionResult> {
  const me = await requireUser(["admin"]);
  if (!isRole(role)) return { error: "Ungültige Rolle" };
  if (userId === me.id && role !== "admin") return { error: "Sie können sich nicht selbst die Admin-Rolle entziehen." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  const admin = createAdminClient();
  if (admin) await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });
  refresh();
  return { ok: "Rolle geändert" };
}

export async function setMemberPassword(userId: string, password: string): Promise<ActionResult> {
  await requireUser(["admin"]);
  const admin = createAdminClient();
  if (!admin) return { error: NO_SECRET };
  if (password.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen haben." };
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { ok: "Passwort geändert" };
}

export async function deleteMember(userId: string): Promise<ActionResult> {
  const me = await requireUser(["admin"]);
  if (userId === me.id) return { error: "Sie können sich nicht selbst löschen." };
  const admin = createAdminClient();
  if (!admin) return { error: NO_SECRET };
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Benutzer gelöscht" };
}
