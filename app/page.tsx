'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

type Bookmark = {
  id: string
  title: string
  url: string
  created_at: string
  user_id: string
}

export default function BookmarksPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const fetchBookmarks = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) setBookmarks(data)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchBookmarks(user.id)
      setLoading(false)
    })
  }, [supabase, fetchBookmarks])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('bookmarks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBookmarks((prev) => [payload.new as Bookmark, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setBookmarks((prev) => prev.filter((b) => b.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim() || !url.trim()) {
      setError('Both title and URL are required.')
      return
    }
    let finalUrl = url.trim()
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl
    }
    setAdding(true)
    const { error: insertError } = await supabase.from('bookmarks').insert({
      title: title.trim(),
      url: finalUrl,
      user_id: user!.id,
    })
    if (insertError) {
      setError(insertError.message)
    } else {
      setTitle('')
      setUrl('')
    }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('bookmarks').delete().eq('id', id)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading your bookmarks...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50 animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Smart Bookmark</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 font-medium">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-700 bg-white border-2 border-gray-200 rounded-xl px-4 py-2 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-medium shadow-sm hover:shadow"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleAdd} className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-2xl p-6 mb-8 shadow-lg hover:shadow-xl transition-shadow animate-scaleIn">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-800">Add a new bookmark</h2>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Title (e.g., My Favorite Website)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <input
              type="text"
              placeholder="URL (e.g., https://example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={adding}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-xl px-6 py-3 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed self-end shadow-md hover:shadow-lg transform hover:scale-[1.02]"
            >
              {adding ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Bookmark
                </span>
              )}
            </button>
          </div>
        </form>

        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-5-7 5V5z" />
              </svg>
              Your bookmarks
            </h2>
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full px-3 py-1 shadow-sm">
              {bookmarks.length}
            </span>
          </div>
          {bookmarks.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-5-7 5V5z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium">No bookmarks yet</p>
              <p className="text-gray-400 text-xs mt-1">Add your first bookmark above to get started!</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {bookmarks.map((bookmark, index) => (
                <li
                  key={bookmark.id}
                  className="bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4 hover:border-blue-300 hover:shadow-lg transition-all duration-200 animate-slideIn group"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-semibold text-gray-800 hover:text-blue-600 block truncate transition-colors group-hover:translate-x-1 transition-transform duration-200"
                    >
                      {bookmark.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="text-xs text-gray-500 truncate">{bookmark.url}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="text-xs text-red-500 hover:text-white bg-red-50 hover:bg-red-500 px-4 py-2 rounded-lg shrink-0 transition-all duration-200 font-medium border-2 border-red-200 hover:border-red-500"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
