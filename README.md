# PawnPro — Pawnshop Management System

A full-stack pawnshop manager built with Next.js 14, Supabase, and deployed on Vercel.

## Features
- 📦 **Inventory** — Track items with cost price, selling price, profit margin
- 🤝 **Buybacks** — Manage buybacks with collateral, interest, due dates, overdue alerts
- 👥 **Customers** — Customer records with ID verification fields
- 📊 **Dashboard** — Live stats, overdue alerts, revenue overview

## Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + REST API)
- **Hosting**: Vercel (free tier)

---

## Setup Instructions

### Step 1 — Supabase Database
1. Go to [supabase.com](https://supabase.com) and open your project
2. Go to **SQL Editor**
3. Paste the entire contents of `schema.sql` and click **Run**
4. All tables will be created automatically

### Step 2 — Environment Variables
Create a `.env.local` file in the root with:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3 — Deploy to Vercel
1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Add these **Environment Variables** in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** — done!

### Run Locally
```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## Currency
The app uses **GH₵ (Ghana Cedis)** by default.

## Security Note
After setting up, consider enabling Supabase Auth so only you can log in.
Regenerate your anon key from Supabase Settings → API if it was ever shared publicly.
