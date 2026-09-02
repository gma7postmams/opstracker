"use client";
import { useState } from "react";
import { useToast } from "./Toast";

export default function ImageUpload({ kind, value, onChange, round, hint }: {
  kind: "avatar" | "logo" | "favicon";
  value?: string | null;
  onChange: (url: string | null) => void;
  round?: boolean;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { toast(out.error ?? "Upload failed"); return; }
    onChange(out.url);
  }

  return (
    <div className="uploadrow">
      {value
        ? <img src={value} alt="" className="uploadprev" style={{ borderRadius: round ? "50%" : 10 }} />
        : <div className="uploadprev placeholder" style={{ borderRadius: round ? "50%" : 10 }}>▦</div>}
      <div>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
          onChange={pick} disabled={busy} />
        {hint && <div className="muted upl-hint">{hint}</div>}
        {value && (
          <button type="button" className="secondary small" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
