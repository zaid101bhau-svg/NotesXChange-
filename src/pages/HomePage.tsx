import React, { useEffect, useState } from 'react';
import {
  Search,
  ArrowRight,
  BookOpen,
  Upload,
  ShieldCheck,
  Users,
  Star,
  GraduationCap,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { NoteCard } from '../components/NoteCard';
import type { StudyNote, StudentProfile, ReviewRecord } from '../types/marketplace';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

const CLASSES = [6, 7, 8, 9, 10, 11, 12];

export function HomePage({ onNavigate }: HomePageProps) {
  const { subjects, firebaseUser, profile, openAuthModal } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [contributors, setContributors] = useState<StudentProfile[]>([]);
  const [featuredReviews, setFeaturedReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadHomeData() {
      setLoading(true);
      try {
        const [notesRes, contribRes, reviewsRes] = await Promise.all([
          apiFetch<{ notes: StudyNote[] }>('/notes').catch(() => ({ notes: [] })),
          apiFetch<{ contributors: StudentProfile[] }>('/contributors').catch(() => ({
            contributors: [],
          })),
          apiFetch<{ reviews: ReviewRecord[] }>('/reviews/featured').catch(() => ({
            reviews: [],
          })),
        ]);
        if (mounted) {
          setNotes(notesRes.notes || []);
          setContributors((contribRes.contributors || []).slice(0, 4));
          setFeaturedReviews(reviewsRes.reviews || []);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadHomeData();
    return () => {
      mounted = false;
    };
  }, []);

  const topRatedNotes = [...notes]
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0) || (b.purchaseCount || 0) - (a.purchaseCount || 0))
    .slice(0, 3);
  const recentNotes = [...notes]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 3);
  const freeNotes = notes.filter((n) => n.isFree || n.price === 0).slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    onNavigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  return (
    <div className="bg-slate-50">
      {/* HERO SECTION */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-16 lg:px-8">
          <div className="flex flex-col justify-center lg:col-span-7">
            <p className="text-xs font-semibold tracking-wide text-violet-700">
              NOTE XCHANGE · Class 6 to Class 12 Student Marketplace
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl text-balance">
              Share Your Knowledge. Earn From Your Notes.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Discover, Buy &amp; Sell Quality Study Notes from Students Like You. Learn Together.
              Share Knowledge. Grow Together.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mt-7 flex max-w-xl flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Class 10 Physics, Organic Chemistry, Trigonometry..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Search Notes
              </button>
            </form>

            {/* Primary Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/explore')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Explore Notes
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!firebaseUser) {
                    openAuthModal('signup');
                  } else if (!profile?.onboardingCompleted) {
                    onNavigate('/onboarding');
                  } else {
                    onNavigate('/dashboard');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-5 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap"
              >
                {firebaseUser ? 'Go to Dashboard' : 'Join Now'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img
                src="/src/assets/images/hero_study_notes_1794512073221.jpg"
                alt="Organized Class 6 to 12 handwritten and digital study notebooks on a bright desk"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 1. BROWSE BY CLASS (6-12) */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">Browse by Class</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select your grade from Class 6 to Class 12 to explore board-aligned study packs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/explore')}
            className="text-sm font-semibold text-blue-600 hover:underline self-start sm:self-auto"
          >
            View all classes →
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {CLASSES.map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => onNavigate(`/explore?classLevel=${cls}`)}
              className="group flex flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm"
            >
              <span className="font-mono text-xs font-medium text-violet-700 tabular-nums">
                GRADE 0{cls < 10 ? cls : ''}
                {cls >= 10 ? '' : ''}
              </span>
              <span className="mt-1 font-display text-lg font-bold text-slate-900 group-hover:text-blue-700">
                Class {cls}
              </span>
              <span className="mt-2 text-xs text-slate-500">Explore notes →</span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. POPULAR SUBJECTS */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-slate-900">Popular Subjects</h2>
          <p className="mt-1 text-sm text-slate-600">
            Find chapter-wise summaries, derivations, and solved question banks across core subjects.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => onNavigate(`/explore?subject=${encodeURIComponent(subject.name)}`)}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {subject.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {subject.description}
                  </p>
                </div>
                <span className="mt-3 text-xs font-semibold text-blue-600">Browse notes →</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3, 4, 5. TOP RATED, RECENTLY UPLOADED, & FREE NOTES */}
      <section className="mx-auto max-w-7xl space-y-14 px-4 py-14 sm:px-6 lg:px-8">
        {/* 3. Top Rated Notes */}
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Top Rated Notes</h2>
              <p className="mt-1 text-sm text-slate-600">
                Highest-rated study resources verified by student purchasers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/explore?sort=highest_rated')}
              className="text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              See all →
            </button>
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
              ))}
            </div>
          ) : topRatedNotes.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {topRatedNotes.map((note) => (
                <NoteCard key={note.id} note={note} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyNotesCallout
              title="No published notes yet"
              description="Be among the first students to upload original Class 6–12 study notes and earn from your work."
              onAction={() => onNavigate(firebaseUser ? '/upload' : '/explore')}
              actionLabel={firebaseUser ? 'Upload Your First Note' : 'Browse Marketplace'}
            />
          )}
        </div>

        {/* 4. Recently Uploaded Notes */}
        {recentNotes.length > 0 && (
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  Recently Uploaded Notes
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Fresh chapter summaries and formula sheets added by peers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/explore?sort=recent')}
                className="text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap"
              >
                Explore recent →
              </button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {recentNotes.map((note) => (
                <NoteCard key={note.id} note={note} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}

        {/* 5. Free Notes */}
        <div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Free Study Notes</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open-access revision sheets and community notes you can claim at ₹0.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('/explore?classLevel=6&board=CBSE&pricing=free')}
                className="text-xs font-semibold text-violet-700 hover:underline whitespace-nowrap"
              >
                Class 6 CBSE →
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/explore?classLevel=7&board=CBSE&pricing=free')}
                className="text-xs font-semibold text-violet-700 hover:underline whitespace-nowrap"
              >
                Class 7 CBSE →
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/explore?pricing=free')}
                className="text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap"
              >
                Browse free notes →
              </button>
            </div>
          </div>
          {freeNotes.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {freeNotes.map((note) => (
                <NoteCard key={note.id} note={note} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Free community study notes uploaded by verified student sellers will appear here automatically.
            </div>
          )}
        </div>
      </section>

      {/* 6. TOP CONTRIBUTORS */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">Top Contributors</h2>
              <p className="mt-1 text-sm text-slate-600">
                Students recognized for high-rated notes, verified purchases, and community helpfulness.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/contributors')}
              className="text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Full leaderboard →
            </button>
          </div>

          {contributors.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {contributors.map((student, idx) => (
                <button
                  key={student.uid}
                  type="button"
                  onClick={() => onNavigate(`/profile/${student.uid}`)}
                  className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-5 text-left transition-all hover:border-blue-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-violet-700 tabular-nums">
                      RANK #{idx + 1}
                    </span>
                    <span className="font-mono text-xs text-slate-500 tabular-nums">
                      {student.contributionPoints} pts
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-display text-sm font-bold text-blue-700">
                      {student.avatarUrl ? (
                        <img
                          src={student.avatarUrl}
                          alt={student.fullName}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        student.fullName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold text-slate-900">
                        {student.fullName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        @{student.username} · Class {student.classLevel}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-xs text-slate-600 tabular-nums">
                    <span>{student.uploadedNotesCount} notes</span>
                    <span>
                      ★ {student.averageRating > 0 ? student.averageRating.toFixed(1) : 'New'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Contributor rankings update in real time as students complete onboarding and publish study materials.
            </div>
          )}
        </div>
      </section>

      {/* 7. HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-bold text-slate-900">How NOTE XCHANGE Works</h2>
        <p className="mt-1 text-sm text-slate-600">
          Built for clarity, originality, and safe peer-to-peer learning.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
              01. Create Your Student Profile
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Register with verified email, enter your Class (6–12) and Board, confirm guardian
              consent if under 18, and choose Buyer, Seller, or Explorer roles.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
              02. Preview &amp; Unlock Notes
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Inspect 2-page sample previews before claiming free PDFs or checking out securely via
              UPI and Cards with instant verified download receipts.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Upload className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">
              03. Share Notes &amp; Grow Together
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Upload original PDF notes, set fair prices or share for free, earn verified reviews,
              and track real-time earnings after seller eligibility verification.
            </p>
          </div>
        </div>
      </section>

      {/* 8. STUDENT COMMUNITY & AGE SAFEGUARDS */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              A Safe Educational Community for Class 6–12
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Follow top student creators across CBSE, ICSE, and State Boards to receive instant
              notifications when new chapter guides drop. Every upload goes through originality
              attestation, private PDF storage, and admin moderation, while minor accounts include
              parent or guardian safeguards and verified seller payout checks.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Verified PDF Protection
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Paid PDFs are stored privately and unlocked only after verified payment.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                <Users className="h-5 w-5 shrink-0 text-violet-700 mt-0.5" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Student Following Feed
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Follow classmates and top contributors to track new notes and free study packs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img
                src="/src/assets/images/cover_biology_genetics_1794512074893.jpg"
                alt="Illustrated biology and genetics student notes"
                referrerPolicy="no-referrer"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 9. GENUINE STUDENT REVIEWS */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Genuine Student Reviews
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Reviews submitted exclusively by verified note purchasers and claimants.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/feedback')}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Share platform feedback →
          </button>
        </div>

        {featuredReviews.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            {featuredReviews.map((rev) => (
              <div key={rev.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {rev.rating}.0 / 5
                  </span>
                  <span className="font-medium text-emerald-700">Verified Purchase</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">&ldquo;{rev.comment}&rdquo;</p>
                <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">{rev.buyerName}</span> · @
                  {rev.buyerUsername}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Verified purchase reviews from students will appear here once notes are claimed or purchased and reviewed.
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyNotesCallout({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
      <div>
        <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
      >
        {actionLabel}
      </button>
    </div>
  );
}
