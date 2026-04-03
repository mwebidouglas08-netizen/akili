require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// ── CORS ───────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "10kb" }));

// ── Rate limiting ──────────────────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests. Please wait a moment before sending another message." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Anthropic client ──────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const CRISIS_KEYWORDS = [
  "suicide", "kill myself", "end my life", "kujiua", "no reason to live",
  "want to die", "better off dead", "nafsi yangu", "nijiue",
];

function detectCrisis(text) {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

function buildSystemPrompt(mode, user) {
  const base = `User profile: Name=${user.name}, Age=${user.age}, County=${user.county}, Skills=${(user.skills || []).join(", ")}, Current mood=${user.mood}.`;

  if (mode === "wellness") {
    return `You are Akili Afya, a warm, culturally sensitive AI mental wellness companion built specifically for Kenyan youth.
${base}
Guidelines:
- Respond in the same language the user writes in (English or Kiswahili).
- Be empathetic, non-clinical, and non-judgmental. Validate feelings first.
- Keep responses concise — 3 to 5 sentences unless the user needs more.
- If the user shows ANY signs of crisis or suicidal ideation, acknowledge their pain clearly, provide the Befrienders Kenya helpline (0800 723 253, toll-free, 24/7), and strongly encourage them to call.
- Ground your advice in Kenyan cultural context — reference community, family support, faith where appropriate.
- Never diagnose. Always encourage professional help for serious issues.`;
  }

  return `You are Akili Kazi, an AI career coach specialising in helping Kenyan youth find jobs and build careers.
${base}
Guidelines:
- Give practical, specific, Kenya-focused career advice.
- Reference real Kenyan employers, job boards (BrighterMonday, Fuzu, LinkedIn Kenya), gig platforms (Glovo, Uber, Jiji), and government programmes (Kazi Mtaani, Ajira Digital, Hustler Fund).
- Help with CV writing, interview prep, salary negotiation, and skills development.
- Keep responses focused and actionable — 3 to 5 sentences.
- Be encouraging and realistic about the Kenyan job market.`;
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }
  if (!["wellness", "career"].includes(mode)) {
    return res.status(400).json({ error: "mode must be 'wellness' or 'career'." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "API key not configured." });
  }

  // Sanitise messages
  const sanitised = messages
    .filter((m) => m.role && m.content && typeof m.content === "string")
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content.slice(0, 2000) }))
    .slice(-12);

  const lastUserMsg = sanitised.filter((m) => m.role === "user").pop();
  const isCrisis = lastUserMsg ? detectCrisis(lastUserMsg.content) : false;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: buildSystemPrompt(mode, user || {}),
      messages: sanitised,
    });

    const text = response.content[0]?.text || "Samahani, please try again.";

    res.json({
      reply: text,
      crisis: isCrisis,
    });
  } catch (err) {
    console.error("Anthropic error:", err.message);
    const status = err.status || 500;
    res.status(status).json({
      error: status === 429
        ? "The AI service is busy. Please try again in a moment."
        : "Something went wrong. Please try again.",
    });
  }
});

// Jobs endpoint — returns AI-matched jobs based on user skills
app.post("/api/jobs", async (req, res) => {
  const { skills = [], county = "Nairobi" } = req.body;

  const ALL_JOBS = [
    { id: 1, title: "Junior Data Analyst", company: "Safaricom PLC", type: "Full-time", pay: "KSh 45,000/mo", match: 94, tags: ["Excel", "Data", "Reports"], skills: ["Data entry", "IT / Tech", "Accounting"], county: ["Nairobi", "Mombasa"] },
    { id: 2, title: "Social Media Manager", company: "Jumia Kenya", type: "Remote", pay: "KSh 30,000/mo", match: 91, tags: ["Instagram", "TikTok", "Content"], skills: ["Social media", "Graphic design", "Writing"], county: ["Any"] },
    { id: 3, title: "Delivery Rider (Gig)", company: "Glovo", type: "Gig", pay: "KSh 800/day", match: 88, tags: ["Flexible", "Daily pay", "No CV needed"], skills: ["Driving"], county: ["Nairobi", "Mombasa", "Kisumu"] },
    { id: 4, title: "Community Health Promoter", company: "Amref Health Africa", type: "Full-time", pay: "KSh 28,000/mo", match: 85, tags: ["NGO", "Training provided", "Health"], skills: ["Healthcare", "Teaching", "Customer service"], county: ["Any"] },
    { id: 5, title: "Graphic Designer", company: "Nation Media Group", type: "Full-time", pay: "KSh 35,000/mo", match: 82, tags: ["Creative", "Adobe", "Branding"], skills: ["Graphic design", "Social media"], county: ["Nairobi"] },
    { id: 6, title: "Sales Agent (Agri-input)", company: "Apollo Agriculture", type: "Gig", pay: "Commission + KSh 15k base", match: 79, tags: ["Rural", "Farmers", "Commission"], skills: ["Sales", "Farming", "Customer service"], county: ["Any"] },
    { id: 7, title: "Kitchen Hand / Chef Assistant", company: "Java House Kenya", type: "Full-time", pay: "KSh 22,000/mo", match: 76, tags: ["No experience needed", "Training", "Food"], skills: ["Cooking"], county: ["Nairobi", "Mombasa", "Kisumu", "Nakuru"] },
    { id: 8, title: "Customer Support Rep", company: "Onfon Media", type: "Full-time", pay: "KSh 25,000/mo", match: 73, tags: ["Call centre", "English", "Kiswahili"], skills: ["Customer service", "Sales"], county: ["Nairobi"] },
    { id: 9, title: "Construction Labourer", company: "Roko Construction", type: "Contract", pay: "KSh 700/day", match: 70, tags: ["Physical", "Contract", "Daily pay"], skills: ["Construction"], county: ["Nairobi", "Thika", "Nakuru"] },
    { id: 10, title: "Primary School Teacher (BOM)", company: "Nairobi County Schools", type: "Contract", pay: "KSh 20,000/mo", match: 68, tags: ["Education", "Children", "BOM"], skills: ["Teaching"], county: ["Nairobi", "Mombasa", "Kisumu"] },
    { id: 11, title: "Tailor / Fashion Designer", company: "Kariokor Market Cooperative", type: "Self-employed", pay: "KSh 500–2,000/order", match: 75, tags: ["Creative", "Self-employed", "Flexible"], skills: ["Tailoring"], county: ["Nairobi", "Mombasa"] },
    { id: 12, title: "Accounts Assistant", company: "KPMG Kenya", type: "Full-time", pay: "KSh 40,000/mo", match: 80, tags: ["Finance", "Excel", "Graduate"], skills: ["Accounting", "Data entry", "IT / Tech"], county: ["Nairobi"] },
  ];

  let matched = ALL_JOBS;
  if (skills.length > 0) {
    matched = ALL_JOBS.filter((j) =>
      j.skills.some((s) => skills.includes(s)) ||
      j.county.includes("Any") ||
      j.county.includes(county)
    );
  }
  if (matched.length === 0) matched = ALL_JOBS.slice(0, 6);

  res.json({ jobs: matched });
});

// ── Serve React build in production ──────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Akili backend running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});
