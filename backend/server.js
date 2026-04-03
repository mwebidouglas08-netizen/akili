require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk");
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CRISIS_KEYWORDS = [
  "suicide","kill myself","end my life","kujiua","no reason to live",
  "want to die","better off dead","nafsi yangu","nijiue","mauti",
];

function detectCrisis(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
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
- Ground advice in Kenyan context: family, community, faith.
- Never diagnose. Encourage professional help for clinical issues.
- Remember the full conversation history and build on it.`;
  }

  return `You are Akili Kazi, a practical AI career coach for Kenyan youth.
User profile: ${profile}
Rules:
- Give specific, actionable Kenya-focused career advice.
- Reference real Kenyan context: employers (Safaricom, KCB, Equity Bank, Nation Media), job boards (BrighterMonday, Fuzu), gig platforms (Glovo, Bolt, Sendy), government programmes (Kazi Mtaani, Ajira Digital, Hustler Fund).
- Help with CV writing, interview prep, salary negotiation, side hustles.
- Keep responses focused — 3-6 sentences.
- Be encouraging but realistic about the Kenyan job market.
- Remember the full conversation and build on what the user has shared.`;
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    apiKey: process.env.ANTHROPIC_API_KEY ? "SET" : "MISSING",
  });
});

// ── Chat ──────────────────────────────────────────────────────────────────────
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;

  // ── Basic validation ────────────────────────────────────────────────────
  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "messages array is required." });

  if (!mode || !["wellness", "career"].includes(mode))
    return res.status(400).json({ error: "mode must be wellness or career." });

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: "API key not configured on server." });

  // ── Clean messages ──────────────────────────────────────────────────────
  // 1. Keep only user/assistant with non-empty string content
  let cleaned = messages
    .filter((m) => m
      && typeof m === "object"
      && (m.role === "user" || m.role === "assistant")
      && typeof m.content === "string"
      && m.content.trim().length > 0
    )
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, 4000),
    }));

  // 2. Must start with user
  while (cleaned.length > 0 && cleaned[0].role !== "user") {
    cleaned.shift();
  }

  // 3. Enforce strict alternation (user → assistant → user …)
  //    If two consecutive same roles, keep the last one
  const alternated = [];
  for (const msg of cleaned) {
    if (alternated.length === 0) {
      alternated.push(msg);
    } else if (alternated[alternated.length - 1].role === msg.role) {
      // Same role — replace last with this one (keep most recent)
      alternated[alternated.length - 1] = msg;
    } else {
      alternated.push(msg);
    }
  }

  // 4. Must end with user (last message must be from user)
  while (alternated.length > 0 && alternated[alternated.length - 1].role !== "user") {
    alternated.pop();
  }

  // 5. Trim to last 20 messages
  const finalMessages = alternated.slice(-20);

  if (finalMessages.length === 0) {
    return res.status(400).json({ error: "No valid user message found to process." });
  }

  // Log for debugging in Railway
  console.log(`[chat] mode=${mode} user=${user?.name} messages=${finalMessages.length} last="${finalMessages[finalMessages.length-1]?.content?.slice(0,60)}"`);

  const lastUser = [...finalMessages].reverse().find((m) => m.role === "user");
  const isCrisis = detectCrisis(lastUser?.content);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",   // fast + affordable
      max_tokens: 800,
      system: buildSystemPrompt(mode, user || {}),
      messages: finalMessages,
    });

    const reply = response.content?.[0]?.text;
    if (!reply) throw new Error("Empty response from Anthropic");

    console.log(`[chat] reply length=${reply.length} tokens=${response.usage?.output_tokens}`);

    res.json({ reply, crisis: isCrisis });

  } catch (err) {
    // Log the full error for Railway logs
    console.error("[chat] Anthropic error:", JSON.stringify({
      status: err.status,
      message: err.message,
      type: err.error?.type,
      detail: err.error?.error,
    }));

    if (err.status === 401)
      return res.status(401).json({ error: "Invalid API key — check ANTHROPIC_API_KEY in Railway variables." });
    if (err.status === 429)
      return res.status(429).json({ error: "AI is busy right now. Wait a moment and try again." });
    if (err.status === 400)
      return res.status(400).json({ error: `Bad request to AI: ${err.error?.error?.message || err.message}` });
    if (err.status === 529 || err.status === 503)
      return res.status(503).json({ error: "AI service is overloaded. Please try again in a moment." });

    res.status(500).json({ error: "Unexpected error. Please try again." });
  }
});

// ── Jobs ──────────────────────────────────────────────────────────────────────
app.post("/api/jobs", (req, res) => {
  const { skills = [], county = "Nairobi" } = req.body;

  const ALL_JOBS = [
    { id:1,  title:"Junior Data Analyst",         company:"Safaricom PLC",          type:"Full-time",     pay:"KSh 45,000/mo",        match:94, tags:["Excel","Data","Reports"],              skills:["Data entry","IT / Tech","Accounting"],       county:["Nairobi","Mombasa"] },
    { id:2,  title:"Social Media Manager",         company:"Jumia Kenya",            type:"Remote",        pay:"KSh 30,000/mo",        match:91, tags:["Instagram","TikTok","Content"],         skills:["Social media","Graphic design","Writing"],  county:["Any"] },
    { id:3,  title:"Delivery Rider (Gig)",          company:"Glovo",                  type:"Gig",           pay:"KSh 800/day",          match:88, tags:["Flexible","Daily pay","No CV needed"],  skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"] },
    { id:4,  title:"Community Health Promoter",    company:"Amref Health Africa",    type:"Full-time",     pay:"KSh 28,000/mo",        match:85, tags:["NGO","Training","Health"],              skills:["Healthcare","Teaching","Customer service"], county:["Any"] },
    { id:5,  title:"Graphic Designer",             company:"Nation Media Group",      type:"Full-time",     pay:"KSh 35,000/mo",        match:82, tags:["Creative","Adobe","Branding"],          skills:["Graphic design","Social media"],             county:["Nairobi"] },
    { id:6,  title:"Sales Agent (Agri-input)",     company:"Apollo Agriculture",      type:"Gig",           pay:"Commission + KSh 15k", match:79, tags:["Rural","Farmers","Commission"],         skills:["Sales","Farming","Customer service"],        county:["Any"] },
    { id:7,  title:"Kitchen Hand / Chef Asst",     company:"Java House Kenya",        type:"Full-time",     pay:"KSh 22,000/mo",        match:76, tags:["No experience","Training","Food"],      skills:["Cooking"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"] },
    { id:8,  title:"Customer Support Rep",          company:"Onfon Media",             type:"Full-time",     pay:"KSh 25,000/mo",        match:73, tags:["Call centre","English","Kiswahili"],    skills:["Customer service","Sales"],                 county:["Nairobi"] },
    { id:9,  title:"Construction Labourer",         company:"Roko Construction",       type:"Contract",      pay:"KSh 700/day",          match:70, tags:["Physical","Contract","Daily pay"],      skills:["Construction"],                             county:["Nairobi","Thika","Nakuru"] },
    { id:10, title:"Primary School Teacher (BOM)", company:"Nairobi County Schools",  type:"Contract",      pay:"KSh 20,000/mo",        match:68, tags:["Education","Children","BOM"],           skills:["Teaching"],                                 county:["Nairobi","Mombasa","Kisumu"] },
    { id:11, title:"Tailor / Fashion Designer",    company:"Kariokor Market Coop",    type:"Self-employed", pay:"KSh 500-2,000/order",  match:75, tags:["Creative","Self-employed","Flexible"],  skills:["Tailoring"],                                county:["Nairobi","Mombasa"] },
    { id:12, title:"Accounts Assistant",            company:"KPMG Kenya",              type:"Full-time",     pay:"KSh 40,000/mo",        match:80, tags:["Finance","Excel","Graduate"],           skills:["Accounting","Data entry","IT / Tech"],      county:["Nairobi"] },
    { id:13, title:"Digital Content Creator",       company:"Freshi Media",            type:"Freelance",     pay:"KSh 15k-50k/mo",       match:77, tags:["Video","YouTube","TikTok"],             skills:["Social media","Writing","Graphic design"],  county:["Any"] },
    { id:14, title:"Motorbike Courier",             company:"Sendy",                   type:"Gig",           pay:"KSh 600-1,200/day",    match:83, tags:["Gig","Own bike","Flexible"],            skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"] },
    { id:15, title:"Receptionist / Front Office",  company:"Radisson Blu Nairobi",    type:"Full-time",     pay:"KSh 28,000/mo",        match:71, tags:["Hospitality","English","Smart"],        skills:["Customer service","Writing"],               county:["Nairobi"] },
  ];

  let matched = skills.length > 0
    ? ALL_JOBS.filter((j) => j.skills.some((s) => skills.includes(s)) || j.county.includes("Any") || j.county.includes(county))
    : ALL_JOBS;

  if (matched.length === 0) matched = ALL_JOBS.slice(0, 8);
  matched.sort((a, b) => b.match - a.match);
  res.json({ jobs: matched });
});

// ── Serve React ───────────────────────────────────────────────────────────────
const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge: "1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Akili on port ${PORT}`);
  console.log(`✓ API key: ${process.env.ANTHROPIC_API_KEY ? "SET ✓" : "MISSING ✗"}`);
  console.log(`✓ Frontend dist: ${distPath}`);
});
