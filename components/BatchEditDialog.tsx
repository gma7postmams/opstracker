"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";

const KEEP = "";

export default function BatchEditDialog({ count, master, onClose, onApply }: {
  count: number; master: Record<string, string[]>;
  onClose: () => void; onApply: (patch: any) => void;
}) {
  const [patch, setPatch] = useState<any>({});
  const [people, setPeople] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((u) => setPeople(u.map((x: any) => x.name)));
  }, []);

  const set = (k: string, v: string) =>
    setPatch((p: any) => {
      const n = { ...p };
      if (v === KEEP) delete n[k]; else n[k] = v;
      return n;
    });

  const changed = Object.keys(patch).length;

  return (
    <Modal title={`Edit ${count} record${count === 1 ? "" : "s"}`}
      subtitle="Only the fields you change are applied" onClose={onClose} width={560}
      footer={<>
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" disabled={!changed} onClick={() => onApply(patch)}>
          Apply to {count}
        </button>
      </>}>
      <div className="form">
        <label>Status
          <select onChange={(e) => set("status", e.target.value)} defaultValue={KEEP}>
            <option value={KEEP}>— leave unchanged —</option>
            <option value="OPEN">Open</option>
            <option value="CLOSE_PENDING">Close Pending</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        <label>Priority
          <select onChange={(e) => set("priority", e.target.value)} defaultValue={KEEP}>
            <option value={KEEP}>— leave unchanged —</option>
            {["LOW", "NORMAL", "HIGH", "CRITICAL"].map((p) =>
              <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <label>Location
          <select onChange={(e) => set("location", e.target.value)} defaultValue={KEEP}>
            <option value={KEEP}>— leave unchanged —</option>
            {(master.LOCATION ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label>Shift
          <select onChange={(e) => set("shift", e.target.value)} defaultValue={KEEP}>
            <option value={KEEP}>— leave unchanged —</option>
            {(master.SHIFT ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label>Assigned to
          <select onChange={(e) => set("assigned", e.target.value)} defaultValue={KEEP}>
            <option value={KEEP}>— leave unchanged —</option>
            {people.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label>Accountable
          <select onChange={(e) => set("accountable", e.target.value)} defaultValue={KEEP}>
            <option value={KEEP}>— leave unchanged —</option>
            {people.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="full">Time ended
          <input type="time" onChange={(e) => set("timeEnded", e.target.value)} />
          <span className="muted">Set this when closing a batch of records</span>
        </label>
      </div>
    </Modal>
  );
}
