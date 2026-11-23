"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, Trash2, UserPlus } from "lucide-react";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";
import type { Role } from "@/lib/types";
import { createMember, deleteMember, setMemberPassword, setMemberRole, type ActionResult } from "./actions";

export interface Member {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role | null;
  created_at: string;
  leadCount: number;
}

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result || (!result.error && !result.ok)) return null;
  return (
    <p className={result.error ? "rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" : "rounded-xl bg-volt-50 px-3 py-2 text-sm font-medium text-volt-800"}>
      {result.error ?? result.ok}
    </p>
  );
}

export function CreateMemberForm() {
  const [result, action, pending] = useActionState(createMember, {});
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold">
        <UserPlus className="size-5" />
        Zugang anlegen
      </h2>
      <p className="mb-4 text-sm text-slate-500">Zum Beispiel für den Mechaniker. Er meldet sich dann mit E-Mail und Passwort an.</p>
      <form action={action} className="space-y-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Vor- und Nachname" />
        </div>
        <div>
          <Label htmlFor="email">E-Mail</Label>
          <Input id="email" name="email" type="email" required autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="password">Passwort</Label>
          <Input id="password" name="password" type="text" required minLength={8} autoComplete="new-password" placeholder="mind. 8 Zeichen" />
        </div>
        <div>
          <Label htmlFor="role">Rolle</Label>
          <Select id="role" name="role" defaultValue="mechanic">
            <option value="mechanic">Mechaniker</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Feedback result={result} />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Spinner /> : null}
          Anlegen
        </Button>
      </form>
    </Card>
  );
}

export function MemberRow({ member, isMe }: { member: Member; isMe: boolean }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    setResult(null);
    start(async () => setResult(await fn()));
  }

  return (
    <li className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {member.full_name || member.email}
            {isMe ? <span className="ml-2 text-xs font-medium text-slate-400">(Sie)</span> : null}
          </div>
          <div className="truncate text-sm text-slate-500">
            {member.email} · {member.leadCount} Prüfung{member.leadCount === 1 ? "" : "en"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Rolle"
            value={member.role ?? ""}
            disabled={pending}
            onChange={(e) => run(() => setMemberRole(member.id, e.target.value as Role))}
            className="w-40"
          >
            {member.role ? null : <option value="">Kein Zugriff</option>}
            <option value="mechanic">Mechaniker</option>
            <option value="admin">Admin</option>
          </Select>
          <Button
            variant="secondary"
            disabled={pending}
            title="Neues Passwort setzen"
            aria-label="Neues Passwort setzen"
            onClick={() => {
              const pw = window.prompt(`Neues Passwort für ${member.email} (mind. 8 Zeichen):`);
              if (pw) run(() => setMemberPassword(member.id, pw));
            }}
          >
            <KeyRound className="size-4" />
          </Button>
          {!isMe ? (
            <Button
              variant="danger"
              disabled={pending}
              title="Benutzer löschen"
              aria-label="Benutzer löschen"
              onClick={() => {
                if (window.confirm(`${member.email} löschen? Die Prüfungen bleiben erhalten.`)) run(() => deleteMember(member.id));
              }}
            >
              {pending ? <Spinner /> : <Trash2 className="size-4" />}
            </Button>
          ) : null}
        </div>
      </div>
      {result ? (
        <div className="mt-2">
          <Feedback result={result} />
        </div>
      ) : null}
    </li>
  );
}
