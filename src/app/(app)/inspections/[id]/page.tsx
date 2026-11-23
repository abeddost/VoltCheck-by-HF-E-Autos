import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { signPaths, signPhotos } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadPhoto } from "@/lib/types";
import { FormSkeleton, InspectionFormLoader } from "./form-loader";

export const metadata: Metadata = { title: "Prüfung" };

export default function InspectionPage({ params }: PageProps<"/inspections/[id]">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <Inspection params={params} />
    </Suspense>
  );
}

async function Inspection({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle<Lead>();
  if (!lead) notFound();

  const { data: photoRows } = await supabase
    .from("lead_photos")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  const photos = await signPhotos(supabase, (photoRows ?? []) as LeadPhoto[]);
  const signature = lead.signature_path ? (await signPaths(supabase, [lead.signature_path])).get(lead.signature_path) ?? null : null;
  const canEdit = lead.status === "draft" && (lead.mechanic_id === user.id || user.role === "admin");

  return <InspectionFormLoader key={lead.id} lead={lead} photos={photos} signatureUrl={signature} readOnly={!canEdit} />;
}
