import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Spinner } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="grid flex-1 place-items-center text-slate-400">
          <Spinner className="size-6" />
        </div>
      }
    >
      <RoleRedirect />
    </Suspense>
  );
}

async function RoleRedirect(): Promise<null> {
  const user = await requireUser();
  redirect(user.role === "admin" ? "/admin" : "/inspections");
}
