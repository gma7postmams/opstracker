"use client";

import { useState } from "react";
import ImportDialog from "./ImportDialog";

/**
 * Administration-side import. Unlike the self-service button on the record
 * pages, this one reads the Assigned To / Accountable columns, so a supervisor
 * can load a whole shift's log in one pass.
 */
export default function AdminImportPanel({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="panel spaced">
        <div className="panelhead">
          <div><h3>Import records</h3>
            <span className="muted">Load a log on behalf of the whole team</span></div>
        </div>
        <div className="hint spacedbottom">
          <b>How this differs from the record pages</b><br />
          • Here, <b>Assigned To</b> and <b>Accountable Person</b> are read from the file, so
          rows can be attributed to different people.<br />
          • On the Technical Assistance and Other Tasks pages, anyone can import their own
          work and every row is logged under them.<br />
          • Either way the records are owned by you, so you can correct them afterwards.
        </div>
        <button className="primary" onClick={() => setOpen(true)}>⇧ Import Excel / CSV</button>
      </section>

      {open && (
        <ImportDialog
          scope="admin"
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); onDone?.(); }}
        />
      )}
    </>
  );
}
