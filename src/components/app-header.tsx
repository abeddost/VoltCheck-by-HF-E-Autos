import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function AppHeader() {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Start">
          <Logo />
        </Link>
        <Suspense fallback={<div className="ml-auto h-8 w-32 animate-pulse rounded-lg bg-slate-100" />}>
          <UserNav />
        </Suspense>
      </div>
    </header>
  );
}

async function UserNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  const links =
    user.role === "admin"
      ? [
          { href: "/admin", label: "Leads" },
          { href: "/inspections", label: "Prüfen" },
          { href: "/admin/team", label: "Team" },
        ]
      : user.role === "mechanic"
        ? [{ href: "/inspections", label: "Meine Prüfungen" }]
        : [];

  return (
    <>
      <NavLinks links={links} />
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-sm font-semibold text-navy-900">{user.name}</div>
          <div className="text-xs text-slate-500">{user.role === "admin" ? "Admin" : user.role === "mechanic" ? "Mechaniker" : "Kein Zugriff"}</div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-navy-900"
            title="Abmelden"
            aria-label="Abmelden"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
    </>
  );
}
