# File Explanation — Smart Bookmark App

This document explains every file in the project and what its code does.

---

## `.env.local`

Stores secret environment variables that Next.js loads at runtime. Never committed to Git.

- `NEXT_PUBLIC_SUPABASE_URL` — The URL of your Supabase project. Prefixed with `NEXT_PUBLIC_` so it is accessible in the browser.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — The public anon key for Supabase. Safe to expose in the browser; access is controlled by Row Level Security.

---

## `proxy.ts`

Runs on every request before it reaches a page (Next.js 16 renamed `middleware.ts` to `proxy.ts`). Uses `@supabase/ssr` to read the session from cookies.

- If the user is **not logged in** and tries to visit any page other than `/login` or `/auth/*`, they are redirected to `/login`.
- If the user **is logged in** and visits `/login`, they are redirected to `/` (the main page).
- Also refreshes the Supabase session cookie on every request to keep it alive.

---

## `lib/supabase/client.ts`

Creates a Supabase client for use in **Client Components** (browser). Uses `createBrowserClient` from `@supabase/ssr` which reads/writes cookies in the browser automatically.

---

## `lib/supabase/server.ts`

Creates a Supabase client for use in **Server Components** and **Route Handlers**. Uses `createServerClient` from `@supabase/ssr` which reads cookies from the incoming request and writes them to the response.

---

## `app/layout.tsx`

The root layout that wraps every page. Sets the HTML `<title>` and `<meta description>` via Next.js `Metadata`. Imports global CSS.

---

## `app/globals.css`

Global stylesheet. Imports Tailwind CSS using the `@import "tailwindcss"` directive (Tailwind v4 syntax). Also sets `box-sizing: border-box` and resets body margin.

---

## `app/login/page.tsx`

The login page. A Client Component (`'use client'`).

- Renders a centered card with the app name and a "Continue with Google" button.
- On button click, calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Supabase redirects the user to Google, then back to `/auth/callback` after login.

---

## `app/auth/callback/route.ts`

A Next.js Route Handler (API route). Handles the OAuth redirect from Supabase after Google login.

- Reads the `code` query parameter from the URL.
- Calls `supabase.auth.exchangeCodeForSession(code)` to convert the code into a session stored in cookies.
- Redirects the user to `/` on success, or `/login?error=auth_failed` on failure.

---

## `app/page.tsx`

The main bookmarks dashboard. A Client Component.

**State:**
- `user` — the logged-in Supabase user object
- `bookmarks` — array of the user's bookmarks fetched from the database
- `title`, `url` — form input values
- `loading`, `adding`, `error` — UI state flags

**On mount:**
1. Calls `supabase.auth.getUser()` to get the current user.
2. Fetches the user's bookmarks from the `bookmarks` table ordered by `created_at` descending.

**Real-time:**
- Subscribes to a Supabase Realtime channel filtered to `user_id=eq.<current user id>`.
- On `INSERT` event: prepends the new bookmark to the list.
- On `DELETE` event: removes the deleted bookmark from the list.
- Unsubscribes when the component unmounts.

**Add bookmark:**
- Validates that both title and URL are filled.
- Prepends `https://` if the URL doesn't start with `http://` or `https://`.
- Inserts a new row into the `bookmarks` table. The Realtime subscription picks up the change and updates the UI.

**Delete bookmark:**
- Calls `supabase.from('bookmarks').delete().eq('id', id)`.
- The Realtime subscription picks up the DELETE event and removes it from the list.

**Sign out:**
- Calls `supabase.auth.signOut()` then redirects to `/login`.

---

## `next.config.ts`

Default Next.js configuration file. No custom changes needed for this project.

---

## `tsconfig.json`

TypeScript configuration. The `@/*` path alias maps to the project root, so `@/lib/supabase/client` resolves to `lib/supabase/client.ts`.

---

## `package.json`

Lists all dependencies:
- `next` — the Next.js framework
- `react`, `react-dom` — React
- `@supabase/supabase-js` — Supabase JavaScript client
- `@supabase/ssr` — Supabase SSR helpers for Next.js cookie handling
- `tailwindcss` — utility-first CSS framework
