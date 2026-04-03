# Akili — AI Career & Mental Wellness Platform

> Kazi · Afya · Matumaini (Work · Wellness · Hope)

An AI-powered fullstack web platform helping Kenyan youth find jobs and support their mental health — in Kiswahili and English.

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18 + Vite |
| Backend   | Node.js + Express |
| AI        | Anthropic Claude (claude-sonnet-4-20250514) |
| Deployment| Railway |

---

## Project Structure

```
akili/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx    # All screens and UI
│   │   ├── index.css  # Global styles
│   │   └── main.jsx   # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/           # Express API server
│   ├── server.js      # Main server + all routes
│   ├── .env.example   # Environment variable template
│   └── package.json
├── railway.toml       # Railway deployment config
├── nixpacks.toml      # Nixpacks build config
├── .gitignore
└── README.md
```

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/akili.git
cd akili

# Install all dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 2. Set up environment variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

Get your API key at: https://console.anthropic.com

### 3. Run locally (two terminals)

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open: http://localhost:5173

---

## Deploy to Railway (Step-by-Step)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Akili platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/akili.git
git push -u origin main
```

### Step 2 — Create Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `akili` repository
4. Railway will auto-detect the `railway.toml` config

### Step 3 — Set environment variables in Railway

In your Railway project dashboard:
1. Click your service → **Variables** tab
2. Add these variables:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | Your Railway public URL (e.g. `https://akili.up.railway.app`) |

### Step 4 — Get your public URL

1. In Railway, go to **Settings** → **Networking**
2. Click **Generate Domain** to get a public URL
3. Copy the URL and set it as `ALLOWED_ORIGINS` in your environment variables
4. Redeploy (Railway auto-redeploys on variable changes)

### Step 5 — Verify deployment

Visit `https://your-app.up.railway.app/api/health` — you should see:
```json
{ "status": "ok", "timestamp": "..." }
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/chat` | AI chat (wellness or career) |
| POST | `/api/jobs` | Fetch AI-matched job listings |

### POST /api/chat

```json
{
  "messages": [{ "role": "user", "content": "I feel overwhelmed" }],
  "mode": "wellness",
  "user": {
    "name": "Amina",
    "age": "22",
    "county": "Nairobi",
    "skills": ["Sales", "Customer service"],
    "mood": "low"
  }
}
```

### POST /api/jobs

```json
{
  "skills": ["Sales", "Customer service"],
  "county": "Nairobi"
}
```

---

## Features

- **Splash + Onboarding** — 5-step personalisation flow collecting name, age, county, skills, and mood
- **Dashboard** — Personalised job matches, mood tracker, wellness streak, crisis banner
- **Akili Kazi** — AI-matched job opportunities based on user skills; apply button launches career AI coach
- **Akili Afya** — Live AI chat powered by Claude in both Wellness and Career modes; Kiswahili support; crisis detection + crisis helpline surfacing
- **Resources** — Real Kenyan crisis helplines, hospitals, government employment programmes
- **Profile** — User summary, skill pills, wellness journey

---

## Crisis Safety

The app detects crisis keywords (in English and Kiswahili) and:
1. Shows a prominent crisis banner with the Befrienders Kenya helpline
2. The AI always provides the helpline number in its response
3. A "Talk now" button routes the user to the wellness chat immediately

**Befrienders Kenya: 0800 723 253 (toll-free, 24/7)**

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | Yes | `development` or `production` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins |

---

## License

MIT — built for Kenya's youth.
