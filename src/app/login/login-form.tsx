"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Spinner } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setPending(false);
      setError(
        error.message.includes("Invalid login credentials")
          ? "E-Mail oder Passwort ist falsch."
          : error.message.includes("Email not confirmed")
            ? "Die E-Mail-Adresse ist noch nicht bestätigt."
            : `Anmeldung fehlgeschlagen: ${error.message}`,
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password">Passwort</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : null}
        Anmelden
      </Button>
    </form>
  );
}
