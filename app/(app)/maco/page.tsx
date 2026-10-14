"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function MACOPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

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
      async function loadAIStatus() {
        try {
          const res =
            await fetch("/api/admin/ai");

          const settings =
            await res.json();

          const test =
            await fetch("/api/admin/ai/test");

          const status =
            await test.json();

          setAiStatus({
            model:
              settings.maco?.model ??
              "Unknown",
            url:
              settings.url ?? "",
            online:
              status.success ??
              status.ok ??
              false,
          });
        } catch {
          setAiStatus({
            model: "Unknown",
            url: "",
            online: false,
          });
        }
      }

      loadAIStatus();
    }, []);          

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

  return (
    <div className="page">
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <section
          className="panel"
          style={{
            height: "calc(100vh - 180px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 24,
          }}
        >
          {/* CHAT AREA */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 32,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 28,
                  background:
                    "linear-gradient(135deg,#2563eb,#7c3aed)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 42,
                  fontWeight: 700,
                  marginBottom: 24,
                  boxShadow:
                    "0 12px 32px rgba(99,102,241,.35)",
                }}
              >
                ✦
              </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: 64,
                    fontWeight: 300,
                    letterSpacing: "-0.06em",
                  }}
                >
                  MACO
                </h1>

                <p
                  className="muted"
                  style={{
                    marginTop: 10,
                    marginBottom: 28,
                    fontSize: 16,
                  }}
                >
                  MAMS Support Operations Tracker Copilot
                </p>

                <h2
                  style={{
                    margin: 0,
                    marginBottom: 12,
                    fontSize: 42,
                    fontFamily: "var(--font-caveat)",
                    fontWeight: 600,
                    color: "#4f46e5",
                  }}
                >
                  {greeting}, Eugene 👋
                </h2>

                <p
                  className="muted"
                  style={{
                    maxWidth: 680,
                    marginBottom: 32,
                    fontSize: 18,
                    lineHeight: 1.8,
                  }}
                >
                  Welcome back. I can help you investigate incidents,
                  search historical records, analyze operational data,
                  answer workflow questions, and provide insights from
                  OpsTracker.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    justifyContent: "center",
                    maxWidth: 700,
                  }}
                >

                <button
                  className="secondary"
                  style={{
                    width: 240,
                    textAlign: "left",
                    padding: 16,
                    borderRadius: 16,
                  }}
                  onClick={() =>
                    setQuestion(
                      "Did we encounter slow publishing before?"
                    )
                  }
                >
                  <strong>📚 Historical Incidents</strong>
                  <br />
                  Search previous support issues
                </button>

                <button
                  className="secondary"
                  style={{
                    width: 240,
                    textAlign: "left",
                    padding: 16,
                    borderRadius: 16,
                  }}
                  onClick={() =>
                    setQuestion(
                      "Show Adobe-related incidents."
                    )
                  }
                >
                  <strong>🎬 Adobe Issues</strong>
                  <br />
                  Find Adobe, Premiere, and Media Encoder issues
                </button>

                <button
                  className="secondary"
                  style={{
                    width: 240,
                    textAlign: "left",
                    padding: 16,
                    borderRadius: 16,
                  }}
                  onClick={() =>
                    setQuestion(
                      "Summarize support activity this month."
                    )
                  }
                >
                  <strong>📈 Monthly Summary</strong>
                  <br />
                  Review incidents, tasks, and activities
                </button>

                <button
                  className="secondary"
                  style={{
                    width: 240,
                    textAlign: "left",
                    padding: 16,
                    borderRadius: 16,
                  }}
                  onClick={() =>
                    setQuestion(
                      "How do I use Administrative Import?"
                    )
                  }
                >
                  <strong>⚙️ MAMS Workflow</strong>
                  <br />
                  Learn workflows and troubleshooting steps
                </button>

                </div>
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
                      marginBottom: 24,
                    }}
                  >
                    {msg.role === "user" ? (
                      <div
                        style={{
                          maxWidth: "75%",
                          background:
                            "linear-gradient(135deg,#2563eb,#7c3aed)",
                          color: "#fff",
                          padding: "14px 18px",
                          borderRadius: 20,
                          lineHeight: 1.7,
                          boxShadow:
                            "0 4px 20px rgba(37,99,235,.3)",
                        }}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          maxWidth: "100%",
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background:
                              "linear-gradient(135deg,#2563eb,#7c3aed)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          M
                        </div>

                        <div
                          className="maco-markdown"
                          style={{
                            width: "100%",
                            padding: 0,
                            background: "transparent",
                          }}
                        >
                          <div
                            style={{
                              paddingLeft: 12,
                            }}
                          >
                            <div id={`maco-response-${index}`}>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-start",
                                marginTop: 40,
                                paddingTop: 14,
                                borderTop: "1px solid rgba(0,0,0,.08)",
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
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg,#2563eb,#7c3aed)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        M
                      </div>

                      <div
                        style={{
                          background: "#fff",
                          padding: "16px 20px",
                          borderRadius: 20,
                          border:
                            "1px solid rgba(0,0,0,.08)",
                          boxShadow:
                            "0 4px 20px rgba(0,0,0,.06)",
                        }}
                      >
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
          <div
            style={{
              padding: 20,
              borderTop:
                "1px solid rgba(0,0,0,.08)",
              background: "#fafafa",
            }}
          >

          <div
            style={{
              maxWidth: 900,
              margin: "0 auto 10px auto",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#64748b",
              paddingRight: 150,
            }}
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
          </div>


            <div
              style={{
                display: "flex",
                gap: 12,
                maxWidth: 900,
                margin: "0 auto",
              }}
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
                style={{
                  flex: 1,
                  resize: "none",
                  padding: 16,
                  borderRadius: 18,
                  border:
                    "1px solid rgba(0,0,0,.08)",
                  fontSize: 15,
                }}
              />

              <button
                className="primary"
                onClick={askMACO}
                disabled={loading}
                style={{
                  minWidth: 120,
                  height: 52,
                  borderRadius: 16,
                }}
              >
                ➜ Send
              </button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .typing {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #6366f1;
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
          line-height: 1.7;
          margin-bottom: 10px;
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
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 6px;
        }

        .maco-markdown pre {
          background: #111827;
          color: white;
          padding: 16px;
          border-radius: 12px;
          overflow-x: auto;
        }

        .maco-markdown {
          max-width: 900px;
        }        


      `}</style>
    </div>
  );
}