"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import ImportDialog from "./ImportDialog";

export default function AdminImportPanel({
  onDone,
}: {
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="panel spaced">
        <div className="panelhead system-tile-head">
          <div className="system-tile-heading">
            <span className="system-tile-icon"><FileUp size={17} aria-hidden="true" /></span>
            <div>
              <h3>Import records</h3>
              <span className="muted">
                Load a log on behalf of the whole team
              </span>
            </div>
          </div>
        </div>

        <div className="hint spacedbottom">
          <b>How this differs from the record pages</b>
          <br />
          • <b>Assigned To</b> is optional and matched against users by full name.
          <br />
          • Unknown or ambiguous assignee names leave the record unassigned and
          add a warning.
          <br />
          • <b>Accountable Person</b> values are ignored; records remain owned
          by the importer and accountability is set to them.
          <br />
          • On the Technical Assistance and Other Tasks pages, anyone can import
          records; each record remains owned by its importer.
          <br />
          • Only Technical Assistance and Other Tasks worksheets are processed;
          additional worksheets are ignored.
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            className="primary"
            onClick={() => setOpen(true)}
          >
            ⇧ Import Excel / CSV
          </button>

<a
  href="/templates/OpsTracker_Import_Template.xlsx"
  download
  className="secondary"
  style={{
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 14px",
  }}
>
  ⬇ Download Workbook Template
</a>

        </div>
      </section>

      {open && (
        <ImportDialog
          scope="admin"
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone?.();
          }}
        />
      )}
    </>
  );
}
