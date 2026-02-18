# Step-by-Step Setup Guide — Smart Bookmark App

## Prerequisites

- Node.js 18+ installed
- A Supabase account and project
- A Google Cloud project with OAuth 2.0 credentials
- A GitHub account
- A Vercel account (sign up with GitHub)

---

## Step 1 — Set Up the Supabase Database

1. Go to your Supabase project dashboard.
2. Click **SQL Editor** in the left sidebar.
3. Run the following SQL to create the bookmarks table and enable Row Level Security:

```sql
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  url text not null,
  created_at timestamptz default now() not null
);

alter table bookmarks enable row level security;

create policy "Users can view own bookmarks"
  on bookmarks for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
  on bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on bookmarks for delete
  using (auth.uid() = user_id);
```

4. Click **Run**.

---

## Step 2 — Enable Realtime on the Bookmarks Table

1. In Supabase, go to **Database** → **Replication**.
2. Under **Supabase Realtime**, find the `bookmarks` table.
3. Toggle it **on** (enable realtime for this table).

---

## Step 3 — Configure Google OAuth in Supabase

1. In Supabase, go to **Authentication** → **Providers**.
2. Find **Google** and toggle it **on**.
3. Enter:
   - **Client ID:** `<your-google-client-id>`
   - **Client Secret:** `<your-google-client-secret>`
4. Click **Save**.

---

## Step 4 — Install Dependencies and Run Locally

1. Open a terminal in the `app` folder inside your project directory.
2. Run:

```bash
npm install
npm run dev
```

3. Open `http://localhost:3000` in your browser.
4. You should see the login page. Click "Continue with Google" to test.

---

## Step 5 — Push to GitHub

Run these commands from inside the `app` folder:

```bash
git remote remove origin
git remote add origin https://github.com/kinshukkush/SMART-BOOKMARK-APP.git
git add .
git commit -m "initial commit: smart bookmark app"
git branch -M main
git push -u origin main
```

> Note: The `app` folder already has a `.git` directory from `create-next-app`. Push from inside it.

---

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Add New Project"**.
3. Import the `SMART-BOOKMARK-APP` repository.
4. Set the **Root Directory** to `app` (since the Next.js project is inside the `app` subfolder).
5. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ymanansjcaegsuokieav.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full anon key)
6. Click **Deploy**.
7. Once deployed, copy your Vercel URL (e.g., `https://smart-bookmark-app.vercel.app`).

---

## Step 7 — Add Vercel URL to Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Navigate to **APIs & Services** → **Credentials** → your OAuth 2.0 Client.
3. Under **Authorized redirect URIs**, add:
   - `https://ymanansjcaegsuokieav.supabase.co/auth/v1/callback` (already added)
4. Click **Save**.

> The Supabase callback URL handles all redirects, so you don't need to add the Vercel URL separately.

---

## Step 8 — Add Vercel URL to Supabase Auth Settings

1. In Supabase, go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g., `https://smart-bookmark-app.vercel.app`).
3. Under **Redirect URLs**, add: `https://smart-bookmark-app.vercel.app/**`
4. Click **Save**.

---

## Step 9 — Test the Live App

1. Open your Vercel URL in a browser.
2. Sign in with Google.
3. Add a bookmark.
4. Open the same URL in another tab — the bookmark should appear there too (real-time).
5. Delete a bookmark — it disappears from both tabs.

---

## Folder Structure

```
app/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts       # OAuth callback handler
│   ├── login/
│   │   └── page.tsx           # Login page
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main bookmarks dashboard
├── lib/
│   └── supabase/
│       ├── client.ts          # Browser Supabase client
│       └── server.ts          # Server Supabase client
├── middleware.ts               # Route protection
├── .env.local                 # Environment variables (not in Git)
├── .env.example               # Example env file
├── file-explanation.md        # Code explanation for every file
├── setup-steps.md             # This file
└── README.md                  # Project overview and problems/solutions
```
