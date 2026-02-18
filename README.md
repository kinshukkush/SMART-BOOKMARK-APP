# Smart Bookmark App 🔖

<div align="center">

![Smart Bookmark](https://img.shields.io/badge/Smart-Bookmark-blue?style=for-the-badge&logo=bookmark&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-green?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

<div align="center">
  <p>A simple, privacy-first bookmark manager built with Next.js and Supabase.</p>
  <p>Sign in with Google, save your bookmarks, and watch them sync in real-time across all your open tabs.</p>
</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔐 Authentication
- **Google Sign-In only** — no email/password, no friction
- Secure OAuth 2.0 flow
- Session management with Supabase Auth

</td>
<td width="50%">

### 🔒 Privacy First
- **Private bookmarks** — each user sees only their own data
- Row Level Security (RLS) enforced at database level
- No tracking, no analytics

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Real-time Sync
- **Instant updates** — open two tabs, add a bookmark in one
- Changes appear immediately in the other
- Powered by Supabase Realtime

</td>
<td width="50%">

### 🚀 Performance
- **Deployed on Vercel** — fast, globally distributed
- Server-side rendering with Next.js App Router
- Optimized for speed and reliability

</td>
</tr>
</table>

---

## 🌐 Live Demo

> 🔗 **Live URL:** [https://smart-bookmark-app-pi-hazel.vercel.app](https://smart-bookmark-app-pi-hazel.vercel.app)

> 📁 **GitHub Repository:** [github.com/kinshukkush/SMART-BOOKMARK-APP](https://github.com/kinshukkush/SMART-BOOKMARK-APP)

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router) |
| **Authentication** | Supabase Auth (Google OAuth) |
| **Database** | Supabase PostgreSQL |
| **Real-time** | Supabase Realtime |
| **Styling** | Tailwind CSS |
| **Deployment** | Vercel |

</div>

---

## 📁 Project Structure

```
app/
├── app/
│   ├── auth/callback/route.ts   # OAuth callback handler
│   ├── login/page.tsx           # Login page (Google sign-in)
│   ├── globals.css              # Global styles + animations
│   ├── layout.tsx               # Root layout with metadata
│   └── page.tsx                 # Main bookmarks dashboard
├── lib/
│   └── supabase/
│       ├── client.ts            # Browser Supabase client
│       └── server.ts            # Server Supabase client
├── public/
│   └── logo.svg                 # App logo and favicon
├── proxy.ts                     # Route protection (Next.js 16)
└── README.md                    # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account
- Google OAuth credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kinshukkush/SMART-BOOKMARK-APP.git
   cd SMART-BOOKMARK-APP/app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create `.env.local` in the `app` folder:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🎨 Features Showcase

### Real-time Collaboration
Open multiple browser tabs and watch bookmarks sync instantly. Add a bookmark in one tab, and it appears in all others without refresh!

### Modern UI/UX
- Beautiful gradient backgrounds
- Smooth animations and transitions
- Responsive design for all devices
- Glass-morphism effects
- Hover states and micro-interactions

### Security Features
- Row Level Security (RLS) policies
- User-scoped queries
- Secure OAuth flow
- Session management

---

## 🐛 Problems & Solutions

<details>
<summary><b>1. Next.js project name restriction</b></summary>

**Problem:** `create-next-app` does not allow capital letters or spaces in the project name, but the target folder was `Smart Bookmark App`.

**Solution:** Created the project inside a subdirectory named `app` within the workspace folder, then set the Vercel root directory to `app` during deployment.
</details>

<details>
<summary><b>2. Supabase SSR cookie handling in Next.js App Router</b></summary>

**Problem:** The standard `@supabase/supabase-js` client doesn't handle server-side cookies in Next.js App Router, causing session loss between requests.

**Solution:** Used `@supabase/ssr` which provides `createBrowserClient` and `createServerClient` with proper cookie adapters for both client and server contexts.
</details>

<details>
<summary><b>3. Real-time updates scoped to the current user</b></summary>

**Problem:** Supabase Realtime broadcasts all table changes by default — we only want changes for the logged-in user.

**Solution:** Used the `filter` option on the Realtime channel: `filter: \`user_id=eq.${user.id}\`` so only the current user's changes are pushed to the client.
</details>

<details>
<summary><b>4. Row Level Security (RLS)</b></summary>

**Problem:** Without RLS, any authenticated user could read or delete another user's bookmarks via the Supabase API.

**Solution:** Enabled RLS on the `bookmarks` table with policies that restrict SELECT, INSERT, and DELETE to rows where `user_id = auth.uid()`.
</details>

<details>
<summary><b>5. Google OAuth "Unsupported provider" error</b></summary>

**Problem:** After setting up the code, clicking "Continue with Google" returned a 400 error saying the provider was not enabled.

**Solution:** The Google provider must be explicitly enabled in Supabase Dashboard → Authentication → Providers, with the Client ID and Secret from Google Cloud Console entered there.
</details>

<details>
<summary><b>6. GitHub push protection blocked secrets</b></summary>

**Problem:** GitHub's secret scanning blocked the push because the setup documentation file contained the Google OAuth Client ID and Secret.

**Solution:** Replaced the actual credentials with `<placeholder>` values in the documentation file, amended the commit, and pushed the clean history.
</details>

<details>
<summary><b>7. Next.js 16 middleware renamed to proxy</b></summary>

**Problem:** Next.js 16 deprecated `middleware.ts` in favour of `proxy.ts`, and the exported function must be named `proxy` (not `middleware`).

**Solution:** Renamed the file to `proxy.ts` and updated the export name accordingly.
</details>

---

## 📧 Contact

<div align="center">

### **Kinshuk Saxena**

[![Email](https://img.shields.io/badge/Email-kinshuksaxena3%40gmail.com-red?style=for-the-badge&logo=gmail&logoColor=white)](mailto:kinshuksaxena3@gmail.com)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Kinshuk--Saxena-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/kinshuk-saxena-)
[![GitHub](https://img.shields.io/badge/GitHub-Kinshukkush-black?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Kinshukkush)
[![Portfolio](https://img.shields.io/badge/Portfolio-kinshuksaxena.vercel.app-purple?style=for-the-badge&logo=vercel&logoColor=white)](https://portfolio-frontend-mu-snowy.vercel.app/)

</div>

---

## 📄 License

MIT License — free to use, modify, and distribute.

```
MIT License

Copyright (c) 2026 Kinshuk Saxena

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

### Made with ❤️ by Kinshuk Saxena

**[⬆ Back to Top](#smart-bookmark-app-)**

</div>
