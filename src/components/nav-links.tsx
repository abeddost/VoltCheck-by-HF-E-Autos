"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  if (links.length < 2) return null;
  return (
    <nav className="flex items-center gap-1">
      {links.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin" || pathname.startsWith("/admin/leads")
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-navy-900",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
