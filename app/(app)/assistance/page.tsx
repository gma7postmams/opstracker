import RecordsView from "@/components/RecordsView";
import { TYPES } from "@/lib/recordTypes";

export default function Page() {
  const c = TYPES.assistance;
  return <RecordsView type="assistance" label={c.label} singular={c.singular}
    subjectHeader={c.subjectHeader} subjectField={c.subjectField} bodyField={c.bodyField} />;
}
