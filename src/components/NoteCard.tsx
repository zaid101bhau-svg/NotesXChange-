import React from 'react';
import { Bookmark, Star, FileText, Users } from 'lucide-react';
import type { StudyNote } from '../types/marketplace';
import { useAuth } from '../context/AuthContext';

const SUBJECT_DEFAULT_COVERS: Record<string, string> = {
  Physics: '/src/assets/images/cover_physics_optics_1794512073101.jpg',
  Chemistry: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
  Mathematics: '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
  Biology: '/src/assets/images/cover_biology_genetics_1794512074893.jpg',
  Science: '/src/assets/images/cover_biology_genetics_1794512074893.jpg',
  'Social Science': '/src/assets/images/cover_physics_optics_1794512073101.jpg',
  English: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
  Hindi: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
  Sanskrit: '/src/assets/images/cover_organic_chemistry_1794512074371.jpg',
  'Computer Science': '/src/assets/images/cover_calculus_maths_1794512074590.jpg',
};

export function getNoteCoverUrl(note: Pick<StudyNote, 'coverUrl' | 'subject'>): string {
  if (note.coverUrl) return note.coverUrl;
  return SUBJECT_DEFAULT_COVERS[note.subject] || '/src/assets/images/cover_calculus_maths_1794512074590.jpg';
}

interface NoteCardProps {
  note: StudyNote;
  onNavigate: (path: string) => void;
}

export function NoteCard({ note, onNavigate }: NoteCardProps) {
  const { wishlistIds, toggleWishlist } = useAuth();
  const isWishlisted = wishlistIds.includes(note.id);
  const coverSrc = getNoteCoverUrl(note);

  const handleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleWishlist(note.id);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div
        onClick={() => onNavigate(`/notes/${note.id}`)}
        className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-slate-100"
      >
        <img
          src={coverSrc}
          alt={`${note.title} cover`}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            isWishlisted
              ? 'border-violet-600 bg-violet-600 text-white'
              : 'border-white/70 bg-white/90 text-slate-700 hover:bg-white hover:text-blue-600'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Clean unboxed zero-pill metadata */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span>Class {note.classLevel}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate text-blue-700">{note.subject}</span>
          <span aria-hidden="true">·</span>
          <span>{note.board}</span>
        </div>

        <h3
          onClick={() => onNavigate(`/notes/${note.id}`)}
          className="mt-2 line-clamp-2 cursor-pointer font-display text-base font-semibold leading-snug text-slate-900 group-hover:text-blue-700 transition-colors"
        >
          {note.title}
        </h3>

        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            onClick={() => onNavigate(`/profile/${note.sellerId}`)}
            className="truncate font-medium text-slate-600 hover:text-violet-700 hover:underline"
          >
            @{note.sellerUsername}
          </button>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            {note.pageCount} pp
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1 font-medium text-slate-800">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {note.averageRating > 0 ? note.averageRating.toFixed(1) : 'New'}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {note.purchaseCount}
            </span>
          </div>

          <span className="font-display text-base font-bold tabular-nums text-slate-900">
            {note.isFree || note.price === 0 ? (
              <span className="text-emerald-700">Free</span>
            ) : (
              `₹${note.price}`
            )}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigate(`/notes/${note.id}`)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            View Details
          </button>
          <button
            type="button"
            onClick={() =>
              onNavigate(
                note.isFree || note.price === 0 ? `/notes/${note.id}` : `/checkout/${note.id}`
              )
            }
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            {note.isFree || note.price === 0 ? 'Claim Free' : 'Buy Now'}
          </button>
        </div>
      </div>
    </article>
  );
}
