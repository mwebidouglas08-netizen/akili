import { useState, useEffect, useRef, useCallback } from "react";

// ── Storage helper ────────────────────────────────────────────────────────────
const BOT_HISTORY_KEY = "akili_bot_history_v1";
const botStore = {
  get: (k, fb = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v)         => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k)            => { try { localStorage.removeItem(k); } catch {} },
};

// ── Quick reply suggestions ───────────────────────────────────────────────────
const SUGGESTIONS = {
  default: [
    "Help me find a job",
    "I need mental health support",
    "Help me write my CV",
    "What jobs match my skills?",
  ],
  wellness: [
    "I feel overwhelmed",
    "How do I manage stress?",
    "Siwezi kulala vizuri",
    "I need someone to talk to",
  ],
  career: [
    "Help me prepare for an interview",
    "How to negotiate salary?",
    "Review my CV",
    "What skills should I learn?",
  ],
};

// ── API call ──────────────────────────────────────────────────────────────────
async function sendToAI(messages, mode, user) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
      mode,
      user: user || { name: "Friend", skills: [], county: "Nairobi", mood: "good" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── Detect mode from message ──────────────────────────────────────────────────
function detectMode(text) {
  const t = text.toLowerCase();
  const wellnessWords = ["stress","overwhelm","sad","depressed","anxious","lonely","hopeless","mental","feeling","mood","help me cope","siwezi","nafsi","wellness","afya","struggling","tired","hurt"];
  const careerWords   = ["job","cv","resume","interview","salary","career","work","hire","apply","skills","employer","kazi","employment","internship","freelance"];
  const wScore = wellnessWords.filter(w => t.includes(w)).length;
  const cScore = careerWords.filter(w => t.includes(w)).length;
  if (wScore > cScore) return "wellness";
  if (cScore > wScore) return "career";
  return null; // keep current
}

// ════════════════════════════════════════════════════════════════════════════
// CHATBOT WIDGET
// ════════════════════════════════════════════════════════════════════════════
export default function Chatbot({ user, autoOpen = false }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState(() => botStore.get(BOT_HISTORY_KEY, []));
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [mode, setMode]         = useState("wellness");
  const [crisis, setCrisis]     = useState(false);
  const [unread, setUnread]     = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [typing, setTyping]     = useState(false);

  const msgsRef     = useRef(null);
  const inputRef    = useRef(null);
  const initialized = useRef(false);

  // Save history
  useEffect(() => {
    if (messages.length > 0) botStore.set(BOT_HISTORY_KEY, messages.slice(-50));
  }, [messages]);

  // Scroll to bottom
  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Initial greeting
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (messages.length === 0) {
      const name = user?.name || "friend";
      const mood = user?.mood || "good";
      const isTough = mood === "struggling" || mood === "low";
      const greeting = isTough
        ? `Habari ${name} 💙 I'm Akili — your AI companion. I can see today might be hard. I'm here to listen and help with both your wellness and career journey. What's on your mind?`
        : `Habari ${name}! 👋 I'm Akili — your personal AI assistant for jobs and wellness. I can help you find work, prepare for interviews, support your mental health, and more. How can I help you today?`;
      const msg = { role: "assistant", content: greeting, ts: Date.now() };
      setMessages([msg]);
    }
  }, []);

  // Track unread when closed
  useEffect(() => {
    if (!open) {
      const assistantMsgs = messages.filter(m => m.role === "assistant" && m.ts > (Date.now() - 5000));
      if (assistantMsgs.length > 0) setUnread(u => u + assistantMsgs.length);
    }
  }, [messages]);

  // Clear unread on open
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // Auto open if requested
  useEffect(() => {
    if (autoOpen) setTimeout(() => setOpen(true), 1500);
  }, [autoOpen]);

  const send = useCallback(async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setShowSuggestions(false);
    setTyping(false);

    // Auto-detect mode
    const detected = detectMode(text);
    const currentMode = detected || mode;
    if (detected) setMode(detected);

    const userMsg = { role: "user", content: text, ts: Date.now(), mode: currentMode };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    // Show typing indicator with small delay for realism
    await new Promise(r => setTimeout(r, 300));
    setTyping(true);

    try {
      const data = await sendToAI(updated, currentMode, user);
      setTyping(false);
      const botMsg = {
        role: "assistant",
        content: data.reply,
        ts: Date.now(),
        mode: currentMode,
      };
      setMessages([...updated, botMsg]);
      if (data.crisis) setCrisis(true);
    } catch (err) {
      setTyping(false);
      setError(err.message || "Something went wrong. Please try again.");
      setMessages(updated.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }, [messages, mode, input, loading, user]);

  const clearHistory = () => {
    botStore.del(BOT_HISTORY_KEY);
    setMessages([]);
    setCrisis(false);
    setShowSuggestions(true);
    initialized.current = false;
    setTimeout(() => {
      initialized.current = false;
      const name = user?.name || "friend";
      setMessages([{ role:"assistant", content:`Chat cleared! Hi again ${name} 👋 How can I help you?`, ts:Date.now() }]);
      initialized.current = true;
    }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const currentSuggestions = mode === "wellness" ? SUGGESTIONS.wellness
    : mode === "career" ? SUGGESTIONS.career
    : SUGGESTIONS.default;

  const modeColor = mode === "wellness" ? "#7C3AED" : "#0D9E75";
  const modeLabel = mode === "wellness" ? "Wellness" : "Career";

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Akili AI Chatbot"
        style={{
          position: "fixed",
          bottom: 88,
          right: 16,
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: open ? "#374151" : "linear-gradient(135deg, #0D9E75, #059669)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(13,158,117,0.4), 0 2px 8px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9998,
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "scale(0.92)" : "scale(1)",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.transform = "scale(1)"; }}
      >
        {/* Icon: chat when closed, X when open */}
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}

        {/* Unread badge */}
        {!open && unread > 0 && (
          <div style={{
            position: "absolute", top: -4, right: -4,
            width: 20, height: 20, borderRadius: "50%",
            background: "#EF4444", color: "#fff",
            fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
            fontFamily: "'Sora', sans-serif",
          }}>
            {unread > 9 ? "9+" : unread}
          </div>
        )}

        {/* Pulse ring when closed */}
        {!open && (
          <div style={{
            position: "absolute",
            width: "100%", height: "100%",
            borderRadius: "50%",
            border: "2px solid rgba(13,158,117,0.4)",
            animation: "chatPulse 2.5s ease-out infinite",
          }} />
        )}
      </button>

      {/* ── Chat Window ── */}
      <div style={{
        position: "fixed",
        bottom: 158,
        right: 12,
        width: "min(380px, calc(100vw - 24px))",
        height: "min(560px, calc(100vh - 180px))",
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 9997,
        fontFamily: "'Sora', sans-serif",
        transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        transformOrigin: "bottom right",
        transform: open ? "scale(1) translateY(0)" : "scale(0.85) translateY(20px)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "all" : "none",
        border: "1px solid #E2E8F0",
      }}>

        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #0D1117 0%, #0D3D2E 100%)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}>
          {/* Avatar with status dot */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg, #0D9E75, #059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, boxShadow: "0 2px 8px rgba(13,158,117,0.4)",
            }}>🤖</div>
            <div style={{
              position: "absolute", bottom: 1, right: 1,
              width: 11, height: 11, borderRadius: "50%",
              background: "#22C55E", border: "2px solid #0D1117",
            }} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Akili AI</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
              Online · {messages.length > 1 ? `${messages.length} messages` : "Ready to help"}
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 4px" }}>
            {["wellness","career"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "4px 10px",
                borderRadius: 16,
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: mode === m ? modeColor : "transparent",
                color: mode === m ? "#fff" : "rgba(255,255,255,0.5)",
                transition: "all 0.2s",
                textTransform: "capitalize",
                fontFamily: "'Sora', sans-serif",
              }}>{m}</button>
            ))}
          </div>

          {/* Clear button */}
          <button onClick={clearHistory} title="Clear chat" style={{
            background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8,
            color: "rgba(255,255,255,0.4)", fontSize: 12, padding: "5px 8px",
            cursor: "pointer", flexShrink: 0, fontFamily: "'Sora', sans-serif",
          }}>🗑</button>
        </div>

        {/* ── Crisis Banner ── */}
        {crisis && (
          <div style={{
            background: "#FEF2F2", borderBottom: "1px solid #FECACA",
            padding: "8px 14px", fontSize: 12, color: "#DC2626", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <span>🆘</span>
            <span>Call <strong>+254 722 178 177</strong> — Befrienders Kenya (free, 24/7)</span>
          </div>
        )}

        {/* ── Messages ── */}
        <div ref={msgsRef} style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "#F8FAFC",
        }}>

          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              flexDirection: m.role === "user" ? "row-reverse" : "row",
              animation: "msgIn 0.25s ease",
            }}>
              {/* Avatar */}
              {m.role === "assistant" && (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg, #0D9E75, #059669)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, flexShrink: 0,
                }}>🤖</div>
              )}

              <div style={{ maxWidth: "78%" }}>
                {/* Mode tag for bot messages */}
                {m.role === "assistant" && m.mode && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: m.mode === "wellness" ? "#7C3AED" : "#0D9E75", marginBottom: 3, paddingLeft: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {m.mode === "wellness" ? "🧠 Wellness" : "💼 Career"}
                  </div>
                )}

                {/* Bubble */}
                <div style={{
                  padding: "10px 13px",
                  borderRadius: 16,
                  fontSize: 13,
                  lineHeight: 1.6,
                  ...(m.role === "user" ? {
                    background: "#0D9E75",
                    color: "#fff",
                    borderBottomRightRadius: 4,
                  } : {
                    background: "#fff",
                    border: "1px solid #E2E8F0",
                    color: "#0F172A",
                    borderBottomLeftRadius: 4,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }),
                }}>
                  {m.content.split("\n").map((line, j) => (
                    <p key={j} style={{ margin: j > 0 ? "5px 0 0" : 0 }}>{line}</p>
                  ))}
                </div>

                {/* Timestamp */}
                <div style={{
                  fontSize: 10, color: "#94A3B8", marginTop: 3,
                  textAlign: m.role === "user" ? "right" : "left",
                }}>
                  {new Date(m.ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {(loading || typing) && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", animation: "msgIn 0.25s ease" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #0D9E75, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🤖</div>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, borderBottomLeftRadius: 4, padding: "12px 16px", display: "flex", gap: 5, alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#94A3B8", animation: "typingBounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && messages.length <= 1 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8, fontWeight: 600 }}>Quick start:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {currentSuggestions.map((s, i) => (
                  <button key={i} onClick={() => { setShowSuggestions(false); send(s); }} style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: "1.5px solid #E2E8F0",
                    background: "#fff",
                    color: "#374151",
                    textAlign: "left",
                    transition: "all 0.15s",
                    fontFamily: "'Sora', sans-serif",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#0D9E75"; e.currentTarget.style.color = "#0D9E75"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#374151"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Error bar ── */}
        {error && (
          <div style={{
            background: "#FEF3C7", borderTop: "1px solid #FCD34D",
            padding: "8px 14px", fontSize: 11, color: "#92400E",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          }}>
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#92400E", fontWeight: 700, fontSize: 14 }}>✕</button>
          </div>
        )}

        {/* ── Quick replies after conversation starts ── */}
        {messages.length > 1 && !loading && (
          <div style={{ padding: "6px 12px 0", display: "flex", gap: 5, overflowX: "auto", flexShrink: 0, background: "#F8FAFC", borderTop: "1px solid #F1F5F9" }}>
            {(mode === "wellness" ? SUGGESTIONS.wellness : SUGGESTIONS.career).slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => send(s)} disabled={loading} style={{
                padding: "4px 10px", borderRadius: 14, fontSize: 11, fontWeight: 500,
                cursor: "pointer", border: "1px solid #E2E8F0", background: "#fff",
                color: "#64748B", whiteSpace: "nowrap", flexShrink: 0,
                transition: "all 0.15s", fontFamily: "'Sora', sans-serif", opacity: loading ? 0.5 : 1,
              }}>{s}</button>
            ))}
          </div>
        )}

        {/* ── Input ── */}
        <div style={{
          padding: "10px 12px",
          background: "#fff",
          borderTop: "1px solid #E2E8F0",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Akili is thinking…" : "Type your message…"}
            disabled={loading}
            rows={1}
            style={{
              flex: 1,
              border: "1.5px solid #E2E8F0",
              borderRadius: 12,
              padding: "9px 13px",
              fontSize: 13,
              outline: "none",
              resize: "none",
              background: "#F8FAFC",
              color: "#0F172A",
              lineHeight: 1.5,
              fontFamily: "'Sora', sans-serif",
              transition: "border 0.2s",
              minHeight: 38,
              maxHeight: 80,
              overflow: "auto",
              opacity: loading ? 0.7 : 1,
            }}
            onFocus={e => e.target.style.borderColor = "#0D9E75"}
            onBlur={e => e.target.style.borderColor = "#E2E8F0"}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{
              width: 38, height: 38,
              borderRadius: "50%",
              background: input.trim() && !loading ? "#0D9E75" : "#E2E8F0",
              border: "none",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.2s",
              boxShadow: input.trim() && !loading ? "0 2px 8px rgba(13,158,117,0.35)" : "none",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={input.trim() && !loading ? "#fff" : "#94A3B8"}>
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "5px 14px 8px",
          background: "#fff",
          textAlign: "center",
          fontSize: 10,
          color: "#CBD5E1",
          flexShrink: 0,
          fontFamily: "'Sora', sans-serif",
        }}>
          Powered by Akili AI · Free & private
        </div>
      </div>

      {/* ── Animations ── */}
      <style>{`
        @keyframes chatPulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
