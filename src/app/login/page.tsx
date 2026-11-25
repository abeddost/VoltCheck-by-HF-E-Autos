import DesignerCredit from "@/components/designer-credit";
import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-navy-950 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-volt-500/15 blur-3xl"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo dark />
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/30 sm:p-8">
          <h1 className="text-xl font-bold text-navy-900">Anmelden</h1>
          <p className="mt-1 text-sm text-slate-500">Ankaufsprüfung für E-Autos</p>
          {isSupabaseConfigured ? (
            <LoginForm />
          ) : (
            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
              Supabase ist noch nicht eingerichtet. Bitte <code>NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code> eintragen.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Kein Konto? Der Admin legt Zugänge im Bereich „Team“ an.</p>
        <div className="mt-8 flex justify-center text-slate-400">
          <DesignerCredit site="voltcheck" />
        </div>
      </div>
    </main>
  );
}
