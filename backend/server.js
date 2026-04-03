require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// Disable CSP — lets React, Google Fonts, and inline styles load freely
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — allow all origins (tighten in prod by setting ALLOWED_ORIGINS env var)
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

app.use(express.json({ limit: "20kb" }));

// Rate limit chat to 30 requests/min per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many messages. Wait a moment then try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Crisis keyword detection (English + Kiswahili)
const CRISIS_KEYWORDS = [
  "suicide","kill myself","end my life","kujiua","no reason to live",
  "want to die","better off dead","nafsi yangu","nijiue","mauti",
  "niache niende","sitaki kuendelea",
];
function detectCrisis(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

// System prompts
function buildSystemPrompt(mode, user) {
  const profile = [
    user.name    ? `Name: ${user.name}`              : null,
    user.age     ? `Age: ${user.age}`                : null,
    user.county  ? `County: ${user.county}, Kenya`  : null,
    user.skills  && user.skills.length ? `Skills: ${user.skills.join(", ")}` : null,
    user.mood    ? `Current mood: ${user.mood}`      : null,
  ].filter(Boolean).join(" | ");

  if (mode === "wellness") {
    return `You are Akili Afya — a warm, culturally sensitive AI mental wellness companion built for Kenyan youth.
User profile: ${profile}

Core rules:
1. Mirror the user's language — respond in Kiswahili if they write in Kiswahili, English if English.
2. Always validate feelings before giving advice. Lead with empathy.
3. Keep replies concise — 3 to 5 sentences unless the conversation calls for more.
4. If ANY message contains suicidal ideation or crisis signals: acknowledge the pain, share the Befrienders Kenya helpline (0800 723 253 — toll-free, 24/7), and encourage the user to call immediately.
5. Ground advice in Kenyan context — family, community, faith, and local resources.
6. Never diagnose. Always encourage professional help for clinical issues.
7. Remember conversation history — reference what the user has shared earlier.
8. Be human and real. Avoid clinical or robotic language.`;
  }

  return `You are Akili Kazi — a sharp, practical AI career coach for Kenyan youth.
User profile: ${profile}

Core rules:
1. Give specific, actionable Kenya-focused career advice.
2. Reference real Kenyan context: employers (Safaricom, KCB, Nation Media, Equity Bank), job boards (BrighterMonday, Fuzu, LinkedIn Kenya), gig platforms (Glovo, Bolt, Jiji), government programmes (Kazi Mtaani, Ajira Digital, Hustler Fund, TVET).
3. Help with: CV writing, cover letters, interview prep, salary negotiation, career pivots, side hustles.
4. Keep responses focused and actionable — 3 to 6 sentences.
5. Be encouraging but realistic about the Kenyan job market.
6. Remember the full conversation — build on what the user has already shared.
7. If the user wants to apply for a specific job, help them prepare targeted materials.`;
}

// ── API Routes ──────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), model: "claude-sonnet-4-20250514" });
});

// Main AI chat endpoint
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;

  // Validate
  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: "messages array is required." });
  if (!mode || !["wellness", "career"].includes(mode))
    return res.status(400).json({ error: "mode must be 'wellness' or 'career'." });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: "Server configuration error: API key missing." });

  // Clean and sanitise messages for Anthropic
  // Must alternate user/assistant, start with user, no empty content
  const cleaned = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  // Ensure messages start with "user" role (Anthropic requirement)
  while (cleaned.length > 0 && cleaned[0].role !== "user") cleaned.shift();

  // Ensure alternating roles — remove consecutive duplicates
  const alternated = [];
  for (const msg of cleaned) {
    if (alternated.length === 0 || alternated[alternated.length - 1].role !== msg.role) {
      alternated.push(msg);
    }
  }

  // Keep last 20 messages for context window
  const finalMessages = alternated.slice(-20);

  if (finalMessages.length === 0)
    return res.status(400).json({ error: "No valid messages to process." });

  // Detect crisis in the latest user message
  const lastUser = finalMessages.filter((m) => m.role === "user").pop();
  const isCrisis = detectCrisis(lastUser?.content);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: buildSystemPrompt(mode, user || {}),
      messages: finalMessages,
    });

    const reply = response.content?.[0]?.text;
    if (!reply) throw new Error("Empty response from AI");

    res.json({
      reply,
      crisis: isCrisis,
      tokens: response.usage?.output_tokens || 0,
    });

  } catch (err) {
    console.error("Anthropic API error:", err?.message || err);

    if (err?.status === 401)
      return res.status(401).json({ error: "Invalid API key. Check your ANTHROPIC_API_KEY environment variable." });
    if (err?.status === 429)
      return res.status(429).json({ error: "AI is busy right now. Please wait a moment and try again." });
    if (err?.status === 400)
      return res.status(400).json({ error: "Invalid request to AI. Please try again." });

    res.status(500).json({ error: "AI service error. Please try again in a moment." });
  }
});

// Jobs endpoint — skill-matched
app.post("/api/jobs", (req, res) => {
  const { skills = [], county = "Nairobi" } = req.body;

  const ALL_JOBS = [
    { id:1,  title:"Junior Data Analyst",          company:"Safaricom PLC",             type:"Full-time",    pay:"KSh 45,000/mo",           match:94, tags:["Excel","Data","Reports"],               skills:["Data entry","IT / Tech","Accounting"],          county:["Nairobi","Mombasa"] },
    { id:2,  title:"Social Media Manager",          company:"Jumia Kenya",               type:"Remote",       pay:"KSh 30,000/mo",           match:91, tags:["Instagram","TikTok","Content"],          skills:["Social media","Graphic design","Writing"],     county:["Any"] },
    { id:3,  title:"Delivery Rider (Gig)",           company:"Glovo",                     type:"Gig",          pay:"KSh 800/day",             match:88, tags:["Flexible","Daily pay","No CV needed"],   skills:["Driving"],                                     county:["Nairobi","Mombasa","Kisumu"] },
    { id:4,  title:"Community Health Promoter",     company:"Amref Health Africa",       type:"Full-time",    pay:"KSh 28,000/mo",           match:85, tags:["NGO","Training provided","Health"],      skills:["Healthcare","Teaching","Customer service"],    county:["Any"] },
    { id:5,  title:"Graphic Designer",              company:"Nation Media Group",         type:"Full-time",    pay:"KSh 35,000/mo",           match:82, tags:["Creative","Adobe","Branding"],           skills:["Graphic design","Social media"],               county:["Nairobi"] },
    { id:6,  title:"Sales Agent (Agri-input)",      company:"Apollo Agriculture",         type:"Gig",          pay:"Commission + KSh 15k",    match:79, tags:["Rural","Farmers","Commission"],          skills:["Sales","Farming","Customer service"],          county:["Any"] },
    { id:7,  title:"Kitchen Hand / Chef Asst",      company:"Java House Kenya",           type:"Full-time",    pay:"KSh 22,000/mo",           match:76, tags:["No experience","Training","Food"],       skills:["Cooking"],                                     county:["Nairobi","Mombasa","Kisumu","Nakuru"] },
    { id:8,  title:"Customer Support Rep",           company:"Onfon Media",               type:"Full-time",    pay:"KSh 25,000/mo",           match:73, tags:["Call centre","English","Kiswahili"],     skills:["Customer service","Sales"],                    county:["Nairobi"] },
    { id:9,  title:"Construction Labourer",          company:"Roko Construction",         type:"Contract",     pay:"KSh 700/day",             match:70, tags:["Physical","Contract","Daily pay"],       skills:["Construction"],                                county:["Nairobi","Thika","Nakuru"] },
    { id:10, title:"Primary School Teacher (BOM)",  company:"Nairobi County Schools",    type:"Contract",     pay:"KSh 20,000/mo",           match:68, tags:["Education","Children","BOM"],            skills:["Teaching"],                                    county:["Nairobi","Mombasa","Kisumu"] },
    { id:11, title:"Tailor / Fashion Designer",     company:"Kariokor Market Coop",      type:"Self-employed",pay:"KSh 500-2,000/order",     match:75, tags:["Creative","Self-employed","Flexible"],   skills:["Tailoring"],                                   county:["Nairobi","Mombasa"] },
    { id:12, title:"Accounts Assistant",             company:"KPMG Kenya",                type:"Full-time",    pay:"KSh 40,000/mo",           match:80, tags:["Finance","Excel","Graduate"],            skills:["Accounting","Data entry","IT / Tech"],         county:["Nairobi"] },
    { id:13, title:"Digital Content Creator",        company:"Freshi Media",              type:"Freelance",    pay:"KSh 15,000-50,000/mo",    match:77, tags:["Video","YouTube","TikTok"],              skills:["Social media","Writing","Graphic design"],    county:["Any"] },
    { id:14, title:"Motorbike Courier",              company:"Sendy",                     type:"Gig",          pay:"KSh 600-1,200/day",       match:83, tags:["Gig","Own bike","Flexible"],             skills:["Driving"],                                     county:["Nairobi","Mombasa","Kisumu"] },
    { id:15, title:"Receptionist / Front Office",   company:"Radisson Blu Nairobi",      type:"Full-time",    pay:"KSh 28,000/mo",           match:71, tags:["Hospitality","English","Smart"],         skills:["Customer service","Writing"],                  county:["Nairobi"] },
  ];

  let matched = ALL_JOBS;
  if (skills.length > 0) {
    matched = ALL_JOBS.filter((j) =>
      j.skills.some((s) => skills.includes(s)) ||
      j.county.includes("Any") ||
      j.county.includes(county)
    );
  }
  if (matched.length === 0) matched = ALL_JOBS.slice(0, 8);

  // Sort by match score
  matched.sort((a, b) => b.match - a.match);

  res.json({ jobs: matched });
});

// Serve React frontend — always after API routes
const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge: "1d" }));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Start — 0.0.0.0 required for Railway
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Akili running on port ${PORT}`);
  console.log(`✓ Serving frontend from: ${distPath}`);
  console.log(`✓ Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? "SET" : "MISSING ⚠️"}`);
});
