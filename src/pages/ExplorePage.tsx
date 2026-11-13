import { useEffect, useState, useCallback } from 'react';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { NoteCard } from '../components/NoteCard';
import type { StudyNote } from '../types/marketplace';

interface ExplorePageProps {
  queryString: string;
  onNavigate: (path: string) => void;
}

export function ExplorePage({ queryString, onNavigate }: ExplorePageProps) {
  const { subjects } = useAuth();
  const params = new URLSearchParams(queryString);

  const [q, setQ] = useState(params.get('q') || '');
  const [classLevel, setClassLevel] = useState(params.get('classLevel') || 'all');
  const [subject, setSubject] = useState(params.get('subject') || 'all');
  const [chapter, setChapter] = useState(params.get('chapter') || '');
  const [board, setBoard] = useState(params.get('board') || 'all');
  const [pricing, setPricing] = useState(params.get('pricing') || 'all');
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '');
  const [sort, setSort] = useState(params.get('sort') || 'recent');

  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(queryString);
    setQ(p.get('q') || '');
    setClassLevel(p.get('classLevel') || 'all');
    setSubject(p.get('subject') || 'all');
    setChapter(p.get('chapter') || '');
    setBoard(p.get('board') || 'all');
    setPricing(p.get('pricing') || 'all');
    setSort(p.get('sort') || 'recent');
  }, [queryString]);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (classLevel !== 'all') qs.set('classLevel', classLevel);
      if (subject !== 'all') qs.set('subject', subject);
      if (chapter.trim()) qs.set('chapter', chapter.trim());
      if (board !== 'all') qs.set('board', board);
      if (pricing !== 'all') qs.set('pricing', pricing);
      if (minPrice !== '') qs.set('minPrice', minPrice);
      if (maxPrice !== '') qs.set('maxPrice', maxPrice);
      if (sort) qs.set('sort', sort);

      const res = await apiFetch<{ notes: StudyNote[] }>(`/notes?${qs.toString()}`);
      setNotes(res.notes || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load notes.');
    } finally {
      setLoading(false);
    }
  }, [q, classLevel, subject, chapter, board, pricing, minPrice, maxPrice, sort]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const resetFilters = () => {
    setQ('');
    setClassLevel('all');
    setSubject('all');
    setChapter('');
    setBoard('all');
    setPricing('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('recent');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Explore Study Notes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search verified Class 6–12 notes by subject, chapter, education board, and price.
          </p>
        </div>
        <div className="text-sm font-medium text-slate-600 tabular-nums">
          {loading ? 'Searching...' : `${notes.length} note${notes.length === 1 ? '' : 's'} found`}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            Search &amp; Filters
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, subject, chapter, or @username..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by Class"
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Classes (6–12)</option>
            {[6, 7, 8, 9, 10, 11, 12].map((c) => (
              <option key={c} value={String(c)}>
                Class {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Filter by chapter name..."
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
          />

          <select
            aria-label="Filter by Board"
            value={board}
            onChange={(e) => setBoard(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Boards</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="State Board">State Board</option>
            <option value="Other">Other</option>
          </select>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by Pricing"
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              className="w-1/2 rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">Free &amp; Paid</option>
              <option value="free">Free Only</option>
              <option value="paid">Paid Only</option>
            </select>
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min ₹"
              className="w-1/4 rounded-xl border border-slate-300 px-2.5 py-2.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
            />
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max ₹"
              className="w-1/4 rounded-xl border border-slate-300 px-2.5 py-2.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
            />
          </div>

          <select
            aria-label="Sort results"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="recent">Recently Uploaded</option>
            <option value="highest_rated">Highest Rated</option>
            <option value="most_popular">Most Popular</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No matching study notes found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try clearing some filters, or upload original notes for this subject and class.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/upload')}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Upload Notes
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
