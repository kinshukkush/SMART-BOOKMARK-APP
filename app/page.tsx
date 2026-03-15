'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export type Bookmark = {
  id: string
  title: string
  url: string | null
  notes: string | null
  category: string | null
  pinned: boolean
  created_at: string
  updated_at: string
  user_id: string
}

type Toast = { id: number; message: string; type: 'success' | 'error' }
type SortOption = 'Newest First' | 'Oldest First' | 'A to Z' | 'Pinned First'

// ─── Constants & Helpers ─────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['General', 'Work', 'Learning', 'Tools', 'Reading']

const CATEGORY_COLORS: Record<string, string> = {
  General:  '#6366f1',
  Work:     '#f59e0b',
  Learning: '#10b981',
  Tools:    '#3b82f6',
  Reading:  '#ec4899',
}

function getCatColor(cat: string | null | undefined): string {
  return CATEGORY_COLORS[cat ?? 'General'] ?? '#8b5cf6'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getLinkCount(notes: string | null | undefined): number {
  if (!notes) return 0
  return (notes.match(/(https?:\/\/[^\s]+)/g) ?? []).length
}

function extractDomain(url: string | null | undefined): string {
  if (!url) return ''
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

function renderNotesWithLinks(notes: string) {
  const urlRe = /(https?:\/\/[^\s]+)/g
  return notes.split(urlRe).map((part, i) =>
    part.match(urlRe)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
           className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 break-all transition-colors duration-150">{part}</a>
      : <span key={i}>{part}</span>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-[#2a2a2a]'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`} />
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<SortOption>('Pinned First')

  // Panel
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null)

  // Add modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addCategory, setAddCategory] = useState('General')
  const [addCustomCategory, setAddCustomCategory] = useState('')
  const [addPinned, setAddPinned] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editCustomCategory, setEditCustomCategory] = useState('')
  const [editPinned, setEditPinned] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Toast & delete confirm
  const [toasts, setToasts] = useState<Toast[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // ─── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500)
  }, [])

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchBookmarks = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('bookmarks').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setBookmarks(data as Bookmark[])
  }, [supabase])

  // ─── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchBookmarks(user.id)
      setLoading(false)
    })
  }, [supabase, fetchBookmarks])

  // ─── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`bookmarks-rt-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookmarks',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newB = payload.new as Bookmark
          setBookmarks(prev => [newB, ...prev.filter(b => b.id !== newB.id)])
        } else if (payload.eventType === 'DELETE') {
          setBookmarks(prev => prev.filter(b => b.id !== payload.old.id))
          setSelectedBookmark(prev => prev?.id === payload.old.id ? null : prev)
        } else if (payload.eventType === 'UPDATE') {
          const newB = payload.new as Bookmark
          setBookmarks(prev => prev.map(b => b.id === newB.id ? newB : b))
          setSelectedBookmark(prev => {
            if (prev?.id !== newB.id) return prev
            setEditTitle(newB.title || '')
            setEditUrl(newB.url || '')
            setEditNotes(newB.notes || '')
            setEditCategory(newB.category || 'General')
            setEditPinned(newB.pinned)
            return newB
          })
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, supabase])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddModalOpen) { setIsAddModalOpen(false); return }
        if (deleteConfirmOpen) { setDeleteConfirmOpen(false); return }
        setSelectedBookmark(null)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openAddModal() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isAddModalOpen, deleteConfirmOpen])

  // ─── Derived ───────────────────────────────────────────────────────────────
  const allCategories = useMemo(() => {
    const cats = new Set([...DEFAULT_CATEGORIES, ...bookmarks.map(b => b.category || 'General')])
    return ['All', ...Array.from(cats)]
  }, [bookmarks])

  const filteredAndSortedBookmarks = useMemo(() => {
    let result = [...bookmarks]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(b =>
        (b.title || '').toLowerCase().includes(q) ||
        (b.url || '').toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      )
    }
    if (selectedCategory !== 'All') {
      result = result.filter(b => (b.category || 'General') === selectedCategory)
    }
    result.sort((a, b) => {
      if (sortBy === 'Pinned First') {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'Newest First') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'Oldest First') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'A to Z') return (a.title || '').localeCompare(b.title || '')
      return 0
    })
    return result
  }, [bookmarks, searchQuery, selectedCategory, sortBy])

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = '/login' }

  const openAddModal = () => {
    setAddTitle(''); setAddUrl(''); setAddNotes('')
    setAddCategory('General'); setAddCustomCategory(''); setAddPinned(false); setAddError('')
    setIsAddModalOpen(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    if (!addTitle.trim()) { setAddError('Title is required'); return }
    let url = addUrl.trim()
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url
    const cat = addCustomCategory.trim() || addCategory
    setAdding(true)
    const { error } = await supabase.from('bookmarks').insert({
      title: addTitle.trim(), url: url || null, notes: addNotes.trim() || null,
      category: cat, pinned: addPinned, user_id: user!.id,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    if (error) setAddError(error.message)
    else { setIsAddModalOpen(false); showToast('Bookmark created') }
    setAdding(false)
  }

  const openDrawer = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark)
    setEditTitle(bookmark.title || '')
    setEditUrl(bookmark.url || '')
    setEditNotes(bookmark.notes || '')
    setEditCategory(bookmark.category || 'General')
    setEditPinned(bookmark.pinned)
    setEditCustomCategory('')
    setTimeout(() => rightPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  const handleUpdate = async () => {
    if (!selectedBookmark) return
    setUpdating(true)
    let url = editUrl.trim()
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url
    const cat = editCustomCategory.trim() || editCategory
    const { error } = await supabase.from('bookmarks').update({
      title: editTitle.trim(), url: url || null, notes: editNotes.trim() || null,
      category: cat, pinned: editPinned, updated_at: new Date().toISOString(),
    }).eq('id', selectedBookmark.id)
    if (error) showToast(error.message, 'error')
    else showToast('Changes saved')
    setUpdating(false)
  }

  const handleDelete = async () => {
    if (!selectedBookmark) return
    const { error } = await supabase.from('bookmarks').delete().eq('id', selectedBookmark.id)
    if (error) { showToast(error.message, 'error'); return }
    setDeleteConfirmOpen(false); setSelectedBookmark(null); showToast('Bookmark deleted')
  }

  const togglePin = async (bookmark: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('bookmarks').update({ pinned: !bookmark.pinned, updated_at: new Date().toISOString() }).eq('id', bookmark.id)
  }

  const copyUrl = async (url: string) => {
    try { await navigator.clipboard.writeText(url); showToast('Copied to clipboard') }
    catch { showToast('Copy failed', 'error') }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-2 border-[#1f1f1f] rounded-full" />
            <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <span className="text-zinc-700 text-xs font-mono tracking-widest uppercase">loading</span>
        </div>
      </div>
    )
  }

  const pinnedCount = bookmarks.filter(b => b.pinned).length

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col overflow-hidden text-white">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="h-14 shrink-0 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-5 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span className="font-bold text-white tracking-tight text-sm">Smart Bookmark</span>
          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-500/70 tracking-widest uppercase">live</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow shadow-indigo-900/50">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-zinc-500 max-w-[180px] truncate">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-white border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg px-3 py-1.5 transition-all duration-150 active:scale-95"
          >Sign out</button>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
        <aside className="w-full lg:w-[420px] shrink-0 bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col h-full overflow-hidden">

          {/* Fixed controls */}
          <div className="shrink-0 px-4 pt-4 space-y-3">

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={searchRef} id="search-input" type="text"
                placeholder="Search bookmarks…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:bg-[#141414] transition-all duration-150"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Count + sort row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-600">
                {searchQuery
                  ? <><span className="text-zinc-300">{filteredAndSortedBookmarks.length}</span> of {bookmarks.length}</>
                  : <><span className="text-zinc-300">{bookmarks.length}</span>{' bookmarks'}{pinnedCount > 0 && <> · <span className="text-amber-400/80">{pinnedCount} pinned</span></>}</>
                }
              </span>
              <select
                value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
                className="text-xs text-zinc-400 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500/50 cursor-pointer hover:border-[#3a3a3a] transition-colors appearance-none"
              >
                <option value="Pinned First">Pinned first</option>
                <option value="Newest First">Newest first</option>
                <option value="Oldest First">Oldest first</option>
                <option value="A to Z">A → Z</option>
              </select>
            </div>

            {/* Category pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 active:scale-95 ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                      : 'bg-[#1a1a1a] text-zinc-500 border border-[#2a2a2a] hover:border-[#3a3a3a] hover:text-zinc-200'
                  }`}
                >
                  {cat !== 'All' && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCatColor(cat) }} />}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#1a1a1a]" />

          {/* Bookmark list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-hide">
            {filteredAndSortedBookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mb-4 border border-[#2a2a2a]">
                  <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p className="text-zinc-500 text-sm font-medium">No bookmarks found</p>
                <p className="text-zinc-700 text-xs mt-1">{searchQuery ? 'Try a different search' : 'Press ⌘N to add one'}</p>
              </div>
            ) : filteredAndSortedBookmarks.map((bm, idx) => {
              const catColor = getCatColor(bm.category)
              const isSelected = selectedBookmark?.id === bm.id
              const linkCount = getLinkCount(bm.notes)
              const domain = extractDomain(bm.url)
              return (
                <div
                  key={bm.id}
                  onClick={() => openDrawer(bm)}
                  className={`group relative rounded-2xl p-4 cursor-pointer transition-all duration-200 animate-cardSlideIn border ${
                    isSelected
                      ? 'bg-[#1e1e30] border-indigo-500/40 shadow-lg shadow-indigo-900/20'
                      : 'bg-[#1a1a1a] border-[#262626] hover:bg-[#1e1e1e] hover:border-[#333]'
                  } hover:scale-[1.01]`}
                  style={{
                    animationDelay: `${Math.min(idx * 40, 400)}ms`,
                    borderLeftColor: isSelected ? '#6366f1' : catColor,
                    borderLeftWidth: '2px',
                  }}
                >
                  {bm.pinned && (
                    <button
                      onClick={e => togglePin(bm, e)}
                      className="absolute top-3 right-3 p-1 opacity-70 hover:opacity-100 transition-opacity active:scale-90"
                      title="Unpin"
                    >
                      <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
                        <path d="M16 4v4l-2 2v6l-2 2-2-2v-6l-2-2V4h8z"/>
                        <path d="M12 18v4" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" fill="none"/>
                      </svg>
                    </button>
                  )}

                  {/* Title row */}
                  <div className="flex items-start gap-2.5 mb-1.5 pr-6">
                    {bm.url
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={`https://www.google.com/s2/favicons?domain=${bm.url}&sz=32`} alt="" className="w-4 h-4 rounded mt-0.5 shrink-0 opacity-75" onError={e => (e.currentTarget.style.display = 'none')} />
                      : <span className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-sm opacity-50" style={{ backgroundColor: catColor }} /></span>
                    }
                    <h3 className="text-sm font-semibold text-white leading-snug truncate flex-1">{bm.title}</h3>
                  </div>

                  {domain && <p className="text-[11px] font-mono text-zinc-600 truncate mb-1.5 pl-[26px]">{domain}</p>}

                  {bm.notes && (
                    <p className="text-xs text-zinc-600 line-clamp-2 mb-2.5 leading-relaxed">
                      {bm.notes.slice(0, 90)}{bm.notes.length > 90 ? '…' : ''}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-600">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                      {bm.category || 'General'}
                    </span>
                    <div className="flex items-center gap-3">
                      {linkCount > 0 && (
                        <span className="text-[10px] font-mono text-zinc-700 flex items-center gap-1">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                          </svg>
                          {linkCount}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-700">{timeAgo(bm.created_at)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── RIGHT PANEL ────────────────────────────────────────────────── */}
        <main className={`bg-[#0d0d0d] flex flex-col overflow-hidden ${
          selectedBookmark
            ? 'fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto lg:flex-1'
            : 'hidden lg:flex lg:flex-1'
        }`}>
          {selectedBookmark ? (
            <div ref={rightPanelRef} className="flex-1 overflow-y-auto scrollbar-hide animate-panelSlideIn">
              {/* Top bar */}
              <div className="sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur-md border-b border-[#1a1a1a] px-6 lg:px-10 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedBookmark.url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={`https://www.google.com/s2/favicons?domain=${selectedBookmark.url}&sz=64`} alt="" className="w-5 h-5 rounded-md opacity-70" onError={e => (e.currentTarget.style.display = 'none')} />
                    : null
                  }
                  <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.15em]">editing</span>
                </div>
                <button
                  onClick={() => setSelectedBookmark(null)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-white hover:bg-[#1a1a1a] rounded-xl transition-all duration-150 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="px-6 lg:px-10 py-8 max-w-3xl mx-auto space-y-8">

                {/* Title */}
                <input
                  type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-3xl font-bold text-white bg-transparent border-none outline-none placeholder:text-zinc-700 leading-tight"
                  placeholder="Bookmark title…"
                />

                {/* URL section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.15em] shrink-0">URL</span>
                    <div className="flex-1 h-px bg-[#1f1f1f]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      {editUrl
                        /* eslint-disable-next-line @next/next/no-img-element */
                        ? <img src={`https://www.google.com/s2/favicons?domain=${editUrl}&sz=32`} alt="" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded opacity-70 pointer-events-none" onError={e => (e.currentTarget.style.display = 'none')} />
                        : null
                      }
                      <input
                        type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                        placeholder="https://example.com"
                        className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-2.5 pr-4 text-sm text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150 ${editUrl ? 'pl-10' : 'pl-4'}`}
                      />
                    </div>
                    {editUrl && (
                      <>
                        <a href={editUrl.startsWith('http') ? editUrl : 'https://' + editUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 w-10 h-10 flex items-center justify-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-zinc-500 hover:text-white hover:border-[#3a3a3a] transition-all duration-150 active:scale-95" title="Visit site"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        </a>
                        <button onClick={() => copyUrl(editUrl)}
                          className="shrink-0 w-10 h-10 flex items-center justify-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-zinc-500 hover:text-white hover:border-[#3a3a3a] transition-all duration-150 active:scale-95" title="Copy URL"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Properties */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.15em] shrink-0">Properties</span>
                    <div className="flex-1 h-px bg-[#1f1f1f]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-600 block">Category</label>
                      <select
                        value={editCategory} onChange={e => setEditCategory(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-all duration-150 cursor-pointer"
                      >
                        {allCategories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="text" value={editCustomCategory} onChange={e => setEditCustomCategory(e.target.value)}
                        placeholder="Or type custom…"
                        className="w-full bg-transparent border-b border-[#2a2a2a] pb-1 text-xs text-zinc-400 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-600 block">Pin to top</label>
                      <div className="flex items-center gap-3 py-2.5">
                        <Toggle checked={editPinned} onChange={setEditPinned} />
                        <span className="text-sm text-zinc-400">{editPinned ? 'Pinned' : 'Not pinned'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-[0.15em] shrink-0">Notes</span>
                    <div className="flex-1 h-px bg-[#1f1f1f]" />
                    {getLinkCount(editNotes) > 0 && <span className="text-[10px] font-mono text-zinc-600 shrink-0">{getLinkCount(editNotes)} links detected</span>}
                  </div>
                  <textarea
                    value={editNotes} onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add notes, links, thoughts…"
                    className="w-full min-h-[300px] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 text-sm text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150 resize-y leading-relaxed"
                  />
                  {editNotes && getLinkCount(editNotes) > 0 && (
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                      <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.15em] mb-3">Link Preview</div>
                      <div className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed break-words">
                        {renderNotesWithLinks(editNotes)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-700 py-2 border-t border-[#1a1a1a]">
                  <span>created {timeAgo(selectedBookmark.created_at)}</span>
                  <span className="text-zinc-800">·</span>
                  <span>updated {timeAgo(selectedBookmark.updated_at)}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pb-10">
                  <button
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="flex items-center gap-2 text-sm text-zinc-600 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 px-3 py-2 rounded-xl transition-all duration-150 active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Delete
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedBookmark(null)}
                      className="px-4 py-2 text-sm text-zinc-500 hover:text-white hover:bg-[#1a1a1a] rounded-xl border border-transparent hover:border-[#2a2a2a] transition-all duration-150 active:scale-95"
                    >Cancel</button>
                    <button
                      onClick={handleUpdate} disabled={updating}
                      className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-900/30 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {updating ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── EMPTY STATE ─────────────────────────────────────────────── */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #6366f115 1px, transparent 0)',
                backgroundSize: '28px 28px',
              }} />
              <div className="relative z-10 flex flex-col items-center gap-6 max-w-xs">
                <div className="relative">
                  <div className="w-20 h-20 bg-[#1a1a1a] rounded-3xl flex items-center justify-center border border-[#2a2a2a] shadow-2xl">
                    <svg className="w-9 h-9 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-900/60">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Nothing selected</h2>
                  <p className="text-sm text-zinc-600 leading-relaxed">Pick a bookmark from the left panel to view and edit, or create a new one to get started.</p>
                </div>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={openAddModal}
                    className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-indigo-900/30 transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    Create your first bookmark
                  </button>
                  <div className="flex items-center gap-2 justify-center text-[11px] text-zinc-700 font-mono">
                    <kbd className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5">⌘K</kbd><span>search</span>
                    <span className="text-zinc-800">·</span>
                    <kbd className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5">⌘N</kbd><span>new</span>
                    <span className="text-zinc-800">·</span>
                    <kbd className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5">Esc</kbd><span>close</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── FAB ──────────────────────────────────────────────────────────────── */}
      <button
        onClick={openAddModal}
        title="New bookmark (⌘N)"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-900/60 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
      </button>

      {/* ── ADD MODAL ────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-5 border-b border-[#242424] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600/15 border border-indigo-500/25 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                </div>
                <h2 className="text-base font-bold text-white">New Bookmark</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-white hover:bg-[#2a2a2a] rounded-xl transition-all duration-150 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-hide">
              {addError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                  {addError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Title <span className="text-red-400">*</span></label>
                <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Bookmark title" required
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">URL</label>
                <div className="relative">
                  {addUrl
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={`https://www.google.com/s2/favicons?domain=${addUrl}&sz=32`} alt="" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none" onError={e => (e.currentTarget.style.display = 'none')} />
                    : null
                  }
                  <input id="add-url-input" type="text" value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://example.com"
                    className={`w-full bg-[#111] border border-[#2a2a2a] rounded-xl py-2.5 pr-4 text-sm text-white font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150 ${addUrl ? 'pl-10' : 'pl-4'}`}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Category</label>
                <div className="flex gap-2">
                  <select value={addCategory} onChange={e => setAddCategory(e.target.value)}
                    className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-all duration-150 cursor-pointer"
                  >
                    {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    {!DEFAULT_CATEGORIES.includes(addCategory) && addCategory && <option value={addCategory}>{addCategory}</option>}
                  </select>
                  <input type="text" value={addCustomCategory} onChange={e => setAddCustomCategory(e.target.value)} placeholder="Custom…"
                    className="w-28 bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-500 font-medium">Notes</label>
                <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Add notes, links, thoughts…" rows={6}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-zinc-300 font-mono placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all duration-150 resize-none leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm text-zinc-300 font-medium">Pin to top</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Always show this bookmark first</p>
                </div>
                <Toggle checked={addPinned} onChange={setAddPinned} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-zinc-500 hover:text-white bg-[#111] hover:bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl transition-all duration-150 active:scale-95"
                >Cancel</button>
                <button type="submit" disabled={adding}
                  className="flex-[2] py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30"
                >
                  {adding ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</> : 'Save Bookmark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ───────────────────────────────────────────────────── */}
      {deleteConfirmOpen && selectedBookmark && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl p-7 animate-scaleIn">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-base font-bold text-white text-center mb-1.5">Delete bookmark?</h3>
            <p className="text-sm text-zinc-500 text-center mb-6 line-clamp-2">
              &ldquo;{selectedBookmark.title}&rdquo; will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 text-sm font-medium text-zinc-400 hover:text-white bg-[#111] hover:bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl transition-all duration-150 active:scale-95"
              >Cancel</button>
              <button onClick={handleDelete}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all duration-150 active:scale-95 shadow-lg shadow-red-900/30"
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOASTS ───────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none" style={{ bottom: '88px' }}>
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-center gap-3 pl-3 pr-5 py-3 rounded-xl border shadow-2xl text-sm font-medium animate-toastSlideUp pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-[#1c1c1c] border-[#2a2a2a] text-white'
                : 'bg-red-950/90 border-red-500/20 text-red-300'
            }`}
          >
            {toast.type === 'success'
              ? <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                </div>
              : <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                </div>
            }
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}















        





