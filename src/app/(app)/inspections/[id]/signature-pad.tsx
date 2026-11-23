"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

/** Finger/stylus signature. Calls onSave with a PNG when the user confirms. */
export function SignaturePad({
  imageUrl,
  disabled,
  onSave,
  onClear,
}: {
  imageUrl: string | null;
  disabled?: boolean;
  onSave: (png: Blob) => Promise<void>;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPad = !imageUrl && !disabled;

  useEffect(() => {
    if (!showPad) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0B1F33";
  }, [showPad]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    last.current = point(event);
    const ctx = event.currentTarget.getContext("2d");
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = "#0B1F33";
      ctx.fill();
    }
    setHasInk(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Leer"))), "image/png"),
      );
      await onSave(blob);
      setHasInk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (imageUrl) {
    return (
      <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage */}
        <img src={imageUrl} alt="Unterschrift des Verkäufers" className="h-36 w-full object-contain" />
        {!disabled ? (
          <div className="mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClear}>
              <PenLine className="size-4" />
              Neu unterschreiben
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (disabled) {
    return <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Keine Unterschrift</p>;
  }

  return (
    <div>
      <div className="relative rounded-2xl bg-white ring-1 ring-slate-300">
        <canvas
          ref={canvasRef}
          className="h-44 w-full touch-none rounded-2xl"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-sm text-slate-400">
            Hier mit dem Finger unterschreiben
          </span>
        ) : null}
        <span className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-dashed border-slate-300" />
      </div>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={clear} disabled={!hasInk || saving}>
          <Eraser className="size-4" />
          Löschen
        </Button>
        <Button size="sm" onClick={save} disabled={!hasInk || saving}>
          {saving ? <Spinner /> : null}
          Unterschrift übernehmen
        </Button>
      </div>
    </div>
  );
}
