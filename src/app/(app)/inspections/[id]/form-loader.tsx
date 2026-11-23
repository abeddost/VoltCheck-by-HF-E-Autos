"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

/** The form reads local backups (localStorage), so it renders in the browser only. */
export const InspectionFormLoader = dynamic(() => import("./inspection-form"), {
  ssr: false,
  loading: () => <FormSkeleton />,
});

export function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}
