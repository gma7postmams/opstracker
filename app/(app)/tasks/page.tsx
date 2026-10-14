import RecordsView from "@/components/RecordsView";
import { TYPES } from "@/lib/recordTypes";

export default function Page() {
  const c = TYPES.tasks;
  return (
    <div className="page report-page" style={{ color: "var(--text)" }}>
      <RecordsView type="tasks" label={c.label} singular={c.singular}
        subjectHeader={c.subjectHeader} subjectField={c.subjectField} bodyField={c.bodyField} />
    </div>
  );
}
