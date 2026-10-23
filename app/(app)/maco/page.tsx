"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: SourceReference[];
};

type SourceReference = {
  source: string;
  references: string[];
};

const helperSuggestions = [
  "Which incidents changed status this week?",
  "What tasks are overdue, and who owns them?",
  "Summarize this week's activity by incident status.",
  "What changes appear in today's audit history?",
];

const loadingStatuses = [
  "Searching OpsTracker records...",
  "Reviewing historical incidents...",
  "Analyzing task activity...",
  "Investigating audit history...",
  "Preparing operational insights...",
];

export default function MACOPage() {
  const { data: session } = useSession();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [macoEnabled, setMacoEnabled] = useState<boolean | null>(null);
  const [loadingStatusIndex, setLoadingStatusIndex] = useState(0);
  const [typedGreeting, setTypedGreeting] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggestionVisible, setSuggestionVisible] = useState(true);

  const [copiedIndex, setCopiedIndex] =
    useState<number | null>(null);  

  const [aiStatus, setAiStatus] = useState({
    model: "",
    url: "",
    online: false,
  });    

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 18
      ? "Good afternoon"
      : "Good evening";

  useEffect(() => {
    let revealTimer: number | undefined;
    const rotationTimer = window.setInterval(() => {
      setSuggestionVisible(false);
      revealTimer = window.setTimeout(() => {
        setSuggestionIndex((current) => (current + 1) % helperSuggestions.length);
        setSuggestionVisible(true);
      }, 220);
    }, 5000);

    return () => {
      window.clearInterval(rotationTimer);
      if (revealTimer !== undefined) {
        window.clearTimeout(revealTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (!loading) return;

    setLoadingStatusIndex(0);
    const timer = window.setInterval(() => {
      setLoadingStatusIndex((current) => (current + 1) % loadingStatuses.length);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    const fullGreeting = `${greeting}, Eugene 👋`;
    const characters = Array.from(fullGreeting);
    const duration = 1200;
    const startedAt = performance.now();

    const timer = window.setInterval(() => {
      const progress = Math.min((performance.now() - startedAt) / duration, 1);
      setTypedGreeting(characters.slice(0, Math.ceil(progress * characters.length)).join(""));

      if (progress === 1) {
        window.clearInterval(timer);
      }
    }, 40);

    return () => window.clearInterval(timer);
  }, [greeting]);

  useEffect(() => {
    async function loadFeatures() {
      try {
        const response = await fetch("/api/features");
        const features = await response.json();
        setMacoEnabled(response.ok && features.macoEnabled === true);
      } catch {
        setMacoEnabled(false);
      }
    }

    loadFeatures();
  }, []);

  useEffect(() => {
    if (session?.user.role !== "ADMIN") return;

    async function loadAIStatus() {
      try {
        const settingsResponse = await fetch("/api/admin/ai");
        const settings = await settingsResponse.json();
        if (!settingsResponse.ok) return;

        const testResponse = await fetch("/api/admin/ai/test");
        const status = await testResponse.json();
        setAiStatus({
          model: settings.maco?.model ?? "Unknown",
          url: settings.url ?? "",
          online: testResponse.ok && (status.success ?? status.ok ?? false),
        });
      } catch {
        setAiStatus({ model: "Unknown", url: "", online: false });
      }
    }

    loadAIStatus();
  }, [session?.user.role]);

  async function askMACO() {

    if (!question.trim() || loading) return;

    const userQuestion = question;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userQuestion,
      },
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/api/maco/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          message: userQuestion,
          history: messages.slice(-10),
        }),

      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.answer ??
            "No response received.",
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Failed to contact MACO.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (macoEnabled === null) {
    return <div className="page maco-page" />;
  }

  if (!macoEnabled) {
    return <div className="page maco-page">MACO is currently disabled by an administrator.</div>;
  }

  return (
    <div className="page maco-page">
        <section className="maco-workspace">
          <div className="maco-chat-area">
            {messages.length === 0 ? (
              <div className="maco-welcome">
                <div className="maco-logo">✦</div>
                <h1 className="maco-title">MACO</h1>
                <p className="muted maco-subtitle">
                  MAMS Support Operations Tracker Copilot
                </p>
                <h2 className="maco-greeting">{typedGreeting}</h2>
                <p
                  className={`muted helper-suggestion${suggestionVisible ? "" : " is-hidden"}`}
                >
                  {helperSuggestions[suggestionIndex]}
                </p>
                <p className="muted maco-intro">
                  Welcome back. I can help you investigate incidents,
                  search historical records, analyze operational data,
                  answer workflow questions, and provide insights from
                  OpsTracker.
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent:
                        msg.role === "user"
                          ? "flex-end"
                          : "flex-start",
                      marginBottom: 30,
                    }}
                  >
                    {msg.role === "user" ? (
                      <div className="maco-user-message">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="maco-assistant-message">
                        <div
                          className="maco-markdown"
                        >
                          <div
                            className="maco-assistant-content"
                          >
                            <div className="maco-assistant-label">
                              <span className="maco-assistant-spark">✦</span>
                              MACO
                            </div>
                            <div id={`maco-response-${index}`}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            {msg.sources?.length ? (
                              <div className="maco-sources" aria-label="Response sources">
                                <span className="maco-sources-label">Sources</span>
                                {msg.sources.map((source) => (
                                  <span className="maco-source" key={source.source}>
                                    <strong>{source.source}</strong>
                                    {source.references.length > 0 && ` · ${source.references.join(", ")}`}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-start",
                                marginTop: 40,
                                paddingTop: 14,
                                borderTop: "1px solid var(--line)",
                              }}
                            >
                              <button
                                className={
                                  copiedIndex === index
                                    ? "copy-action copied"
                                    : "copy-action"
                                }
                                title="Copy response"
                                onClick={() => {
                                  try {
                                    const element =
                                      document.getElementById(
                                        `maco-response-${index}`
                                      );

                                    const text =
                                      element?.innerText ??
                                      msg.content;

                                    if (navigator?.clipboard?.writeText) {
                                      navigator.clipboard.writeText(text);
                                    } else {
                                      const textarea =
                                        document.createElement("textarea");

                                      textarea.value = text;

                                      document.body.appendChild(textarea);

                                      textarea.select();

                                      document.execCommand("copy");

                                      document.body.removeChild(textarea);
                                    }

                                    setCopiedIndex(index);

                                    setTimeout(() => {
                                      setCopiedIndex(null);
                                    }, 2000);
                                  } catch (err) {
                                    console.error(
                                      "Copy failed:",
                                      err
                                    );
                                  }
                                }}
                              >
                                <span>
                                  {copiedIndex === index
                                    ? "✓"
                                    : "⧉"}
                                </span>

                                {copiedIndex === index
                                  ? " Copied"
                                  : " Copy"}
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      marginBottom: 30,
                    }}
                  >
                    <div className="maco-assistant-message maco-pending">
                      <div className="maco-assistant-label">
                        <span className="maco-assistant-spark">✦</span>
                        MACO
                      </div>
                      <div className="maco-loading-card">
                        <p className="maco-loading-status" aria-live="polite">
                          {loadingStatuses[loadingStatusIndex]}
                        </p>
                        <div className="typing">
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* INPUT */}
          <div className="maco-composer-area">

            {session?.user.role === "ADMIN" && <div
              className="maco-status"
          >

            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  aiStatus.online
                    ? "#10b981"
                    : "#ef4444",
                display: "inline-block",
                boxShadow:
                  aiStatus.online
                    ? "0 0 8px rgba(16,185,129,.5)"
                    : "0 0 8px rgba(239,68,68,.5)",
              }}
            />

            <span>
              {aiStatus.online
                ? "Online"
                : "Offline"}
            </span>

            <span>•</span>

            <span
              title={`Server: ${aiStatus.url}`}
              style={{
                fontWeight: 600,
              }}
            >
              {aiStatus.model}
            </span>
          </div>}


            <div
              className="maco-composer"
            >
              <textarea
                rows={2}
                value={question}
                onChange={(e) =>
                  setQuestion(e.target.value)
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    askMACO();
                  }
                }}
                placeholder="Ask MACO anything..."
                className="maco-input"
              />

              <button
                className="primary maco-send"
                onClick={askMACO}
                disabled={loading}
              >
                ➜ Send
              </button>
            </div>
          </div>
        </section>

      <style jsx>{`
        .maco-page {
          padding-top: 20px;
          padding-bottom: 20px;
        }

        .maco-workspace {
          width: 100%;
          max-width: 1080px;
          height: calc(100vh - 124px);
          min-height: 560px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }

        .maco-chat-area {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 12px 24px 28px;
        }

        .maco-user-message {
          max-width: 75%;
          padding: 13px 17px;
          border: 1px solid var(--line);
          border-radius: 18px 18px 4px 18px;
          background: var(--panel);
          color: var(--text);
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .maco-assistant-message {
          width: 100%;
          max-width: 820px;
          color: var(--text);
        }

        .maco-assistant-content {
          padding-left: 2px;
        }

        .maco-sources {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px 12px;
          margin-top: 18px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .maco-sources-label {
          color: var(--text);
          font-weight: 600;
        }

        .maco-source {
          overflow-wrap: anywhere;
        }

        .maco-assistant-label {
          display: flex;
          align-items: center;
          gap: 7px;
          margin: 0 0 12px;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }

        .maco-assistant-spark {
          color: var(--accent);
        }

        .maco-welcome {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 36px 0 56px;
        }

        .maco-logo {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          margin-bottom: 28px;
          border-radius: 17px;
          background: var(--accent);
          color: #fff;
          font-size: 27px;
          font-weight: 700;
          animation: breathe 4s ease-in-out infinite;
        }

        .maco-title {
          margin: 0;
          color: var(--text);
          font-size: 36px;
          font-weight: 600;
          line-height: 1.1;
        }

        .maco-subtitle {
          margin-top: 8px;
          margin-bottom: 0;
          font-size: 14px;
        }

        .maco-greeting {
          margin-top: 56px;
          margin-bottom: 16px;
          color: var(--text);
          font-family: Georgia, "Times New Roman", serif;
          font-size: 34px;
          font-weight: 400;
          line-height: 1.2;
        }

        .helper-suggestion {
          min-height: 1.5em;
          margin: 0 0 36px;
          color: var(--muted);
          font-size: 15px;
          transition: opacity 220ms ease;
        }

        .helper-suggestion.is-hidden {
          opacity: 0;
        }

        .maco-intro {
          max-width: 620px;
          margin: 0;
          font-size: 15px;
          line-height: 1.8;
        }

        .maco-composer-area {
          flex: none;
          padding: 26px 24px 8px;
        }

        .maco-status {
          max-width: 820px;
          margin: 0 auto 9px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 8px;
          padding-right: 4px;
          color: var(--muted);
          font-size: 12px;
        }

        .maco-composer {
          max-width: 820px;
          min-height: 90px;
          margin: 0 auto;
          display: flex;
          align-items: flex-end;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--line2);
          border-radius: 20px;
          background: var(--panel);
          box-shadow: 0 8px 28px rgba(16, 24, 40, 0.09);
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }

        .maco-composer:focus-within {
          border-color: var(--accent);
          box-shadow: 0 8px 28px rgba(16, 24, 40, 0.12);
        }

        .maco-input {
          flex: 1;
          min-width: 0;
          min-height: 62px;
          resize: none;
          padding: 12px 10px;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--text);
          font-size: 16px;
          line-height: 1.55;
        }

        .maco-input::placeholder {
          color: var(--muted);
        }

        .maco-send {
          min-width: 104px;
          height: 48px;
          border-radius: 13px !important;
        }

        .maco-loading-card {
          padding: 4px 0;
          background: transparent;
        }

        .maco-loading-status {
          margin: 0 0 10px;
          color: var(--muted);
          font-size: 14px;
        }

        .maco-pending .maco-assistant-label {
          margin-bottom: 5px;
        }

        @keyframes breathe {
          0%,
          100% {
            transform: scale(1);
          }

          50% {
            transform: scale(1.025);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .maco-logo {
            animation: none;
          }

          .helper-suggestion {
            transition: none;
          }
        }

        .typing {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
          animation: bounce 1.4s infinite;
        }

        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: scale(0.6);
            opacity: 0.4;
          }

          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .maco-markdown h1,
        .maco-markdown h2,
        .maco-markdown h3 {
          margin-top: 16px;
          margin-bottom: 8px;
        }

        .maco-markdown p {
          line-height: 1.75;
          margin-top: 0;
          margin-bottom: 14px;
        }

        .maco-markdown ul {
          padding-left: 22px;
        }

        .maco-markdown li {
          margin-bottom: 6px;
        }

        .maco-markdown li::marker {
          color: #6b7280;
        }

        .maco-markdown h1 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .maco-markdown h2 {
          font-size: 20px;
          font-weight: 700;
          margin-top: 24px;
        }

        .maco-markdown h3 {
          font-size: 18px;
          font-weight: 600;
        }


        .maco-markdown code {
          background: var(--code-bg);
          color: var(--text);
          padding: 2px 6px;
          border-radius: 6px;
        }

        .maco-markdown pre {
          background: var(--code-bg);
          color: var(--text);
          padding: 16px;
          border-radius: 12px;
          overflow-x: auto;
        }

        .maco-markdown {
          max-width: 900px;
          color: var(--text);
        }

        @media (max-width: 700px) {
          .maco-page {
            padding: 14px;
          }

          .maco-workspace {
            height: calc(100dvh - 112px);
            min-height: 520px;
          }

          .maco-chat-area {
            padding: 4px 4px 20px;
          }

          .maco-user-message {
            max-width: 88%;
            padding: 11px 14px;
          }

          .maco-welcome {
            padding: 28px 4px 44px;
          }

          .maco-greeting {
            margin-top: 44px;
            margin-bottom: 14px;
            font-size: 30px;
          }

          .maco-intro {
            font-size: 14px;
          }

          .maco-composer-area {
            padding: 20px 0 2px;
          }

          .maco-composer {
            min-height: 78px;
            gap: 6px;
            padding: 8px;
            border-radius: 17px;
          }

          .maco-input {
            min-height: 58px;
            font-size: 15px;
          }

          .maco-send {
            min-width: 82px;
            height: 44px;
            padding: 8px !important;
          }
        }

      `}</style>
    </div>
  );
}