require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const rateLimit = require("express-rate-limit");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "20kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { error: "Too many messages. Wait a moment then try again." },
  standardHeaders: true, legacyHeaders: false,
});

// ── Crisis detection ──────────────────────────────────────────────────────────
const CRISIS_KEYWORDS = [
  "suicide","kill myself","end my life","kujiua","no reason to live",
  "want to die","better off dead","nafsi yangu","nijiue","mauti",
];
const detectCrisis = (text) =>
  text ? CRISIS_KEYWORDS.some((kw) => text.toLowerCase().includes(kw)) : false;

// ── System prompts ────────────────────────────────────────────────────────────
function buildSystemPrompt(mode, user) {
  const profile = [
    user.name   ? `Name: ${user.name}`            : null,
    user.age    ? `Age: ${user.age}`              : null,
    user.county ? `County: ${user.county}, Kenya` : null,
    user.skills?.length ? `Skills: ${user.skills.join(", ")}` : null,
    user.mood   ? `Current mood: ${user.mood}`    : null,
  ].filter(Boolean).join(" | ");

  if (mode === "wellness") return `You are Akili Afya, a warm, culturally sensitive AI mental wellness companion for Kenyan youth.
User profile: ${profile}
- Mirror the user's language (English or Kiswahili).
- Validate feelings before advice. Lead with empathy.
- Keep replies to 3-5 sentences unless more is needed.
- If ANY message has suicidal ideation: acknowledge pain, give Befrienders Kenya helpline (0800 723 253, toll-free 24/7), encourage them to call.
- Ground advice in Kenyan context: family, community, faith.
- Never diagnose. Encourage professional help for clinical issues.
- Remember the full conversation history and build on it.`;

  return `You are Akili Kazi, a practical AI career coach for Kenyan youth.
User profile: ${profile}
- Give specific, actionable Kenya-focused career advice.
- Reference real Kenyan employers (Safaricom, KCB, Equity Bank, Nation Media), job boards (BrighterMonday, Fuzu), gig platforms (Glovo, Bolt, Sendy), government programmes (Kazi Mtaani, Ajira Digital, Hustler Fund).
- Help with CV writing, interview prep, salary negotiation, side hustles.
- Keep responses focused and actionable — 3-6 sentences.
- Be encouraging but realistic about the Kenyan job market.
- Remember the full conversation and build on it.`;
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Gemini models — tried in order ───────────────────────────────────────────
const MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

// ── Single model call ─────────────────────────────────────────────────────────
async function callModel(model, systemPrompt, messages, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: 800, temperature: 0.75 },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const res  = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await res.json();

  if (!res.ok) {
    const err = Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { status: res.status });
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || "unknown";
    throw Object.assign(new Error(`Empty response. Finish reason: ${reason}`), { status: 500 });
  }
  return text;
}

// ── Waterfall: try each model with retries ────────────────────────────────────
async function callGemini(systemPrompt, messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY not set. Add it in Railway Variables."), { status: 500 });

  let lastErr;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[gemini] model=${model} attempt=${attempt}`);
        const text = await callModel(model, systemPrompt, messages, apiKey);
        console.log(`[gemini] OK model=${model} chars=${text.length}`);
        return text;
      } catch (err) {
        lastErr = err;
        console.warn(`[gemini] FAIL model=${model} attempt=${attempt} status=${err.status} msg=${err.message}`);
        if (err.status === 429 && attempt < 3) { await sleep(attempt * 2000); continue; }
        if (err.status === 400 || err.status === 403) throw err; // hard fail — no point retrying
        break; // other errors — try next model
      }
    }
  }
  throw lastErr || new Error("All AI models unavailable.");
}

// ── Message sanitiser ─────────────────────────────────────────────────────────
function cleanMessages(raw) {
  let msgs = raw
    .filter((m) => m && (m.role==="user"||m.role==="assistant") && typeof m.content==="string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0,4000) }));

  while (msgs.length && msgs[0].role !== "user") msgs.shift();       // must start with user

  const alt = [];
  for (const m of msgs) {
    if (!alt.length) { alt.push(m); }
    else if (alt[alt.length-1].role === m.role) { alt[alt.length-1] = m; } // merge consecutive same-role
    else { alt.push(m); }
  }

  while (alt.length && alt[alt.length-1].role !== "user") alt.pop(); // must end with user
  return alt.slice(-20);
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  timestamp: new Date().toISOString(),
  ai: "Google Gemini (free tier)",
  models: MODELS,
  geminiKey: process.env.GEMINI_API_KEY ? "SET ✓" : "MISSING ✗",
}));

app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;

  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: "messages array is required." });
  if (!["wellness","career"].includes(mode))
    return res.status(400).json({ error: "mode must be wellness or career." });
  if (!process.env.GEMINI_API_KEY)
    return res.status(500).json({ error: "GEMINI_API_KEY not configured. Add it in Railway Variables." });

  const final = cleanMessages(messages);
  if (!final.length) return res.status(400).json({ error: "No valid user message found." });

  const lastUser = [...final].reverse().find((m) => m.role==="user");
  const isCrisis = detectCrisis(lastUser?.content);

  console.log(`[chat] mode=${mode} user=${user?.name} msgs=${final.length}`);

  try {
    const reply = await callGemini(buildSystemPrompt(mode, user||{}), final);
    res.json({ reply, crisis: isCrisis });
  } catch (err) {
    console.error("[chat] final error:", err.status, err.message);
    if (err.status === 403) return res.status(403).json({ error: "Gemini API key invalid. Check GEMINI_API_KEY in Railway Variables." });
    if (err.status === 400) return res.status(400).json({ error: "Invalid AI request. Please try again." });
    if (err.status === 500 && err.message.includes("GEMINI_API_KEY")) return res.status(500).json({ error: err.message });
    res.status(503).json({ error: "AI temporarily unavailable. Retrying automatically — please wait a moment." });
  }
});

app.post("/api/jobs", (req, res) => {
  const { skills=[], county="Nairobi" } = req.body;
  const ALL = [
    { id:1,  title:"Junior Data Analyst",         company:"Safaricom PLC",          type:"Full-time",     pay:"KSh 45,000/mo",        match:94, tags:["Excel","Data","Reports"],             skills:["Data entry","IT / Tech","Accounting"],       county:["Nairobi","Mombasa"] },
    { id:2,  title:"Social Media Manager",         company:"Jumia Kenya",            type:"Remote",        pay:"KSh 30,000/mo",        match:91, tags:["Instagram","TikTok","Content"],        skills:["Social media","Graphic design","Writing"],  county:["Any"] },
    { id:3,  title:"Delivery Rider (Gig)",          company:"Glovo",                  type:"Gig",           pay:"KSh 800/day",          match:88, tags:["Flexible","Daily pay","No CV needed"], skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"] },
    { id:4,  title:"Community Health Promoter",    company:"Amref Health Africa",    type:"Full-time",     pay:"KSh 28,000/mo",        match:85, tags:["NGO","Training","Health"],             skills:["Healthcare","Teaching","Customer service"], county:["Any"] },
    { id:5,  title:"Graphic Designer",             company:"Nation Media Group",      type:"Full-time",     pay:"KSh 35,000/mo",        match:82, tags:["Creative","Adobe","Branding"],         skills:["Graphic design","Social media"],             county:["Nairobi"] },
    { id:6,  title:"Sales Agent (Agri-input)",     company:"Apollo Agriculture",      type:"Gig",           pay:"Commission + KSh 15k", match:79, tags:["Rural","Farmers","Commission"],        skills:["Sales","Farming","Customer service"],        county:["Any"] },
    { id:7,  title:"Kitchen Hand / Chef Asst",     company:"Java House Kenya",        type:"Full-time",     pay:"KSh 22,000/mo",        match:76, tags:["No experience","Training","Food"],     skills:["Cooking"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"] },
    { id:8,  title:"Customer Support Rep",          company:"Onfon Media",             type:"Full-time",     pay:"KSh 25,000/mo",        match:73, tags:["Call centre","English","Kiswahili"],   skills:["Customer service","Sales"],                 county:["Nairobi"] },
    { id:9,  title:"Construction Labourer",         company:"Roko Construction",       type:"Contract",      pay:"KSh 700/day",          match:70, tags:["Physical","Contract","Daily pay"],     skills:["Construction"],                             county:["Nairobi","Thika","Nakuru"] },
    { id:10, title:"Primary School Teacher (BOM)", company:"Nairobi County Schools",  type:"Contract",      pay:"KSh 20,000/mo",        match:68, tags:["Education","Children","BOM"],          skills:["Teaching"],                                 county:["Nairobi","Mombasa","Kisumu"] },
    { id:11, title:"Tailor / Fashion Designer",    company:"Kariokor Market Coop",    type:"Self-employed", pay:"KSh 500-2,000/order",  match:75, tags:["Creative","Self-employed","Flexible"], skills:["Tailoring"],                                county:["Nairobi","Mombasa"] },
    { id:12, title:"Accounts Assistant",            company:"KPMG Kenya",              type:"Full-time",     pay:"KSh 40,000/mo",        match:80, tags:["Finance","Excel","Graduate"],          skills:["Accounting","Data entry","IT / Tech"],      county:["Nairobi"] },
    { id:13, title:"Digital Content Creator",       company:"Freshi Media",            type:"Freelance",     pay:"KSh 15k-50k/mo",       match:77, tags:["Video","YouTube","TikTok"],            skills:["Social media","Writing","Graphic design"],  county:["Any"] },
    { id:14, title:"Motorbike Courier",             company:"Sendy",                   type:"Gig",           pay:"KSh 600-1,200/day",    match:83, tags:["Gig","Own bike","Flexible"],           skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"] },
    { id:15, title:"Receptionist / Front Office",  company:"Radisson Blu Nairobi",    type:"Full-time",     pay:"KSh 28,000/mo",        match:71, tags:["Hospitality","English","Smart"],       skills:["Customer service","Writing"],               county:["Nairobi"] },
  ];
  let matched = skills.length
    ? ALL.filter((j) => j.skills.some((s) => skills.includes(s)) || j.county.includes("Any") || j.county.includes(county))
    : ALL;
  if (!matched.length) matched = ALL.slice(0,8);
  matched.sort((a,b) => b.match - a.match);
  res.json({ jobs: matched });
});

const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge: "1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Akili on port ${PORT}`);
  console.log(`✓ Gemini models: ${MODELS.join(" → ")}`);
  console.log(`✓ Gemini key: ${process.env.GEMINI_API_KEY ? "SET ✓" : "MISSING ✗ — add GEMINI_API_KEY in Railway Variables"}`);
});
