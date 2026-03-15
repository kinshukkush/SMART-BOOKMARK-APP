'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export type Bookmark = {
  id: string
  title: string
  url: string
  notes: string
  category: string
  pinned: boolean
  created_at: string
  updated_at: string
  user_id: string
}

const DEFAULT_CATEGORIES = ['General', 'Work', 'Learning', 'Tools', 'Reading']

export default function BookmarksPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'Newest' | 'Oldest' | 'Alphabetical' | 'Pinned First'>('Pinned First')

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null)

  // Add Form State
  const [addTitle, setAddTitle] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addCategory, setAddCategory] = useState('General')
  const [addPinned, setAddPinned] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit State
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [updating, setUpdating] = useState(false)

  // Fetch
  const fetchBookmarks = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (data) {
      setBookmarks(data)
    }
  }, [supabase])

  // Initial Auth & Theme Setup
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDarkMode(false)
      document.documentElement.classList.remove('dark')
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchBookmarks(user.id)
      setLoading(false)
    })
  }, [supabase, fetchBookmarks])

  // Realtime
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
            setBookmarks((prev) => {
              const newB = payload.new as Bookmark
              return [newB, ...prev.filter(b => b.id !== newB.id)]
            })
          } else if (payload.eventType === 'DELETE') {
            setBookmarks((prev) => prev.filter((b) => b.id !== payload.old.id))
            setSelectedBookmark((prev) => prev?.id === payload.old.id ? null : prev)
          } else if (payload.eventType === 'UPDATE') {
            const newB = payload.new as Bookmark
            setBookmarks((prev) => prev.map((b) => b.id === newB.id ? newB : b))
            setSelectedBookmark((prev) => prev?.id === newB.id ? newB : prev)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false)
        setSelectedBookmark(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setIsAddModalOpen(true)
        // Set focus to the first input field
        setTimeout(() => document.getElementById('add-url-input')?.focus(), 100)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Derived state
  const filteredAndSortedBookmarks = useMemo(() => {
    let result = bookmarks

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        b => b.title.toLowerCase().includes(q) || 
             b.url.toLowerCase().includes(q) || 
             b.notes.toLowerCase().includes(q)
      )
    }

    // Filter
    if (selectedCategory !== 'All') {
      result = result.filter(b => b.category === selectedCategory)
    }

    // Sort
    result = [...result].sort((a, b) => {
      // Pinned First sorting logic: always push pinned to the top if that's the chosen sort strategy
      if (sortBy === 'Pinned First') {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'Newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'Oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sortBy === 'Alphabetical') {
        return a.title.localeCompare(b.title)
      }
      return 0
    })

    return result
  }, [bookmarks, searchQuery, selectedCategory, sortBy])

  // Handlers
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev
      localStorage.setItem('darkMode', newMode.toString())
      if (newMode) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      return newMode
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    if (!addTitle.trim() || !addUrl.trim()) {
      setAddError('Both title and URL are required.')
      return
    }
    let finalUrl = addUrl.trim()
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl
    }
    setAdding(true)
    const { error: insertError } = await supabase.from('bookmarks').insert({
      title: addTitle.trim(),
      url: finalUrl,
      notes: addNotes,
      category: addCategory,
      pinned: addPinned,
      user_id: user!.id,
    })
    if (insertError) {
      setAddError(insertError.message)
    } else {
      setAddTitle('')
      setAddUrl('')
      setAddNotes('')
      setAddCategory('General')
      setAddPinned(false)
      setIsAddModalOpen(false)
    }
    setAdding(false)
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this bookmark?')) return
    await supabase.from('bookmarks').delete().eq('id', id)
    if (selectedBookmark?.id === id) {
      setSelectedBookmark(null)
    }
  }

  const handleUpdate = async () => {
    if (!selectedBookmark) return
    setUpdating(true)
    let finalUrl = editUrl.trim()
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl
    }
    await supabase.from('bookmarks').update({
      title: editTitle.trim(),
      url: finalUrl,
      notes: editNotes,
      category: editCategory,
      updated_at: new Date().toISOString()
    }).eq('id', selectedBookmark.id)
    setUpdating(false)
  }

  const togglePin = async (bookmark: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('bookmarks').update({ pinned: !bookmark.pinned, updated_at: new Date().toISOString() }).eq('id', bookmark.id)
  }

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
  }

  const openDrawer = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark)
    setEditTitle(bookmark.title)
    setEditUrl(bookmark.url)
    setEditNotes(bookmark.notes || '')
    setEditCategory(bookmark.category || 'General')
  }

  // Utils
  const renderNotesWithLinks = (notes: string) => {
    if (!notes) return null
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = notes.split(urlRegex)
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-500 dark:text-blue-400 hover:underline">{part}</a>
      }
      return <span key={i}>{part}</span>
    })
  }

  const getLinkCount = (notes: string) => {
    if (!notes) return 0
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const matches = notes.match(urlRegex)
    return matches ? matches.length : 0
  }

  // Loading UI
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    )
  }

  // Categories extraction
  const allCategories = ['All', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...bookmarks.map(b => b.category || 'General')]))]

  return (
    <main className="h-screen w-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shrink-0 z-40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent hidden sm:block">Smart Bookmark</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleDarkMode} className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Toggle Dark Mode">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-1.5 transition-colors">
             <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <button onClick={handleSignOut} className="text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-4 py-1.5 transition-colors shadow-sm">
            Sign out
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel: List/Grid view */}
        <div className={`flex-1 flex flex-col h-full overflow-y-auto p-4 lg:p-6 transition-all duration-300 ${selectedBookmark ? 'xl:w-2/3 xl:pr-6' : 'w-full'}`}>
          {/* Search & Filter Bar */}
          <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0">
            <div className="flex-1 w-full max-w-xl relative">
              <svg className="absolute left-3.5 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input 
                id="search-input"
                type="text" 
                placeholder="Search titles, urls, notes... (Cmd+K)" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors shadow-sm text-sm"
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar shrink-0">
              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Sort:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as 'Newest' | 'Oldest' | 'Alphabetical' | 'Pinned First')} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <option value="Pinned First">Pinned First</option>
                <option value="Newest">Newest</option>
                <option value="Oldest">Oldest</option>
                <option value="Alphabetical">Alphabetical</option>
              </select>
            </div>
          </div>

          <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar shrink-0 border-b border-gray-200 dark:border-gray-700/50">
            {allCategories.map(cat => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 mb-2 rounded-full text-sm font-medium transition-colors border ${selectedCategory === cat ? 'bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-500 text-blue-800 dark:text-blue-100 shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide shrink-0">
            <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-1 px-2.5 rounded-full text-xs font-bold mr-2">{filteredAndSortedBookmarks.length}</span>
            {filteredAndSortedBookmarks.length === 1 ? 'bookmark' : 'bookmarks'} found
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 ${selectedBookmark ? 'lg:grid-cols-2 xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-5 animate-fadeIn pb-24 content-start`}>
            {filteredAndSortedBookmarks.map(bookmark => (
              <div 
                key={bookmark.id} 
                onClick={() => openDrawer(bookmark)}
                className={`group bg-white dark:bg-gray-800 rounded-2xl border-2 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer p-5 flex flex-col shadow-sm hover:shadow-md relative overflow-hidden ${selectedBookmark?.id === bookmark.id ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5 max-w-[85%]">
                     {/* eslint-disable-next-line @next/next/no-img-element */}
                     <img src={`https://www.google.com/s2/favicons?domain=${bookmark.url}&sz=32`} alt="" className="w-5 h-5 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                     <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate flex-1">{bookmark.title}</h3>
                  </div>
                  <button onClick={(e) => togglePin(bookmark, e)} className="p-1 -m-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0" title={bookmark.pinned ? "Unpin" : "Pin to top"}>
                    <svg className={`w-5 h-5 ${bookmark.pinned ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-600'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4v4l-2 2v6l-2 2l-2-2v-6l-2-2V4h8z"/><path d="M12 18v4"/></svg>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors mb-4 group-hover:translate-x-1 duration-200">
                  <a href={bookmark.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="truncate font-medium flex-1">
                    {bookmark.url.replace(/^https?:\/\//, '')}
                  </a>
                  <svg className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </div>
                
                {bookmark.notes ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 min-h-[40px] mb-4 select-text">
                    {bookmark.notes.length > 80 ? renderNotesWithLinks(bookmark.notes.slice(0, 80) + '...') : renderNotesWithLinks(bookmark.notes)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic min-h-[40px] mb-4">No notes added...</p>
                )}

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <span className="text-xs px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                    {bookmark.category || 'General'}
                  </span>
                  <div className="flex items-center gap-3">
                    {getLinkCount(bookmark.notes) > 0 && (
                      <span className="text-xs flex items-center gap-1 text-gray-500 font-medium bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded" title={`${getLinkCount(bookmark.notes)} links in notes`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                        {getLinkCount(bookmark.notes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredAndSortedBookmarks.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl">
                 <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                 <p className="font-semibold text-lg text-gray-700 dark:text-gray-300">No bookmarks found</p>
                 <p className="text-sm mt-1">Try adjusting your filters, or press Cmd+N to add a new one.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Overlay on mobile, resizable side panel on lg desktop */}
        {selectedBookmark && (
          <div className="fixed inset-0 z-50 flex xl:relative xl:inset-auto xl:w-[480px] 2xl:w-[500px] shrink-0 xl:border-l border-gray-200 dark:border-gray-700 bg-black/20 dark:bg-black/50 xl:bg-gray-50 dark:xl:bg-gray-900 transition-all">
            {/* Backdrop for mobile */}
            <div className="absolute inset-0 xl:hidden backdrop-blur-sm" onClick={() => setSelectedBookmark(null)}></div>
            
            {/* Drawer */}
            <div className="absolute xl:relative top-auto bottom-0 xl:top-0 h-[88vh] xl:h-full w-full bg-white dark:bg-gray-800 shadow-2xl xl:shadow-none flex flex-col rounded-t-3xl xl:rounded-none animate-slideUpBottomSheet xl:animate-slideInRight overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
                <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit Bookmark
                </h2>
                <button onClick={() => setSelectedBookmark(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors font-medium text-gray-500 dark:text-gray-400" title="Close (Escape)">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 hide-scrollbar">
                
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    type="text" 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 dark:hover:border-gray-600 focus:outline-none py-1 transition-colors"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editUrl} 
                      onChange={e => setEditUrl(e.target.value)}
                      className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    />
                    <a href={editUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center border border-blue-100 dark:border-blue-800" title="Open in new tab">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </a>
                    <button onClick={() => copyUrl(editUrl)} className="p-2.5 bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center" title="Copy URL">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex-1 flex flex-col min-h-[250px]">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                    <span>Notes</span>
                    <span className="text-[10px] font-medium tracking-normal normal-case bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">URLs auto-link</span>
                  </label>
                  <textarea 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add your notes here..."
                    className="w-full h-32 resize-y bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors mb-4 leading-relaxed"
                  />
                  {editNotes && (
                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Preview</label>
                      <div className="flex-1 p-4 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm overflow-y-auto preview-area whitespace-pre-wrap leading-relaxed">
                        {renderNotesWithLinks(editNotes)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Category & Timestamps */}
                <div className="grid grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Category</label>
                    <select 
                      value={editCategory} 
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {allCategories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Saved On</label>
                    <div className="text-sm font-medium py-2 text-gray-700 dark:text-gray-300">
                       {new Date(selectedBookmark.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Drawer Footer actions */}
              <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center shrink-0">
                <button onClick={(e) => handleDelete(selectedBookmark.id, e)} className="text-red-500 hover:text-red-700 font-semibold text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Delete
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setSelectedBookmark(null)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleUpdate} disabled={updating || !editTitle || !editUrl || (editTitle === selectedBookmark.title && editUrl === selectedBookmark.url && editNotes === (selectedBookmark.notes || '') && editCategory === (selectedBookmark.category || 'General'))} className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* FAB (Floating Action Button) */}
      <button 
        onClick={() => { setIsAddModalOpen(true); setTimeout(() => document.getElementById('add-url-input')?.focus(), 100); }}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform hover:scale-105 z-40 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
        title="Add new bookmark (Cmd+N)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
      </button>

      {/* Add Modal Overlay */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 flex justify-between items-center shrink-0">
               <h2 className="text-xl font-bold flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
                  </div>
                  Add Bookmark
               </h2>
               <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors font-medium text-gray-500 dark:text-gray-400" title="Close (Escape)">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>
            
            <form onSubmit={handleAdd} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 hide-scrollbar">
              {addError && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-medium flex gap-3 items-center border border-red-100 dark:border-red-900/50">
                  <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">URL <span className="text-red-500">*</span></label>
                <div className="relative">
                  {addUrl && (
                    <div className="absolute left-4 top-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://www.google.com/s2/favicons?domain=${addUrl}&sz=32`} alt="" className="w-5 h-5 bg-gray-100 dark:bg-gray-800 rounded-sm" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                  <input 
                    id="add-url-input"
                    type="url" 
                    placeholder="https://example.com" 
                    value={addUrl} 
                    onChange={e => setAddUrl(e.target.value)}
                    required
                    className={`w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-3 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${addUrl ? 'pl-11' : 'pl-4'}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Title <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  placeholder="Website title" 
                  value={addTitle} 
                  onChange={e => setAddTitle(e.target.value)}
                  required
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between items-end">
                  <span>Category</span>
                  <input type="text" placeholder="+ New Category..." onBlur={(e) => { if(e.target.value) setAddCategory(e.target.value) }} className="text-xs bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none px-1 py-0.5 w-28 placeholder-gray-400 font-medium" />
                </label>
                <select 
                  value={addCategory} 
                  onChange={e => setAddCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-medium appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                   {allCategories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                   {!allCategories.includes(addCategory) && addCategory !== 'All' && <option value={addCategory}>{addCategory}</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                <textarea 
                  placeholder="Add optional notes. Links are supported."
                  value={addNotes}
                  onChange={e => setAddNotes(e.target.value)}
                  className="w-full min-h-[100px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors leading-relaxed resize-y"
                />
              </div>

              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <input 
                  type="checkbox" 
                  id="pin-toggle" 
                  checked={addPinned} 
                  onChange={e => setAddPinned(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="pin-toggle" className="text-sm font-bold text-gray-700 dark:text-gray-300 cursor-pointer select-none">Pin to top of the list</label>
              </div>

              <div className="pt-2 mt-auto flex gap-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding} className="flex-[2] py-3 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                  {adding ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : 'Save Bookmark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}
