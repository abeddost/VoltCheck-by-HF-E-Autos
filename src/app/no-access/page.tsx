import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Kein Zugriff" };

export default function NoAccessPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-xl font-bold">Noch kein Zugriff</h1>
        <p className="mt-2 text-sm text-slate-500">
          Ihr Konto hat noch keine Rolle. Bitte beim Admin melden, damit er Sie als Mechaniker oder Admin freischaltet.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button type="submit" className="text-sm font-semibold text-navy-700 underline underline-offset-4">
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
