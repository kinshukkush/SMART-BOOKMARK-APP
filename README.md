# README.md — Smart Bookmark App

## What This App Does

A simple bookmark manager where users sign in with Google and save, view, and delete their own bookmarks. Bookmarks update in real-time across browser tabs using Supabase Realtime.

## Tech Stack

- **Next.js 15** (App Router)
- **Supabase** (Auth, PostgreSQL, Realtime)
- **Tailwind CSS**
- **Deployed on Vercel**

## Key Points

- Google OAuth only — no email/password login
- Each user sees only their own bookmarks (enforced via Row Level Security in Supabase)
- Real-time sync: open two tabs, add a bookmark in one, it appears in the other instantly
- Middleware protects all routes — unauthenticated users are redirected to `/login`

## Problems Encountered and How They Were Solved

### 1. Next.js project name restriction
**Problem:** `create-next-app` does not allow capital letters or spaces in the project name, but the target folder was `Smart Bookmark App`.  
**Solution:** Created the project inside a subdirectory named `app` within the workspace folder.

### 2. Supabase SSR cookie handling
**Problem:** Supabase Auth with Next.js App Router requires cookies to be read/written server-side. The old `createClient` from `@supabase/supabase-js` does not handle this.  
**Solution:** Used `@supabase/ssr` package which provides `createBrowserClient` and `createServerClient` with proper cookie adapters for Next.js middleware and Server Components.

### 3. Real-time updates scoped to the current user
**Problem:** Supabase Realtime broadcasts all changes on a table by default. We only want to receive changes for the logged-in user's bookmarks.  
**Solution:** Used the `filter` option on the Realtime channel: `filter: \`user_id=eq.${user.id}\`` — this ensures only relevant changes are pushed to the client.

### 4. Row Level Security (RLS)
**Problem:** Without RLS, any authenticated user could read or delete another user's bookmarks via the API.  
**Solution:** Enabled RLS on the `bookmarks` table and added policies so users can only SELECT, INSERT, and DELETE their own rows (`user_id = auth.uid()`).

### 5. Redirect URI mismatch for Google OAuth
**Problem:** Google OAuth requires the exact redirect URI to be whitelisted. Using the wrong URL causes an `redirect_uri_mismatch` error.  
**Solution:** Added `https://ymanansjcaegsuokieav.supabase.co/auth/v1/callback` as an authorized redirect URI in Google Cloud Console, and also added the Vercel production URL's auth callback after deployment.

## Live URL

> Add your Vercel URL here after deployment

## GitHub Repo

> https://github.com/kinshukkush/SMART-BOOKMARK-APP
