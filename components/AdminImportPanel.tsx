"use client";

import { useState } from "react";
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
        <div className="panelhead">
          <div>
            <h3>Import records</h3>
            <span className="muted">
              Load a log on behalf of the whole team
            </span>
          </div>
        </div>

        <div className="hint spacedbottom">
          <b>How this differs from the record pages</b>
          <br />
          • <b>Assigned To</b> and <b>Accountable Person</b> can be supplied in
          the file, allowing rows to be attributed to different people.
          <br />
          • If either value is blank, the currently logged-in user will be used
          automatically.
          <br />
          • If those columns are not present in the file, the currently logged-in
          user will be used automatically.
          <br />
          • On the Technical Assistance and Other Tasks pages, anyone can import
          their own work and every row is logged under them.
          <br />
          • Either way, the records are owned by you, so you can correct them
          afterwards.
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
