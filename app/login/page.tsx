'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="min-h-screen w-full bg-[#080808] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #6366f112 1px, transparent 0)',
        backgroundSize: '28px 28px',
      }} />

      {/* Subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #6366f108 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Card */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-8 shadow-2xl animate-scaleIn">

          {/* Logo */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-900/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-white tracking-tight">Smart Bookmark</h1>
              <p className="text-xs font-mono text-zinc-600 mt-1 tracking-widest uppercase">your knowledge, organized</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#1f1f1f] mb-6" />

          {/* Sign in button */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-[#111] text-sm font-semibold rounded-xl px-5 py-3 transition-all duration-150 active:scale-95 shadow-md"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {['RLS secured', 'Real-time sync', 'No ads'].map(feat => (
              <span key={feat} className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 bg-[#1a1a1a] border border-[#242424] rounded-full px-2.5 py-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-[11px] text-zinc-700 mt-5 font-mono">
          By signing in you agree to our terms.
        </p>
      </div>
    </main>
  )
}
