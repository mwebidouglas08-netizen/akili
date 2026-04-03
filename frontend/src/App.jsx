import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";

// ── PWA Install — smart cross-platform banner ─────────────────────────────────
const INSTALL_DISMISSED_KEY = "akili_install_dismissed";

function detectPlatform() {
  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  return { isIOS, isAndroid, isSafari, isStandalone };
}

function useInstallBanner() {
  const [nativePrompt, setNativePrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState({});

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    // Already running as installed app — never show
    if (p.isStandalone) return;

    // Already dismissed in this browser
    const dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY);
    if (dismissed) return;

    // Listen for Android/Chrome native prompt
    const handler = (e) => {
      e.preventDefault();
      setNativePrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // For iOS Safari and all other browsers — show manual instructions banner
    // after a short delay so it doesn't clash with page load
    const timer = setTimeout(() => setShow(true), 3000);

    window.addEventListener("appinstalled", () => {
      setShow(false);
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (nativePrompt) {
      nativePrompt.prompt();
      const { outcome } = await nativePrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
        localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      }
      setNativePrompt(null);
    }
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  };

  return { show, nativePrompt, install, dismiss, platform };
}

function InstallBanner() {
  const { show, nativePrompt, install, dismiss, platform } = useInstallBanner();
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  if (!show) return null;

  const isIOS = platform.isIOS;
  const hasNative = !!nativePrompt;

  return (
    <>
      {/* Main banner */}
      <div style={{
        position: "fixed", bottom: 16, left: 12, right: 12, zIndex: 99999,
        background: "#0D1117",
        border: "1px solid rgba(13,158,117,0.5)",
        borderRadius: 18, overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(13,158,117,0.1)",
        fontFamily: "'Sora', sans-serif",
      }}>
        {/* Top bar */}
        <div style={{
          background: "rgba(13,158,117,0.08)",
          borderBottom: "1px solid rgba(13,158,117,0.15)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          {/* App icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: "linear-gradient(135deg, #0D9E75, #064E3B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, boxShadow: "0 4px 12px rgba(13,158,117,0.4)",
          }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, fontWeight: 700, color: "#fff" }}>A</span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
              Install Akili
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
              {hasNative
                ? "Add to your home screen — free, no app store needed"
                : isIOS
                ? "Add to your iPhone home screen in seconds"
                : "Install for quick access — works offline"}
            </div>
          </div>

          <button onClick={dismiss} style={{
            background: "none", border: "none",
            color: "rgba(255,255,255,0.3)", fontSize: 22,
            cursor: "pointer", lineHeight: 1, padding: "4px 6px", flexShrink: 0,
          }}>×</button>
        </div>

        {/* Action area */}
        <div style={{ padding: "12px 16px" }}>
          {hasNative ? (
            // Android Chrome — native install button
            <button onClick={install} style={{
              width: "100%", padding: "13px",
              background: "#0D9E75", color: "#fff",
              border: "none", borderRadius: 12,
              fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "'Sora',sans-serif",
              boxShadow: "0 4px 16px rgba(13,158,117,0.4)",
              transition: "opacity 0.2s",
            }}>
              Add to Home Screen
            </button>
          ) : isIOS ? (
            // iOS Safari — step by step instructions
            <>
              <button
                onClick={() => setShowIOSSteps((s) => !s)}
                style={{
                  width: "100%", padding: "13px",
                  background: "rgba(13,158,117,0.15)",
                  color: "#0D9E75", border: "1px solid rgba(13,158,117,0.3)",
                  borderRadius: 12, fontSize: 15, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Sora',sans-serif",
                }}>
                {showIOSSteps ? "Hide steps" : "Show me how →"}
              </button>
              {showIOSSteps && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { n: 1, icon: "⬆️", text: 'Tap the Share button at the bottom of Safari' },
                    { n: 2, icon: "📲", text: 'Scroll down and tap "Add to Home Screen"' },
                    { n: 3, icon: "✅", text: 'Tap "Add" — Akili appears on your home screen' },
                  ].map((s) => (
                    <div key={s.n} style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "rgba(13,158,117,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#0D9E75", flexShrink: 0,
                      }}>{s.n}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, paddingTop: 4 }}>
                        {s.icon} {s.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Desktop / other browsers
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px",
            }}>
              <span style={{ fontSize: 20 }}>💻</span>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                Click the install icon <strong style={{ color: "#0D9E75" }}>⊕</strong> in your browser address bar to install Akili on your device.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


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

// ── Persistence ───────────────────────────────────────────────────────────────
const storage = {
  get: (key, fallback = null) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  clear: (key) => { try { localStorage.removeItem(key); } catch {} },
};

// ── API helper ─────────────────────────────────────────────────────────────────
async function apiPost(endpoint, body) {
  const res = await fetch(endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
  return data;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = {
  card: { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"1.25rem" },
  label: { fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-muted)" },
  btnPrimary: { background:"var(--teal)", color:"#fff", border:"none", borderRadius:"var(--radius-pill)", padding:"12px 32px", fontSize:14, fontWeight:600, cursor:"pointer" },
};

// ════════════════════════════════════════════════════════════════════════════
// CINEMATIC SPLASH
// ════════════════════════════════════════════════════════════════════════════
function Splash({ onStart, hasSavedUser }) {
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: -(Math.random() * 0.4 + 0.1),
        alpha: Math.random() * 0.6 + 0.1,
        color: Math.random() > 0.7 ? "#0D9E75" : "#ffffff",
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  // Staggered entrance
  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
    setTimeout(() => setHeroVisible(true), 500);
    setTimeout(() => setStatsVisible(true), 1000);
  }, []);

  const features = [
    { icon:"💼", tag:"KAZI", title:"AI Job Matching", desc:"Skills-based matching to 500+ Kenyan employers. No CV needed to start.", color:"#0D9E75" },
    { icon:"🧠", tag:"AFYA", title:"Wellness Companion", desc:"Always-on mental health support in Kiswahili & English, 24/7.", color:"#6C4FD4" },
    { icon:"📍", tag:"LOCAL", title:"Built for Kenya", desc:"Every feature tuned for Nairobi, Mombasa, Kisumu and all 47 counties.", color:"#D97706" },
  ];

  const stats = [
    { value:"18M+", label:"Kenyan youth served" },
    { value:"500+", label:"Job opportunities" },
    { value:"24/7", label:"Wellness support" },
    { value:"Free", label:"Always & forever" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#070B0F", position:"relative", overflow:"hidden", fontFamily:"'Sora',sans-serif" }}>

      {/* Animated particle canvas */}
      <canvas ref={canvasRef} style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0 }} />

      {/* Cinematic grid overlay */}
      <div style={{
        position:"absolute", inset:0, zIndex:0, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(13,158,117,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(13,158,117,0.03) 1px, transparent 1px)",
        backgroundSize:"60px 60px",
      }} />

      {/* Deep radial glow — teal */}
      <div style={{
        position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)",
        width:700, height:700, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(13,158,117,0.12) 0%, transparent 70%)",
        pointerEvents:"none", zIndex:0,
      }} />
      {/* Purple glow bottom right */}
      <div style={{
        position:"absolute", bottom:"-10%", right:"-10%",
        width:500, height:500, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(108,79,212,0.1) 0%, transparent 70%)",
        pointerEvents:"none", zIndex:0,
      }} />

      {/* NAV */}
      <nav style={{
        position:"relative", zIndex:10, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"1.5rem 2.5rem",
        borderBottom:"1px solid rgba(255,255,255,0.04)",
        opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(-10px)",
        transition:"all 0.6s ease",
      }}>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:22, fontWeight:700, color:"#fff", letterSpacing:-1 }}>
          aki<span style={{ color:"#0D9E75" }}>li</span>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", letterSpacing:"0.14em", textTransform:"uppercase" }}>Kazi · Afya · Matumaini</span>
          {hasSavedUser && (
            <button onClick={() => onStart(true)} style={{
              marginLeft:16, background:"rgba(13,158,117,0.15)", border:"1px solid rgba(13,158,117,0.3)",
              borderRadius:20, padding:"6px 18px", fontSize:12, color:"#0D9E75",
              cursor:"pointer", fontFamily:"'Sora',sans-serif", fontWeight:600,
            }}>Resume →</button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <div style={{
        position:"relative", zIndex:10, maxWidth:860, margin:"0 auto",
        padding:"5rem 2rem 3rem", textAlign:"center",
      }}>

        {/* Live badge */}
        <div style={{
          display:"inline-flex", alignItems:"center", gap:8,
          background:"rgba(13,158,117,0.1)", border:"1px solid rgba(13,158,117,0.25)",
          borderRadius:20, padding:"6px 18px", marginBottom:"2rem",
          opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
          transition:"all 0.7s ease 0.1s",
        }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#0D9E75", display:"inline-block", animation:"pulse 2s infinite" }} />
          <span style={{ fontSize:11, color:"#0D9E75", fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase" }}>Now live across Kenya</span>
        </div>

        {/* Main headline */}
        <div style={{
          opacity: heroVisible ? 1 : 0, transform: heroVisible ? "none" : "translateY(30px)",
          transition:"all 0.8s ease",
        }}>
          <h1 style={{
            fontSize:"clamp(2.8rem, 8vw, 5.5rem)", fontWeight:700, color:"#fff",
            lineHeight:1.08, margin:"0 0 1.5rem", letterSpacing:"-0.03em",
            fontFamily:"'Sora',sans-serif",
          }}>
            Your future starts<br />
            <span style={{
              color:"#0D9E75",
              textShadow:"0 0 40px rgba(13,158,117,0.4)",
            }}>right here.</span>
          </h1>

          <p style={{
            fontSize:"clamp(1rem, 2.5vw, 1.2rem)", color:"rgba(255,255,255,0.5)",
            maxWidth:560, margin:"0 auto 2.5rem", lineHeight:1.75,
          }}>
            Akili connects Kenya's youth to real jobs and real mental health support —
            powered by AI, free forever, in Kiswahili and English.
          </p>

          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button
              onClick={() => onStart(false)}
              style={{
                background:"#0D9E75", color:"#fff", border:"none",
                borderRadius:"var(--radius-pill)", padding:"16px 44px",
                fontSize:16, fontWeight:700, cursor:"pointer",
                fontFamily:"'Sora',sans-serif", letterSpacing:"0.01em",
                boxShadow:"0 0 30px rgba(13,158,117,0.35)",
                transition:"all 0.2s",
              }}
              onMouseEnter={(e) => { e.target.style.transform="scale(1.04)"; e.target.style.boxShadow="0 0 50px rgba(13,158,117,0.5)"; }}
              onMouseLeave={(e) => { e.target.style.transform="scale(1)"; e.target.style.boxShadow="0 0 30px rgba(13,158,117,0.35)"; }}
            >
              Anza sasa — Begin Free
            </button>
            {hasSavedUser && (
              <button
                onClick={() => onStart(true)}
                style={{
                  background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.7)",
                  border:"1px solid rgba(255,255,255,0.12)", borderRadius:"var(--radius-pill)",
                  padding:"16px 36px", fontSize:15, fontWeight:600, cursor:"pointer",
                  fontFamily:"'Sora',sans-serif", transition:"all 0.2s",
                }}
                onMouseEnter={(e) => e.target.style.background="rgba(255,255,255,0.08)"}
                onMouseLeave={(e) => e.target.style.background="rgba(255,255,255,0.04)"}
              >
                Continue →
              </button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:1,
          maxWidth:640, margin:"4rem auto 0",
          background:"rgba(255,255,255,0.04)", borderRadius:16,
          border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden",
          opacity: statsVisible ? 1 : 0, transform: statsVisible ? "none" : "translateY(20px)",
          transition:"all 0.8s ease",
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding:"1.25rem 0.75rem", textAlign:"center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{ fontSize:"clamp(1.2rem,3vw,1.6rem)", fontWeight:700, color:"#0D9E75", fontFamily:"'Space Mono',monospace" }}>{s.value}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:4, letterSpacing:"0.04em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURE CARDS */}
      <div style={{
        position:"relative", zIndex:10, maxWidth:960, margin:"0 auto",
        padding:"1rem 2rem 2rem",
        display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16,
      }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:20, padding:"1.75rem",
            opacity: statsVisible ? 1 : 0,
            transform: statsVisible ? "none" : "translateY(30px)",
            transition:`all 0.7s ease ${0.15 * i + 1.1}s`,
            position:"relative", overflow:"hidden",
          }}>
            {/* Card accent glow */}
            <div style={{
              position:"absolute", top:-30, right:-30, width:100, height:100,
              borderRadius:"50%", background:`radial-gradient(circle, ${f.color}22 0%, transparent 70%)`,
              pointerEvents:"none",
            }} />
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6, marginBottom:16,
              background:`${f.color}18`, border:`1px solid ${f.color}30`,
              borderRadius:20, padding:"4px 12px",
            }}>
              <span style={{ fontSize:14 }}>{f.icon}</span>
              <span style={{ fontSize:10, fontWeight:700, color:f.color, letterSpacing:"0.1em" }}>{f.tag}</span>
            </div>
            <div style={{ fontSize:17, fontWeight:700, color:"#fff", marginBottom:8 }}>{f.title}</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", lineHeight:1.65 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* TESTIMONIAL STRIP */}
      <div style={{
        position:"relative", zIndex:10, maxWidth:960, margin:"1rem auto",
        padding:"0 2rem",
        opacity: statsVisible ? 1 : 0, transition:"all 0.8s ease 1.6s",
      }}>
        <div style={{
          background:"rgba(13,158,117,0.05)", border:"1px solid rgba(13,158,117,0.12)",
          borderRadius:16, padding:"1.5rem 2rem",
          display:"flex", alignItems:"center", gap:"2rem", flexWrap:"wrap",
        }}>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:15, color:"rgba(255,255,255,0.7)", lineHeight:1.7, fontStyle:"italic" }}>
              "Akili helped me land my first job at Jumia within 2 weeks. The AI career coach knew exactly what to say in my interview."
            </div>
            <div style={{ fontSize:12, color:"#0D9E75", fontWeight:600, marginTop:10 }}>— Brian M., 23, Nairobi</div>
          </div>
          <div style={{ width:1, height:60, background:"rgba(13,158,117,0.2)", flexShrink:0 }} />
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:15, color:"rgba(255,255,255,0.7)", lineHeight:1.7, fontStyle:"italic" }}>
              "Nilikuwa sipendi kuzungumza na mtu. Akili Afya ilinisaidia kupata nguvu tena. Nashukuri sana."
            </div>
            <div style={{ fontSize:12, color:"#6C4FD4", fontWeight:600, marginTop:10 }}>— Amina W., 19, Mombasa</div>
          </div>
        </div>
      </div>

      {/* BOTTOM CTA */}
      <div style={{
        position:"relative", zIndex:10, textAlign:"center", padding:"3rem 2rem 4rem",
        opacity: statsVisible ? 1 : 0, transition:"all 0.8s ease 1.8s",
      }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
          Free forever · No credit card · Works on all phones · 47 counties
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CINEMATIC ONBOARDING
// ════════════════════════════════════════════════════════════════════════════
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name:"", age:"", county:"", skills:[], mood:"good", moodEmoji:"😊", moodLabel:"Good" });
  const [animating, setAnimating] = useState(false);
  const [slideIn, setSlideIn] = useState(true);

  const next = () => {
    setAnimating(true);
    setSlideIn(false);
    setTimeout(() => { setStep((s) => s + 1); setSlideIn(true); setAnimating(false); }, 300);
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSkill = (s) => set("skills", form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s]);

  const TOTAL = 5;
  const pct = ((step) / (TOTAL - 1)) * 100;

  const steps = [
    { q: <><span style={{ color:"rgba(255,255,255,0.5)" }}>Habari!</span> What's your <HL>name</HL>?</>, content: (
      <>
        <input style={OI} placeholder="Enter your name…" value={form.name} onChange={(e) => set("name", e.target.value)} onKeyDown={(e) => e.key==="Enter" && form.name.trim() && next()} autoFocus />
        <NB onClick={next} disabled={!form.name.trim()}>Continue →</NB>
      </>
    )},
    { q: <><span style={{ color:"rgba(255,255,255,0.5)" }}>Nice to meet you, {form.name}!</span><br/>How old are <HL>you</HL>?</>, content: (
      <>
        <input style={OI} type="number" min="15" max="35" placeholder="Your age…" value={form.age} onChange={(e) => set("age", e.target.value)} onKeyDown={(e) => e.key==="Enter" && form.age && next()} autoFocus />
        <NB onClick={next} disabled={!form.age}>Continue →</NB>
      </>
    )},
    { q: <>Which <HL>county</HL> are you based in?</>, content: (
      <>
        <OChips items={COUNTIES} selected={[form.county]} single onToggle={(v) => set("county", v)} />
        <NB onClick={next} disabled={!form.county}>Continue →</NB>
      </>
    )},
    { q: <>What are your <HL>skills</HL>?<br/><span style={{ fontSize:14, color:"rgba(255,255,255,0.35)", fontWeight:400 }}>Pick all that apply</span></>, content: (
      <>
        <OChips items={SKILLS} selected={form.skills} onToggle={toggleSkill} />
        <NB onClick={next}>Continue →</NB>
      </>
    )},
    { q: <>How are you <HL>feeling</HL> today?</>, content: (
      <>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:24 }}>
          {MOODS.map((m) => {
            const active = form.mood === m.key;
            return (
              <button key={m.key} onClick={() => setForm((f) => ({ ...f, mood:m.key, moodEmoji:m.emoji, moodLabel:m.label }))}
                style={{
                  padding:"14px 8px", borderRadius:14, border: active?"2px solid #0D9E75":"1px solid rgba(255,255,255,0.1)",
                  background: active?"rgba(13,158,117,0.15)":"rgba(255,255,255,0.04)",
                  cursor:"pointer", textAlign:"center", transition:"all 0.15s",
                }}>
                <div style={{ fontSize:24, marginBottom:4 }}>{m.emoji}</div>
                <div style={{ fontSize:11, fontWeight:600, color: active?"#0D9E75":"rgba(255,255,255,0.5)" }}>{m.label}</div>
              </button>
            );
          })}
        </div>
        <NB onClick={() => onComplete(form)} glow>Enter Akili →</NB>
      </>
    )},
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#070B0F", display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      {/* Grid bg */}
      <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(13,158,117,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(13,158,117,0.02) 1px, transparent 1px)", backgroundSize:"60px 60px", pointerEvents:"none" }} />

      {/* Progress bar */}
      <div style={{ position:"relative", zIndex:10, padding:"1.5rem 2rem 0", display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:18, fontWeight:700, color:"#fff" }}>
          aki<span style={{ color:"#0D9E75" }}>li</span>
        </div>
        <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"#0D9E75", borderRadius:2, transition:"width 0.4s ease", boxShadow:"0 0 8px rgba(13,158,117,0.6)" }} />
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", fontFamily:"'Space Mono',monospace", minWidth:40, textAlign:"right" }}>{step + 1}/{TOTAL}</div>
      </div>

      {/* Step content */}
      <div style={{
        flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        padding:"2rem", position:"relative", zIndex:10,
      }}>
        <div style={{
          maxWidth:540, width:"100%",
          opacity: slideIn ? 1 : 0,
          transform: slideIn ? "translateY(0)" : "translateY(20px)",
          transition:"all 0.35s ease",
        }}>
          <div style={{ fontSize:"clamp(1.5rem,4vw,2rem)", fontWeight:700, color:"#fff", marginBottom:"1.75rem", lineHeight:1.3 }}>
            {steps[step].q}
          </div>
          {steps[step].content}
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display:"flex", justifyContent:"center", gap:8, padding:"1.5rem", position:"relative", zIndex:10 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: i===step?24:8, height:8, borderRadius:4, background: i<step?"#0D9E75": i===step?"#0D9E75":"rgba(255,255,255,0.15)", transition:"all 0.3s ease" }} />
        ))}
      </div>
    </div>
  );
}

const OI = { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"15px 18px", fontSize:16, color:"#fff", outline:"none", marginBottom:16, fontFamily:"'Sora',sans-serif", transition:"border 0.2s" };
function HL({ children }) { return <span style={{ color:"#0D9E75" }}>{children}</span>; }
function NB({ onClick, disabled, children, glow }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: glow ? "#0D9E75" : "rgba(13,158,117,0.15)",
      color: glow ? "#fff" : "#0D9E75",
      border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : "rgba(13,158,117,0.4)"}`,
      borderRadius:50, padding:"13px 36px", fontSize:15, fontWeight:600,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily:"'Sora',sans-serif",
      opacity: disabled ? 0.35 : 1, transition:"all 0.2s",
      boxShadow: glow ? "0 0 30px rgba(13,158,117,0.35)" : "none",
    }}>{children}</button>
  );
}
function OChips({ items, selected, onToggle, single }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
      {items.map((item) => {
        const active = selected.includes(item);
        return (
          <button key={item} onClick={() => onToggle(item)} style={{
            padding:"9px 18px", borderRadius:50, fontSize:13, fontWeight:500,
            border: active ? "1px solid #0D9E75" : "1px solid rgba(255,255,255,0.1)",
            background: active ? "rgba(13,158,117,0.2)" : "rgba(255,255,255,0.04)",
            color: active ? "#0D9E75" : "rgba(255,255,255,0.65)",
            cursor:"pointer", transition:"all 0.15s",
          }}>{item}</button>
        );
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
  const [tab, setTab]        = useState("dashboard");
  const [jobs, setJobs]      = useState([]);
  const [mood, setMoodState] = useState({ key:user.mood, emoji:user.moodEmoji, label:user.moodLabel });
  const [crisis, setCrisis]  = useState(user.mood === "struggling");
  const [applyTarget, setApplyTarget] = useState(null);

  const setMood = (m) => {
    setMoodState(m);
    const log = storage.get(MOOD_LOG_KEY, []);
    log.push({ date:new Date().toISOString(), mood:m.key, emoji:m.emoji });
    storage.set(MOOD_LOG_KEY, log.slice(-30));
    setCrisis(m.key === "struggling");
    const updated = { ...user, mood:m.key, moodEmoji:m.emoji, moodLabel:m.label };
    setUser(updated);
    storage.set(STORAGE_KEY, updated);
  };

  useEffect(() => {
    apiPost("/api/jobs", { skills:user.skills, county:user.county }).then((d) => setJobs(d.jobs||[])).catch(console.error);
  }, []);

  const handleApply = (jobTitle) => { setApplyTarget(jobTitle); setTab("afya"); };
  const initials = (user.name||"?").slice(0,2).toUpperCase();

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh" }}>
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

      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", display:"flex", padding:"0 1rem", overflowX:"auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"14px 18px", fontSize:13, fontWeight:500, border:"none", background:"none", borderBottom: tab===t.id?"2px solid var(--teal)":"2px solid transparent", color: tab===t.id?"var(--teal)":"var(--text-muted)", cursor:"pointer", whiteSpace:"nowrap", transition:"color 0.2s" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex:1, padding:"1.5rem", maxWidth:900, margin:"0 auto", width:"100%" }}>
        {crisis && (
          <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"var(--radius-sm)", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ flex:1, fontSize:13, color:"var(--red)" }}>You're not alone — call <strong>0800 723 253</strong> (Befrienders Kenya, free, 24/7).</div>
            <button onClick={() => setTab("afya")} style={{ ...S.btnPrimary, background:"var(--red)", padding:"8px 18px", fontSize:12, whiteSpace:"nowrap" }}>Talk now</button>
          </div>
        )}
        {tab==="dashboard"  && <Dashboard user={user} jobs={jobs.slice(0,3)} mood={mood} setMood={setMood} onApply={handleApply} />}
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
function Dashboard({ user, jobs, mood, setMood, onApply }) {
  const moodLog = storage.get(MOOD_LOG_KEY, []);
  return (
    <>
      <div style={{ background:"#0D1117", borderRadius:"var(--radius)", padding:"1.5rem 2rem", marginBottom:"1.5rem", color:"#fff" }}>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>Habari, {user.name}!</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>{user.county} · {user.skills.length} skills · Here's your Akili dashboard.</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:"1.5rem" }}>
        {[{ label:"Job matches", value:jobs.length, sub:"Based on your skills" }, { label:"Check-in streak", value:moodLog.length||1, sub:"Days logged" }, { label:"Mood today", value:mood.emoji, sub:mood.label }].map((s) => (
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
            <button key={m.key} onClick={() => setMood(m)} style={{ flex:1, minWidth:70, padding:12, borderRadius:"var(--radius-sm)", border: mood.key===m.key?"1.5px solid var(--teal)":"1.5px solid var(--border)", background: mood.key===m.key?"var(--teal-light)":"var(--bg)", cursor:"pointer", textAlign:"center", transition:"all 0.15s" }}>
              <div style={{ fontSize:22, marginBottom:4 }}>{m.emoji}</div>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--text-muted)" }}>{m.label}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function JobCard({ job, onApply }) {
  const clr = job.match>85 ? { bg:"var(--teal-light)", text:"var(--teal-dark)" } : job.type==="Gig" ? { bg:"var(--purple-light)", text:"var(--purple)" } : { bg:"#EEF2FF", text:"#3730A3" };
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

function KaziPanel({ jobs, onApply }) {
  return (
    <>
      <div style={{ ...S.label, marginBottom:"0.75rem" }}>AI-matched opportunities — ranked by fit</div>
      {jobs.length===0 && <div style={{ ...S.card, color:"var(--text-muted)", fontSize:14 }}>Loading opportunities…</div>}
      {jobs.map((j) => <JobCard key={j.id} job={j} onApply={onApply} />)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AFYA PANEL
// ════════════════════════════════════════════════════════════════════════════
function AfyaPanel({ user, applyTarget, clearApplyTarget }) {
  const [mode, setMode]         = useState("wellness");
  const [messages, setMessages] = useState(() => storage.get(HISTORY_KEY, []));
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [crisis, setCrisis]     = useState(false);
  const msgsRef   = useRef(null);
  const initialized = useRef(false);

  useEffect(() => { if (messages.length > 0) storage.set(HISTORY_KEY, messages.slice(-40)); }, [messages]);
  useEffect(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, [messages, loading]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (messages.length === 0) {
      const greeting = user.mood==="struggling"||user.mood==="low"
        ? `Habari ${user.name}. I'm Akili Afya — your wellness companion. I can see today is tough. You're not alone — I'm here to listen. What's on your mind?`
        : `Habari ${user.name}! I'm Akili Afya — your wellness and career companion. I remember our conversations. How can I support you today?`;
      setMessages([{ role:"assistant", content:greeting, ts:Date.now() }]);
    }
  }, []);

  useEffect(() => {
    if (applyTarget) {
      setMode("career");
      const msg = `I want to apply for "${applyTarget}". Help me prepare — cover letter, what to say, and what to expect in the interview.`;
      clearApplyTarget();
      setTimeout(() => send(msg), 300);
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
    const apiMessages = updated.map(({ role, content }) => ({ role, content }));
    try {
      const data = await apiPost("/api/chat", {
        messages: apiMessages, mode,
        user: { name:user.name||"", age:user.age||"", county:user.county||"", skills:user.skills||[], mood:user.mood||"good" },
      });
      setMessages([...updated, { role:"assistant", content:data.reply, ts:Date.now() }]);
      if (data.crisis) setCrisis(true);
    } catch (err) {
      setError(err.message||"Could not reach the AI. Check your internet and try again.");
      setMessages(updated.slice(0,-1));
      setInput(text);
    } finally { setLoading(false); }
  }, [messages, mode, input, loading, user]);

  const clearHistory = () => { storage.clear(HISTORY_KEY); window.location.reload(); };
  const quickPrompts = mode==="wellness" ? QUICK_WELLNESS : QUICK_CAREER;

  return (
    <div>
      {crisis && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"var(--radius-sm)", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <span style={{ flex:1, fontSize:13, color:"var(--red)" }}>🆘 Crisis support: <strong>0800 723 253</strong> — Befrienders Kenya (toll-free, 24/7)</span>
        </div>
      )}
      {error && (
        <div style={{ background:"#FEF3C7", border:"1px solid #FCD34D", borderRadius:"var(--radius-sm)", padding:"10px 16px", fontSize:13, color:"#92400E", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#92400E", fontWeight:600 }}>✕</button>
        </div>
      )}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden", display:"flex", flexDirection:"column", height:560 }}>
        <div style={{ background:"#0D1117", padding:"0.85rem 1.25rem", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:"50%", background:"var(--teal)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#fff" }}>Akili Afya</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{messages.length>1?`${messages.length} messages · saved`:"Always here · Kiswahili & English"}</div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {["wellness","career"].map((m) => (
              <button key={m} onClick={() => setMode(m)} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", border: mode===m?"1px solid var(--teal)":"1px solid rgba(255,255,255,0.15)", background: mode===m?"var(--teal)":"transparent", color: mode===m?"#fff":"rgba(255,255,255,0.5)", transition:"all 0.15s", textTransform:"capitalize" }}>{m==="wellness"?"Wellness":"Career"}</button>
            ))}
            <button onClick={clearHistory} style={{ marginLeft:4, background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, color:"rgba(255,255,255,0.3)", fontSize:11, padding:"4px 8px", cursor:"pointer" }}>Clear</button>
          </div>
        </div>

        <div ref={msgsRef} style={{ flex:1, overflowY:"auto", padding:"1.25rem", display:"flex", flexDirection:"column", gap:12, background:"var(--bg)" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-end", flexDirection: m.role==="user"?"row-reverse":"row" }}>
              {m.role==="assistant" && <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--teal)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>🤖</div>}
              <div style={{ maxWidth:"78%" }}>
                <div style={{ padding:"10px 14px", borderRadius:16, fontSize:14, lineHeight:1.6, ...(m.role==="user" ? { background:"var(--teal)", color:"#fff", borderBottomRightRadius:4 } : { background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text)", borderBottomLeftRadius:4 }) }}>
                  {m.content.split("\n").map((line, j) => <p key={j} style={{ margin:j>0?"6px 0 0":0 }}>{line}</p>)}
                </div>
                {m.ts && <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:3, textAlign: m.role==="user"?"right":"left" }}>{new Date(m.ts).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</div>}
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

        <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"0.75rem 1rem 0.5rem", background:"var(--bg)", borderTop:"1px solid var(--border)" }}>
          {quickPrompts.map((p) => <button key={p} onClick={() => send(p)} disabled={loading} style={{ padding:"5px 12px", borderRadius:20, fontSize:11, cursor:"pointer", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-muted)", transition:"all 0.15s", opacity:loading?0.5:1 }}>{p}</button>)}
        </div>

        <div style={{ display:"flex", gap:10, padding:"0.85rem 1rem", borderTop:"1px solid var(--border)", background:"var(--surface)" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} }} placeholder={loading?"Akili is thinking…":"Type in English or Kiswahili…"} disabled={loading}
            style={{ flex:1, border:"1px solid var(--border)", borderRadius:50, padding:"10px 18px", fontSize:14, outline:"none", background:"var(--bg)", color:"var(--text)", transition:"border 0.2s", opacity:loading?0.7:1 }} />
          <button onClick={() => send()} disabled={!input.trim()||loading} style={{ width:42, height:42, borderRadius:"50%", background:"var(--teal)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:(!input.trim()||loading)?0.4:1, flexShrink:0, transition:"opacity 0.2s" }}>
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
  { icon:"📞", bg:"var(--teal-light)",   title:"Befrienders Kenya — Crisis Helpline",          desc:"Free, confidential support 24/7 for anyone in emotional distress.",                        link:"0800 723 253 (toll-free)" },
  { icon:"🏥", bg:"var(--purple-light)", title:"Mathari National Teaching & Referral Hospital", desc:"Kenya's primary public psychiatric facility with outpatient mental health services.",       link:"+254 20 2724017" },
  { icon:"💬", bg:"var(--amber-light)",  title:"Niskize — SMS Mental Health Support",           desc:"Text-based, confidential, low-cost mental health support for Kenyans.",                   link:'SMS "HELP" to 21138' },
  { icon:"🎓", bg:"var(--teal-light)",   title:"TVETA — Technical & Vocational Training",       desc:"800+ TVET institutions across Kenya. Free and subsidised courses for youth.",              link:"tveta.go.ke" },
  { icon:"💼", bg:"var(--purple-light)", title:"Kazi Mtaani — Government Youth Employment",     desc:"Short-term employment programme for youth in urban informal settlements.",                 link:"youthemployment.go.ke" },
  { icon:"📱", bg:"var(--amber-light)",  title:"Ajira Digital — Online Work Training",          desc:"Free government programme training youth to earn income through digital platforms.",       link:"ajiradigital.go.ke" },
];
function ResourcesPanel() {
  return RESOURCES.map((r) => (
    <div key={r.title} style={{ ...S.card, display:"flex", gap:16, alignItems:"flex-start", marginBottom:12 }}>
      <div style={{ width:44, height:44, borderRadius:"var(--radius-sm)", background:r.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{r.icon}</div>
      <div>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>{r.title}</div>
        <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.5, marginBottom:6 }}>{r.desc}</div>
        <span style={{ fontSize:12, color:"var(--teal)", fontWeight:600 }}>{r.link}</span>
      </div>
    </div>
  ));
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════════════════════════════════
function ProfilePanel({ user, mood }) {
  const moodLog   = storage.get(MOOD_LOG_KEY, []);
  const chatCount = storage.get(HISTORY_KEY, []).length;
  const initials  = (user.name||"?").slice(0,2).toUpperCase();
  return (
    <div style={{ ...S.card }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.25rem" }}>
        <div style={{ width:60, height:60, borderRadius:"50%", background:"var(--teal)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700 }}>{initials}</div>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{user.name}</div>
          <div style={{ fontSize:13, color:"var(--text-muted)" }}>{user.age} yrs · {user.county}, Kenya</div>
        </div>
      </div>
      <Sec label="Your skills"><div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{(user.skills.length>0?user.skills:["No skills added"]).map((s) => <span key={s} style={{ padding:"6px 14px", borderRadius:50, background:"var(--teal-light)", color:"var(--teal-dark)", fontSize:12, fontWeight:600 }}>{s}</span>)}</div></Sec>
      <Sec label="Current mood"><MoodBadge mood={mood} /></Sec>
      <Sec label="Activity stats">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[{ label:"Mood check-ins", value:moodLog.length||1 }, { label:"Chat messages", value:chatCount }].map((s) => (
            <div key={s.label} style={{ background:"var(--bg)", borderRadius:"var(--radius-sm)", padding:"0.75rem" }}>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Sec>
      <Sec label="About Akili">
        <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.6 }}>Akili is a free AI platform helping Kenya's 18M+ youth find jobs and support their mental health. Your data is saved privately on this device. In crisis? Call <strong style={{ color:"var(--teal)" }}>0800 723 253</strong> — Befrienders Kenya, toll-free, 24/7.</div>
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
    if (useSaved && savedUser) { setUser(savedUser); setScreen("app"); }
    else {
      storage.clear(STORAGE_KEY); storage.clear(HISTORY_KEY); storage.clear(MOOD_LOG_KEY);
      setScreen("onboarding");
    }
  };

  return (
    <>
      {screen==="splash"     && <Splash onStart={handleStart} hasSavedUser={!!savedUser} />}
      {screen==="onboarding" && <Onboarding onComplete={(f) => { storage.set(STORAGE_KEY,f); setUser(f); setScreen("app"); }} />}
      {screen==="app" && user && <AppShell user={user} setUser={setUser} />}
      <InstallBanner />
    </>
  );
}
