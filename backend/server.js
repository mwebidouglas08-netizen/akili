require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");
const crypto    = require("crypto");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json({ limit: "50kb" }));

// ── In-memory store (replace with DB later) ───────────────────────────────────
let JOBS_STORE = [
  { id:"j1",  title:"Junior Data Analyst",        company:"Safaricom PLC",         type:"Full-time",     pay:"KSh 45,000/mo",          match:94, tags:["Excel","Data","Nairobi"],        skills:["Data entry","IT / Tech","Accounting"],      county:["Nairobi","Mombasa"],          applyUrl:"https://www.safaricom.co.ke/careers",              posted:new Date().toISOString(), active:true },
  { id:"j2",  title:"Social Media Manager",        company:"Jumia Kenya",           type:"Remote",        pay:"KSh 30,000/mo",          match:91, tags:["Instagram","TikTok","Remote"],   skills:["Social media","Graphic design","Writing"],  county:["Any"],                        applyUrl:"https://group.jumia.com/careers",                   posted:new Date().toISOString(), active:true },
  { id:"j3",  title:"Delivery Rider",              company:"Glovo Kenya",           type:"Gig",           pay:"KSh 800–1,500/day",      match:88, tags:["Gig","Daily pay","Flexible"],    skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"], applyUrl:"https://glovoapp.com/ke/en/courier",               posted:new Date().toISOString(), active:true },
  { id:"j4",  title:"Community Health Promoter",   company:"Amref Health Africa",   type:"Full-time",     pay:"KSh 28,000/mo",          match:85, tags:["NGO","Health","Training"],       skills:["Healthcare","Teaching","Customer service"], county:["Any"],                        applyUrl:"https://amref.org/job_opportunities",              posted:new Date().toISOString(), active:true },
  { id:"j5",  title:"Graphic Designer",            company:"Nation Media Group",     type:"Full-time",     pay:"KSh 35,000/mo",          match:82, tags:["Creative","Adobe","Nairobi"],    skills:["Graphic design","Social media"],             county:["Nairobi"],                    applyUrl:"https://www.nationmedia.com/careers",              posted:new Date().toISOString(), active:true },
  { id:"j6",  title:"Sales Agent",                 company:"Apollo Agriculture",     type:"Gig",           pay:"Commission+KSh 15,000",  match:79, tags:["Rural","Farming","Commission"],  skills:["Sales","Farming","Customer service"],        county:["Any"],                        applyUrl:"https://apolloagriculture.com/careers",            posted:new Date().toISOString(), active:true },
  { id:"j7",  title:"Kitchen Hand",                company:"Java House Kenya",       type:"Full-time",     pay:"KSh 22,000/mo",          match:76, tags:["Food","Training","Nairobi"],     skills:["Cooking"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"], applyUrl:"https://www.javahouseafrica.com/careers", posted:new Date().toISOString(), active:true },
  { id:"j8",  title:"Software Developer",          company:"Andela Kenya",          type:"Remote",        pay:"KSh 80,000–120,000/mo",  match:89, tags:["Tech","Remote","Graduate"],      skills:["IT / Tech","Data entry"],                   county:["Any"],                        applyUrl:"https://andela.com/join-andela",                   posted:new Date().toISOString(), active:true },
  { id:"j9",  title:"Clinical Nurse Officer",      company:"Aga Khan Hospital",      type:"Full-time",     pay:"KSh 55,000/mo",          match:86, tags:["Healthcare","Hospital"],          skills:["Healthcare"],                               county:["Nairobi","Mombasa"],          applyUrl:"https://www.agakhanacademies.org/careers",         posted:new Date().toISOString(), active:true },
  { id:"j10", title:"Bolt Driver Partner",          company:"Bolt Kenya",             type:"Gig",           pay:"KSh 2,000–5,000/day",    match:83, tags:["Gig","Driving","Flexible"],      skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"], applyUrl:"https://bolt.eu/en-ke/driver", posted:new Date().toISOString(), active:true },
  { id:"j11", title:"Accounts Assistant",           company:"KPMG Kenya",             type:"Full-time",     pay:"KSh 40,000/mo",          match:80, tags:["Finance","Excel","Graduate"],    skills:["Accounting","Data entry","IT / Tech"],      county:["Nairobi"],                    applyUrl:"https://home.kpmg/ke/en/home/careers.html",        posted:new Date().toISOString(), active:true },
  { id:"j12", title:"Tailor / Fashion Designer",   company:"Kariokor Market",        type:"Self-employed", pay:"KSh 500–2,000/order",    match:75, tags:["Creative","Self-employed"],      skills:["Tailoring"],                                county:["Nairobi","Mombasa"],          applyUrl:"https://www.jiji.co.ke/nairobi/jobs",              posted:new Date().toISOString(), active:true },
];

let ANNOUNCEMENTS = [
  { id:"a1", title:"Welcome to Akili!", message:"Akili is now live across Kenya. Find jobs, get wellness support, and build your future — free forever.", type:"info", active:true, createdAt:new Date().toISOString() },
];

let STATS = { totalUsers:0, chatMessages:0, jobViews:0, applications:0 };

// ── Admin auth middleware ──────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token  = req.headers["authorization"]?.replace("Bearer ", "");
  const secret = process.env.ADMIN_SECRET || "akili-admin-2026";
  if (!token || token !== secret) {
    return res.status(401).json({ error: "Unauthorized. Invalid admin token." });
  }
  next();
}

const chatLimiter = rateLimit({ windowMs:60000, max:60, message:{ error:"Too many messages." }, standardHeaders:true, legacyHeaders:false });

// ── Crisis detection ──────────────────────────────────────────────────────────
const CRISIS = ["suicide","kill myself","end my life","kujiua","no reason to live","want to die","better off dead","nafsi yangu","nijiue","mauti"];
const detectCrisis = t => t ? CRISIS.some(kw => t.toLowerCase().includes(kw)) : false;

// ── Updated crisis contact ────────────────────────────────────────────────────
const BEFRIENDERS_CONTACT = "+254 722 178 177";

function buildSystemPrompt(mode, user) {
  const profile = [
    user.name   ? `Name: ${user.name}`            : null,
    user.age    ? `Age: ${user.age}`              : null,
    user.county ? `County: ${user.county}, Kenya` : null,
    user.skills?.length ? `Skills: ${user.skills.join(", ")}` : null,
    user.mood   ? `Current mood: ${user.mood}`    : null,
  ].filter(Boolean).join(" | ");

  if (mode === "wellness") return `You are Akili Afya, a warm culturally sensitive AI mental wellness companion for Kenyan youth.
User profile: ${profile}
- Respond in the same language the user writes — English or Kiswahili.
- Lead with empathy. Validate feelings before advice. Keep replies 3-5 sentences.
- Crisis signals: acknowledge pain, give Befrienders Kenya helpline (${BEFRIENDERS_CONTACT}, available 24/7), encourage them to call immediately.
- Ground advice in Kenyan context: family, community, faith, local resources.
- Never diagnose. Encourage professional help for serious issues.
- Remember the full conversation and build on it. Be human, warm, real.`;

  return `You are Akili Kazi, a sharp practical AI career coach for Kenyan youth.
User profile: ${profile}
- Give specific actionable Kenya-focused career advice.
- Reference real Kenyan employers: Safaricom, KCB, Equity Bank, Nation Media, Andela Kenya, KPMG Kenya.
- Reference job platforms: BrighterMonday Kenya, Fuzu Kenya, LinkedIn Kenya, MyJobMag Kenya.
- Reference gig platforms: Glovo Kenya, Bolt Kenya, Sendy, Uber Kenya.
- Reference govt programmes: Kazi Mtaani, Ajira Digital, Hustler Fund, TVET Kenya.
- Help with CV writing, cover letters, interview prep, salary negotiation, side hustles.
- Keep responses focused 3-6 sentences. Remember the full conversation.`;
}

function cleanMessages(raw) {
  let msgs = (raw||[]).filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string"&&m.content.trim()).map(m=>({role:m.role,content:m.content.trim().slice(0,4000)}));
  while(msgs.length&&msgs[0].role!=="user")msgs.shift();
  const alt=[];for(const m of msgs){if(!alt.length)alt.push(m);else if(alt[alt.length-1].role===m.role)alt[alt.length-1]=m;else alt.push(m);}
  while(alt.length&&alt[alt.length-1].role!=="user")alt.pop();
  return alt.slice(-20);
}

// ── Gemini — ONLY verified working models ────────────────────────────────────
// gemini-2.0-flash and gemini-2.0-flash-lite are the ONLY stable free models
// All 1.5 variants have been removed from v1beta generateContent
const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGeminiModel(model, systemPrompt, messages, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      system_instruction:{ parts:[{ text:systemPrompt }] },
      contents: messages.map(m=>({ role:m.role==="assistant"?"model":"user", parts:[{text:m.content}] })),
      generationConfig:{ maxOutputTokens:800, temperature:0.75 },
      safetySettings:[
        {category:"HARM_CATEGORY_HARASSMENT",        threshold:"BLOCK_NONE"},
        {category:"HARM_CATEGORY_HATE_SPEECH",       threshold:"BLOCK_NONE"},
        {category:"HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold:"BLOCK_NONE"},
        {category:"HARM_CATEGORY_DANGEROUS_CONTENT", threshold:"BLOCK_ONLY_HIGH"},
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status = res.status; err.model = model;
    throw err;
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || "unknown";
    if (reason === "SAFETY") return "I want to help. Could you rephrase that? I'm here for you.";
    const err = new Error(`No text in response. finishReason: ${reason}`);
    err.status = 500; err.model = model; throw err;
  }
  return text;
}

async function callGemini(systemPrompt, messages) {
  const apiKey = (process.env.GEMINI_API_KEY||"").trim();
  if (!apiKey) { const e=new Error("GEMINI_API_KEY not set. Add it in Railway Variables — free key at aistudio.google.com/app/apikey"); e.status=500; throw e; }
  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[gemini] trying ${model}`);
      const text = await callGeminiModel(model, systemPrompt, messages, apiKey);
      console.log(`[gemini] SUCCESS ${model} len=${text.length}`);
      return text;
    } catch(err) {
      lastErr = err;
      console.warn(`[gemini] FAILED ${model} status=${err.status} "${err.message.slice(0,80)}"`);
      if (err.status===401||err.status===403) throw err;
      if (err.status===429) { await sleep(2000); continue; }
      continue;
    }
  }
  throw lastErr || new Error("Gemini unavailable. Please try again.");
}

// ── Startup self-test ─────────────────────────────────────────────────────────
async function selfTest() {
  const key = (process.env.GEMINI_API_KEY||"").trim();
  if (!key) { console.error("⚠️  GEMINI_API_KEY MISSING"); return; }
  try {
    const r = await callGemini("Reply with just the word OK.", [{role:"user",content:"OK?"}]);
    console.log(`✅ Gemini working — "${r.trim().slice(0,30)}"`);
  } catch(e) { console.error("❌ Gemini test failed:", e.message); }
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════════

app.get("/api/health", (_req, res) => {
  const key = (process.env.GEMINI_API_KEY||"").trim();
  res.json({ status:"ok", timestamp:new Date().toISOString(), models:GEMINI_MODELS, geminiKey:key?`SET (${key.slice(0,8)}...)`:"MISSING", befrienders:BEFRIENDERS_CONTACT });
});

// Public announcements
app.get("/api/announcements", (_req, res) => {
  res.json({ announcements: ANNOUNCEMENTS.filter(a=>a.active) });
});

// Chat
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;
  if (!Array.isArray(messages)||!messages.length) return res.status(400).json({error:"messages array required"});
  if (!["wellness","career"].includes(mode)) return res.status(400).json({error:"mode must be wellness or career"});
  const key = (process.env.GEMINI_API_KEY||"").trim();
  if (!key) return res.status(500).json({error:"GEMINI_API_KEY not set. Add it in Railway Variables — free key at aistudio.google.com/app/apikey"});
  const final = cleanMessages(messages);
  if (!final.length) return res.status(400).json({error:"No valid user message"});
  const lastUser = [...final].reverse().find(m=>m.role==="user");
  const isCrisis = detectCrisis(lastUser?.content);
  STATS.chatMessages++;
  console.log(`[chat] mode=${mode} user="${user?.name}" msgs=${final.length}`);
  try {
    const reply = await callGemini(buildSystemPrompt(mode, user||{}), final);
    res.json({ reply, crisis:isCrisis, befriendersContact: isCrisis ? BEFRIENDERS_CONTACT : undefined });
  } catch(err) {
    console.error("[chat] error:", err.status, err.message);
    if (err.status===401||err.status===403) return res.status(403).json({error:"Gemini API key invalid. Get a new free key at aistudio.google.com/app/apikey and update GEMINI_API_KEY in Railway Variables."});
    if (err.status===429) return res.status(429).json({error:"AI busy. Please wait a moment and try again."});
    res.status(503).json({error:`AI error: ${err.message}`});
  }
});

// Jobs (public)
app.post("/api/jobs", (req, res) => {
  const {skills=[], county="Nairobi", query=""} = req.body;
  STATS.jobViews++;
  let jobs = JOBS_STORE.filter(j=>j.active);
  if (skills.length) jobs = jobs.filter(j=>j.skills.some(s=>skills.includes(s))||j.county.includes("Any")||j.county.includes(county));
  if (!jobs.length) jobs = JOBS_STORE.filter(j=>j.active).slice(0,8);
  if (query.trim()) {
    const q=query.toLowerCase();
    const f=jobs.filter(j=>j.title.toLowerCase().includes(q)||j.company.toLowerCase().includes(q)||j.tags.some(t=>t.toLowerCase().includes(q)));
    if (f.length) jobs=f;
  }
  jobs.sort((a,b)=>b.match-a.match);
  const q2=query||(skills.length?skills.slice(0,2).join(" "):"jobs");
  const enc=encodeURIComponent;
  res.json({ jobs, boards:{
    brightermonday:`https://www.brightermonday.co.ke/listings?q=${enc(q2)}&l=Kenya`,
    fuzu:`https://www.fuzu.com/kenya/jobs?search=${enc(q2)}`,
    linkedin:`https://www.linkedin.com/jobs/search/?keywords=${enc(q2+" Kenya")}`,
    myjobmag:`https://www.myjobmag.co.ke/search/?q=${enc(q2)}`,
  }, hasRealJobs:false });
});

// Track application click
app.post("/api/jobs/:id/apply", (req, res) => {
  STATS.applications++;
  res.json({ success:true });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES — all protected by ADMIN_SECRET
// ════════════════════════════════════════════════════════════════════════════

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const secret = process.env.ADMIN_SECRET || "akili-admin-2026";
  if (password === secret) {
    res.json({ success:true, token:secret, message:"Welcome to Akili Admin!" });
  } else {
    res.status(401).json({ error:"Invalid password." });
  }
});

// Dashboard stats
app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  res.json({
    stats: STATS,
    totalJobs: JOBS_STORE.filter(j=>j.active).length,
    totalAnnouncements: ANNOUNCEMENTS.filter(a=>a.active).length,
    models: GEMINI_MODELS,
    befriendersContact: BEFRIENDERS_CONTACT,
    geminiKey: (process.env.GEMINI_API_KEY||"").trim() ? "SET ✓" : "MISSING ✗",
  });
});

// Get all jobs (admin sees inactive too)
app.get("/api/admin/jobs", requireAdmin, (_req, res) => {
  res.json({ jobs: JOBS_STORE });
});

// Create job
app.post("/api/admin/jobs", requireAdmin, (req, res) => {
  const { title,company,type,pay,match,tags,skills,county,applyUrl } = req.body;
  if (!title||!company) return res.status(400).json({error:"title and company are required"});
  const job = {
    id: `j${Date.now()}`,
    title, company,
    type:       type     || "Full-time",
    pay:        pay      || "Competitive",
    match:      Number(match) || 80,
    tags:       Array.isArray(tags) ? tags : (tags||"").split(",").map(t=>t.trim()).filter(Boolean),
    skills:     Array.isArray(skills) ? skills : (skills||"").split(",").map(s=>s.trim()).filter(Boolean),
    county:     Array.isArray(county) ? county : (county||"Any").split(",").map(c=>c.trim()).filter(Boolean),
    applyUrl:   applyUrl || "#",
    posted:     new Date().toISOString(),
    active:     true,
  };
  JOBS_STORE.unshift(job);
  res.status(201).json({ success:true, job });
});

// Update job
app.put("/api/admin/jobs/:id", requireAdmin, (req, res) => {
  const idx = JOBS_STORE.findIndex(j=>j.id===req.params.id);
  if (idx===-1) return res.status(404).json({error:"Job not found"});
  JOBS_STORE[idx] = { ...JOBS_STORE[idx], ...req.body, id:req.params.id };
  res.json({ success:true, job:JOBS_STORE[idx] });
});

// Toggle job active/inactive
app.put("/api/admin/jobs/:id/toggle", requireAdmin, (req, res) => {
  const job = JOBS_STORE.find(j=>j.id===req.params.id);
  if (!job) return res.status(404).json({error:"Job not found"});
  job.active = !job.active;
  res.json({ success:true, job });
});

// Delete job
app.delete("/api/admin/jobs/:id", requireAdmin, (req, res) => {
  const idx = JOBS_STORE.findIndex(j=>j.id===req.params.id);
  if (idx===-1) return res.status(404).json({error:"Job not found"});
  JOBS_STORE.splice(idx,1);
  res.json({ success:true });
});

// Get announcements (admin)
app.get("/api/admin/announcements", requireAdmin, (_req, res) => {
  res.json({ announcements: ANNOUNCEMENTS });
});

// Create announcement
app.post("/api/admin/announcements", requireAdmin, (req, res) => {
  const { title, message, type } = req.body;
  if (!title||!message) return res.status(400).json({error:"title and message required"});
  const ann = { id:`a${Date.now()}`, title, message, type:type||"info", active:true, createdAt:new Date().toISOString() };
  ANNOUNCEMENTS.unshift(ann);
  res.status(201).json({ success:true, announcement:ann });
});

// Toggle announcement
app.put("/api/admin/announcements/:id/toggle", requireAdmin, (req, res) => {
  const ann = ANNOUNCEMENTS.find(a=>a.id===req.params.id);
  if (!ann) return res.status(404).json({error:"Announcement not found"});
  ann.active = !ann.active;
  res.json({ success:true, announcement:ann });
});

// Delete announcement
app.delete("/api/admin/announcements/:id", requireAdmin, (req, res) => {
  const idx = ANNOUNCEMENTS.findIndex(a=>a.id===req.params.id);
  if (idx===-1) return res.status(404).json({error:"Announcement not found"});
  ANNOUNCEMENTS.splice(idx,1);
  res.json({ success:true });
});

// Reset stats
app.post("/api/admin/stats/reset", requireAdmin, (_req, res) => {
  STATS = { totalUsers:0, chatMessages:0, jobViews:0, applications:0 };
  res.json({ success:true });
});

// ── Serve React + Admin ───────────────────────────────────────────────────────
const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge:"1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  const secret = process.env.ADMIN_SECRET || "akili-admin-2026";
  console.log(`\n✓ Akili on port ${PORT}`);
  console.log(`✓ AI models: ${GEMINI_MODELS.join(" → ")}`);
  console.log(`✓ Gemini key: ${process.env.GEMINI_API_KEY ? "SET ✓" : "MISSING ✗ — add GEMINI_API_KEY in Railway"}`);
  console.log(`✓ Admin secret: ${secret.slice(0,8)}... (set ADMIN_SECRET in Railway to change)`);
  console.log(`✓ Befrienders: ${BEFRIENDERS_CONTACT}\n`);
  setTimeout(selfTest, 3000);
});
