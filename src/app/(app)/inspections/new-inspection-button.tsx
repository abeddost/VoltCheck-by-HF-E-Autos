"use client";

import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { createInspection } from "./actions";

function SubmitButton({ large }: { large?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="volt" size={large ? "lg" : "md"} disabled={pending}>
      {pending ? <Spinner /> : <Plus className="size-5" />}
      Neue Prüfung
    </Button>
  );
}

export function NewInspectionButton({ large }: { large?: boolean }) {
  return (
    <form action={createInspection}>
      <SubmitButton large={large} />
    </form>
  );
}
