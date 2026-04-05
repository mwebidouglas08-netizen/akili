require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin:"*", methods:["GET","POST","OPTIONS"], allowedHeaders:["Content-Type"] }));
app.use(express.json({ limit:"30kb" }));

const chatLimiter = rateLimit({
  windowMs:60000, max:60,
  message:{ error:"Too many messages. Please wait a moment." },
  standardHeaders:true, legacyHeaders:false,
});

// ── Crisis detection ──────────────────────────────────────────────────────────
const CRISIS = ["suicide","kill myself","end my life","kujiua","no reason to live",
  "want to die","better off dead","nafsi yangu","nijiue","mauti"];
const detectCrisis = (t) => t ? CRISIS.some(kw => t.toLowerCase().includes(kw)) : false;

// ── System prompts ────────────────────────────────────────────────────────────
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
- Crisis signals: acknowledge pain, give Befrienders Kenya (0800 723 253, free 24/7), encourage them to call.
- Ground advice in Kenyan context: family, community, faith, local resources.
- Never diagnose. Encourage professional help for serious issues.
- Remember the full conversation and build on what the user has shared.
- Be human, warm, real. Never robotic or clinical.`;

  return `You are Akili Kazi, a sharp practical AI career coach for Kenyan youth.
User profile: ${profile}
- Give specific actionable Kenya-focused career advice.
- Reference real Kenyan employers: Safaricom, KCB, Equity Bank, Nation Media, Andela Kenya, KPMG Kenya.
- Reference job platforms: BrighterMonday Kenya, Fuzu Kenya, LinkedIn Kenya, MyJobMag Kenya.
- Reference gig platforms: Glovo Kenya, Bolt Kenya, Sendy, Uber Kenya.
- Reference govt programmes: Kazi Mtaani, Ajira Digital, Hustler Fund, TVET Kenya.
- Help with CV writing, cover letters, interview prep, salary negotiation, side hustles.
- Keep responses focused and actionable 3-6 sentences.
- Remember the full conversation and build on it.`;
}

// ── Message cleaner ───────────────────────────────────────────────────────────
function cleanMessages(raw) {
  let msgs = (raw||[])
    .filter(m => m && ["user","assistant"].includes(m.role) && typeof m.content==="string" && m.content.trim())
    .map(m => ({ role:m.role, content:m.content.trim().slice(0,4000) }));
  while (msgs.length && msgs[0].role!=="user") msgs.shift();
  const alt = [];
  for (const m of msgs) {
    if (!alt.length) alt.push(m);
    else if (alt[alt.length-1].role===m.role) alt[alt.length-1]=m;
    else alt.push(m);
  }
  while (alt.length && alt[alt.length-1].role!=="user") alt.pop();
  return alt.slice(-20);
}

// ── Gemini AI — VERIFIED working model names (April 2026) ────────────────────
// Only use pinned stable versions — avoid "latest" and deprecated names
const GEMINI_MODELS = [
  "gemini-2.0-flash",          // Primary — stable, free, fast
  "gemini-2.0-flash-001",      // Pinned stable version
  "gemini-2.0-flash-lite",     // Lightweight fallback
  "gemini-1.5-flash-002",      // Older stable pinned
  "gemini-1.5-flash-001",      // Last resort fallback
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGeminiModel(model, systemPrompt, messages, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts:[{ text:systemPrompt }] },
    contents: messages.map(m => ({
      role: m.role==="assistant" ? "model" : "user",
      parts:[{ text:m.content }],
    })),
    generationConfig: { maxOutputTokens:800, temperature:0.75 },
    safetySettings:[
      { category:"HARM_CATEGORY_HARASSMENT",        threshold:"BLOCK_NONE" },
      { category:"HARM_CATEGORY_HATE_SPEECH",       threshold:"BLOCK_NONE" },
      { category:"HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold:"BLOCK_NONE" },
      { category:"HARM_CATEGORY_DANGEROUS_CONTENT", threshold:"BLOCK_ONLY_HIGH" },
    ],
  };

  const res  = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.status  = res.status;
    err.model   = model;
    err.gemCode = data?.error?.code;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || "unknown";
    if (reason === "SAFETY") return "I want to help. Could you rephrase that? I'm here for you.";
    const err = new Error(`Empty response from ${model}. finishReason: ${reason}`);
    err.status = 500; err.model = model;
    throw err;
  }
  return text;
}

async function callGemini(systemPrompt, messages) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY not configured. Add it in Railway Variables — get a free key at aistudio.google.com/app/apikey");
    err.status = 500;
    throw err;
  }

  let lastErr;
  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[gemini] trying ${model}`);
      const text = await callGeminiModel(model, systemPrompt, messages, apiKey);
      console.log(`[gemini] SUCCESS ${model} chars=${text.length}`);
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[gemini] FAILED ${model} → status=${err.status} msg="${err.message.slice(0,80)}"`);
      if (err.status===401 || err.status===403) throw err; // bad key — stop immediately
      if (err.status===429) { await sleep(1500); continue; } // rate limit — try next
      // 404 / model not found / 400 — try next model
      continue;
    }
  }
  console.error("[gemini] ALL models failed");
  throw lastErr || new Error("All Gemini models unavailable. Please try again.");
}

// ── Startup self-test ─────────────────────────────────────────────────────────
async function selfTest() {
  const key = (process.env.GEMINI_API_KEY||"").trim();
  if (!key) { console.error("⚠️  GEMINI_API_KEY MISSING — AI disabled"); return; }
  try {
    const reply = await callGemini("Reply with just OK", [{ role:"user", content:"OK?" }]);
    console.log(`✅ Gemini AI working — "${reply.trim().slice(0,30)}"`);
  } catch (e) {
    console.error("❌ Gemini test failed:", e.message);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  const key = (process.env.GEMINI_API_KEY||"").trim();
  res.json({ status:"ok", timestamp:new Date().toISOString(), models:GEMINI_MODELS, geminiKey: key ? `SET (${key.slice(0,8)}...)` : "MISSING" });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;
  if (!Array.isArray(messages)||!messages.length) return res.status(400).json({ error:"messages array required" });
  if (!["wellness","career"].includes(mode)) return res.status(400).json({ error:"mode must be wellness or career" });
  const key = (process.env.GEMINI_API_KEY||"").trim();
  if (!key) return res.status(500).json({ error:"GEMINI_API_KEY not set. Add it in Railway Variables — free key at aistudio.google.com/app/apikey" });

  const final = cleanMessages(messages);
  if (!final.length) return res.status(400).json({ error:"No valid user message" });

  const lastUser = [...final].reverse().find(m=>m.role==="user");
  const isCrisis = detectCrisis(lastUser?.content);
  console.log(`[chat] mode=${mode} user="${user?.name}" msgs=${final.length}`);

  try {
    const reply = await callGemini(buildSystemPrompt(mode, user||{}), final);
    res.json({ reply, crisis:isCrisis });
  } catch (err) {
    console.error("[chat] final error:", err.status, err.message);
    if (err.status===401||err.status===403) return res.status(403).json({ error:"Gemini API key is invalid. Get a new free key at aistudio.google.com/app/apikey and update GEMINI_API_KEY in Railway Variables." });
    if (err.status===429) return res.status(429).json({ error:"AI is busy. Please wait a moment and try again." });
    res.status(503).json({ error:`AI error: ${err.message}` });
  }
});

app.post("/api/jobs", (req, res) => {
  const { skills=[], county="Nairobi", query="" } = req.body;
  const JOBS = [
    { id:1,  title:"Junior Data Analyst",        company:"Safaricom PLC",         type:"Full-time",     pay:"KSh 45,000/mo",        match:94, tags:["Excel","Data","Nairobi"],        skills:["Data entry","IT / Tech","Accounting"],      county:["Nairobi","Mombasa"], applyUrl:"https://www.safaricom.co.ke/careers",              posted:"Recent" },
    { id:2,  title:"Social Media Manager",        company:"Jumia Kenya",           type:"Remote",        pay:"KSh 30,000/mo",        match:91, tags:["Instagram","TikTok","Remote"],   skills:["Social media","Graphic design","Writing"],  county:["Any"],               applyUrl:"https://group.jumia.com/careers",                   posted:"Recent" },
    { id:3,  title:"Delivery Rider",              company:"Glovo Kenya",           type:"Gig",           pay:"KSh 800–1,500/day",    match:88, tags:["Gig","Daily pay","Flexible"],    skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"], applyUrl:"https://glovoapp.com/ke/en/courier",   posted:"Today"  },
    { id:4,  title:"Community Health Promoter",   company:"Amref Health Africa",   type:"Full-time",     pay:"KSh 28,000/mo",        match:85, tags:["NGO","Health","Training"],       skills:["Healthcare","Teaching","Customer service"], county:["Any"],               applyUrl:"https://amref.org/job_opportunities",               posted:"Recent" },
    { id:5,  title:"Graphic Designer",            company:"Nation Media Group",     type:"Full-time",     pay:"KSh 35,000/mo",        match:82, tags:["Creative","Adobe","Nairobi"],    skills:["Graphic design","Social media"],             county:["Nairobi"],           applyUrl:"https://www.nationmedia.com/careers",               posted:"Recent" },
    { id:6,  title:"Sales Agent",                 company:"Apollo Agriculture",     type:"Gig",           pay:"Commission+KSh 15,000",match:79, tags:["Rural","Farming","Commission"],  skills:["Sales","Farming","Customer service"],        county:["Any"],               applyUrl:"https://apolloagriculture.com/careers",             posted:"Recent" },
    { id:7,  title:"Kitchen Hand",                company:"Java House Kenya",       type:"Full-time",     pay:"KSh 22,000/mo",        match:76, tags:["Food","Training","Nairobi"],     skills:["Cooking"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"], applyUrl:"https://www.javahouseafrica.com/careers", posted:"Recent" },
    { id:8,  title:"Customer Support Rep",         company:"Onfon Media",            type:"Full-time",     pay:"KSh 25,000/mo",        match:73, tags:["Call centre","Kiswahili"],       skills:["Customer service","Sales"],                 county:["Nairobi"],           applyUrl:"https://www.brightermonday.co.ke",                  posted:"Recent" },
    { id:9,  title:"Software Developer",           company:"Andela Kenya",          type:"Remote",        pay:"KSh 80,000–120,000/mo",match:89, tags:["Tech","Remote","Graduate"],       skills:["IT / Tech","Data entry"],                   county:["Any"],               applyUrl:"https://andela.com/join-andela",                    posted:"Recent" },
    { id:10, title:"Clinical Nurse Officer",      company:"Aga Khan Hospital",      type:"Full-time",     pay:"KSh 55,000/mo",        match:86, tags:["Healthcare","Hospital"],          skills:["Healthcare"],                               county:["Nairobi","Mombasa"], applyUrl:"https://www.agakhanacademies.org/careers",          posted:"Recent" },
    { id:11, title:"Accounts Assistant",           company:"KPMG Kenya",             type:"Full-time",     pay:"KSh 40,000/mo",        match:80, tags:["Finance","Excel","Graduate"],    skills:["Accounting","Data entry","IT / Tech"],      county:["Nairobi"],           applyUrl:"https://home.kpmg/ke/en/home/careers.html",        posted:"Recent" },
    { id:12, title:"Bolt Driver Partner",          company:"Bolt Kenya",             type:"Gig",           pay:"KSh 2,000–5,000/day",  match:83, tags:["Gig","Driving","Flexible"],      skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"], applyUrl:"https://bolt.eu/en-ke/driver", posted:"Today" },
    { id:13, title:"Farm Manager",                company:"Vegpro Kenya",           type:"Full-time",     pay:"KSh 35,000/mo",        match:78, tags:["Agriculture","Farming"],          skills:["Farming","Customer service"],               county:["Nakuru","Nairobi"],  applyUrl:"https://www.fuzu.com/kenya/jobs/agriculture",      posted:"Recent" },
    { id:14, title:"Tailor / Fashion Designer",   company:"Kariokor Market",        type:"Self-employed", pay:"KSh 500–2,000/order",  match:75, tags:["Creative","Self-employed"],      skills:["Tailoring"],                                county:["Nairobi","Mombasa"], applyUrl:"https://www.jiji.co.ke/nairobi/jobs",              posted:"Recent" },
    { id:15, title:"Receptionist",                company:"Radisson Blu Nairobi",   type:"Full-time",     pay:"KSh 28,000/mo",        match:71, tags:["Hospitality","English"],          skills:["Customer service","Writing"],               county:["Nairobi"],           applyUrl:"https://jobs.radissonhotels.com",                   posted:"Recent" },
  ];

  let jobs = JOBS;
  if (skills.length) jobs = JOBS.filter(j => j.skills.some(s=>skills.includes(s)) || j.county.includes("Any") || j.county.includes(county));
  if (!jobs.length) jobs = JOBS.slice(0,8);
  if (query.trim()) {
    const q = query.toLowerCase();
    const filtered = jobs.filter(j => j.title.toLowerCase().includes(q)||j.company.toLowerCase().includes(q)||j.tags.some(t=>t.toLowerCase().includes(q)));
    if (filtered.length) jobs = filtered;
  }
  jobs.sort((a,b) => b.match-a.match);
  const q2 = query||(skills.length?skills.slice(0,2).join(" "):"jobs");
  const enc = encodeURIComponent;
  res.json({ jobs, boards:{
    brightermonday:`https://www.brightermonday.co.ke/listings?q=${enc(q2)}&l=Kenya`,
    fuzu:`https://www.fuzu.com/kenya/jobs?search=${enc(q2)}`,
    linkedin:`https://www.linkedin.com/jobs/search/?keywords=${enc(q2+" Kenya")}`,
    myjobmag:`https://www.myjobmag.co.ke/search/?q=${enc(q2)}`,
  }, hasRealJobs:false });
});

const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge:"1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✓ Akili on port ${PORT}`);
  console.log(`✓ Models: ${GEMINI_MODELS.join(" → ")}`);
  console.log(`✓ Gemini key: ${process.env.GEMINI_API_KEY ? "SET ✓" : "MISSING ✗ — add GEMINI_API_KEY in Railway Variables"}\n`);
  setTimeout(selfTest, 4000);
});
