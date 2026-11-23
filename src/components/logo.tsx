import { cn } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vc-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14365A" />
          <stop offset="1" stopColor="#0A1A2B" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#vc-mark-bg)" />
      <rect x="96" y="166" width="292" height="180" rx="46" fill="#3EE07F" fillOpacity="0.1" stroke="#fff" strokeWidth="26" />
      <rect x="390" y="218" width="38" height="76" rx="12" fill="#fff" />
      <path d="M170 259 L219 306 L314 207" fill="none" stroke="#3EE07F" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, dark = false, compact = false }: { className?: string; dark?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-9 shrink-0" />
      <span className="leading-none">
        <span className={cn("block text-[19px] font-extrabold tracking-tight", dark ? "text-white" : "text-navy-900")}>
          Volt<span className={dark ? "text-volt-400" : "text-volt-500"}>Check</span>
        </span>
        {compact ? null : (
          <span className={cn("mt-1 block text-[9.5px] font-bold tracking-[0.2em]", dark ? "text-slate-400" : "text-slate-500")}>
            BY HF E-AUTOS
          </span>
        )}
      </span>
    </span>
  );
}
