import { useState, useEffect, useRef, useCallback } from "react";
import Chatbot from "./Chatbot.jsx";
import "./index.css";

// ── PWA ───────────────────────────────────────────────────────────────────────
const SNOOZE_KEY = "akili_pwa_snooze";
function InstallBanner() {
  const [visible,setVisible]=useState(false);const[native,setNative]=useState(null);const[isIOS,setIsIOS]=useState(false);const[steps,setSteps]=useState(false);
  useEffect(()=>{
    if(window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone)return;
    const snooze=localStorage.getItem(SNOOZE_KEY);
    if(snooze&&Date.now()-Number(snooze)<7*864e5)return;
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h=e=>{e.preventDefault();setNative(e);};
    window.addEventListener("beforeinstallprompt",h);
    setVisible(true);
    return()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);
  const dismiss=()=>{setVisible(false);localStorage.setItem(SNOOZE_KEY,String(Date.now()));};
  const install=async()=>{if(!native)return;native.prompt();const{outcome}=await native.userChoice;if(outcome==="accepted"){setVisible(false);localStorage.setItem(SNOOZE_KEY,String(Date.now()+365*864e5));}setNative(null);};
  if(!visible)return null;
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:99999,background:"rgba(13,17,23,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(0,212,160,0.3)",fontFamily:"'Sora',sans-serif"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
        <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontWeight:700,fontSize:18,color:"#000",flexShrink:0,boxShadow:"var(--shadow-teal)"}}>A</div>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>Install Akili</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{native?"Tap below — free, no app store":isIOS?"Add to your iPhone home screen":"Install as app — works offline"}</div></div>
        <button onClick={dismiss} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-faint)",fontSize:22,lineHeight:1,padding:4}}>×</button>
      </div>
      <div style={{padding:"10px 16px 14px"}}>
        {native?(<button onClick={install} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",color:"#000",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>Add to Home Screen</button>)
        :isIOS?(<><button onClick={()=>setSteps(s=>!s)} style={{width:"100%",padding:"11px",background:"var(--teal-dim)",color:"var(--teal)",border:"1px solid rgba(0,212,160,0.3)",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>{steps?"Hide":"How to install on iPhone →"}</button>
          {steps&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
            {[["1","Tap Share button","at the bottom of Safari"],["2","Tap \"Add to Home Screen\"","scroll to find it"],["3","Tap \"Add\"","Akili appears on your home screen"]].map(([n,t,s])=>(
              <div key={n} style={{display:"flex",gap:10,alignItems:"flex-start",background:"var(--surface2)",borderRadius:8,padding:"8px 10px"}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:"var(--teal)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#000",flexShrink:0}}>{n}</div>
                <div><div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{t}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{s}</div></div>
              </div>))}</div>}</>)
        :(<div style={{fontSize:12,color:"var(--text-muted)",padding:"8px 0"}}>Click the <strong style={{color:"var(--teal)"}}>install icon ⊕</strong> in your browser address bar.</div>)}
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTIES=["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Machakos","Meru","Nyeri","Kisii","Garissa","Kakamega","Other"];
const SKILLS=["Sales","Customer service","Data entry","Graphic design","Social media","Driving","Cooking","Tailoring","Construction","Teaching","IT / Tech","Farming","Writing","Healthcare","Accounting"];
const MOODS=[{key:"great",emoji:"😄",label:"Great"},{key:"good",emoji:"😊",label:"Good"},{key:"okay",emoji:"😐",label:"Okay"},{key:"low",emoji:"😔",label:"Low"},{key:"struggling",emoji:"😟",label:"Struggling"}];
const QUICK_WELLNESS=["I feel overwhelmed","Siwezi kulala vizuri","How to manage stress?","I need someone to talk to","I feel hopeless"];
const QUICK_CAREER=["Help me write my CV","Mock interview practice","What jobs suit my skills?","How to negotiate salary?","Prepare me for an interview"];
const STORAGE_KEY="akili_user_v2";const HISTORY_KEY="akili_chat_v2";const MOOD_LOG_KEY="akili_mood_v2";

const store={
  get:(k,fb=null)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
  del:(k)=>{try{localStorage.removeItem(k);}catch{}},
};
async function apiPost(url,body){const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Error ${res.status}`);return data;}

// ── Cinematic shared styles ───────────────────────────────────────────────────
const S={
  card:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:"1.25rem",backdropFilter:"blur(10px)"},
  cardHover:{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(0,212,160,0.2)",boxShadow:"0 0 20px rgba(0,212,160,0.08)"},
  label:{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--text-muted)"},
  btn:{background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",color:"#000",border:"none",borderRadius:"var(--radius-pill)",padding:"11px 28px",fontSize:14,fontWeight:700,cursor:"pointer",transition:"all 0.2s",boxShadow:"0 4px 20px var(--teal-glow)"},
  btnGhost:{background:"transparent",color:"var(--teal)",border:"1.5px solid rgba(0,212,160,0.4)",borderRadius:"var(--radius-pill)",padding:"10px 24px",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s"},
};

// ════════════════════════════════════════════════════════════════════════════
// SPLASH — Cinematic
// ════════════════════════════════════════════════════════════════════════════
function Splash({onStart,hasSavedUser}){
  const canvasRef=useRef(null);
  const[vis,setVis]=useState(false);
  const[h1,setH1]=useState(false);
  const[h2,setH2]=useState(false);

  useEffect(()=>{
    const c=canvasRef.current;if(!c)return;
    const ctx=c.getContext("2d");let id;
    const particles=[];
    const resize=()=>{c.width=window.innerWidth;c.height=window.innerHeight;};
    resize();window.addEventListener("resize",resize);
    for(let i=0;i<120;i++)particles.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2+0.3,dx:(Math.random()-.5)*.4,dy:-(Math.random()*.5+.1),alpha:Math.random()*.5+.05,color:Math.random()>.6?"#00D4A0":Math.random()>.5?"#A78BFA":"#ffffff"});
    const draw=()=>{
      ctx.clearRect(0,0,c.width,c.height);
      particles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=p.alpha;ctx.fill();p.x+=p.dx;p.y+=p.dy;if(p.y<-5){p.y=c.height+5;p.x=Math.random()*c.width;}if(p.x<-5)p.x=c.width+5;if(p.x>c.width+5)p.x=-5;});
      ctx.globalAlpha=1;id=requestAnimationFrame(draw);};
    draw();
    return()=>{cancelAnimationFrame(id);window.removeEventListener("resize",resize);};
  },[]);

  useEffect(()=>{
    setTimeout(()=>setVis(true),100);
    setTimeout(()=>setH1(true),400);
    setTimeout(()=>setH2(true),800);
  },[]);

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <canvas ref={canvasRef} style={{position:"absolute",inset:0,pointerEvents:"none"}}/>
      {/* Grid overlay */}
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(0,212,160,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,160,0.03) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
      {/* Glow orbs */}
      <div style={{position:"absolute",top:"15%",left:"50%",transform:"translateX(-50%)",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,212,160,0.08) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"-10%",right:"-5%",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(167,139,250,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>

      {/* Nav */}
      <nav style={{position:"relative",zIndex:10,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 2rem",borderBottom:"1px solid var(--border)",backdropFilter:"blur(10px)",
        opacity:vis?1:0,transform:vis?"none":"translateY(-10px)",transition:"all 0.5s ease"}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:"var(--text)"}}>aki<span style={{color:"var(--teal)"}}>li</span></div>
        <div style={{display:"flex",gap:10}}>
          {hasSavedUser&&<button onClick={()=>onStart(true)} style={{...S.btnGhost,padding:"7px 18px",fontSize:12}}>Continue →</button>}
          <button onClick={()=>onStart(false)} style={{...S.btn,padding:"8px 22px",fontSize:13}}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"3rem 1.5rem 2rem",textAlign:"center",position:"relative",zIndex:10}}>
        {/* Live badge */}
        <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(0,212,160,0.1)",border:"1px solid rgba(0,212,160,0.25)",borderRadius:"var(--radius-pill)",padding:"6px 16px",marginBottom:"1.75rem",
          opacity:vis?1:0,transition:"all 0.6s ease 0.1s"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"var(--teal)",animation:"pulse-teal 2s infinite"}}/>
          <span style={{fontSize:12,color:"var(--teal)",fontWeight:700,letterSpacing:"0.05em"}}>Live across Kenya · Free Forever</span>
        </div>

        <h1 style={{fontSize:"clamp(2.8rem,8vw,5.5rem)",fontWeight:800,lineHeight:1.05,marginBottom:"1.25rem",letterSpacing:"-0.03em",
          opacity:h1?1:0,transform:h1?"none":"translateY(30px)",transition:"all 0.7s ease"}}>
          Your future starts<br/>
          <span style={{color:"var(--teal)",textShadow:"0 0 60px rgba(0,212,160,0.4)"}}>right here.</span>
        </h1>

        <p style={{fontSize:"clamp(1rem,2.5vw,1.2rem)",color:"var(--text-muted)",maxWidth:540,marginBottom:"2.25rem",lineHeight:1.75,
          opacity:h2?1:0,transform:h2?"none":"translateY(20px)",transition:"all 0.7s ease 0.2s"}}>
          Akili connects Kenya's 18 million youth to real jobs and mental health support —
          powered by AI, completely free, in Kiswahili and English.
        </p>

        <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",marginBottom:"3rem",
          opacity:h2?1:0,transition:"all 0.7s ease 0.35s"}}>
          <button onClick={()=>onStart(false)} style={{...S.btn,fontSize:16,padding:"15px 40px"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.04)";e.currentTarget.style.boxShadow="0 8px 30px var(--teal-glow)";}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 20px var(--teal-glow)";}}>
            Anza sasa — Begin Free
          </button>
          {hasSavedUser&&<button onClick={()=>onStart(true)} style={{...S.btnGhost,fontSize:15,padding:"14px 30px"}} onMouseEnter={e=>e.currentTarget.style.background="var(--teal-dim)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            Continue →
          </button>}
        </div>

        {/* Stats bar */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",maxWidth:540,width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:"3rem",
          opacity:h2?1:0,transition:"all 0.7s ease 0.5s"}}>
          {[["18M+","Kenyan youth"],["67%","Unemployment"],["24/7","AI support"],["Free","Always"]].map(([v,l],i)=>(
            <div key={i} style={{padding:"1rem 0.5rem",textAlign:"center",borderRight:i<3?"1px solid var(--border)":"none"}}>
              <div style={{fontSize:"clamp(1.2rem,3vw,1.6rem)",fontWeight:800,color:"var(--teal)",fontFamily:"'Space Mono',monospace"}}>{v}</div>
              <div style={{fontSize:11,color:"var(--text-muted)",marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,maxWidth:720,width:"100%",
          opacity:h2?1:0,transition:"all 0.8s ease 0.65s"}}>
          {[
            {icon:"💼",col:"var(--teal)",title:"Real Job Matching",desc:"AI matches your skills to real Kenyan opportunities with direct application links"},
            {icon:"🧠",col:"var(--purple)",title:"Wellness Support",desc:"24/7 mental health companion in English & Kiswahili — always free, always private"},
            {icon:"🤖",col:"var(--amber)",title:"AI Chatbot",desc:"Always-on AI assistant that remembers you and helps with jobs and wellness"},
          ].map((f,i)=>(
            <div key={i} style={{...S.card,textAlign:"left",transition:"all 0.25s",cursor:"default",animation:`fadeUp 0.6s ease ${0.7+i*0.1}s both`}}
              onMouseEnter={e=>{Object.assign(e.currentTarget.style,S.cardHover);}} onMouseLeave={e=>{Object.assign(e.currentTarget.style,S.card);}}>
              <div style={{fontSize:28,marginBottom:12}}>{f.icon}</div>
              <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:6}}>{f.title}</div>
              <div style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.65}}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{position:"relative",zIndex:10,padding:"1rem",borderTop:"1px solid var(--border)",textAlign:"center",fontSize:11,color:"var(--text-faint)"}}>
        Free · Kiswahili & English · Works on all phones · No CV required · 47 counties
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARDING — Cinematic
// ════════════════════════════════════════════════════════════════════════════
function Onboarding({onComplete}){
  const[step,setStep]=useState(0);
  const[form,setForm]=useState({name:"",age:"",county:"",skills:[],mood:"good",moodEmoji:"😊",moodLabel:"Good"});
  const[anim,setAnim]=useState(true);
  const next=()=>{setAnim(false);setTimeout(()=>{setStep(s=>s+1);setAnim(true);},200);};
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const toggleSkill=s=>set("skills",form.skills.includes(s)?form.skills.filter(x=>x!==s):[...form.skills,s]);
  const total=5;const pct=(step/(total-1))*100;

  const chipStyle=(active,col="var(--teal)")=>({
    padding:"9px 18px",borderRadius:"var(--radius-pill)",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s",
    background:active?`rgba(${col==="var(--teal)"?"0,212,160":"167,139,250"},0.15)`:"var(--surface)",
    color:active?col:"var(--text-muted)",
    border:active?`1.5px solid ${col}`:"1.5px solid var(--border)",
  });

  const steps=[
    {q:<>Habari! What's your <span style={{color:"var(--teal)"}}>name</span>?</>,content:(
      <><input style={OI} placeholder="Enter your name…" value={form.name} onChange={e=>set("name",e.target.value)} onKeyDown={e=>e.key==="Enter"&&form.name.trim()&&next()} autoFocus/>
      <OBtn onClick={next} disabled={!form.name.trim()}>Continue →</OBtn></>
    )},
    {q:<>Nice to meet you, {form.name}! How old are <span style={{color:"var(--teal)"}}>you</span>?</>,content:(
      <><input style={OI} type="number" min="15" max="45" placeholder="Your age…" value={form.age} onChange={e=>set("age",e.target.value)} onKeyDown={e=>e.key==="Enter"&&form.age&&next()} autoFocus/>
      <OBtn onClick={next} disabled={!form.age}>Continue →</OBtn></>
    )},
    {q:<>Which <span style={{color:"var(--teal)"}}>county</span> are you in?</>,content:(
      <><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>{COUNTIES.map(cn=><button key={cn} onClick={()=>set("county",cn)} style={chipStyle(form.county===cn)}>{cn}</button>)}</div>
      <OBtn onClick={next} disabled={!form.county}>Continue →</OBtn></>
    )},
    {q:<>What are your <span style={{color:"var(--teal)"}}>skills</span>? <span style={{fontSize:13,color:"var(--text-muted)",fontWeight:400}}>(pick all)</span></>,content:(
      <><div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>{SKILLS.map(sk=>{const active=form.skills.includes(sk);return<button key={sk} onClick={()=>toggleSkill(sk)} style={chipStyle(active)}>{active?"✓ ":""}{sk}</button>;})}</div>
      <OBtn onClick={next}>Continue →</OBtn></>
    )},
    {q:<>How are you <span style={{color:"var(--teal)"}}>feeling</span> today?</>,content:(
      <><div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:24}}>
        {MOODS.map(m=>{const active=form.mood===m.key;return<button key={m.key} onClick={()=>setForm(f=>({...f,mood:m.key,moodEmoji:m.emoji,moodLabel:m.label}))} style={{padding:"14px 6px",borderRadius:"var(--radius)",border:active?"2px solid var(--teal)":"1.5px solid var(--border)",background:active?"var(--teal-dim)":"var(--surface)",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}><div style={{fontSize:26,marginBottom:4}}>{m.emoji}</div><div style={{fontSize:11,fontWeight:700,color:active?"var(--teal)":"var(--text-muted)"}}>{m.label}</div></button>;})}
      </div><OBtn onClick={()=>onComplete(form)}>Enter Akili →</OBtn></>
    )},
  ];

  return(
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      {/* Grid bg */}
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(0,212,160,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,160,0.02) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none"}}/>
      {/* Progress header */}
      <div style={{position:"relative",zIndex:10,padding:"1.25rem 1.5rem",display:"flex",alignItems:"center",gap:16,background:"rgba(13,17,23,0.8)",backdropFilter:"blur(10px)",borderBottom:"1px solid var(--border)"}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:18,fontWeight:700}}>aki<span style={{color:"var(--teal)"}}>li</span></div>
        <div style={{flex:1,height:4,background:"var(--surface2)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,var(--teal),var(--teal2))",borderRadius:2,transition:"width 0.4s ease",boxShadow:"0 0 10px var(--teal-glow)"}}/>
        </div>
        <div style={{fontSize:12,color:"var(--text-muted)",fontFamily:"'Space Mono',monospace",minWidth:36,textAlign:"right"}}>{step+1}/{total}</div>
      </div>
      {/* Step content */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem 1.5rem",position:"relative",zIndex:10}}>
        <div style={{maxWidth:520,width:"100%",opacity:anim?1:0,transform:anim?"translateY(0)":"translateY(12px)",transition:"all 0.2s ease"}}>
          <h2 style={{fontSize:"clamp(1.5rem,4vw,2rem)",fontWeight:700,color:"var(--text)",marginBottom:"1.75rem",lineHeight:1.3}}>{steps[step].q}</h2>
          {steps[step].content}
        </div>
      </div>
      {/* Step dots */}
      <div style={{display:"flex",justifyContent:"center",gap:8,padding:"1.5rem",borderTop:"1px solid var(--border)",position:"relative",zIndex:10}}>
        {steps.map((_,i)=><div key={i} style={{width:i===step?28:8,height:8,borderRadius:4,background:i<step?"var(--teal)":i===step?"var(--teal)":"var(--surface2)",transition:"all 0.3s ease",boxShadow:i===step?"0 0 8px var(--teal-glow)":"none"}}/>)}
      </div>
    </div>
  );
}

const OI={width:"100%",background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"14px 18px",fontSize:15,color:"var(--text)",outline:"none",marginBottom:16,transition:"border 0.2s, box-shadow 0.2s",fontFamily:"'Sora',sans-serif"};
function OBtn({onClick,disabled,children}){return<button onClick={onClick} disabled={disabled} style={{...S.btn,opacity:disabled?0.35:1,fontSize:14,padding:"13px 36px"}}>{children}</button>;}

// ════════════════════════════════════════════════════════════════════════════
// APP SHELL
// ════════════════════════════════════════════════════════════════════════════
const TABS=[{id:"dashboard",icon:"🏠",label:"Home"},{id:"kazi",icon:"💼",label:"Jobs"},{id:"afya",icon:"🧠",label:"Wellness"},{id:"resources",icon:"📋",label:"Resources"},{id:"profile",icon:"👤",label:"Profile"}];

function AppShell({user,setUser}){
  const[tab,setTab]=useState("dashboard");
  const[jobs,setJobs]=useState([]);const[boards,setBoards]=useState({});const[jobsLoading,setJobsLoading]=useState(true);
  const[mood,setMoodState]=useState({key:user.mood||"good",emoji:user.moodEmoji||"😊",label:user.moodLabel||"Good"});
  const[crisis,setCrisis]=useState(user.mood==="struggling");
  const[applyTarget,setApplyTarget]=useState(null);

  const setMood=m=>{setMoodState(m);const log=store.get(MOOD_LOG_KEY,[]);log.push({date:new Date().toISOString(),mood:m.key,emoji:m.emoji});store.set(MOOD_LOG_KEY,log.slice(-60));setCrisis(m.key==="struggling");const updated={...user,mood:m.key,moodEmoji:m.emoji,moodLabel:m.label};setUser(updated);store.set(STORAGE_KEY,updated);};

  const loadJobs=useCallback(async(q="")=>{setJobsLoading(true);try{const d=await apiPost("/api/jobs",{skills:user.skills,county:user.county,query:q});setJobs(d.jobs||[]);setBoards(d.boards||{});}catch{}finally{setJobsLoading(false);}},[ user.skills,user.county]);
  useEffect(()=>{loadJobs();},[]);

  const handleApply=t=>{setApplyTarget(t);setTab("afya");};
  const initials=(user.name||"?").slice(0,2).toUpperCase();

  return(
    <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"var(--bg)"}}>
      {/* TOP BAR */}
      <div style={{background:"rgba(13,17,23,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--border)",padding:"0 1.25rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:58,position:"sticky",top:0,zIndex:100}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:19,fontWeight:700}}>aki<span style={{color:"var(--teal)"}}>li</span></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <MoodBadge mood={mood}/>
          <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",color:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>{initials}</div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,overflow:"auto",paddingBottom:72}}>
        {/* Grid bg */}
        <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(0,212,160,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,160,0.015) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none",zIndex:0}}/>
        <div style={{maxWidth:860,margin:"0 auto",padding:"1.25rem 1rem",position:"relative",zIndex:1}}>
          {crisis&&(
            <div style={{background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.3)",borderRadius:"var(--radius-sm)",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:16,backdropFilter:"blur(10px)"}}>
              <div style={{flex:1,fontSize:13,color:"var(--red)",fontWeight:600}}>You're not alone 💙 — call <strong>+254 722 178 177</strong> (Befrienders Kenya, free, 24/7)</div>
              <button onClick={()=>setTab("afya")} style={{...S.btn,background:"var(--red)",boxShadow:"none",padding:"7px 16px",fontSize:12,color:"#fff",whiteSpace:"nowrap"}}>Talk now</button>
            </div>
          )}
          {tab==="dashboard"&&<Dashboard user={user} jobs={jobs.slice(0,4)} boards={boards} jobsLoading={jobsLoading} mood={mood} setMood={setMood} onApply={handleApply} gotoKazi={()=>setTab("kazi")}/>}
          {tab==="kazi"&&<KaziPanel jobs={jobs} boards={boards} jobsLoading={jobsLoading} onApply={handleApply} onSearch={loadJobs}/>}
          {tab==="afya"&&<AfyaPanel user={user} applyTarget={applyTarget} clearApply={()=>setApplyTarget(null)}/>}
          {tab==="resources"&&<ResourcesPanel/>}
          {tab==="profile"&&<ProfilePanel user={user} mood={mood}/>}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(13,17,23,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid var(--border)",display:"flex",zIndex:90}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 4px",border:"none",background:"none",cursor:"pointer",gap:3,color:tab===t.id?"var(--teal)":"var(--text-faint)",transition:"color 0.15s",position:"relative",fontFamily:"'Sora',sans-serif"}}>
            <span style={{fontSize:20}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:tab===t.id?700:500}}>{t.label}</span>
            {tab===t.id&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2,borderRadius:2,background:"var(--teal)",boxShadow:"0 0 8px var(--teal-glow)"}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

function MoodBadge({mood}){
  const clr=mood.key==="great"||mood.key==="good"?{bg:"rgba(0,212,160,0.12)",text:"var(--teal)"}:mood.key==="struggling"?{bg:"rgba(255,107,107,0.12)",text:"var(--red)"}:{bg:"rgba(251,184,64,0.12)",text:"var(--amber)"};
  return<span style={{background:clr.bg,color:clr.text,border:`1px solid ${clr.text}30`,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>{mood.emoji} {mood.label}</span>;
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({user,jobs,boards,jobsLoading,mood,setMood,onApply,gotoKazi}){
  const moodLog=store.get(MOOD_LOG_KEY,[]);
  return(
    <>
      {/* Welcome */}
      <div style={{background:"linear-gradient(135deg,rgba(0,212,160,0.08) 0%,rgba(167,139,250,0.05) 100%)",border:"1px solid rgba(0,212,160,0.15)",borderRadius:"var(--radius)",padding:"1.5rem",marginBottom:"1.25rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,212,160,0.15),transparent)",pointerEvents:"none"}}/>
        <div style={{fontSize:20,fontWeight:800,color:"var(--text)",marginBottom:4}}>Habari, {user.name}! 👋</div>
        <div style={{fontSize:13,color:"var(--text-muted)"}}>{user.county} · {user.skills.length} skills · {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long"})}</div>
      </div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.25rem"}}>
        {[{label:"Job matches",value:jobs.length,sub:"Based on skills",color:"var(--teal)"},{label:"Check-ins",value:moodLog.length||1,sub:"Days logged",color:"var(--purple)"},{label:"Today's mood",value:mood.emoji,sub:mood.label,color:"var(--amber)"}].map((s,i)=>(
          <div key={i} style={{...S.card,padding:"0.9rem"}}>
            <div style={{fontSize:11,color:"var(--text-muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:"var(--text-faint)"}}>{s.sub}</div>
          </div>
        ))}
      </div>
      {/* Mood */}
      <div style={{...S.card,marginBottom:"1.25rem"}}>
        <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:12}}>How are you feeling right now?</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {MOODS.map(m=>(
            <button key={m.key} onClick={()=>setMood(m)} style={{flex:1,minWidth:64,padding:"10px 6px",borderRadius:"var(--radius-sm)",border:mood.key===m.key?"2px solid var(--teal)":"1.5px solid var(--border)",background:mood.key===m.key?"var(--teal-dim)":"var(--surface)",cursor:"pointer",textAlign:"center",transition:"all 0.15s",boxShadow:mood.key===m.key?"0 0 12px var(--teal-glow)":"none"}}>
              <div style={{fontSize:20,marginBottom:3}}>{m.emoji}</div>
              <div style={{fontSize:10,fontWeight:700,color:mood.key===m.key?"var(--teal)":"var(--text-muted)"}}>{m.label}</div>
            </button>
          ))}
        </div>
      </div>
      {/* Jobs */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={S.label}>Top matches</div>
        <button onClick={gotoKazi} style={{...S.btnGhost,padding:"5px 14px",fontSize:11}}>View all →</button>
      </div>
      {jobsLoading?<Loading/>:jobs.slice(0,3).map(j=><JobCard key={j.id} job={j} onApply={onApply} compact/>)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KAZI
// ════════════════════════════════════════════════════════════════════════════
function KaziPanel({jobs,boards,jobsLoading,onApply,onSearch}){
  const[query,setQuery]=useState("");const[filter,setFilter]=useState("All");
  const filters=["All","Full-time","Gig","Remote","Contract"];
  const filtered=jobs.filter(j=>{if(filter==="All")return true;if(filter==="Remote")return j.tags?.some(t=>t.toLowerCase().includes("remote"));return j.type===filter;});
  return(
    <>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSearch(query)} placeholder="Search jobs — e.g. 'graphic design Nairobi'…" style={{...OI,marginBottom:0,flex:1,fontSize:13}}/>
        <button onClick={()=>onSearch(query)} style={{...S.btn,padding:"0 18px",fontSize:13,flexShrink:0}}>Search</button>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
        {filters.map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 14px",borderRadius:"var(--radius-pill)",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s",background:filter===f?"linear-gradient(135deg,var(--teal),var(--teal-dark))":var(--surface),color:filter===f?"#000":"var(--text-muted)",border:filter===f?"none":"1.5px solid var(--border)",fontFamily:"'Sora',sans-serif"}}>{f}</button>)}
      </div>
      <div style={{...S.label,marginBottom:10}}>{filtered.length} opportunities{filter!=="All"?` · ${filter}`:""}</div>
      {jobsLoading?<Loading/>:filtered.map(j=><JobCard key={j.id} job={j} onApply={onApply}/>)}
      {Object.keys(boards).length>0&&(
        <div style={{...S.card,marginTop:16}}>
          <div style={{...S.label,marginBottom:12}}>Search on Kenyan job boards</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
            {[["BrighterMonday","brightermonday","var(--blue)"],["Fuzu Kenya","fuzu","var(--purple)"],["LinkedIn Kenya","linkedin","#0A66C2"],["MyJobMag","myjobmag","var(--amber)"]].map(([label,key,col])=>boards[key]&&(
              <a key={key} href={boards[key]} target="_blank" rel="noopener noreferrer" style={{display:"block",padding:"10px 14px",borderRadius:"var(--radius-sm)",border:`1.5px solid ${col}30`,textDecoration:"none",fontSize:12,fontWeight:700,color:col,textAlign:"center",background:`${col}11`,transition:"all 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background=`${col}22`} onMouseLeave={e=>e.currentTarget.style.background=`${col}11`}>{label} →</a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function JobCard({job,onApply,compact}){
  const[hov,setHov]=useState(false);
  const matchColor=job.match>88?"var(--teal)":job.match>75?"var(--amber)":"var(--text-muted)";
  const typeColor=job.type==="Gig"?"var(--purple)":job.type==="Remote"?"var(--blue)":"var(--text-muted)";
  return(
    <div style={{...S.card,marginBottom:10,transition:"all 0.2s",cursor:"default",...(hov?S.cardHover:{})}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:"var(--text)",marginBottom:2}}>{job.title}</div>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>{job.company}{job.posted&&` · ${job.posted}`}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:800,color:matchColor,textShadow:job.match>88?`0 0 10px ${matchColor}40`:"none"}}>{job.match}%</div>
          <div style={{fontSize:10,color:"var(--text-faint)"}}>match</div>
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
        <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"var(--surface2)",color:typeColor,border:`1px solid ${typeColor}30`,fontWeight:600}}>{job.type}</span>
        {(job.tags||[]).slice(0,compact?2:4).map((t,i)=><span key={i} style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"var(--surface)",color:"var(--text-muted)",border:"1px solid var(--border)",fontWeight:500}}>{t}</span>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid var(--border)"}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--teal)"}}>{job.pay}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>onApply(job.title)} style={{...S.btnGhost,padding:"6px 14px",fontSize:12}}>Prep with AI</button>
          {job.applyUrl&&job.applyUrl!=="#"&&<a href={job.applyUrl} target="_blank" rel="noopener noreferrer" style={{...S.btn,padding:"7px 16px",fontSize:12,display:"inline-flex",alignItems:"center",gap:4}}>Apply ↗</a>}
        </div>
      </div>
    </div>
  );
}

function Loading(){return<div style={{display:"flex",justifyContent:"center",padding:"2rem"}}><div style={{width:32,height:32,borderRadius:"50%",border:"3px solid var(--border)",borderTopColor:"var(--teal)",animation:"spin 0.8s linear infinite",boxShadow:"0 0 10px var(--teal-glow)"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;}

// ════════════════════════════════════════════════════════════════════════════
// AFYA PANEL
// ════════════════════════════════════════════════════════════════════════════
function AfyaPanel({user,applyTarget,clearApply}){
  const[mode,setMode]=useState("wellness");
  const[messages,setMessages]=useState(()=>store.get(HISTORY_KEY,[]));
  const[input,setInput]=useState("");const[loading,setLoading]=useState(false);const[error,setError]=useState(null);const[crisis,setCrisis]=useState(false);
  const msgsRef=useRef(null);const initialized=useRef(false);
  useEffect(()=>{if(messages.length>0)store.set(HISTORY_KEY,messages.slice(-40));},[messages]);
  useEffect(()=>{if(msgsRef.current)msgsRef.current.scrollTop=msgsRef.current.scrollHeight;},[messages,loading]);
  useEffect(()=>{if(initialized.current)return;initialized.current=true;if(messages.length===0){const g=user.mood==="struggling"||user.mood==="low"?`Habari ${user.name} 💙 I'm Akili Afya — your wellness companion. Today sounds tough. You're not alone — I'm right here. What's on your mind?`:`Habari ${user.name}! 👋 I'm Akili Afya — your wellness and career companion. I remember our conversations. How can I help today?`;setMessages([{role:"assistant",content:g,ts:Date.now()}]);}},[]);
  useEffect(()=>{if(applyTarget){setMode("career");const msg=`I want to apply for "${applyTarget}". Help me prepare — cover letter, what to say, and what to expect in the interview.`;clearApply();setTimeout(()=>send(msg),350);}},[applyTarget]);

  const send=useCallback(async(textOverride)=>{
    const text=(textOverride||input).trim();if(!text||loading)return;
    setInput("");setError(null);
    const userMsg={role:"user",content:text,ts:Date.now()};
    const updated=[...messages,userMsg];setMessages(updated);setLoading(true);
    try{
      const data=await apiPost("/api/chat",{messages:updated.map(({role,content})=>({role,content})),mode,user:{name:user.name||"",age:user.age||"",county:user.county||"",skills:user.skills||[],mood:user.mood||"good"}});
      setMessages([...updated,{role:"assistant",content:data.reply,ts:Date.now()}]);
      if(data.crisis)setCrisis(true);
    }catch(err){setError(err.message||"Connection error. Please try again.");setMessages(updated.slice(0,-1));setInput(text);}
    finally{setLoading(false);}
  },[messages,mode,input,loading,user]);

  return(
    <div>
      {crisis&&<div style={{background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.3)",borderRadius:"var(--radius-sm)",padding:"10px 14px",marginBottom:12,fontSize:13,color:"var(--red)",fontWeight:600}}>🆘 Crisis: <strong>+254 722 178 177</strong> — Befrienders Kenya (free, 24/7)</div>}
      {error&&<div style={{background:"rgba(251,184,64,0.1)",border:"1px solid rgba(251,184,64,0.3)",borderRadius:"var(--radius-sm)",padding:"10px 14px",fontSize:12,color:"var(--amber)",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>⚠️ {error}</span><button onClick={()=>setError(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--amber)",fontWeight:700}}>✕</button></div>}
      <div style={{...S.card,padding:0,overflow:"hidden",display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:400,maxHeight:620}}>
        {/* Header */}
        <div style={{background:"rgba(0,0,0,0.4)",backdropFilter:"blur(20px)",padding:"0.85rem 1rem",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid rgba(0,212,160,0.15)"}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,boxShadow:"0 0 10px var(--teal-glow)"}}>🤖</div>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>Akili Afya</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{messages.length>1?`${messages.length} messages · saved`:"Always here · English & Kiswahili"}</div></div>
          <div style={{display:"flex",gap:6}}>
            {["wellness","career"].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:mode===m?"1px solid var(--teal)":"1px solid var(--border)",background:mode===m?"var(--teal-dim)":"transparent",color:mode===m?"var(--teal)":"var(--text-faint)",transition:"all 0.15s",fontFamily:"'Sora',sans-serif",textTransform:"capitalize"}}>{m}</button>)}
            <button onClick={()=>{store.del(HISTORY_KEY);window.location.reload();}} style={{background:"none",border:"1px solid var(--border)",borderRadius:6,color:"var(--text-faint)",fontSize:11,padding:"4px 8px",cursor:"pointer"}}>🗑</button>
          </div>
        </div>
        {/* Messages */}
        <div ref={msgsRef} style={{flex:1,overflowY:"auto",padding:"1rem",display:"flex",flexDirection:"column",gap:10,background:"var(--bg2)"}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-end",flexDirection:m.role==="user"?"row-reverse":"row"}}>
              {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🤖</div>}
              <div style={{maxWidth:"78%"}}>
                <div style={{padding:"10px 13px",borderRadius:14,fontSize:13,lineHeight:1.6,...(m.role==="user"?{background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",color:"#000",fontWeight:600,borderBottomRightRadius:4}:{background:"var(--surface2)",border:"1px solid var(--border)",color:"var(--text)",borderBottomLeftRadius:4})}}>
                  {m.content.split("\n").map((line,j)=><p key={j} style={{margin:j>0?"5px 0 0":0}}>{line}</p>)}
                </div>
                {m.ts&&<div style={{fontSize:10,color:"var(--text-faint)",marginTop:2,textAlign:m.role==="user"?"right":"left"}}>{new Date(m.ts).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</div>}
              </div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,var(--teal),var(--teal-dark))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🤖</div><div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:14,borderBottomLeftRadius:4,padding:"12px 16px",display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"var(--teal)",animation:"typingBounce 1.2s infinite",animationDelay:`${i*0.2}s`}}/>)}</div></div>}
        </div>
        {/* Quick prompts */}
        <div style={{display:"flex",flexWrap:"wrap",gap:5,padding:"8px 10px 4px",background:"var(--bg2)",borderTop:"1px solid var(--border)"}}>
          {(mode==="wellness"?QUICK_WELLNESS:QUICK_CAREER).map(p=><button key={p} onClick={()=>send(p)} disabled={loading} style={{padding:"4px 11px",borderRadius:20,fontSize:11,cursor:"pointer",border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text-muted)",transition:"all 0.15s",opacity:loading?0.5:1,fontFamily:"'Sora',sans-serif"}}>{p}</button>)}
        </div>
        {/* Input */}
        <div style={{display:"flex",gap:8,padding:"8px 10px",background:"var(--bg3)",borderTop:"1px solid var(--border)"}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={loading?"Akili is thinking…":"Type in English or Kiswahili…"} disabled={loading}
            style={{flex:1,border:"1.5px solid var(--border)",borderRadius:50,padding:"9px 16px",fontSize:13,outline:"none",background:"var(--surface)",color:"var(--text)",transition:"border 0.2s",opacity:loading?0.7:1,fontFamily:"'Sora',sans-serif"}}
            onFocus={e=>e.target.style.borderColor="var(--teal)"} onBlur={e=>e.target.style.borderColor="var(--border)"}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading} style={{width:38,height:38,borderRadius:"50%",background:input.trim()&&!loading?"linear-gradient(135deg,var(--teal),var(--teal-dark))":"var(--surface2)",border:"none",cursor:input.trim()&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",opacity:(!input.trim()||loading)?0.4:1,flexShrink:0,transition:"all 0.2s",boxShadow:input.trim()&&!loading?"0 0 12px var(--teal-glow)":"none"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={input.trim()&&!loading?"#000":"#4B5A72"}><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>
      <style>{`@keyframes typingBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════════════════════
const RESOURCES=[
  {icon:"📞",col:"var(--teal)",title:"Befrienders Kenya",desc:"Free, confidential 24/7 crisis support.",link:"+254 722 178 177 (toll-free)",url:"tel:+254722178177"},
  {icon:"🏥",col:"var(--purple)",title:"Mathari National Hospital",desc:"Kenya's primary public psychiatric facility.",link:"+254 20 2724017",url:"tel:+254202724017"},
  {icon:"💬",col:"var(--amber)",title:"Niskize SMS Support",desc:"Text-based confidential mental health support.",link:'SMS "HELP" to 21138',url:"sms:21138"},
  {icon:"🎓",col:"var(--teal)",title:"TVETA — Vocational Training",desc:"800+ TVET institutions. Free & subsidised courses.",link:"tveta.go.ke",url:"https://www.tveta.go.ke"},
  {icon:"💼",col:"var(--purple)",title:"Kazi Mtaani",desc:"Government youth employment programme.",link:"youthemployment.go.ke",url:"https://www.youthemployment.go.ke"},
  {icon:"📱",col:"var(--amber)",title:"Ajira Digital",desc:"Free training for digital economy jobs.",link:"ajiradigital.go.ke",url:"https://www.ajiradigital.go.ke"},
  {icon:"🌐",col:"var(--blue)",title:"BrighterMonday Kenya",desc:"Kenya's top job board — thousands of live jobs.",link:"brightermonday.co.ke",url:"https://www.brightermonday.co.ke"},
  {icon:"🚀",col:"var(--teal)",title:"Fuzu Kenya",desc:"Smart career matching for East African professionals.",link:"fuzu.com/kenya/jobs",url:"https://www.fuzu.com/kenya/jobs"},
];
function ResourcesPanel(){
  return<>{RESOURCES.map(r=>(
    <a key={r.title} href={r.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"block",marginBottom:10}}>
      <div style={{...S.card,display:"flex",gap:14,alignItems:"flex-start",transition:"all 0.2s"}} onMouseEnter={e=>Object.assign(e.currentTarget.style,S.cardHover)} onMouseLeave={e=>Object.assign(e.currentTarget.style,S.card)}>
        <div style={{width:42,height:42,borderRadius:"var(--radius-sm)",background:`${r.col}18`,border:`1px solid ${r.col}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{r.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:3}}>{r.title}</div>
          <div style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.5,marginBottom:4}}>{r.desc}</div>
          <span style={{fontSize:12,color:r.col,fontWeight:700}}>{r.link} →</span>
        </div>
      </div>
    </a>
  ))}</>;
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════════════════════════════════
function ProfilePanel({user,mood}){
  const moodLog=store.get(MOOD_LOG_KEY,[]);const chatCount=store.get(HISTORY_KEY,[]).length;const initials=(user.name||"?").slice(0,2).toUpperCase();
  return(
    <div style={{...S.card}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:"1.25rem"}}>
        <div style={{width:58,height:58,borderRadius:"50%",background:"linear-gradient(135deg,var(--teal),var(--purple))",color:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,flexShrink:0,boxShadow:"0 0 20px rgba(0,212,160,0.2)"}}>{initials}</div>
        <div><div style={{fontSize:18,fontWeight:800,color:"var(--text)"}}>{user.name}</div><div style={{fontSize:13,color:"var(--text-muted)"}}>{user.age} yrs · {user.county}, Kenya</div></div>
      </div>
      {[["Skills",(user.skills.length>0?user.skills:["No skills added"]).map(s=><span key={s} style={{padding:"5px 12px",borderRadius:20,background:"var(--teal-dim)",color:"var(--teal)",border:"1px solid rgba(0,212,160,0.2)",fontSize:12,fontWeight:700}}>{s}</span>)],
        ["Current mood",<MoodBadge key="m" mood={mood}/>],
        ["Activity",<div key="a" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["Check-ins",moodLog.length||1],["Chat msgs",chatCount]].map(([l,v])=><div key={l} style={{background:"var(--surface2)",borderRadius:"var(--radius-sm)",padding:"0.75rem"}}><div style={{fontSize:11,color:"var(--text-muted)",marginBottom:3}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:"var(--text)"}}>{v}</div></div>)}</div>],
        ["About",<div key="ab" style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.7}}>Akili is free for Kenya's 18M+ youth. Data stored privately on this device only. Crisis? Call <strong style={{color:"var(--teal)"}}>+254 722 178 177</strong> — Befrienders Kenya, toll-free, 24/7.</div>],
      ].map(([label,content])=>(
        <div key={label} style={{marginTop:"1.1rem",paddingTop:"1.1rem",borderTop:"1px solid var(--border)"}}>
          <div style={{...S.label,marginBottom:8}}>{label}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{content}</div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const[screen,setScreen]=useState("splash");
  const[user,setUser]=useState(null);
  const saved=store.get(STORAGE_KEY);
  const handleStart=useSaved=>{
    if(useSaved&&saved){setUser(saved);setScreen("app");}
    else{store.del(STORAGE_KEY);store.del(HISTORY_KEY);store.del(MOOD_LOG_KEY);setScreen("onboarding");}
  };
  return(
    <>
      {screen==="splash"&&<Splash onStart={handleStart} hasSavedUser={!!saved}/>}
      {screen==="onboarding"&&<Onboarding onComplete={f=>{store.set(STORAGE_KEY,f);setUser(f);setScreen("app");}}/>}
      {screen==="app"&&user&&<AppShell user={user} setUser={setUser}/>}
      <InstallBanner/>
      {screen!=="splash"&&<Chatbot user={user} autoOpen={false}/>}
    </>
  );
}
