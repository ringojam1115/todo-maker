# pln. — AI-Powered Learning Planner

**pln.** is a personal learning planner that uses AI to generate and adapt daily/weekly/monthly TODO plans for each of your study goals. Reflect on what you actually did each day, and the AI automatically adjusts future plans based on your progress.

---

## Features

- **Goal management** — Create goals with a title, deadline, daily study time, current level, and learning materials
- **AI-generated plans** — Automatically generates concrete daily TODOs for the next 7 days, weekly plans for the next 3 months, and monthly plans beyond that
- **Daily reflection** — Log task completion, actual time spent, difficulty, notes, and artifacts; submit to regenerate future TODOs based on real progress
- **Learning tips** — AI-generated improvement tips per goal, refreshed on plan updates
- **Learning profile** — Tracks material affinity, completion rates, and difficulty trends over time
- **Timeline sidebar** — Visual overview of all plans grouped by day / week / month
- **Google Calendar integration** — Optionally connects to your calendar so study time is scheduled around existing events
- **Multi-language** — Japanese and English UI
- **Multi-LLM** — Supports OpenAI (GPT), Anthropic (Claude), and Google (Gemini)

---

## Prerequisites

You need an API key from **at least one** of the following providers:

| Provider | Model used | Where to get a key |
|---|---|---|
| **OpenAI** (default) | GPT-4o mini | https://platform.openai.com/api-keys |
| **Anthropic Claude** | claude-3-5-haiku | https://console.anthropic.com/settings/api-keys |
| **Google Gemini** | gemini-2.0-flash | https://aistudio.google.com/apikey |

OpenAI is the default and the simplest to start with.

---

## Getting an OpenAI API Key (step-by-step)

1. Go to https://platform.openai.com and sign up or log in
2. Click your profile icon (top-right) → **API keys**
3. Click **Create new secret key**, give it a name (e.g. `pln-local`), and copy the key — it starts with `sk-`
4. Add a payment method under **Billing** if you have not already (usage is pay-per-use, typical cost is a few cents per plan generation)

> **Claude / Gemini**: follow the same pattern on their respective consoles. Keys for these providers are entered directly in the app's Settings modal and stored in your browser — no environment variable needed.

---

## Running locally

### Step 1 — Clone and install dependencies

```bash
git clone https://github.com/ringojam1115/todo-maker.git
cd todo-maker
npm install
```

### Step 2 — Create an environment file

Create a file named `.env.local` in the project root:

```bash
# Required: default LLM provider key (OpenAI)
OPENAI_API_KEY=sk-...your-key-here...

# Optional: enables Google Calendar integration
# See "Google Calendar setup" below for how to get this
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

> If you prefer Claude or Gemini instead of OpenAI, you can still set `OPENAI_API_KEY` to anything as a placeholder and enter your preferred key through the app's **Settings** menu after launching.

### Step 3 — Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Step 4 — Configure the app

1. Click the **⚙** (gear) icon in the top-left sidebar
2. Under **AI Provider**, select your preferred model (OpenAI / Claude / Gemini)
3. If using Claude or Gemini, paste your API key in the key field — it is stored locally in your browser and never sent to any server other than the chosen AI provider
4. Set your preferred language (Japanese / English)
5. Click **Save**

### Step 5 — Add your first goal

1. Click **+** in the top-left sidebar
2. Enter: goal title, deadline, daily study time (minutes), and your current level
3. Optionally add learning materials (book titles, URLs, etc.)
4. Click **Generate plan** — the AI will create your full TODO schedule

---

## Deploying to Vercel

Vercel lets you access pln. from any device (phone, tablet, another computer) via a personal URL.

### Step 1 — Install the Vercel CLI

```bash
npm i -g vercel
```

> If you get a permissions error on macOS, use: `sudo npm i -g vercel`

### Step 2 — Push your code to GitHub

Make sure your code is pushed to GitHub. If you cloned this repo and made changes:

```bash
git add .
git commit -m "my setup"
git push
```

### Step 3 — Log in to Vercel

```bash
vercel login
```

A browser window will open. Choose **Continue with GitHub** and authorize Vercel.

### Step 4 — Link the project

Inside the project directory:

```bash
vercel link
```

Answer the prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → select your personal account
- **Link to existing project?** → `N` (first time) or `Y` if you already created one on the dashboard
- **Project name?** → `pln` or anything you like
- **Root directory?** → `.` (press Enter to accept)

### Step 5 — Set environment variables on Vercel

```bash
vercel env add OPENAI_API_KEY
```

Paste your OpenAI key, then select **all environments** (Production, Preview, Development) by pressing `a` then Enter.

If you use Google Calendar:

```bash
vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

> Claude and Gemini keys are entered inside the app's Settings UI and stored in the browser — no Vercel env variable needed for those.

### Step 6 — Deploy to production

```bash
vercel --prod
```

When it finishes, Vercel prints your production URL, e.g.:

```
Production: https://pln-yourname.vercel.app
```

Open that URL in any browser. Your data is stored in that browser's localStorage, so plans created on one device will not automatically sync to another — but you can use it fully independently on each device.

---

## Optional: Google Calendar integration

Connecting Google Calendar lets the AI see your existing events and avoid over-scheduling on busy days.

### Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com and sign in
2. Click the project selector at the top → **New Project** → give it a name → **Create**

### Step 2 — Enable the Google Calendar API

1. In the left menu, go to **APIs & Services** → **Library**
2. Search for **Google Calendar API** → click it → **Enable**

### Step 3 — Create an OAuth client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the consent screen first:
   - User type: **External**
   - Fill in app name (e.g. `pln`) and your email, then save
4. Back on Create OAuth client ID:
   - Application type: **Web application**
   - Name: anything (e.g. `pln-web`)
   - **Authorized JavaScript origins** — add your URLs:
     - `http://localhost:3000` (for local development)
     - `https://your-app.vercel.app` (your production URL)
5. Click **Create** — copy the **Client ID** (ends in `.apps.googleusercontent.com`)

### Step 4 — Add to your environment

**Local** — add to `.env.local`:

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**Vercel** — run:

```bash
vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

Paste the client ID and select all environments.

### Step 5 — Reconnect in the app

In the app, click **Connect Google Calendar** in the center panel header. Grant the permission — your calendar events will now be considered when generating plans.

---

## Data & privacy

All goal data, plans, and reflections are stored in your **browser's localStorage**. Nothing is sent to any external server except:

- The AI prompt (goal details, feedback) sent to your chosen LLM provider (OpenAI / Anthropic / Google)
- Google Calendar event times (if connected), sent only to Google's OAuth and Calendar APIs

There is no backend database. Clearing browser storage will erase your data.

---

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Recharts](https://recharts.org) — progress charts
- OpenAI / Anthropic / Google APIs — plan generation and tips
