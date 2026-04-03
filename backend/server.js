require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "20kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many messages. Wait a moment then try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

const CRISIS_KEYWORDS = [
  "suicide","kill myself","end my life","kujiua","no reason to live",
  "want to die","better off dead","nafsi yangu","nijiue","mauti",
];
function detectCrisis(text) {
  if (!text) return false;
  return CRISIS_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
}

function buildSystemPrompt(mode, user) {
  const profile = [
    user.name   ? `Name: ${user.name}`            : null,
    user.age    ? `Age: ${user.age}`              : null,
    user.county ? `County: ${user.county}, Kenya` : null,
    user.skills && user.skills.length ? `Skills: ${user.skills.join(", ")}` : null,
    user.mood   ? `Current mood: ${user.mood}`    : null,
  ].filter(Boolean).join(" | ");

  if (mode === "wellness") {
    return `You are Akili Afya, a warm, culturally sensitive AI mental wellness companion for Kenyan youth.
User profile: ${profile}
Rules:
- Mirror the user's language (English or Kiswahili).
- Validate feelings before giving advice. Lead with empathy.
- Keep replies to 3-5 sentences unless more is needed.
- If any message contains suicidal ideation: acknowledge the pain, share Befrienders Kenya helpline (0800 723 253, toll-free, 24/7), encourage them to call.
- Ground advice in Kenyan context: family, community, faith, local resources.
- Never diagnose. Encourage professional help for clinical issues.
- Remember the full conversation history and build on it.`;
  }

  return `You are Akili Kazi, a practical AI career coach for Kenyan youth.
User profile: ${profile}
Rules:
- Give specific, actionable Kenya-focused career advice.
- Reference real Kenyan employers (Safaricom, KCB, Equity Bank, Nation Media), job boards (BrighterMonday, Fuzu), gig platforms (Glovo, Bolt, Sendy), government programmes (Kazi Mtaani, Ajira Digital, Hustler Fund).
- Help with CV writing, interview prep, salary negotiation, side hustles.
- Keep responses focused and actionable 3-6 sentences.
- Be encouraging but realistic about the Kenyan job market.
- Remember the full conversation and build on what the user has shared.`;
}

async function callGemini(systemPrompt, messages) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw Object.assign(new Error("GEMINI_API_KEY not set on server."), { status: 500 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 800, temperature: 0.75 },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[gemini] error:", JSON.stringify(data));
    const msg = data?.error?.message || `HTTP ${response.status}`;
    throw Object.assign(new Error(msg), { status: response.status });
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new Error(`No reply from Gemini. Finish reason: ${reason || "unknown"}`);
  }

  return text;
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    ai: "Google Gemini 2.0 Flash (free)",
    geminiKey: process.env.GEMINI_API_KEY ? "SET" : "MISSING",
  });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "messages array is required." });
  if (!mode || !["wellness", "career"].includes(mode))
    return res.status(400).json({ error: "mode must be wellness or career." });
  if (!process.env.GEMINI_API_KEY)
    return res.status(500).json({ error: "GEMINI_API_KEY not configured. Add it in Railway Variables." });

  let cleaned = messages
    .filter((m) => m && typeof m === "object"
      && (m.role === "user" || m.role === "assistant")
      && typeof m.content === "string"
      && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  while (cleaned.length > 0 && cleaned[0].role !== "user") cleaned.shift();

  const alternated = [];
  for (const msg of cleaned) {
    if (alternated.length === 0) {
      alternated.push(msg);
    } else if (alternated[alternated.length - 1].role === msg.role) {
      alternated[alternated.length - 1] = msg;
    } else {
      alternated.push(msg);
    }
  }

  while (alternated.length > 0 && alternated[alternated.length - 1].role !== "user") {
    alternated.pop();
  }

  const finalMessages = alternated.slice(-20);
  if (finalMessages.length === 0)
    return res.status(400).json({ error: "No valid user message to process." });

  const lastUser = [...finalMessages].reverse().find((m) => m.role === "user");
  const isCrisis = detectCrisis(lastUser?.content);

  console.log(`[chat] mode=${mode} user=${user?.name} msgs=${finalMessages.length}`);

  try {
    const reply = await callGemini(buildSystemPrompt(mode, user || {}), finalMessages);
    console.log(`[chat] reply length=${reply.length}`);
    res.json({ reply, crisis: isCrisis });
  } catch (err) {
    console.error("[chat] error:", err.status, err.message);
    if (err.status === 403) return res.status(403).json({ error: "Gemini API key invalid. Check GEMINI_API_KEY in Railway variables." });
    if (err.status === 429) return res.status(429).json({ error: "AI is busy. Wait a moment and try again." });
    if (err.status === 500) return res.status(500).json({ error: err.message });
    res.status(500).json({ error: "AI service error. Please try again." });
  }
});

app.post("/api/jobs", (req, res) => {
  const { skills = [], county = "Nairobi" } = req.body;
  const ALL_JOBS = [
    { id:1,  title:"Junior Data Analyst",         company:"Safaricom PLC",         type:"Full-time",     pay:"KSh 45,000/mo",        match:94, tags:["Excel","Data","Reports"],             skills:["Data entry","IT / Tech","Accounting"],       county:["Nairobi","Mombasa"] },
    { id:2,  title:"Social Media Manager",         company:"Jumia Kenya",           type:"Remote",        pay:"KSh 30,000/mo",        match:91, tags:["Instagram","TikTok","Content"],        skills:["Social media","Graphic design","Writing"],  county:["Any"] },
    { id:3,  title:"Delivery Rider (Gig)",          company:"Glovo",                 type:"Gig",           pay:"KSh 800/day",          match:88, tags:["Flexible","Daily pay","No CV needed"], skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"] },
    { id:4,  title:"Community Health Promoter",    company:"Amref Health Africa",   type:"Full-time",     pay:"KSh 28,000/mo",        match:85, tags:["NGO","Training","Health"],             skills:["Healthcare","Teaching","Customer service"], county:["Any"] },
    { id:5,  title:"Graphic Designer",             company:"Nation Media Group",     type:"Full-time",     pay:"KSh 35,000/mo",        match:82, tags:["Creative","Adobe","Branding"],         skills:["Graphic design","Social media"],             county:["Nairobi"] },
    { id:6,  title:"Sales Agent (Agri-input)",     company:"Apollo Agriculture",     type:"Gig",           pay:"Commission + KSh 15k", match:79, tags:["Rural","Farmers","Commission"],        skills:["Sales","Farming","Customer service"],        county:["Any"] },
    { id:7,  title:"Kitchen Hand / Chef Asst",     company:"Java House Kenya",       type:"Full-time",     pay:"KSh 22,000/mo",        match:76, tags:["No experience","Training","Food"],     skills:["Cooking"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"] },
    { id:8,  title:"Customer Support Rep",          company:"Onfon Media",            type:"Full-time",     pay:"KSh 25,000/mo",        match:73, tags:["Call centre","English","Kiswahili"],   skills:["Customer service","Sales"],                 county:["Nairobi"] },
    { id:9,  title:"Construction Labourer",         company:"Roko Construction",      type:"Contract",      pay:"KSh 700/day",          match:70, tags:["Physical","Contract","Daily pay"],     skills:["Construction"],                             county:["Nairobi","Thika","Nakuru"] },
    { id:10, title:"Primary School Teacher (BOM)", company:"Nairobi County Schools", type:"Contract",      pay:"KSh 20,000/mo",        match:68, tags:["Education","Children","BOM"],          skills:["Teaching"],                                 county:["Nairobi","Mombasa","Kisumu"] },
    { id:11, title:"Tailor / Fashion Designer",    company:"Kariokor Market Coop",   type:"Self-employed", pay:"KSh 500-2,000/order",  match:75, tags:["Creative","Self-employed","Flexible"], skills:["Tailoring"],                                county:["Nairobi","Mombasa"] },
    { id:12, title:"Accounts Assistant",            company:"KPMG Kenya",             type:"Full-time",     pay:"KSh 40,000/mo",        match:80, tags:["Finance","Excel","Graduate"],          skills:["Accounting","Data entry","IT / Tech"],      county:["Nairobi"] },
    { id:13, title:"Digital Content Creator",       company:"Freshi Media",           type:"Freelance",     pay:"KSh 15k-50k/mo",       match:77, tags:["Video","YouTube","TikTok"],            skills:["Social media","Writing","Graphic design"],  county:["Any"] },
    { id:14, title:"Motorbike Courier",             company:"Sendy",                  type:"Gig",           pay:"KSh 600-1,200/day",    match:83, tags:["Gig","Own bike","Flexible"],           skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"] },
    { id:15, title:"Receptionist / Front Office",  company:"Radisson Blu Nairobi",   type:"Full-time",     pay:"KSh 28,000/mo",        match:71, tags:["Hospitality","English","Smart"],       skills:["Customer service","Writing"],               county:["Nairobi"] },
  ];

  let matched = skills.length > 0
    ? ALL_JOBS.filter((j) => j.skills.some((s) => skills.includes(s)) || j.county.includes("Any") || j.county.includes(county))
    : ALL_JOBS;

  if (matched.length === 0) matched = ALL_JOBS.slice(0, 8);
  matched.sort((a, b) => b.match - a.match);
  res.json({ jobs: matched });
});

const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge: "1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Akili on port ${PORT} | Gemini key: ${process.env.GEMINI_API_KEY ? "SET" : "MISSING"}`);
});
