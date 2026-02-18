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
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Smart Bookmark</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 border border-gray-300 rounded px-3 py-1 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Add a bookmark</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            <input
              type="text"
              placeholder="URL (e.g. https://example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button
              type="submit"
              disabled={adding}
              className="bg-gray-800 text-white text-sm rounded px-4 py-2 hover:bg-gray-700 transition-colors disabled:opacity-50 self-end"
            >
              {adding ? 'Adding...' : 'Add Bookmark'}
            </button>
          </div>
        </form>

        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Your bookmarks ({bookmarks.length})
          </h2>
          {bookmarks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No bookmarks yet. Add one above.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bookmarks.map((bookmark) => (
                <li
                  key={bookmark.id}
                  className="bg-white border border-gray-200 rounded px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline block truncate"
                    >
                      {bookmark.title}
                    </a>
                    <span className="text-xs text-gray-400 truncate block">{bookmark.url}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0 transition-colors"
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
