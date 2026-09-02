"use client";
import { useEffect, ReactNode } from "react";

export default function Modal({ title, subtitle, children, footer, onClose, width = 600 }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
  onClose: () => void; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="modalbg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: `min(${width}px, 100%)` }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modalhead">
          <div><h3>{title}</h3>{subtitle && <span className="muted">{subtitle}</span>}</div>
          <button className="x" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modalbody">{children}</div>
        {footer && <div className="actions">{footer}</div>}
      </div>
    </div>
  );
}
