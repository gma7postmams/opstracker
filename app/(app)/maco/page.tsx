"use client";

import { useState } from "react";
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
                    width: 90,
                    height: 90,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg,#2563eb,#7c3aed)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                    fontWeight: 700,
                    marginBottom: 20,
                    boxShadow:
                      "0 10px 30px rgba(99,102,241,.35)",
                  }}
                >
                  M
                </div>

                <h1
                  style={{
                    margin: 0,
                    fontSize: 42,
                    fontWeight: 700,
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

                <h3
                  style={{
                    marginBottom: 24,
                  }}
                >
                  What can I help you with today?
                </h3>

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
                    onClick={() =>
                      setQuestion(
                        "Did we encounter slow publishing before?"
                      )
                    }
                  >
                    📚 Historical Incidents
                  </button>

                  <button
                    className="secondary"
                    onClick={() =>
                      setQuestion(
                        "Show Adobe-related incidents."
                      )
                    }
                  >
                    🎬 Adobe Issues
                  </button>

                  <button
                    className="secondary"
                    onClick={() =>
                      setQuestion(
                        "Summarize support activity this month."
                      )
                    }
                  >
                    📈 Monthly Summary
                  </button>

                  <button
                    className="secondary"
                    onClick={() =>
                      setQuestion(
                        "How do I use Administrative Import?"
                      )
                    }
                  >
                    ⚙️ MAMS Workflow
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
                          maxWidth: "85%",
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
                            background: "#fff",
                            padding: "16px 20px",
                            borderRadius: 20,
                            border:
                              "1px solid rgba(0,0,0,.08)",
                            boxShadow:
                              "0 4px 20px rgba(0,0,0,.06)",
                            width: "100%",
                          }}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                          >
                            {msg.content}
                          </ReactMarkdown>
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
          line-height: 1.8;
        }

        .maco-markdown ul {
          padding-left: 24px;
        }

        .maco-markdown li {
          margin: 6px 0;
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
      `}</style>
    </div>
  );
}