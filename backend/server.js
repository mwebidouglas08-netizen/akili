require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
const path      = require("path");

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
const detectCrisis = (t) =>
  t ? CRISIS_KEYWORDS.some((kw) => t.toLowerCase().includes(kw)) : false;

// ── System prompts ────────────────────────────────────────────────────────────
function buildSystemPrompt(mode, user) {
  const profile = [
    user.name   ? `Name: ${user.name}`            : null,
    user.age    ? `Age: ${user.age}`              : null,
    user.county ? `County: ${user.county}, Kenya` : null,
    user.skills?.length ? `Skills: ${user.skills.join(", ")}` : null,
    user.mood   ? `Current mood: ${user.mood}`    : null,
  ].filter(Boolean).join(" | ");

  if (mode === "wellness") {
    return `You are Akili Afya, a warm, culturally sensitive AI mental wellness companion built for Kenyan youth.
User profile: ${profile}

Instructions:
- Always respond in the same language the user writes in — English or Kiswahili.
- Lead every response with empathy. Validate feelings before any advice.
- Keep replies conversational and concise — 3 to 5 sentences unless the user clearly needs more.
- If the user expresses suicidal ideation, severe distress, or any crisis signal: acknowledge their pain with compassion, provide the Befrienders Kenya crisis helpline (0800 723 253 — free call, available 24 hours a day, 7 days a week), and strongly encourage them to reach out.
- Ground your advice in Kenyan cultural context — reference family, community, faith, and local realities where relevant.
- Never diagnose any condition. Always encourage professional support for serious mental health concerns.
- You have memory of the entire conversation — use it. Reference what the user has shared earlier to show you are listening and learning about them.
- Be human, warm, and real. Avoid robotic or clinical language.`;
  }

  return `You are Akili Kazi, a sharp and practical AI career coach for Kenyan youth.
User profile: ${profile}

Instructions:
- Give specific, actionable, Kenya-focused career advice every time.
- Reference real, relevant Kenyan context: employers such as Safaricom, KCB, Equity Bank, Nation Media Group, and Unilever Kenya; job platforms such as BrighterMonday, Fuzu, and LinkedIn Kenya; gig platforms such as Glovo, Bolt, and Sendy; government programmes such as Kazi Mtaani, Ajira Digital, Hustler Fund, and TVET institutions.
- Help the user with CV writing, cover letters, interview preparation, salary negotiation, side hustles, and career pivots.
- Keep responses focused and actionable — 3 to 6 sentences.
- Be encouraging but honest about the realities of the Kenyan job market.
- You have memory of the full conversation — use it. Build on what the user has already told you so they do not have to repeat themselves.
- If the user wants to apply for a specific job, help them prepare targeted, role-specific materials.`;
}

// ── Message cleaner ───────────────────────────────────────────────────────────
function cleanMessages(raw) {
  let msgs = raw
    .filter((m) => m && ["user","assistant"].includes(m.role)
      && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  // Must start with user
  while (msgs.length && msgs[0].role !== "user") msgs.shift();

  // Strict alternation — keep last of consecutive same-role
  const alt = [];
  for (const m of msgs) {
    if (!alt.length) { alt.push(m); }
    else if (alt[alt.length - 1].role === m.role) { alt[alt.length - 1] = m; }
    else { alt.push(m); }
  }

  // Must end with user
  while (alt.length && alt[alt.length - 1].role !== "user") alt.pop();

  return alt.slice(-24); // keep last 24 messages for good memory
}

// ── OpenAI GPT-4o call ────────────────────────────────────────────────────────
async function callOpenAI(systemPrompt, messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw Object.assign(
    new Error("OPENAI_API_KEY not configured. Add it in Railway Variables."), { status: 500 }
  );

  const body = {
    model: "gpt-4o",
    max_tokens: 800,
    temperature: 0.75,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  };

  const res  = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[openai] error:", JSON.stringify(data));
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }

  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("Empty response from OpenAI");

  return reply;
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  timestamp: new Date().toISOString(),
  ai: "OpenAI GPT-4o",
  openaiKey: process.env.OPENAI_API_KEY ? "SET ✓" : "MISSING ✗",
}));

app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;

  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: "messages array is required." });
  if (!["wellness","career"].includes(mode))
    return res.status(400).json({ error: "mode must be wellness or career." });
  if (!process.env.OPENAI_API_KEY)
    return res.status(500).json({ error: "OPENAI_API_KEY not configured. Add it in Railway Variables." });

  const final = cleanMessages(messages);
  if (!final.length) return res.status(400).json({ error: "No valid user message found." });

  const lastUser = [...final].reverse().find((m) => m.role === "user");
  const isCrisis = detectCrisis(lastUser?.content);

  console.log(`[chat] mode=${mode} user=${user?.name} msgs=${final.length}`);

  try {
    const reply = await callOpenAI(buildSystemPrompt(mode, user || {}), final);
    console.log(`[chat] OK chars=${reply.length}`);
    res.json({ reply, crisis: isCrisis });
  } catch (err) {
    console.error("[chat] error:", err.status, err.message);
    if (err.status === 401) return res.status(401).json({ error: "OpenAI API key is invalid. Check OPENAI_API_KEY in Railway Variables." });
    if (err.status === 429) return res.status(429).json({ error: "AI is busy. Please wait a moment and try again." });
    if (err.status === 500 && err.message.includes("OPENAI_API_KEY")) return res.status(500).json({ error: err.message });
    res.status(503).json({ error: "AI service error. Please try again." });
  }
});

app.post("/api/jobs", (req, res) => {
  const { skills = [], county = "Nairobi" } = req.body;
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
  if (!matched.length) matched = ALL.slice(0, 8);
  matched.sort((a, b) => b.match - a.match);
  res.json({ jobs: matched });
});

const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge: "1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Akili on port ${PORT}`);
  console.log(`✓ AI: OpenAI GPT-4o`);
  console.log(`✓ OpenAI key: ${process.env.OPENAI_API_KEY ? "SET ✓" : "MISSING ✗ — add OPENAI_API_KEY in Railway Variables"}`);
});
