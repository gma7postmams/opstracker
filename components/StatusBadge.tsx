import { statusLabel } from "@/lib/recordTypes";

export default function StatusBadge({ status }: { status: string }) {
  const cls = status === "OPEN" ? "open" : status === "CLOSE_PENDING" ? "pending" : "closed";
  return <span className={`status ${cls}`}>{statusLabel(status)}</span>;
}
