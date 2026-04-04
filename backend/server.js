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
app.use(express.json({ limit: "30kb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 60,
  message: { error: "Too many messages. Please wait a moment." },
  standardHeaders: true, legacyHeaders: false,
});

// ── Crisis detection (English + Kiswahili) ───────────────────────────────────
const CRISIS = ["suicide","kill myself","end my life","kujiua","no reason to live",
  "want to die","better off dead","nafsi yangu","nijiue","mauti","nijiue mwenyewe"];
const detectCrisis = (t) => t ? CRISIS.some((kw) => t.toLowerCase().includes(kw)) : false;

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
Rules:
- Always respond in the same language the user writes — English or Kiswahili.
- Lead with empathy. Validate feelings before any advice.
- Keep replies 3-5 sentences unless more is clearly needed.
- Crisis signals: acknowledge pain, give Befrienders Kenya (0800 723 253, free, 24/7), encourage call.
- Ground advice in Kenyan context: family, community, faith, local resources.
- Never diagnose. Recommend professional help for serious issues.
- Remember the full conversation — reference what the user has shared.
- Be human, warm, real. Never robotic or clinical.`;

  return `You are Akili Kazi, a sharp practical AI career coach for Kenyan youth.
User profile: ${profile}
Rules:
- Give specific actionable Kenya-focused career advice every time.
- Reference real Kenyan employers (Safaricom, KCB, Equity Bank, Nation Media, Unilever Kenya, Deloitte Kenya, PwC Kenya).
- Reference job platforms: BrighterMonday Kenya, Fuzu Kenya, LinkedIn Kenya, MyJobMag Kenya, Jobs in Kenya.
- Reference gig platforms: Glovo Kenya, Bolt Kenya, Sendy, Uber Kenya.
- Reference government programmes: Kazi Mtaani, Ajira Digital, Hustler Fund, TVET Kenya.
- Help with CV writing, cover letters, interview prep, salary negotiation, side hustles, career pivots.
- Keep responses focused and actionable — 3-6 sentences.
- Be encouraging but realistic about the Kenyan job market.
- Remember the full conversation and build on it.
- If user wants to apply for a specific job, help them prepare targeted materials and give them the direct application link.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanMessages(raw) {
  let msgs = (raw||[])
    .filter((m) => m && ["user","assistant"].includes(m.role) && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0,4000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const alt = [];
  for (const m of msgs) {
    if (!alt.length) alt.push(m);
    else if (alt[alt.length-1].role === m.role) alt[alt.length-1] = m;
    else alt.push(m);
  }
  while (alt.length && alt[alt.length-1].role !== "user") alt.pop();
  return alt.slice(-24);
}

// ── Gemini AI (free, primary) ─────────────────────────────────────────────────
const GEMINI_MODELS = ["gemini-2.0-flash","gemini-1.5-flash","gemini-1.5-flash-8b"];

async function callGeminiModel(model, systemPrompt, messages, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      system_instruction: { parts:[{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens:900, temperature:0.75, topP:0.9 },
      safetySettings: [
        { category:"HARM_CATEGORY_HARASSMENT",        threshold:"BLOCK_NONE" },
        { category:"HARM_CATEGORY_HATE_SPEECH",       threshold:"BLOCK_NONE" },
        { category:"HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold:"BLOCK_NONE" },
        { category:"HARM_CATEGORY_DANGEROUS_CONTENT", threshold:"BLOCK_MEDIUM_AND_ABOVE" },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { status: res.status });
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw Object.assign(new Error(`Empty response. Reason: ${data?.candidates?.[0]?.finishReason||"unknown"}`), { status:500 });
  return text;
}

async function callGemini(systemPrompt, messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error("GEMINI_API_KEY not set. Add it in Railway Variables."), { status:500 });
  let lastErr;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await callGeminiModel(model, systemPrompt, messages, key);
        console.log(`[ai] OK model=${model} attempt=${attempt} chars=${text.length}`);
        return text;
      } catch (err) {
        lastErr = err;
        console.warn(`[ai] FAIL model=${model} attempt=${attempt} status=${err.status} msg=${err.message}`);
        if (err.status === 429 && attempt < 3) { await sleep(attempt * 1500); continue; }
        if (err.status === 400 || err.status === 403) throw err;
        break;
      }
    }
  }
  throw lastErr;
}

// ── Real job search via JSearch (RapidAPI) ────────────────────────────────────
async function fetchRealJobs(skills, county, query) {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return null; // fall back to curated list

  const searchQuery = query || `${skills.slice(0,2).join(" ")} jobs in ${county} Kenya`;
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(searchQuery)}&page=1&num_pages=2&country=ke&language=en`;

  try {
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key":  apiKey,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const jobs = (data.data || []).slice(0, 12).map((j, i) => ({
      id:          `real-${i}`,
      title:       j.job_title || "Job Opportunity",
      company:     j.employer_name || "Kenyan Employer",
      type:        j.job_employment_type || "Full-time",
      pay:         j.job_salary_currency && j.job_min_salary
                     ? `${j.job_salary_currency} ${j.job_min_salary?.toLocaleString()}–${j.job_max_salary?.toLocaleString()}/yr`
                     : "Competitive salary",
      match:       Math.floor(70 + Math.random() * 28),
      tags:        [j.job_employment_type || "Full-time", j.job_city || county, j.job_is_remote ? "Remote" : "On-site"].filter(Boolean),
      skills:      skills.slice(0,3),
      county:      [j.job_city || county, "Any"],
      applyUrl:    j.job_apply_link || j.job_google_link || "#",
      logo:        j.employer_logo || null,
      posted:      j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc).toLocaleDateString("en-KE") : "Recent",
      description: j.job_description?.slice(0, 300) || "",
      isReal:      true,
    }));
    return jobs.length > 0 ? jobs : null;
  } catch (e) {
    console.warn("[jobs] RapidAPI fetch failed:", e.message);
    return null;
  }
}

// ── Curated Kenyan job listings (always available fallback) ──────────────────
const CURATED_JOBS = [
  { id:1,  title:"Junior Data Analyst",         company:"Safaricom PLC",          type:"Full-time",     pay:"KSh 45,000/mo",        match:94, tags:["Excel","Data","Nairobi"],       skills:["Data entry","IT / Tech","Accounting"],       county:["Nairobi","Mombasa"], applyUrl:"https://www.safaricom.co.ke/careers", logo:null, posted:"Recent", isReal:false },
  { id:2,  title:"Social Media Manager",         company:"Jumia Kenya",            type:"Remote",        pay:"KSh 30,000/mo",        match:91, tags:["Instagram","TikTok","Remote"],  skills:["Social media","Graphic design","Writing"],   county:["Any"],               applyUrl:"https://group.jumia.com/careers",      logo:null, posted:"Recent", isReal:false },
  { id:3,  title:"Delivery Rider",               company:"Glovo Kenya",            type:"Gig",           pay:"KSh 800–1,500/day",    match:88, tags:["Gig","Daily pay","Flexible"],   skills:["Driving"],                                   county:["Nairobi","Mombasa","Kisumu"], applyUrl:"https://glovoapp.com/ke/en/courier", logo:null, posted:"Today", isReal:false },
  { id:4,  title:"Community Health Promoter",    company:"Amref Health Africa",    type:"Full-time",     pay:"KSh 28,000/mo",        match:85, tags:["NGO","Health","Training"],      skills:["Healthcare","Teaching","Customer service"],  county:["Any"],               applyUrl:"https://amref.org/job_opportunities", logo:null, posted:"Recent", isReal:false },
  { id:5,  title:"Graphic Designer",             company:"Nation Media Group",      type:"Full-time",     pay:"KSh 35,000/mo",        match:82, tags:["Creative","Adobe","Nairobi"],   skills:["Graphic design","Social media"],             county:["Nairobi"],           applyUrl:"https://www.nationmedia.com/careers",  logo:null, posted:"Recent", isReal:false },
  { id:6,  title:"Sales Agent — Agri-input",     company:"Apollo Agriculture",      type:"Gig",           pay:"Commission + KSh 15k", match:79, tags:["Rural","Farming","Gig"],        skills:["Sales","Farming","Customer service"],        county:["Any"],               applyUrl:"https://apolloagriculture.com/careers",logo:null, posted:"Recent", isReal:false },
  { id:7,  title:"Kitchen Hand / Chef Asst",     company:"Java House Kenya",        type:"Full-time",     pay:"KSh 22,000/mo",        match:76, tags:["Food","Training","Nairobi"],    skills:["Cooking"],                                   county:["Nairobi","Mombasa","Kisumu","Nakuru"], applyUrl:"https://www.javahouseafrica.com/careers", logo:null, posted:"Recent", isReal:false },
  { id:8,  title:"Customer Support Rep",          company:"Onfon Media",             type:"Full-time",     pay:"KSh 25,000/mo",        match:73, tags:["Call centre","Kiswahili","KE"], skills:["Customer service","Sales"],                 county:["Nairobi"],           applyUrl:"https://www.brightermonday.co.ke/listings/customer-support", logo:null, posted:"Recent", isReal:false },
  { id:9,  title:"Construction Labourer",         company:"Roko Construction",       type:"Contract",      pay:"KSh 700/day",          match:70, tags:["Physical","Contract","Daily"],  skills:["Construction"],                             county:["Nairobi","Thika","Nakuru"], applyUrl:"https://www.brightermonday.co.ke/listings/construction", logo:null, posted:"Recent", isReal:false },
  { id:10, title:"Primary School Teacher (BOM)", company:"Nairobi County Schools",  type:"Contract",      pay:"KSh 20,000/mo",        match:68, tags:["Education","BOM","Children"],   skills:["Teaching"],                                 county:["Nairobi","Mombasa","Kisumu"], applyUrl:"https://www.tsc.go.ke",      logo:null, posted:"Recent", isReal:false },
  { id:11, title:"Tailor / Fashion Designer",    company:"Kariokor Market Coop",    type:"Self-employed", pay:"KSh 500–2,000/order",  match:75, tags:["Creative","Self-employed"],     skills:["Tailoring"],                                county:["Nairobi","Mombasa"], applyUrl:"https://www.jiji.co.ke/nairobi/jobs",  logo:null, posted:"Recent", isReal:false },
  { id:12, title:"Accounts Assistant",            company:"KPMG Kenya",              type:"Full-time",     pay:"KSh 40,000/mo",        match:80, tags:["Finance","Excel","Graduate"],   skills:["Accounting","Data entry","IT / Tech"],      county:["Nairobi"],           applyUrl:"https://home.kpmg/ke/en/home/careers.html", logo:null, posted:"Recent", isReal:false },
  { id:13, title:"Digital Content Creator",       company:"Freshi Media",            type:"Freelance",     pay:"KSh 15k–50k/mo",       match:77, tags:["Video","YouTube","TikTok"],     skills:["Social media","Writing","Graphic design"],  county:["Any"],               applyUrl:"https://www.linkedin.com/jobs/kenya",   logo:null, posted:"Recent", isReal:false },
  { id:14, title:"Motorbike Courier",             company:"Sendy Kenya",             type:"Gig",           pay:"KSh 600–1,200/day",    match:83, tags:["Gig","Own bike","Flexible"],    skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu"], applyUrl:"https://www.sendy.co.ke/partner", logo:null, posted:"Today", isReal:false },
  { id:15, title:"Receptionist / Front Office",  company:"Radisson Blu Nairobi",    type:"Full-time",     pay:"KSh 28,000/mo",        match:71, tags:["Hospitality","English","Smart"],skills:["Customer service","Writing"],               county:["Nairobi"],           applyUrl:"https://jobs.radissonhotels.com",        logo:null, posted:"Recent", isReal:false },
  { id:16, title:"Software Developer (Junior)",  company:"Andela Kenya",            type:"Remote",        pay:"KSh 80,000–120,000/mo",match:89, tags:["Tech","Remote","Graduate"],     skills:["IT / Tech","Data entry"],                   county:["Any"],               applyUrl:"https://andela.com/join-andela",         logo:null, posted:"Recent", isReal:false },
  { id:17, title:"Nurse — Clinical Officer",     company:"Aga Khan Hospital",       type:"Full-time",     pay:"KSh 55,000/mo",        match:86, tags:["Healthcare","Hospital","KE"],   skills:["Healthcare"],                                county:["Nairobi","Mombasa"], applyUrl:"https://www.agakhanacademies.org/careers", logo:null, posted:"Recent", isReal:false },
  { id:18, title:"Farm Manager",                 company:"Vegpro Kenya",            type:"Full-time",     pay:"KSh 35,000/mo",        match:78, tags:["Agriculture","Farming","Nakuru"],skills:["Farming","Customer service"],               county:["Nakuru","Nairobi"],  applyUrl:"https://www.fuzu.com/kenya/jobs/agriculture", logo:null, posted:"Recent", isReal:false },
  { id:19, title:"Security Guard",               company:"G4S Kenya",               type:"Full-time",     pay:"KSh 18,000/mo",        match:72, tags:["Security","Uniform","Shifts"],  skills:["Customer service"],                         county:["Any"],               applyUrl:"https://www.g4s.com/en-ke/about-g4s/careers", logo:null, posted:"Recent", isReal:false },
  { id:20, title:"Bolt Driver Partner",           company:"Bolt Kenya",              type:"Gig",           pay:"Earn KSh 2,000–5,000/day",match:81, tags:["Gig","Driving","Flexible"],  skills:["Driving"],                                  county:["Nairobi","Mombasa","Kisumu","Nakuru"], applyUrl:"https://bolt.eu/en-ke/driver", logo:null, posted:"Today", isReal:false },
];

// ── Job board search links ────────────────────────────────────────────────────
function getJobBoardLinks(query) {
  const q = encodeURIComponent(query + " Kenya");
  return {
    brightermonday: `https://www.brightermonday.co.ke/listings?q=${encodeURIComponent(query)}&l=Kenya`,
    fuzu:           `https://www.fuzu.com/kenya/jobs?search=${encodeURIComponent(query)}`,
    linkedin:       `https://www.linkedin.com/jobs/search/?keywords=${q}&location=Kenya`,
    myjobmag:       `https://www.myjobmag.co.ke/search/?q=${encodeURIComponent(query)}`,
    jobsinkenya:    `https://www.jobsinkenya.co.ke/?s=${encodeURIComponent(query)}`,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  timestamp: new Date().toISOString(),
  ai: "Google Gemini (free tier — multi-model fallback)",
  geminiKey:  process.env.GEMINI_API_KEY  ? "SET ✓" : "MISSING ✗",
  rapidapiKey: process.env.RAPIDAPI_KEY   ? "SET ✓" : "not set (optional)",
}));

// Chat
app.post("/api/chat", chatLimiter, async (req, res) => {
  const { messages, mode, user } = req.body;
  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: "messages array is required." });
  if (!["wellness","career"].includes(mode))
    return res.status(400).json({ error: "mode must be wellness or career." });
  if (!process.env.GEMINI_API_KEY)
    return res.status(500).json({ error: "GEMINI_API_KEY not configured. Add it in Railway Variables — get a free key at aistudio.google.com" });

  const final = cleanMessages(messages);
  if (!final.length) return res.status(400).json({ error: "No valid user message found." });

  const lastUser = [...final].reverse().find((m) => m.role === "user");
  const isCrisis = detectCrisis(lastUser?.content);

  console.log(`[chat] mode=${mode} user=${user?.name} msgs=${final.length}`);

  try {
    const reply = await callGemini(buildSystemPrompt(mode, user||{}), final);
    res.json({ reply, crisis: isCrisis });
  } catch (err) {
    console.error("[chat] error:", err.status, err.message);
    if (err.status === 401 || err.status === 403)
      return res.status(403).json({ error: "Gemini API key invalid or expired. Check GEMINI_API_KEY in Railway Variables." });
    if (err.status === 429)
      return res.status(429).json({ error: "AI is momentarily busy. Please try again in a few seconds." });
    if (err.status === 500 && err.message.includes("GEMINI_API_KEY"))
      return res.status(500).json({ error: err.message });
    res.status(503).json({ error: `AI error: ${err.message || "Please try again."}` });
  }
});

// Jobs — real API + curated fallback + job board links
app.post("/api/jobs", async (req, res) => {
  const { skills=[], county="Nairobi", query="" } = req.body;

  // Try real JSearch API first
  let realJobs = null;
  if (process.env.RAPIDAPI_KEY) {
    realJobs = await fetchRealJobs(skills, county, query);
  }

  // Filter curated jobs by skills + county
  let curated = CURATED_JOBS;
  if (skills.length) {
    curated = CURATED_JOBS.filter((j) =>
      j.skills.some((s) => skills.includes(s)) ||
      j.county.includes("Any") ||
      j.county.includes(county)
    );
  }
  if (!curated.length) curated = CURATED_JOBS.slice(0,10);
  curated.sort((a,b) => b.match - a.match);

  // Merge: real jobs first (if any), then curated
  const jobs = realJobs ? [...realJobs, ...curated.slice(0,8)] : curated;

  // Job board links for manual search
  const searchTerm = query || (skills.length ? skills.slice(0,2).join(" ") : "jobs");
  const boards = getJobBoardLinks(searchTerm);

  res.json({ jobs, boards, hasRealJobs: !!realJobs });
});

// Serve React
const distPath = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath, { maxAge:"1d" }));
app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✓ Akili on port ${PORT}`);
  console.log(`✓ AI: Gemini ${GEMINI_MODELS.join(" → ")}`);
  console.log(`✓ Gemini key: ${process.env.GEMINI_API_KEY ? "SET ✓" : "MISSING ✗"}`);
  console.log(`✓ RapidAPI (real jobs): ${process.env.RAPIDAPI_KEY ? "SET ✓" : "not set — using curated jobs"}\n`);
}); 
