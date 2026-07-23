# Sterling Pawnshop — Staff Portal

A full-stack pawnshop manager built with Next.js 14, Supabase, and deployed on Vercel.

## Features
- 📦 **Inventory** — Track items with cost price, selling price, profit margin
- 🤝 **Buybacks** — Manage buybacks with collateral, interest, due dates, overdue alerts
- 👥 **Customers** — Customer records with ID verification fields
- 💵 **Payroll** — Employee salary management, monthly payslip generation, PDF/Excel export, & annual tax statements
- 📊 **Dashboard** — Live stats, overdue alerts, revenue overview
- 📲 **SMS Portal** — Send SMS notifications via Arkesel
- 🔔 **Push Notifications** — Receive iPhone alerts for overdue and due-in-3-days loans

## Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + REST API)
- **Hosting**: Vercel (with daily cron job)

---

## Setup Instructions

### Step 1 — Supabase Database
1. Go to [supabase.com](https://supabase.com) and open your project
2. Go to **SQL Editor**
3. Paste the entire contents of `schema.sql` and click **Run**
4. Then paste `migrate-push-notifications.sql` and click **Run**
5. Then paste `migrate-payroll.sql` to set up the **Payroll & Employees** tables and click **Run**


### Step 2 — Environment Variables
Create a `.env.local` file in the root with:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@sterlingpawnshop.com
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-random-secret
```

### Step 3 — Deploy to Vercel
1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Add **all** environment variables from `.env.local` in the Vercel dashboard
4. Click **Deploy** — the cron job runs automatically every day at 8 AM UTC

### Step 4 — Enable Push Notifications on iPhone
1. Open the site from your **iPhone Home Screen icon**
2. Log in, then tap the **🔔 Enable Notifications** button in the sidebar
3. Grant permission when iOS prompts you
4. You'll now receive alerts for overdue and due-in-3-days loans

### Run Locally
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Test the Notification Cron Manually
```bash
# Trigger a test push to all subscribed devices
curl -H "Authorization: Bearer your-cron-secret" https://your-domain.vercel.app/api/notify-due
```

---

## Currency
The app uses **GH₵ (Ghana Cedis)** by default.

## Security Note
After setting up, consider enabling Supabase Auth so only you can log in.
Regenerate your anon key from Supabase Settings → API if it was ever shared publicly.
The `SUPABASE_SERVICE_ROLE_KEY` is a **secret** — never expose it in client-side code.

