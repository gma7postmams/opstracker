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
              <h3>Administrative Record Import</h3>
              <span className="muted">
                Import Technical Assistance and Other Task records<br />
                for multiple users. Assigned To and Accountable Person<br />
                values from the workbook can be preserved.
              </span>
            </div>
          </div>
        </div>

        <div className="hint spacedbottom">
          <b>How this works</b>
          <ul className="admin-import-help-list">
            <li><b>Assigned To</b> is optional and matched against existing users.</li>
            <li><b>Accountable Person</b> is matched against existing users.</li>
            <li>Unknown or ambiguous user names generate warnings.</li>
            <li>If <b>Accountable Person</b> is blank or cannot be matched, the importing administrator becomes accountable.</li>
            <li>Technical Assistance and Other Tasks worksheets are supported.</li>
            <li>Additional worksheets are ignored.</li>
          </ul>
        </div>

        <div className="hint spacedbottom admin-import-notice">
          <b>Administration Import</b>
          <p>Designed for:</p>
          <ul>
            <li>Historical data migration</li>
            <li>Bulk record onboarding</li>
            <li>Team-wide imports</li>
          </ul>
          <p>Unlike &quot;Import My Records&quot;, this import can preserve Accountable Person values from the workbook.</p>
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
  ⬇ Download Admin Import Template
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
