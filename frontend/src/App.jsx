import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Machakos","Meru","Nyeri","Kisii","Garissa","Kakamega","Other"];
const SKILLS   = ["Sales","Customer service","Data entry","Graphic design","Social media","Driving","Cooking","Tailoring","Construction","Teaching","IT / Tech","Farming","Writing","Healthcare","Accounting"];
const MOODS    = [
  { key:"great",      emoji:"😄", label:"Great" },
  { key:"good",       emoji:"😊", label:"Good" },
  { key:"okay",       emoji:"😐", label:"Okay" },
  { key:"low",        emoji:"😔", label:"Low" },
  { key:"struggling", emoji:"😟", label:"Struggling" },
];
const QUICK_WELLNESS = ["I feel overwhelmed","Siwezi kulala vizuri","How do I manage stress?","I need someone to talk to","I feel hopeless about my future"];
const QUICK_CAREER   = ["Help me write my CV","Mock interview practice","What jobs suit my skills?","How do I negotiate salary?","Help me prepare for an interview"];
const STORAGE_KEY    = "akili_user_data";
const HISTORY_KEY    = "akili_chat_history";
const MOOD_LOG_KEY   = "akili_mood_log";

// ── Persistence helpers ────────────────────────────────────────────────────────
const storage = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  clear: (key) => { try { localStorage.removeItem(key); } catch {} },
};

// ── API helper ─────────────────────────────────────────────────────────────────
async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  card: { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"1.25rem" },
  label: { fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-muted)" },
  btnPrimary: { background:"var(--teal)", color:"#fff", border:"none", borderRadius:"var(--radius-pill)", padding:"12px 32px", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnGhost: { background:"transparent", border:"1px solid var(--border)", borderRadius:"var(--radius-pill)", padding:"8px 20px", fontSize:13, fontWeight:500, cursor:"pointer", color:"var(--text)" },
};

// ════════════════════════════════════════════════════════════════════════════
// SPLASH
// ════════════════════════════════════════════════════════════════════════════
function Splash({ onStart, hasSavedUser }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0D1117", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem", textAlign:"center" }}>
      <div style={{ fontFamily:"'Space Mono',monospace", fontSize:52, fontWeight:700, color:"#fff", letterSpacing:-2, marginBottom:6 }}>
        aki<span style={{ color:"var(--teal)" }}>li</span>
      </div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:"2.5rem" }}>
        Kazi · Afya · Matumaini
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, maxWidth:420, width:"100%", marginBottom:"2.5rem" }}>
        {[{ icon:"💼", title:"Akili Kazi", sub:"AI job matching for youth" }, { icon:"🧠", title:"Akili Afya", sub:"Mental wellness companion" }].map((c) => (
          <div key={c.title} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"var(--radius)", padding:"1.5rem", textAlign:"left" }}>
            <div style={{ fontSize:26, marginBottom:8 }}>{c.icon}</div>
            <div style={{ fontSize:15, fontWeight:600, color:"#fff", marginBottom:4 }}>{c.title}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <button onClick={() => onStart(false)} style={{ ...S.btnPrimary, padding:"14px 44px", fontSize:15 }}>
        Anza sasa — Get Started
      </button>
      {hasSavedUser && (
        <button onClick={() => onStart(true)} style={{ marginTop:12, background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer", textDecoration:"underline" }}>
          Continue where I left off
        </button>
      )}
      <div style={{ fontSize:12, color:"rgba(255,255,255,0.2)", marginTop:14 }}>Free · Kiswahili & English · Works on all phones</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════════
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:"", age:"", county:"", skills:[], mood:"good", moodEmoji:"😊", moodLabel:"Good" });

  const next = () => setStep((s) => s + 1);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSkill = (s) => set("skills", form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s]);

  const steps = [
    <Step key="name" q={<>Habari! What's your <A>name</A>?</>}>
      <input style={OInput} placeholder="Enter your name…" value={form.name} onChange={(e) => set("name", e.target.value)} onKeyDown={(e) => e.key==="Enter" && form.name.trim() && next()} autoFocus />
      <OBtn onClick={next} disabled={!form.name.trim()}>Next →</OBtn>
    </Step>,

    <Step key="age" q={<>How old are <A>you</A>?</>}>
      <input style={OInput} type="number" min="15" max="35" placeholder="Your age…" value={form.age} onChange={(e) => set("age", e.target.value)} onKeyDown={(e) => e.key==="Enter" && form.age && next()} autoFocus />
      <OBtn onClick={next} disabled={!form.age}>Next →</OBtn>
    </Step>,

    <Step key="county" q={<>Where are you <A>based</A>?</>}>
      <Chips items={COUNTIES} selected={[form.county]} single onToggle={(v) => set("county", v)} />
      <OBtn onClick={next} disabled={!form.county}>Next →</OBtn>
    </Step>,

    <Step key="skills" q={<>What are your <A>skills</A>? <span style={{ fontSize:14, color:"rgba(255,255,255,0.4)" }}>(pick all that apply)</span></>}>
      <Chips items={SKILLS} selected={form.skills} onToggle={toggleSkill} />
      <OBtn onClick={next}>Next →</OBtn>
    </Step>,

    <Step key="mood" q={<>How are you <A>feeling</A> today?</>}>
      <Chips items={MOODS.map((m) => `${m.emoji} ${m.label}`)} selected={[`${form.moodEmoji} ${form.moodLabel}`]} single
        onToggle={(v) => {
          const m = MOODS.find((x) => `${x.emoji} ${x.label}` === v);
          if (m) setForm((f) => ({ ...f, mood:m.key, moodEmoji:m.emoji, moodLabel:m.label }));
        }} />
      <OBtn onClick={() => onComplete(form)} style={{ marginTop:20 }}>Enter Akili →</OBtn>
    </Step>,
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0D1117", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
      <div style={{ maxWidth:480, width:"100%" }}>
        <div style={{ display:"flex", gap:6, marginBottom:"2rem" }}>
          {steps.map((_, i) => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background: i <= step ? "var(--teal)" : "rgba(255,255,255,0.15)", transition:"background 0.2s" }} />)}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}
const OInput = { width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"var(--radius-sm)", padding:"13px 16px", fontSize:15, color:"#fff", outline:"none", marginBottom:14, fontFamily:"'Sora',sans-serif" };
function Step({ q, children }) { return <div><div style={{ fontSize:22, fontWeight:600, color:"#fff", marginBottom:20, lineHeight:1.35 }}>{q}</div>{children}</div>; }
function A({ children }) { return <span style={{ color:"var(--teal)" }}>{children}</span>; }
function OBtn({ onClick, disabled, children, style={} }) { return <button onClick={onClick} disabled={disabled} style={{ ...S.btnPrimary, opacity:disabled?0.4:1, marginTop:8, ...style }}>{children}</button>; }
function Chips({ items, selected, onToggle, single }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
      {items.map((item) => {
        const active = selected.includes(item);
        return <button key={item} onClick={() => onToggle(item)} style={{ padding:"8px 16px", borderRadius:"var(--radius-pill)", fontSize:13, border: active?"1px solid var(--teal)":"1px solid rgba(255,255,255,0.15)", background: active?"var(--teal)":"rgba(255,255,255,0.05)", color: active?"#fff":"rgba(255,255,255,0.7)", cursor:"pointer", transition:"all 0.15s" }}>{item}</button>;
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"dashboard", label:"Dashboard" },
  { id:"kazi",      label:"Akili Kazi 💼" },
  { id:"afya",      label:"Akili Afya 🧠" },
  { id:"resources", label:"Resources" },
  { id:"profile",   label:"Profile" },
];

function AppShell({ user, setUser }) {
  const [tab, setTab]     = useState("dashboard");
  const [jobs, setJobs]   = useState([]);
  const [mood, setMoodState] = useState({ key:user.mood, emoji:user.moodEmoji, label:user.moodLabel });
  const [crisis, setCrisis] = useState(user.mood === "struggling");
  const [applyTarget, setApplyTarget] = useState(null);

  // Log mood to history
  const setMood = (m) => {
    setMoodState(m);
    const log = storage.get(MOOD_LOG_KEY, []);
    log.push({ date: new Date().toISOString(), mood: m.key, emoji: m.emoji });
    storage.set(MOOD_LOG_KEY, log.slice(-30)); // keep last 30 entries
    if (m.key === "struggling") setCrisis(true);
    else setCrisis(false);
    // Update persisted user
    const updated = { ...user, mood:m.key, moodEmoji:m.emoji, moodLabel:m.label };
    setUser(updated);
    storage.set(STORAGE_KEY, updated);
  };

  useEffect(() => {
    apiPost("/api/jobs", { skills: user.skills, county: user.county })
      .then((d) => setJobs(d.jobs || []))
      .catch(console.error);
  }, []);

  const handleApply = (jobTitle) => {
    setApplyTarget(jobTitle);
    setTab("afya");
  };

  const initials = (user.name || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      {/* TOP BAR */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"0 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:60, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:20, fontWeight:700, letterSpacing:-0.5 }}>
          aki<span style={{ color:"var(--teal)" }}>li</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <MoodBadge mood={mood} />
          <span style={{ fontSize:13, color:"var(--text-muted)" }}>{user.name}</span>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--teal)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>{initials}</div>
        </div>
      </div>

      {/* NAV TABS */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", display:"flex", padding:"0 1rem", overflowX:"auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"14px 18px", fontSize:13, fontWeight:500, border:"none", background:"none", borderBottom: tab===t.id ? "2px solid var(--teal)" : "2px solid transparent", color: tab===t.id ? "var(--teal)" : "var(--text-muted)", cursor:"pointer", whiteSpace:"nowrap", transition:"color 0.2s" }}>{t.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, padding:"1.5rem", maxWidth:900, margin:"0 auto", width:"100%" }}>
        {crisis && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"var(--radius-sm)", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ flex:1, fontSize:13, color:"var(--red)" }}>You're not alone. A counsellor is available right now — call <strong>0800 723 253</strong> (Befrienders Kenya, free, 24/7).</div>
            <button onClick={() => setTab("afya")} style={{ ...S.btnPrimary, background:"var(--red)", padding:"8px 18px", fontSize:12, whiteSpace:"nowrap" }}>Talk now</button>
          </div>
        )}

        {tab==="dashboard"  && <Dashboard user={user} jobs={jobs.slice(0,3)} mood={mood} setMood={setMood} onApply={handleApply} gotoAfya={() => setTab("afya")} />}
        {tab==="kazi"       && <KaziPanel jobs={jobs} onApply={handleApply} />}
        {tab==="afya"       && <AfyaPanel user={user} applyTarget={applyTarget} clearApplyTarget={() => setApplyTarget(null)} />}
        {tab==="resources"  && <ResourcesPanel />}
        {tab==="profile"    && <ProfilePanel user={user} mood={mood} />}
      </div>
    </div>
  );
}

function MoodBadge({ mood }) {
  const clr = mood.key==="great"||mood.key==="good" ? { bg:"var(--teal-light)", text:"var(--teal-dark)" } : mood.key==="struggling" ? { bg:"#FEE2E2", text:"var(--red)" } : { bg:"var(--amber-light)", text:"var(--amber)" };
  return <span style={{ background:clr.bg, color:clr.text, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600 }}>{mood.emoji} {mood.label}</span>;
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({ user, jobs, mood, setMood, onApply, gotoAfya }) {
  const moodLog = storage.get(MOOD_LOG_KEY, []);
  const streak = moodLog.length;

  return (
    <>
      <div style={{ background:"#0D1117", borderRadius:"var(--radius)", padding:"1.5rem 2rem", marginBottom:"1.5rem", color:"#fff" }}>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Habari, {user.name}!</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>{user.county} · {user.skills.length} skills · Here's your Akili dashboard.</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:"1.5rem" }}>
        {[
          { label:"Job matches", value:jobs.length, sub:"Based on your skills" },
          { label:"Check-in streak", value:streak || 1, sub:"Days logged" },
          { label:"Mood today", value:mood.emoji, sub:mood.label },
        ].map((s) => (
          <div key={s.label} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", padding:"1rem" }}>
            <div style={S.label}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, margin:"6px 0 2px" }}>{s.value}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ ...S.label, marginBottom:"0.75rem" }}>Top job matches</div>
      {jobs.map((j) => <JobCard key={j.id} job={j} onApply={onApply} />)}

      <div style={{ ...S.label, marginTop:"1.5rem", marginBottom:"0.75rem" }}>Daily wellness check-in</div>
      <div style={{ ...S.card }}>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>How are you feeling right now?</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {MOODS.map((m) => (
            <button key={m.key} onClick={() => setMood(m)} style={{ flex:1, minWidth:70, padding:12, borderRadius:"var(--radius-sm)", border: mood.key===m.key ? "1.5px solid var(--teal)" : "1.5px solid var(--border)", background: mood.key===m.key ? "var(--teal-light)" : "var(--bg)", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{m.emoji}</div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)" }}>{m.label}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// JOB CARD
// ════════════════════════════════════════════════════════════════════════════
function JobCard({ job, onApply }) {
  const clr = job.match > 85 ? { bg:"var(--teal-light)", text:"var(--teal-dark)" } : job.type==="Gig" ? { bg:"var(--purple-light)", text:"var(--purple)" } : { bg:"#EEF2FF", text:"#3730A3" };
  return (
    <div style={{ ...S.card, marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:8 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:600 }}>{job.title}</div>
          <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:2 }}>{job.company}</div>
        </div>
        <span style={{ background:clr.bg, color:clr.text, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{job.match}% match</span>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
        <Tag>{job.type}</Tag>
        {job.tags.map((t) => <Tag key={t}>{t}</Tag>)}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px solid var(--border)" }}>
        <span style={{ fontSize:14, fontWeight:600, color:"var(--teal)" }}>{job.pay}</span>
        <button onClick={() => onApply(job.title)} style={{ ...S.btnPrimary, padding:"8px 20px", fontSize:13 }}>Apply →</button>
      </div>
    </div>
  );
}
function Tag({ children }) { return <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:"var(--bg)", color:"var(--text-muted)", border:"1px solid var(--border)" }}>{children}</span>; }

// ════════════════════════════════════════════════════════════════════════════
// KAZI PANEL
// ════════════════════════════════════════════════════════════════════════════
function KaziPanel({ jobs, onApply }) {
  return (
    <>
      <div style={{ ...S.label, marginBottom:"0.75rem" }}>AI-matched opportunities — ranked by fit</div>
      {jobs.length === 0 && <div style={{ ...S.card, color:"var(--text-muted)", fontSize:14 }}>Loading opportunities…</div>}
      {jobs.map((j) => <JobCard key={j.id} job={j} onApply={onApply} />)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AFYA PANEL — AI Chat with full persistence + apply flow
// ════════════════════════════════════════════════════════════════════════════
function AfyaPanel({ user, applyTarget, clearApplyTarget }) {
  const [mode, setMode]       = useState("wellness");
  const [messages, setMessages] = useState(() => storage.get(HISTORY_KEY, []));
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [crisis, setCrisis]   = useState(false);
  const msgsRef = useRef(null);
  const initialized = useRef(false);

  // Save chat history whenever messages change
  useEffect(() => {
    if (messages.length > 0) storage.set(HISTORY_KEY, messages.slice(-40));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, loading]);

  // Initial greeting (only once per session if no history)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (messages.length === 0) {
      const greeting = user.mood === "struggling" || user.mood === "low"
        ? `Habari ${user.name}. I'm Akili Afya — your wellness companion. I can see today is tough. You're not alone — I'm here to listen. What's on your mind?`
        : `Habari ${user.name}! I'm Akili Afya — your wellness and career companion in one. I remember our conversations. How can I support you today?`;
      setMessages([{ role:"assistant", content:greeting, ts: Date.now() }]);
    }
  }, []);

  // Handle apply target from job card
  useEffect(() => {
    if (applyTarget) {
      setMode("career");
      const msg = `I want to apply for the "${applyTarget}" position. Can you help me prepare — including what to say, how to write a cover letter, and what to expect in the interview?`;
      clearApplyTarget();
      setTimeout(() => send(msg), 300);
    }
  }, [applyTarget]);

  const send = useCallback(async (textOverride) => {
    const text = textOverride || input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);

    const userMsg = { role:"user", content:text, ts: Date.now() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setLoading(true);

    // Prepare messages for API — only role+content, no extra fields
    const apiMessages = updatedHistory.map(({ role, content }) => ({ role, content }));

    try {
      const data = await apiPost("/api/chat", {
        messages: apiMessages,
        mode,
        user: {
          name:   user.name   || "",
          age:    user.age    || "",
          county: user.county || "",
          skills: user.skills || [],
          mood:   user.mood   || "good",
        },
      });

      const aiMsg = { role:"assistant", content:data.reply, ts: Date.now() };
      setMessages([...updatedHistory, aiMsg]);
      if (data.crisis) setCrisis(true);

    } catch (err) {
      console.error("Chat error:", err);
      setError(err.message || "Could not reach the AI. Check your internet and try again.");
      // Remove the user message so they can retry
      setMessages(updatedHistory.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }, [messages, mode, input, loading, user]);

  const clearHistory = () => {
    storage.clear(HISTORY_KEY);
    setMessages([]);
    initialized.current = false;
    setTimeout(() => { initialized.current = false; }, 100);
    window.location.reload();
  };

  const quickPrompts = mode === "wellness" ? QUICK_WELLNESS : QUICK_CAREER;

  return (
    <div>
      {crisis && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"var(--radius-sm)", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <span style={{ flex:1, fontSize:13, color:"var(--red)" }}>🆘 If you're in crisis, call Befrienders Kenya now: <strong>0800 723 253</strong> (toll-free, 24/7)</span>
        </div>
      )}

      {error && (
        <div style={{ background:"#FEF3C7", border:"1px solid #FCD34D", borderRadius:"var(--radius-sm)", padding:"10px 16px", fontSize:13, color:"#92400E", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#92400E", fontWeight:600 }}>✕</button>
        </div>
      )}

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden", display:"flex", flexDirection:"column", height:560 }}>
        {/* Header */}
        <div style={{ background:"#0D1117", padding:"0.85rem 1.25rem", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:"var(--teal)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#fff" }}>Akili Afya</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>
              {messages.length > 1 ? `${messages.length} messages · history saved` : "Always here · Kiswahili & English"}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {["wellness","career"].map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", border: mode===m ? "1px solid var(--teal)" : "1px solid rgba(255,255,255,0.15)", background: mode===m ? "var(--teal)" : "transparent", color: mode===m ? "#fff" : "rgba(255,255,255,0.5)", transition:"all 0.15s", textTransform:"capitalize" }}>{m === "wellness" ? "Wellness" : "Career"}</button>
            ))}
            <button onClick={clearHistory} title="Clear chat history" style={{ marginLeft:4, background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, color:"rgba(255,255,255,0.3)", fontSize:11, padding:"4px 8px", cursor:"pointer" }}>Clear</button>
          </div>
        </div>

        {/* Messages */}
        <div ref={msgsRef} style={{ flex:1, overflowY:"auto", padding:"1.25rem", display:"flex", flexDirection:"column", gap:12, background:"var(--bg)" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-end", flexDirection: m.role==="user" ? "row-reverse" : "row" }}>
              {m.role==="assistant" && (
                <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--teal)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>🤖</div>
              )}
              <div style={{ maxWidth:"78%" }}>
                <div style={{ padding:"10px 14px", borderRadius:16, fontSize:14, lineHeight:1.6, ...(m.role==="user" ? { background:"var(--teal)", color:"#fff", borderBottomRightRadius:4 } : { background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text)", borderBottomLeftRadius:4 }) }}>
                  {m.content.split("\n").map((line, j) => <p key={j} style={{ margin: j>0 ? "6px 0 0" : 0 }}>{line}</p>)}
                </div>
                {m.ts && (
                  <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:3, textAlign: m.role==="user"?"right":"left" }}>
                    {new Date(m.ts).toLocaleTimeString("en-KE", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--teal)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>🤖</div>
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, borderBottomLeftRadius:4, padding:"12px 16px", display:"flex", gap:5 }}>
                {[0,1,2].map((i) => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--text-muted)", animation:"bounce 1.2s infinite", animationDelay:`${i*0.2}s` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"0.75rem 1rem 0.5rem", background:"var(--bg)", borderTop:"1px solid var(--border)" }}>
          {quickPrompts.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={loading} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, cursor:"pointer", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-muted)", transition:"all 0.15s", opacity: loading?0.5:1 }}>{p}</button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display:"flex", gap:10, padding:"0.85rem 1rem", borderTop:"1px solid var(--border)", background:"var(--surface)" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={loading ? "Akili is thinking…" : "Type in English or Kiswahili…"}
            disabled={loading}
            style={{ flex:1, border:"1px solid var(--border)", borderRadius:50, padding:"10px 18px", fontSize:14, outline:"none", background:"var(--bg)", color:"var(--text)", transition:"border 0.2s", opacity: loading?0.7:1 }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{ width:42, height:42, borderRadius:"50%", background:"var(--teal)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(!input.trim()||loading)?0.4:1, flexShrink:0, transition:"opacity 0.2s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>

      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════════════════════
const RESOURCES = [
  { icon:"📞", bg:"var(--teal-light)",   title:"Befrienders Kenya — Crisis Helpline",         desc:"Free, confidential support 24/7 for anyone in emotional distress.",                        link:"0800 723 253 (toll-free)" },
  { icon:"🏥", bg:"var(--purple-light)", title:"Mathari National Teaching & Referral Hospital", desc:"Kenya's primary public psychiatric facility. Outpatient mental health services available.", link:"+254 20 2724017" },
  { icon:"💬", bg:"var(--amber-light)",  title:"Niskize — SMS Mental Health Support",          desc:"Text-based, confidential, low-cost mental health support for Kenyans.",                   link:'SMS "HELP" to 21138' },
  { icon:"🎓", bg:"var(--teal-light)",   title:"TVETA — Technical & Vocational Training",      desc:"800+ TVET institutions across Kenya. Free and subsidised courses for youth.",              link:"tveta.go.ke" },
  { icon:"💼", bg:"var(--purple-light)", title:"Kazi Mtaani — Government Youth Employment",    desc:"Short-term employment for youth in urban informal settlements.",                           link:"youthemployment.go.ke" },
  { icon:"📱", bg:"var(--amber-light)",  title:"Ajira Digital — Online Work Training",         desc:"Free government programme training youth to earn income through digital platforms.",       link:"ajiradigital.go.ke" },
];
function ResourcesPanel() {
  return (
    <>
      {RESOURCES.map((r) => (
        <div key={r.title} style={{ ...S.card, display:"flex", gap:16, alignItems:"flex-start", marginBottom:12 }}>
          <div style={{ width:44, height:44, borderRadius:"var(--radius-sm)", background:r.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{r.icon}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{r.title}</div>
            <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.5, marginBottom:6 }}>{r.desc}</div>
            <span style={{ fontSize:12, color:"var(--teal)", fontWeight:600 }}>{r.link}</span>
          </div>
        </div>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════════════════════════════════
function ProfilePanel({ user, mood }) {
  const moodLog   = storage.get(MOOD_LOG_KEY, []);
  const chatCount = storage.get(HISTORY_KEY, []).length;
  const initials  = (user.name || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{ ...S.card }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.25rem" }}>
        <div style={{ width:60, height:60, borderRadius:"50%", background:"var(--teal)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700 }}>{initials}</div>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{user.name}</div>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>{user.age} yrs · {user.county}, Kenya</div>
        </div>
      </div>

      <Sec label="Your skills">
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {(user.skills.length > 0 ? user.skills : ["No skills added"]).map((s) => (
            <span key={s} style={{ padding:"6px 14px", borderRadius:50, background:"var(--teal-light)", color:"var(--teal-dark)", fontSize:12, fontWeight:600 }}>{s}</span>
          ))}
        </div>
      </Sec>

      <Sec label="Current mood"><MoodBadge mood={mood} /></Sec>

      <Sec label="Activity stats">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[{ label:"Mood check-ins", value:moodLog.length || 1 }, { label:"Chat messages", value:chatCount }].map((s) => (
            <div key={s.label} style={{ background:"var(--bg)", borderRadius:"var(--radius-sm)", padding:"0.75rem" }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Sec>

      <Sec label="About Akili">
        <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.6 }}>
          Akili is a free AI platform helping Kenya's 18M+ youth find jobs and support their mental health.
          Your data is saved privately on this device. In crisis? Call <strong style={{ color:"var(--teal)" }}>0800 723 253</strong> — Befrienders Kenya, toll-free, 24/7.
        </div>
      </Sec>
    </div>
  );
}
function Sec({ label, children }) {
  return (
    <div style={{ marginTop:"1.25rem", paddingTop:"1.25rem", borderTop:"1px solid var(--border)" }}>
      <div style={{ ...S.label, marginBottom:10 }}>{label}</div>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [user, setUser]     = useState(null);

  const savedUser = storage.get(STORAGE_KEY);

  const handleStart = (useSaved) => {
    if (useSaved && savedUser) {
      setUser(savedUser);
      setScreen("app");
    } else {
      storage.clear(STORAGE_KEY);
      storage.clear(HISTORY_KEY);
      storage.clear(MOOD_LOG_KEY);
      setScreen("onboarding");
    }
  };

  const handleOnboardComplete = (formData) => {
    storage.set(STORAGE_KEY, formData);
    setUser(formData);
    setScreen("app");
  };

  if (screen==="splash")     return <Splash onStart={handleStart} hasSavedUser={!!savedUser} />;
  if (screen==="onboarding") return <Onboarding onComplete={handleOnboardComplete} />;
  if (screen==="app" && user) return <AppShell user={user} setUser={setUser} />;
  return null;
}
