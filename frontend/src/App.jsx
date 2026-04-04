import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";

// ── PWA Install Banner ────────────────────────────────────────────────────────
const SNOOZE_KEY = "akili_pwa_snooze";
function InstallBanner() {
  const [visible, setVisible]     = useState(false);
  const [native, setNative]       = useState(null);
  const [isIOS, setIsIOS]         = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) return;
    const snooze = localStorage.getItem(SNOOZE_KEY);
    if (snooze && Date.now() - Number(snooze) < 7*24*60*60*1000) return;
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler = (e) => { e.preventDefault(); setNative(e); };
    window.addEventListener("beforeinstallprompt", handler);
    setVisible(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const dismiss = () => { setVisible(false); localStorage.setItem(SNOOZE_KEY, String(Date.now())); };
  const install = async () => {
    if (!native) return;
    native.prompt();
    const { outcome } = await native.userChoice;
    if (outcome === "accepted") { setVisible(false); localStorage.setItem(SNOOZE_KEY, String(Date.now()+365*24*60*60*1000)); }
    setNative(null);
  };
  if (!visible) return null;
  return (
    <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:99999,background:"#fff",borderTop:"2px solid var(--teal)",boxShadow:"0 -4px 20px rgba(0,0,0,0.1)",fontFamily:"'Sora',sans-serif" }}>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)" }}>
        <div style={{ width:42,height:42,borderRadius:10,background:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:700,fontSize:18,fontFamily:"'Space Mono',monospace" }}>A</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14,fontWeight:700,color:"var(--text)" }}>Install Akili</div>
          <div style={{ fontSize:11,color:"var(--text-muted)" }}>{native?"Tap below to add to home screen":isIOS?"Add to iPhone home screen — free":"Install as app — works offline"}</div>
        </div>
        <button onClick={dismiss} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text-faint)",fontSize:22,lineHeight:1,padding:"4px" }}>×</button>
      </div>
      <div style={{ padding:"10px 16px 14px" }}>
        {native ? (
          <button onClick={install} style={{ width:"100%",padding:"12px",background:"var(--teal)",color:"#fff",border:"none",borderRadius:"var(--radius-sm)",fontSize:14,fontWeight:700,cursor:"pointer" }}>Add to Home Screen</button>
        ) : isIOS ? (
          <>
            <button onClick={() => setShowSteps(s=>!s)} style={{ width:"100%",padding:"11px",background:"var(--teal-light)",color:"var(--teal)",border:"1px solid var(--teal)",borderRadius:"var(--radius-sm)",fontSize:13,fontWeight:700,cursor:"pointer" }}>
              {showSteps ? "Hide steps":"How to install on iPhone →"}
            </button>
            {showSteps && (
              <div style={{ marginTop:10,display:"flex",flexDirection:"column",gap:8 }}>
                {[["1","Tap the Share button","at the bottom of Safari"],["2","Tap \"Add to Home Screen\"","scroll down to find it"],["3","Tap \"Add\"","Akili appears on your home screen"]].map(([n,t,s]) => (
                  <div key={n} style={{ display:"flex",gap:10,alignItems:"flex-start",background:"var(--surface2)",borderRadius:8,padding:"8px 10px" }}>
                    <div style={{ width:24,height:24,borderRadius:"50%",background:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0 }}>{n}</div>
                    <div><div style={{ fontSize:12,fontWeight:600,color:"var(--text)" }}>{t}</div><div style={{ fontSize:11,color:"var(--text-muted)" }}>{s}</div></div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize:12,color:"var(--text-muted)",padding:"8px 0" }}>Click the install icon <strong style={{color:"var(--teal)"}}>⊕</strong> in your browser address bar to install Akili.</div>
        )}
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Machakos","Meru","Nyeri","Kisii","Garissa","Kakamega","Other"];
const SKILLS   = ["Sales","Customer service","Data entry","Graphic design","Social media","Driving","Cooking","Tailoring","Construction","Teaching","IT / Tech","Farming","Writing","Healthcare","Accounting"];
const MOODS    = [
  { key:"great",      emoji:"😄",label:"Great" },
  { key:"good",       emoji:"😊",label:"Good" },
  { key:"okay",       emoji:"😐",label:"Okay" },
  { key:"low",        emoji:"😔",label:"Low" },
  { key:"struggling", emoji:"😟",label:"Struggling" },
];
const QUICK_WELLNESS = ["I feel overwhelmed","Siwezi kulala vizuri","How to manage stress?","I need someone to talk to","I feel hopeless"];
const QUICK_CAREER   = ["Help me write my CV","Mock interview practice","What jobs suit my skills?","How to negotiate salary?","Prepare me for an interview"];
const STORAGE_KEY    = "akili_user_v2";
const HISTORY_KEY    = "akili_chat_v2";
const MOOD_LOG_KEY   = "akili_mood_v2";

// ── Storage ───────────────────────────────────────────────────────────────────
const store = {
  get: (k, fb=null) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb; } catch { return fb; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
  del: (k)   => { try { localStorage.removeItem(k); } catch {} },
};

// ── API ───────────────────────────────────────────────────────────────────────
async function apiPost(url, body) {
  const res = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = {
  card: { background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"1.25rem",boxShadow:"var(--shadow-sm)" },
  label: { fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--text-muted)" },
  btn: { background:"var(--teal)",color:"#fff",border:"none",borderRadius:"var(--radius-pill)",padding:"11px 28px",fontSize:14,fontWeight:600,cursor:"pointer",transition:"all 0.15s" },
  btnOut: { background:"transparent",color:"var(--teal)",border:"1.5px solid var(--teal)",borderRadius:"var(--radius-pill)",padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s" },
};

// ════════════════════════════════════════════════════════════════════════════
// SPLASH — Clean, modern, light
// ════════════════════════════════════════════════════════════════════════════
function Splash({ onStart, hasSavedUser }) {
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(()=>setVis(true),80); }, []);

  const features = [
    { icon:"💼", title:"Real Job Matching",    desc:"AI matches your skills to real Kenyan opportunities with direct application links" },
    { icon:"🧠", title:"Wellness Support",     desc:"24/7 mental health companion in English & Kiswahili — always free, always private" },
    { icon:"🎯", title:"Personalised for You", desc:"Remembers your profile, mood, and conversations across every session" },
  ];

  return (
    <div style={{ minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column" }}>
      {/* Nav */}
      <nav style={{ padding:"1rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--surface)",borderBottom:"1px solid var(--border)" }}>
        <div style={{ fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700 }}>
          aki<span style={{ color:"var(--teal)" }}>li</span>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          {hasSavedUser && <button onClick={()=>onStart(true)} style={{ ...S.btnOut,padding:"7px 18px",fontSize:12 }}>Continue →</button>}
          <button onClick={()=>onStart(false)} style={{ ...S.btn,padding:"8px 20px",fontSize:13 }}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"3rem 1.5rem 2rem",textAlign:"center",
        opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(20px)",transition:"all 0.6s ease" }}>

        {/* Badge */}
        <div style={{ display:"inline-flex",alignItems:"center",gap:6,background:"var(--teal-light)",border:"1px solid rgba(13,158,117,0.2)",borderRadius:"var(--radius-pill)",padding:"5px 14px",marginBottom:"1.5rem" }}>
          <div style={{ width:7,height:7,borderRadius:"50%",background:"var(--teal)",animation:"pulse 2s infinite" }} />
          <span style={{ fontSize:12,color:"var(--teal)",fontWeight:600 }}>Live in Kenya · Free Forever</span>
        </div>

        <h1 style={{ fontSize:"clamp(2.4rem,7vw,4.5rem)",fontWeight:700,lineHeight:1.1,marginBottom:"1rem",letterSpacing:"-0.02em" }}>
          Your future starts<br />
          <span style={{ color:"var(--teal)" }}>right here.</span>
        </h1>

        <p style={{ fontSize:"clamp(1rem,2vw,1.15rem)",color:"var(--text-muted)",maxWidth:520,marginBottom:"2rem",lineHeight:1.7 }}>
          Akili connects Kenya's 18 million youth to real jobs and mental health support —
          powered by AI, completely free, in Kiswahili and English.
        </p>

        <div style={{ display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginBottom:"3rem" }}>
          <button onClick={()=>onStart(false)} style={{ ...S.btn,fontSize:15,padding:"14px 36px",boxShadow:"0 4px 20px rgba(13,158,117,0.3)" }}>
            Anza sasa — Begin Free
          </button>
          {hasSavedUser && (
            <button onClick={()=>onStart(true)} style={{ ...S.btnOut,fontSize:14,padding:"13px 28px" }}>
              Continue where I left off →
            </button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"var(--border)",borderRadius:14,overflow:"hidden",maxWidth:560,width:"100%",marginBottom:"3rem",boxShadow:"var(--shadow-sm)" }}>
          {[["18M+","Kenyan youth"],["67%","Unemployment"],["24/7","AI support"],["Free","Always"]].map(([v,l],i)=>(
            <div key={i} style={{ background:"var(--surface)",padding:"1rem 0.5rem",textAlign:"center" }}>
              <div style={{ fontSize:"1.4rem",fontWeight:700,color:"var(--teal)",fontFamily:"'Space Mono',monospace" }}>{v}</div>
              <div style={{ fontSize:11,color:"var(--text-muted)",marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,maxWidth:720,width:"100%" }}>
          {features.map((f,i)=>(
            <div key={i} style={{ ...S.card,textAlign:"left",transition:"transform 0.2s",cursor:"default" }}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e=>e.currentTarget.style.transform="none"}>
              <div style={{ fontSize:24,marginBottom:10 }}>{f.icon}</div>
              <div style={{ fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:4 }}>{f.title}</div>
              <div style={{ fontSize:12,color:"var(--text-muted)",lineHeight:1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:"1rem",borderTop:"1px solid var(--border)",background:"var(--surface)",textAlign:"center",fontSize:11,color:"var(--text-faint)" }}>
        Free · Kiswahili & English · Works on all phones · No CV required · 47 counties
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════════
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:"",age:"",county:"",skills:[],mood:"good",moodEmoji:"😊",moodLabel:"Good" });
  const [anim, setAnim] = useState(true);

  const next = () => { setAnim(false); setTimeout(()=>{ setStep(s=>s+1); setAnim(true); },200); };
  const set  = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleSkill = (s) => set("skills", form.skills.includes(s)?form.skills.filter(x=>x!==s):[...form.skills,s]);

  const total = 5;
  const pct   = (step/(total-1))*100;

  const steps = [
    {
      q: <>Habari! What's your <span style={{color:"var(--teal)"}}>name</span>?</>,
      content: (
        <>
          <input style={OI} placeholder="Enter your name…" value={form.name}
            onChange={e=>set("name",e.target.value)} onKeyDown={e=>e.key==="Enter"&&form.name.trim()&&next()} autoFocus />
          <OBtn onClick={next} disabled={!form.name.trim()}>Continue →</OBtn>
        </>
      )
    },
    {
      q: <>How old are <span style={{color:"var(--teal)"}}>you</span>, {form.name}?</>,
      content: (
        <>
          <input style={OI} type="number" min="15" max="45" placeholder="Your age…" value={form.age}
            onChange={e=>set("age",e.target.value)} onKeyDown={e=>e.key==="Enter"&&form.age&&next()} autoFocus />
          <OBtn onClick={next} disabled={!form.age}>Continue →</OBtn>
        </>
      )
    },
    {
      q: <>Which <span style={{color:"var(--teal)"}}>county</span> are you in?</>,
      content: (
        <>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:20 }}>
            {COUNTIES.map(cn=>(
              <button key={cn} onClick={()=>set("county",cn)} style={{
                padding:"8px 16px",borderRadius:"var(--radius-pill)",fontSize:13,fontWeight:500,cursor:"pointer",transition:"all 0.15s",
                background:form.county===cn?"var(--teal)":"var(--surface2)",
                color:form.county===cn?"#fff":"var(--text)",
                border:form.county===cn?"1.5px solid var(--teal)":"1.5px solid var(--border)",
              }}>{cn}</button>
            ))}
          </div>
          <OBtn onClick={next} disabled={!form.county}>Continue →</OBtn>
        </>
      )
    },
    {
      q: <>What are your <span style={{color:"var(--teal)"}}>skills</span>? <span style={{fontSize:14,color:"var(--text-muted)",fontWeight:400}}>(pick all that apply)</span></>,
      content: (
        <>
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:20 }}>
            {SKILLS.map(sk=>{
              const active = form.skills.includes(sk);
              return (
                <button key={sk} onClick={()=>toggleSkill(sk)} style={{
                  padding:"8px 16px",borderRadius:"var(--radius-pill)",fontSize:13,fontWeight:500,cursor:"pointer",transition:"all 0.15s",
                  background:active?"var(--teal)":"var(--surface2)",
                  color:active?"#fff":"var(--text)",
                  border:active?"1.5px solid var(--teal)":"1.5px solid var(--border)",
                }}>{active?"✓ ":""}{sk}</button>
              );
            })}
          </div>
          <OBtn onClick={next}>Continue →</OBtn>
        </>
      )
    },
    {
      q: <>How are you <span style={{color:"var(--teal)"}}>feeling</span> today?</>,
      content: (
        <>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:24 }}>
            {MOODS.map(m=>{
              const active = form.mood===m.key;
              return (
                <button key={m.key} onClick={()=>setForm(f=>({...f,mood:m.key,moodEmoji:m.emoji,moodLabel:m.label}))}
                  style={{ padding:"14px 6px",borderRadius:"var(--radius)",border:active?"2px solid var(--teal)":"1.5px solid var(--border)",
                    background:active?"var(--teal-light)":"var(--surface2)",cursor:"pointer",textAlign:"center",transition:"all 0.15s" }}>
                  <div style={{ fontSize:26,marginBottom:4 }}>{m.emoji}</div>
                  <div style={{ fontSize:11,fontWeight:600,color:active?"var(--teal)":"var(--text-muted)" }}>{m.label}</div>
                </button>
              );
            })}
          </div>
          <OBtn onClick={()=>onComplete(form)}>Enter Akili →</OBtn>
        </>
      )
    },
  ];

  return (
    <div style={{ minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column" }}>
      {/* Progress header */}
      <div style={{ padding:"1rem 1.5rem",display:"flex",alignItems:"center",gap:16,background:"var(--surface)",borderBottom:"1px solid var(--border)" }}>
        <div style={{ fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700 }}>aki<span style={{color:"var(--teal)"}}>li</span></div>
        <div style={{ flex:1,height:4,background:"var(--border)",borderRadius:2,overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${pct}%`,background:"var(--teal)",borderRadius:2,transition:"width 0.4s ease",boxShadow:"0 0 8px rgba(13,158,117,0.4)" }} />
        </div>
        <div style={{ fontSize:12,color:"var(--text-muted)",fontFamily:"'Space Mono',monospace",minWidth:36,textAlign:"right" }}>{step+1}/{total}</div>
      </div>

      {/* Step */}
      <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1.5rem" }}>
        <div style={{ maxWidth:520,width:"100%",opacity:anim?1:0,transform:anim?"translateY(0)":"translateY(12px)",transition:"all 0.2s ease" }}>
          <h2 style={{ fontSize:"clamp(1.4rem,4vw,1.9rem)",fontWeight:700,color:"var(--text)",marginBottom:"1.5rem",lineHeight:1.3 }}>
            {steps[step].q}
          </h2>
          {steps[step].content}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display:"flex",justifyContent:"center",gap:8,padding:"1.5rem",borderTop:"1px solid var(--border)",background:"var(--surface)" }}>
        {steps.map((_,i)=>(
          <div key={i} style={{ width:i===step?24:8,height:8,borderRadius:4,background:i<step?"var(--teal)":i===step?"var(--teal)":"var(--border)",transition:"all 0.3s ease",opacity:i>step?0.5:1 }} />
        ))}
      </div>
    </div>
  );
}

const OI = { width:"100%",background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"13px 16px",fontSize:15,color:"var(--text)",outline:"none",marginBottom:14,transition:"border 0.2s",boxShadow:"var(--shadow-sm)" };
function OBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...S.btn,opacity:disabled?0.4:1,fontSize:14,padding:"12px 32px",boxShadow:disabled?"none":"0 4px 14px rgba(13,158,117,0.3)" }}>
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id:"dashboard", icon:"🏠", label:"Home" },
  { id:"kazi",      icon:"💼", label:"Jobs" },
  { id:"afya",      icon:"🧠", label:"Wellness" },
  { id:"resources", icon:"📋", label:"Resources" },
  { id:"profile",   icon:"👤", label:"Profile" },
];

function AppShell({ user, setUser }) {
  const [tab, setTab]        = useState("dashboard");
  const [jobs, setJobs]      = useState([]);
  const [boards, setBoards]  = useState({});
  const [hasReal, setHasReal]= useState(false);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [mood, setMoodState] = useState({ key:user.mood||"good", emoji:user.moodEmoji||"😊", label:user.moodLabel||"Good" });
  const [crisis, setCrisis]  = useState(user.mood==="struggling");
  const [applyTarget, setApplyTarget] = useState(null);

  const setMood = (m) => {
    setMoodState(m);
    const log = store.get(MOOD_LOG_KEY,[]);
    log.push({ date:new Date().toISOString(), mood:m.key, emoji:m.emoji });
    store.set(MOOD_LOG_KEY, log.slice(-60));
    setCrisis(m.key==="struggling");
    const updated = { ...user, mood:m.key, moodEmoji:m.emoji, moodLabel:m.label };
    setUser(updated); store.set(STORAGE_KEY, updated);
  };

  const loadJobs = useCallback(async (q="") => {
    setJobsLoading(true);
    try {
      const data = await apiPost("/api/jobs", { skills:user.skills, county:user.county, query:q });
      setJobs(data.jobs||[]); setBoards(data.boards||{}); setHasReal(data.hasRealJobs||false);
    } catch { } finally { setJobsLoading(false); }
  }, [user.skills, user.county]);

  useEffect(() => { loadJobs(); }, []);

  const handleApply = (jobTitle) => { setApplyTarget(jobTitle); setTab("afya"); };
  const initials = (user.name||"?").slice(0,2).toUpperCase();

  return (
    <div style={{ display:"flex",flexDirection:"column",minHeight:"100vh",background:"var(--bg)" }}>

      {/* TOP BAR */}
      <div style={{ background:"var(--surface)",borderBottom:"1px solid var(--border)",padding:"0 1.25rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,position:"sticky",top:0,zIndex:100,boxShadow:"var(--shadow-sm)" }}>
        <div style={{ fontFamily:"'Space Mono',monospace",fontSize:19,fontWeight:700 }}>
          aki<span style={{ color:"var(--teal)" }}>li</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <MoodBadge mood={mood} />
          <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--teal)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0 }}>{initials}</div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex:1,overflow:"auto",paddingBottom:80 }}>
        <div style={{ maxWidth:860,margin:"0 auto",padding:"1.25rem 1rem" }}>

          {/* Crisis banner */}
          {crisis && (
            <div style={{ background:"var(--red-light)",border:"1px solid #FECACA",borderRadius:"var(--radius-sm)",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
              <div style={{ flex:1,fontSize:13,color:"var(--red)",fontWeight:500 }}>
                You're not alone 💙 — call <strong>0800 723 253</strong> (Befrienders Kenya, free, 24/7)
              </div>
              <button onClick={()=>setTab("afya")} style={{ ...S.btn,background:"var(--red)",padding:"7px 16px",fontSize:12,whiteSpace:"nowrap" }}>Talk now</button>
            </div>
          )}

          {tab==="dashboard"  && <Dashboard user={user} jobs={jobs.slice(0,4)} boards={boards} hasReal={hasReal} jobsLoading={jobsLoading} mood={mood} setMood={setMood} onApply={handleApply} gotoKazi={()=>setTab("kazi")} />}
          {tab==="kazi"       && <KaziPanel jobs={jobs} boards={boards} hasReal={hasReal} jobsLoading={jobsLoading} onApply={handleApply} onSearch={loadJobs} />}
          {tab==="afya"       && <AfyaPanel user={user} applyTarget={applyTarget} clearApply={()=>setApplyTarget(null)} />}
          {tab==="resources"  && <ResourcesPanel />}
          {tab==="profile"    && <ProfilePanel user={user} mood={mood} />}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"var(--surface)",borderTop:"1px solid var(--border)",display:"flex",zIndex:90,boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
        {TABS.map((t)=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            padding:"10px 4px",border:"none",background:"none",cursor:"pointer",gap:3,
            color:tab===t.id?"var(--teal)":"var(--text-faint)",transition:"color 0.15s",
          }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={{ fontSize:10,fontWeight:tab===t.id?700:500 }}>{t.label}</span>
            {tab===t.id && <div style={{ width:20,height:3,borderRadius:2,background:"var(--teal)",position:"absolute",bottom:0 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function MoodBadge({ mood }) {
  const clr = mood.key==="great"||mood.key==="good"
    ? { bg:"var(--teal-light)", text:"var(--teal-dark)" }
    : mood.key==="struggling"
    ? { bg:"var(--red-light)", text:"var(--red)" }
    : { bg:"var(--amber-light)", text:"var(--amber)" };
  return <span style={{ background:clr.bg,color:clr.text,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:600 }}>{mood.emoji} {mood.label}</span>;
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({ user, jobs, boards, hasReal, jobsLoading, mood, setMood, onApply, gotoKazi }) {
  const moodLog = store.get(MOOD_LOG_KEY,[]);
  return (
    <>
      {/* Welcome card */}
      <div style={{ background:"linear-gradient(135deg,#0D1117 60%,#0D3D2E)",borderRadius:"var(--radius)",padding:"1.5rem",marginBottom:"1.25rem",color:"#fff",boxShadow:"var(--shadow-md)" }}>
        <div style={{ fontSize:20,fontWeight:700,marginBottom:4 }}>Habari, {user.name}! 👋</div>
        <div style={{ fontSize:13,color:"rgba(255,255,255,0.55)" }}>{user.county} · {user.skills.length} skills · {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}</div>
      </div>

      {/* Stats row */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.25rem" }}>
        {[
          { label:"Job matches",     value:jobs.length,        sub:"Based on skills",     color:"var(--teal)" },
          { label:"Check-in streak", value:moodLog.length||1,  sub:"Days logged",         color:"var(--purple)" },
          { label:"Today's mood",    value:mood.emoji,         sub:mood.label,            color:"var(--amber)" },
        ].map((s,i)=>(
          <div key={i} style={{ ...S.card,padding:"0.9rem" }}>
            <div style={{ fontSize:11,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:24,fontWeight:700,color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11,color:"var(--text-muted)" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Mood check-in */}
      <div style={{ ...S.card,marginBottom:"1.25rem" }}>
        <div style={{ fontSize:14,fontWeight:600,marginBottom:12 }}>How are you feeling right now?</div>
        <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
          {MOODS.map((m)=>(
            <button key={m.key} onClick={()=>setMood(m)} style={{
              flex:1,minWidth:64,padding:"10px 6px",borderRadius:"var(--radius-sm)",
              border:mood.key===m.key?"2px solid var(--teal)":"1.5px solid var(--border)",
              background:mood.key===m.key?"var(--teal-light)":"var(--surface2)",
              cursor:"pointer",textAlign:"center",transition:"all 0.15s",
            }}>
              <div style={{ fontSize:20,marginBottom:3 }}>{m.emoji}</div>
              <div style={{ fontSize:10,fontWeight:600,color:mood.key===m.key?"var(--teal)":"var(--text-muted)" }}>{m.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Top jobs */}
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
        <div style={S.label}>Top job matches {hasReal && <span style={{ color:"var(--teal)",marginLeft:4,fontSize:10,fontWeight:600,background:"var(--teal-light)",padding:"1px 6px",borderRadius:20 }}>LIVE</span>}</div>
        <button onClick={gotoKazi} style={{ ...S.btnOut,padding:"5px 14px",fontSize:11 }}>View all →</button>
      </div>
      {jobsLoading ? <Loading /> : jobs.slice(0,3).map((j)=><JobCard key={j.id} job={j} onApply={onApply} compact />)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KAZI PANEL — Real jobs with search + apply
// ════════════════════════════════════════════════════════════════════════════
function KaziPanel({ jobs, boards, hasReal, jobsLoading, onApply, onSearch }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filters = ["All","Full-time","Part-time","Gig","Remote","Contract"];

  const filtered = jobs.filter(j => {
    if (filter === "All") return true;
    if (filter === "Remote") return j.tags?.some(t => t.toLowerCase().includes("remote"));
    return j.type === filter;
  });

  return (
    <>
      {/* Search bar */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        <input value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onSearch(query)}
          placeholder="Search jobs — e.g. 'graphic design Nairobi'…"
          style={{ ...OI,marginBottom:0,flex:1,fontSize:13 }} />
        <button onClick={()=>onSearch(query)} style={{ ...S.btn,padding:"0 18px",fontSize:13,flexShrink:0 }}>Search</button>
      </div>

      {/* Filter chips */}
      <div style={{ display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14 }}>
        {filters.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"6px 14px",borderRadius:"var(--radius-pill)",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s",
            background:filter===f?"var(--teal)":"var(--surface)",
            color:filter===f?"#fff":"var(--text-muted)",
            border:filter===f?"1.5px solid var(--teal)":"1.5px solid var(--border)",
          }}>{f}</button>
        ))}
      </div>

      {/* Source indicator */}
      {hasReal && (
        <div style={{ background:"var(--teal-light)",border:"1px solid rgba(13,158,117,0.2)",borderRadius:"var(--radius-sm)",padding:"8px 14px",fontSize:12,color:"var(--teal-dark)",marginBottom:14,display:"flex",alignItems:"center",gap:6 }}>
          <span style={{ width:8,height:8,borderRadius:"50%",background:"var(--teal)",display:"inline-block" }} />
          <strong>Live jobs loaded</strong> — real opportunities from Kenyan employers right now
        </div>
      )}

      {/* Job listings */}
      <div style={{ ...S.label,marginBottom:10 }}>
        {filtered.length} opportunities{filter!=="All"?` · ${filter}`:""}
      </div>
      {jobsLoading ? <Loading /> : filtered.map((j)=><JobCard key={j.id} job={j} onApply={onApply} />)}

      {/* Job board links */}
      {Object.keys(boards).length > 0 && (
        <div style={{ ...S.card,marginTop:16 }}>
          <div style={{ ...S.label,marginBottom:12 }}>Search on Kenyan job boards</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8 }}>
            {[
              ["BrighterMonday","brightermonday","var(--blue)"],
              ["Fuzu Kenya","fuzu","var(--purple)"],
              ["LinkedIn Kenya","linkedin","#0A66C2"],
              ["MyJobMag","myjobmag","var(--amber)"],
              ["Jobs in Kenya","jobsinkenya","var(--teal)"],
            ].map(([label,key,col])=>boards[key]&&(
              <a key={key} href={boards[key]} target="_blank" rel="noopener noreferrer" style={{
                display:"block",padding:"10px 14px",borderRadius:"var(--radius-sm)",border:`1.5px solid ${col}`,
                textDecoration:"none",fontSize:12,fontWeight:600,color:col,textAlign:"center",
                background:`${col}11`,transition:"all 0.15s",
              }}>{label} →</a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────
function JobCard({ job, onApply, compact }) {
  const matchColor = job.match>88?"var(--teal)":job.match>75?"var(--amber)":"var(--text-muted)";
  const typeColor  = job.type==="Gig"?"var(--purple)":job.type==="Remote"?"var(--blue)":"var(--text-muted)";

  return (
    <div style={{ ...S.card,marginBottom:10,transition:"box-shadow 0.2s",cursor:"default" }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="var(--shadow-md)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="var(--shadow-sm)"}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2 }}>
            <div style={{ fontSize:15,fontWeight:700,color:"var(--text)" }}>{job.title}</div>
            {job.isReal && <span style={{ fontSize:9,fontWeight:700,background:"var(--teal)",color:"#fff",padding:"1px 6px",borderRadius:20 }}>LIVE</span>}
          </div>
          <div style={{ fontSize:12,color:"var(--text-muted)" }}>{job.company}{job.posted&&` · ${job.posted}`}</div>
        </div>
        <div style={{ textAlign:"right",flexShrink:0 }}>
          <div style={{ fontSize:16,fontWeight:700,color:matchColor }}>{job.match}%</div>
          <div style={{ fontSize:10,color:"var(--text-faint)" }}>match</div>
        </div>
      </div>

      {!compact && job.description && (
        <div style={{ fontSize:12,color:"var(--text-muted)",marginBottom:8,lineHeight:1.5 }}>{job.description}</div>
      )}

      <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
        <Tag color={typeColor}>{job.type}</Tag>
        {(job.tags||[]).slice(0,compact?2:4).map((t,i)=><Tag key={i}>{t}</Tag>)}
      </div>

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid var(--border)" }}>
        <div style={{ fontSize:13,fontWeight:700,color:"var(--teal)" }}>{job.pay}</div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={()=>onApply(job.title)} style={{ ...S.btnOut,padding:"6px 14px",fontSize:12 }}>Prep with AI</button>
          {job.applyUrl && job.applyUrl !== "#" && (
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
              style={{ ...S.btn,padding:"7px 16px",fontSize:12,display:"inline-flex",alignItems:"center",gap:4 }}>
              Apply Now ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children, color="var(--text-faint)" }) {
  return <span style={{ fontSize:11,padding:"3px 9px",borderRadius:20,background:"var(--surface2)",color,border:"1px solid var(--border)",fontWeight:500 }}>{children}</span>;
}

function Loading() {
  return (
    <div style={{ display:"flex",justifyContent:"center",padding:"2rem" }}>
      <div style={{ width:32,height:32,borderRadius:"50%",border:"3px solid var(--border)",borderTopColor:"var(--teal)",animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AFYA PANEL — AI Chat
// ════════════════════════════════════════════════════════════════════════════
function AfyaPanel({ user, applyTarget, clearApply }) {
  const [mode, setMode]         = useState("wellness");
  const [messages, setMessages] = useState(() => store.get(HISTORY_KEY,[]));
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [crisis, setCrisis]     = useState(false);
  const msgsRef   = useRef(null);
  const initialized = useRef(false);

  useEffect(() => { if (messages.length>0) store.set(HISTORY_KEY, messages.slice(-40)); }, [messages]);
  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, [messages, loading]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (messages.length===0) {
      const g = user.mood==="struggling"||user.mood==="low"
        ? `Habari ${user.name}. I'm Akili Afya — your wellness companion. I can see today is tough. You're not alone — I'm right here. What's on your mind?`
        : `Habari ${user.name}! I'm Akili Afya — your wellness and career companion. I remember our conversations and I'm here to help. What can I do for you today?`;
      setMessages([{ role:"assistant",content:g,ts:Date.now() }]);
    }
  }, []);

  useEffect(() => {
    if (applyTarget) {
      setMode("career");
      const msg = `I want to apply for the "${applyTarget}" position. Help me prepare — what should I say, how should I write a cover letter, and what should I expect in the interview?`;
      clearApply();
      setTimeout(()=>send(msg), 350);
    }
  }, [applyTarget]);

  const send = useCallback(async (textOverride) => {
    const text = textOverride || input.trim();
    if (!text || loading) return;
    setInput(""); setError(null);
    const userMsg = { role:"user", content:text, ts:Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    try {
      const data = await apiPost("/api/chat", {
        messages: updated.map(({ role, content }) => ({ role, content })),
        mode,
        user: { name:user.name||"",age:user.age||"",county:user.county||"",skills:user.skills||[],mood:user.mood||"good" },
      });
      setMessages([...updated, { role:"assistant",content:data.reply,ts:Date.now() }]);
      if (data.crisis) setCrisis(true);
    } catch (err) {
      setError(err.message||"Could not reach the AI. Check your connection.");
      setMessages(updated.slice(0,-1));
      setInput(text);
    } finally { setLoading(false); }
  }, [messages, mode, input, loading, user]);

  const quickPrompts = mode==="wellness" ? QUICK_WELLNESS : QUICK_CAREER;

  return (
    <div>
      {crisis && (
        <div style={{ background:"var(--red-light)",border:"1px solid #FECACA",borderRadius:"var(--radius-sm)",padding:"10px 14px",marginBottom:12,fontSize:13,color:"var(--red)",fontWeight:500 }}>
          🆘 Crisis support: <strong>0800 723 253</strong> — Befrienders Kenya (toll-free, 24/7)
        </div>
      )}
      {error && (
        <div style={{ background:"var(--amber-light)",border:"1px solid #FCD34D",borderRadius:"var(--radius-sm)",padding:"10px 14px",fontSize:12,color:"#92400E",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span>⚠️ {error}</span>
          <button onClick={()=>setError(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"#92400E",fontWeight:700 }}>✕</button>
        </div>
      )}

      <div style={{ ...S.card,padding:0,overflow:"hidden",display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:400,maxHeight:620 }}>
        {/* Header */}
        <div style={{ background:"#0D1117",padding:"0.85rem 1rem",display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:"50%",background:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14,fontWeight:700,color:"#fff" }}>Akili Afya</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)" }}>{messages.length>1?`${messages.length} messages · saved`:"Always here · English & Kiswahili"}</div>
          </div>
          <div style={{ display:"flex",gap:6 }}>
            {["wellness","career"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{
                padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",
                border:mode===m?"1px solid var(--teal)":"1px solid rgba(255,255,255,0.15)",
                background:mode===m?"var(--teal)":"transparent",
                color:mode===m?"#fff":"rgba(255,255,255,0.5)",
                transition:"all 0.15s",textTransform:"capitalize",
              }}>{m==="wellness"?"Wellness":"Career"}</button>
            ))}
            <button onClick={()=>{store.del(HISTORY_KEY);window.location.reload();}} title="Clear history"
              style={{ marginLeft:4,background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"rgba(255,255,255,0.3)",fontSize:11,padding:"4px 8px",cursor:"pointer" }}>Clear</button>
          </div>
        </div>

        {/* Messages */}
        <div ref={msgsRef} style={{ flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:10,background:"var(--surface2)" }}>
          {messages.map((m,i)=>(
            <div key={i} style={{ display:"flex",gap:8,alignItems:"flex-end",flexDirection:m.role==="user"?"row-reverse":"row" }}>
              {m.role==="assistant" && (
                <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0 }}>🤖</div>
              )}
              <div style={{ maxWidth:"78%" }}>
                <div style={{ padding:"9px 13px",borderRadius:14,fontSize:13,lineHeight:1.6,
                  ...(m.role==="user"
                    ? { background:"var(--teal)",color:"#fff",borderBottomRightRadius:4 }
                    : { background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text)",borderBottomLeftRadius:4,boxShadow:"var(--shadow-sm)" }) }}>
                  {m.content.split("\n").map((line,j)=><p key={j} style={{ margin:j>0?"5px 0 0":0 }}>{line}</p>)}
                </div>
                {m.ts && <div style={{ fontSize:10,color:"var(--text-faint)",marginTop:2,textAlign:m.role==="user"?"right":"left" }}>
                  {new Date(m.ts).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}
                </div>}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex",gap:8,alignItems:"flex-end" }}>
              <div style={{ width:26,height:26,borderRadius:"50%",background:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>🤖</div>
              <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,borderBottomLeftRadius:4,padding:"10px 14px",display:"flex",gap:4,boxShadow:"var(--shadow-sm)" }}>
                {[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"var(--text-faint)",animation:"bounce 1.2s infinite",animationDelay:`${i*0.2}s` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        <div style={{ display:"flex",flexWrap:"wrap",gap:5,padding:"8px 10px 4px",background:"var(--surface)",borderTop:"1px solid var(--border)" }}>
          {quickPrompts.map(p=>(
            <button key={p} onClick={()=>send(p)} disabled={loading} style={{
              padding:"4px 11px",borderRadius:20,fontSize:11,cursor:"pointer",
              border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text-muted)",
              transition:"all 0.15s",opacity:loading?0.5:1,
            }}>{p}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display:"flex",gap:8,padding:"8px 10px",background:"var(--surface)",borderTop:"1px solid var(--border)" }}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }}
            placeholder={loading?"Akili is thinking…":"Type in English or Kiswahili…"}
            disabled={loading}
            style={{ flex:1,border:"1.5px solid var(--border)",borderRadius:50,padding:"9px 16px",fontSize:13,outline:"none",background:"var(--surface2)",color:"var(--text)",transition:"border 0.2s",opacity:loading?0.7:1 }} />
          <button onClick={()=>send()} disabled={!input.trim()||loading}
            style={{ width:38,height:38,borderRadius:"50%",background:"var(--teal)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:(!input.trim()||loading)?0.4:1,flexShrink:0,transition:"opacity 0.2s" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════════════════════
const RESOURCES = [
  { icon:"📞", bg:"var(--teal-light)",   title:"Befrienders Kenya — Crisis Helpline",          desc:"Free, confidential 24/7 support for anyone in emotional distress.", link:"0800 723 253 (toll-free)", url:"tel:0800723253" },
  { icon:"🏥", bg:"var(--purple-light)", title:"Mathari National Teaching & Referral Hospital", desc:"Kenya's primary public psychiatric facility. Outpatient services available.", link:"+254 20 2724017", url:"tel:+254202724017" },
  { icon:"💬", bg:"var(--amber-light)",  title:"Niskize — SMS Mental Health Support",           desc:"Text-based, confidential, low-cost mental health support.", link:'SMS "HELP" to 21138', url:"sms:21138" },
  { icon:"🎓", bg:"var(--teal-light)",   title:"TVETA — Technical & Vocational Training",       desc:"800+ TVET institutions across Kenya. Free and subsidised courses.", link:"tveta.go.ke", url:"https://www.tveta.go.ke" },
  { icon:"💼", bg:"var(--purple-light)", title:"Kazi Mtaani — Government Youth Employment",     desc:"Short-term employment programme for youth in informal settlements.", link:"youthemployment.go.ke", url:"https://www.youthemployment.go.ke" },
  { icon:"📱", bg:"var(--amber-light)",  title:"Ajira Digital — Online Work Training",          desc:"Free government programme training youth for the digital economy.", link:"ajiradigital.go.ke", url:"https://www.ajiradigital.go.ke" },
  { icon:"🌐", bg:"var(--blue-light)",   title:"BrighterMonday Kenya",                          desc:"Kenya's top job board — thousands of live opportunities.", link:"brightermonday.co.ke", url:"https://www.brightermonday.co.ke" },
  { icon:"🚀", bg:"var(--teal-light)",   title:"Fuzu Kenya — Career Platform",                  desc:"Smart career matching for East African professionals.", link:"fuzu.com/kenya/jobs", url:"https://www.fuzu.com/kenya/jobs" },
];
function ResourcesPanel() {
  return (
    <>
      <div style={{ ...S.label,marginBottom:12 }}>Support & opportunities</div>
      {RESOURCES.map(r=>(
        <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none",display:"block",marginBottom:10 }}>
          <div style={{ ...S.card,display:"flex",gap:14,alignItems:"flex-start",transition:"box-shadow 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow="var(--shadow-md)"}
            onMouseLeave={e=>e.currentTarget.style.boxShadow="var(--shadow-sm)"}>
            <div style={{ width:42,height:42,borderRadius:"var(--radius-sm)",background:r.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{r.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:3 }}>{r.title}</div>
              <div style={{ fontSize:12,color:"var(--text-muted)",lineHeight:1.5,marginBottom:4 }}>{r.desc}</div>
              <span style={{ fontSize:12,color:"var(--teal)",fontWeight:600 }}>{r.link} →</span>
            </div>
          </div>
        </a>
      ))}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════════════════════════════════
function ProfilePanel({ user, mood }) {
  const moodLog   = store.get(MOOD_LOG_KEY,[]);
  const chatCount = store.get(HISTORY_KEY,[]).length;
  const initials  = (user.name||"?").slice(0,2).toUpperCase();
  return (
    <>
      <div style={{ ...S.card,marginBottom:12 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:"1.25rem" }}>
          <div style={{ width:58,height:58,borderRadius:"50%",background:"var(--teal)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,flexShrink:0 }}>{initials}</div>
          <div>
            <div style={{ fontSize:18,fontWeight:700,color:"var(--text)" }}>{user.name}</div>
            <div style={{ fontSize:13,color:"var(--text-muted)" }}>{user.age} yrs · {user.county}, Kenya</div>
          </div>
        </div>
        <PSec label="Skills">
          <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
            {(user.skills.length>0?user.skills:["No skills added"]).map(s=>(
              <span key={s} style={{ padding:"5px 12px",borderRadius:20,background:"var(--teal-light)",color:"var(--teal-dark)",fontSize:12,fontWeight:600 }}>{s}</span>
            ))}
          </div>
        </PSec>
        <PSec label="Current mood"><MoodBadge mood={mood} /></PSec>
        <PSec label="Activity">
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            {[["Mood check-ins",moodLog.length||1],["Chat messages",chatCount]].map(([l,v])=>(
              <div key={l} style={{ background:"var(--surface2)",borderRadius:"var(--radius-sm)",padding:"0.75rem" }}>
                <div style={{ fontSize:11,color:"var(--text-muted)",marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:22,fontWeight:700,color:"var(--text)" }}>{v}</div>
              </div>
            ))}
          </div>
        </PSec>
        <PSec label="About Akili">
          <div style={{ fontSize:12,color:"var(--text-muted)",lineHeight:1.7 }}>
            Akili is a free AI platform helping Kenya's 18M+ youth find jobs and support mental health.
            Your data is saved privately on this device only.{" "}
            <br />Crisis? Call <strong style={{ color:"var(--teal)" }}>0800 723 253</strong> — Befrienders Kenya, toll-free, 24/7.
          </div>
        </PSec>
      </div>
    </>
  );
}
function PSec({ label, children }) {
  return (
    <div style={{ marginTop:"1.1rem",paddingTop:"1.1rem",borderTop:"1px solid var(--border)" }}>
      <div style={{ ...S.label,marginBottom:8 }}>{label}</div>
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
  const saved = store.get(STORAGE_KEY);

  const handleStart = (useSaved) => {
    if (useSaved && saved) { setUser(saved); setScreen("app"); }
    else {
      store.del(STORAGE_KEY); store.del(HISTORY_KEY); store.del(MOOD_LOG_KEY);
      setScreen("onboarding");
    }
  };

  return (
    <>
      {screen==="splash"     && <Splash onStart={handleStart} hasSavedUser={!!saved} />}
      {screen==="onboarding" && <Onboarding onComplete={f=>{ store.set(STORAGE_KEY,f); setUser(f); setScreen("app"); }} />}
      {screen==="app" && user && <AppShell user={user} setUser={setUser} />}
      <InstallBanner />
    </>
  );
}
