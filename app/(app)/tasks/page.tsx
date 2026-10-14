import RecordsView from "@/components/RecordsView";
import { TYPES } from "@/lib/recordTypes";

export default function Page() {
  const c = TYPES.tasks;
  return (
    <div className="page report-page" style={{ color: "var(--text)" }}>
      <div
        className="report-heading"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "20px",
          margin: "0 0 20px",
        }}
      >
        <div>
          <div
            className="report-eyebrow"
            style={{
              color: "#237a75",
              fontSize: "11px",
              fontWeight: 750,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            OPERATIONS MANAGEMENT
          </div>
          <h1 style={{ margin: "4px 0 5px", fontSize: "26px", lineHeight: 1.2 }}>
            Other Tasks
          </h1>
          <div
            className="report-subtitle"
            style={{ color: "var(--muted)", fontSize: "14px" }}
          >
            Monitor administrative work, maintenance activities, coordination tasks, and operational assignments.
          </div>
        </div>
        <div className="report-actions" aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignSelf: "end" }} />
      </div>

      <RecordsView type="tasks" label={c.label} singular={c.singular}
        subjectHeader={c.subjectHeader} subjectField={c.subjectField} bodyField={c.bodyField} />
    </div>
  );
}
