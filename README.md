# Smart Bookmark App

A simple, privacy-first bookmark manager built with Next.js and Supabase. Sign in with Google, save your bookmarks, and watch them sync in real-time across all your open tabs.

---

## Live Demo

> 🔗 **Live URL:** [https://smart-bookmark-app-pi-hazel.vercel.app](https://smart-bookmark-app-pi-hazel.vercel.app)

## GitHub Repository

> 📁 [github.com/kinshukkush/SMART-BOOKMARK-APP](https://github.com/kinshukkush/SMART-BOOKMARK-APP)

---

## Features

- **Google Sign-In only** — no email/password, no friction
- **Private bookmarks** — each user sees only their own data (enforced via Row Level Security)
- **Real-time sync** — open two tabs, add a bookmark in one, it instantly appears in the other
- **Add bookmarks** — save any URL with a title
- **Delete bookmarks** — remove any bookmark with one click
- **Deployed on Vercel** — fast, globally distributed

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL |
| Real-time | Supabase Realtime |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Project Structure

```
app/
├── app/
│   ├── auth/callback/route.ts   # OAuth callback handler
│   ├── login/page.tsx           # Login page (Google sign-in)
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main bookmarks dashboard
├── lib/
│   └── supabase/
│       ├── client.ts            # Browser Supabase client
│       └── server.ts            # Server Supabase client
├── proxy.ts                     # Route protection (Next.js 16)
└── README.md
```

---

## Problems Encountered & How They Were Solved

### 1. Next.js project name restriction
**Problem:** `create-next-app` does not allow capital letters or spaces in the project name, but the target folder was `Smart Bookmark App`.  
**Solution:** Created the project inside a subdirectory named `app` within the workspace folder, then set the Vercel root directory to `app` during deployment.

### 2. Supabase SSR cookie handling in Next.js App Router
**Problem:** The standard `@supabase/supabase-js` client doesn't handle server-side cookies in Next.js App Router, causing session loss between requests.  
**Solution:** Used `@supabase/ssr` which provides `createBrowserClient` and `createServerClient` with proper cookie adapters for both client and server contexts.

### 3. Real-time updates scoped to the current user
**Problem:** Supabase Realtime broadcasts all table changes by default — we only want changes for the logged-in user.  
**Solution:** Used the `filter` option on the Realtime channel: `filter: \`user_id=eq.${user.id}\`` so only the current user's changes are pushed to the client.

### 4. Row Level Security (RLS)
**Problem:** Without RLS, any authenticated user could read or delete another user's bookmarks via the Supabase API.  
**Solution:** Enabled RLS on the `bookmarks` table with policies that restrict SELECT, INSERT, and DELETE to rows where `user_id = auth.uid()`.

### 5. Google OAuth "Unsupported provider" error
**Problem:** After setting up the code, clicking "Continue with Google" returned a 400 error saying the provider was not enabled.  
**Solution:** The Google provider must be explicitly enabled in Supabase Dashboard → Authentication → Providers, with the Client ID and Secret from Google Cloud Console entered there.

### 6. GitHub push protection blocked secrets
**Problem:** GitHub's secret scanning blocked the push because the setup documentation file contained the Google OAuth Client ID and Secret.  
**Solution:** Replaced the actual credentials with `<placeholder>` values in the documentation file, amended the commit, and pushed the clean history.

### 7. Next.js 16 middleware renamed to proxy
**Problem:** Next.js 16 deprecated `middleware.ts` in favour of `proxy.ts`, and the exported function must be named `proxy` (not `middleware`).  
**Solution:** Renamed the file to `proxy.ts` and updated the export name accordingly.

---

## Local Development Setup

1. Clone the repo and go into the `app` folder:
   ```bash
   git clone https://github.com/kinshukkush/SMART-BOOKMARK-APP.git
   cd SMART-BOOKMARK-APP/app
   npm install
   ```

2. Create `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

---

## Author

**Kinshuk Saxena**  
📧 [Kinshuksaxena3@gmail.com](mailto:kinshuksaxena3@gmail.com)  
🐙 [github.com/kinshukkush](https://github.com/kinshukkush)

---

## License

MIT License — free to use, modify, and distribute.

```
MIT License

Copyright (c) 2026 Kinshuk Kushwaha

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files.
```
