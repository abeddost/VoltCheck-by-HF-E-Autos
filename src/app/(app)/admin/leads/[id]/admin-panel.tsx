"use client";

import { useState, useTransition } from "react";
import { Check, Printer, Trash2 } from "lucide-react";
import { Button, Card, Input, Label, Select, Spinner, Textarea } from "@/components/ui";
import { parseNumber } from "@/lib/format";
import { STATUS_META, type Lead, type LeadStatus } from "@/lib/types";
import { deleteLead, updateLeadAdmin } from "./actions";

const STATUS_CHOICES: LeadStatus[] = ["submitted", "in_review", "offer_sent", "bought", "rejected", "draft"];

export function AdminPanel({ lead }: { lead: Pick<Lead, "id" | "status" | "offer_price" | "purchase_price" | "admin_notes"> }) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [offer, setOffer] = useState(lead.offer_price?.toString() ?? "");
  const [purchase, setPurchase] = useState(lead.purchase_price?.toString() ?? "");
  const [notes, setNotes] = useState(lead.admin_notes ?? "");
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLeadAdmin(lead.id, {
        status,
        offer_price: parseNumber(offer, { integer: true }),
        purchase_price: parseNumber(purchase, { integer: true }),
        admin_notes: notes,
        feedback,
      });
      if (!result.error) setFeedback("");
      setMessage(result.error ? { ok: false, text: result.error } : { ok: true, text: "Gespeichert" });
    });
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-base font-bold">Bearbeitung</h2>
      <div className="space-y-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
            {STATUS_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s === "draft" ? "Entwurf (zurück an Mechaniker)" : STATUS_META[s].label}
              </option>
            ))}
          </Select>
          {status === "draft" && lead.status !== "draft" ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-amber-700">Der Mechaniker kann die Prüfung dann wieder bearbeiten und neu einreichen.</p>
              <Textarea
                aria-label="Nachricht an den Mechaniker"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Nachricht an den Mechaniker, z. B. „Bitte Unterboden fotografieren“"
                className="min-h-20"
              />
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="offer">Unser Angebot €</Label>
            <Input id="offer" inputMode="numeric" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="–" />
          </div>
          <div>
            <Label htmlFor="purchase">Kaufpreis €</Label>
            <Input id="purchase" inputMode="numeric" value={purchase} onChange={(e) => setPurchase(e.target.value)} placeholder="–" />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Interne Notizen</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nur für den Admin sichtbar" />
        </div>
        {message ? (
          <p className={message.ok ? "flex items-center gap-1.5 text-sm font-semibold text-volt-700" : "rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"}>
            {message.ok ? <Check className="size-4" /> : null}
            {message.text}
          </p>
        ) : null}
        <Button className="w-full" onClick={save} disabled={pending}>
          {pending ? <Spinner /> : null}
          Speichern
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
            <Printer className="size-4" />
            Drucken / PDF
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={() => {
              if (window.confirm("Lead mit allen Fotos endgültig löschen?")) startDelete(() => deleteLead(lead.id));
            }}
            aria-label="Lead löschen"
            title="Lead löschen"
          >
            {deleting ? <Spinner /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
