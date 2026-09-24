export default function MACOPage() {
  return (
    <div className="page">

      <section className="panel spaced">
        <div className="panelhead">
          <div>
            <h3>🤖 MACO</h3>
            <span className="muted">
              MAMS Support Operations Tracker Copilot
            </span>
          </div>
        </div>

        <div className="empty">
          <b>Hello, I'm MACO.</b>

          <br /><br />

          I can help you with:

          <ul style={{ marginTop: 12 }}>
            <li>Historical incidents</li>
            <li>Technical Assistance records</li>
            <li>Other Tasks records</li>
            <li>MAMS workflows</li>
            <li>Technical troubleshooting</li>
          </ul>
        </div>
      </section>

      <section className="panel spaced">
        <div className="panelhead">
          <h3>Suggested Questions</h3>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <button className="secondary">
            Did we encounter slow publishing before?
          </button>

          <button className="secondary">
            Show Adobe-related incidents.
          </button>

          <button className="secondary">
            Summarize support activity this month.
          </button>

          <button className="secondary">
            How do I use Administrative Import?
          </button>
        </div>
      </section>

      <section className="panel spaced">
        <div className="panelhead">
          <h3>Ask MACO</h3>
        </div>

        <textarea
          rows={5}
          placeholder="Ask MACO anything..."
        />

        <div style={{ marginTop: 12 }}>
          <button className="primary">
            Ask MACO
          </button>
        </div>
      </section>

    </div>
  );
}