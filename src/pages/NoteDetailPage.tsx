import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Download,
  Eye,
  Flag,
  ShieldCheck,
  Star,
  ThumbsUp,
  UserPlus,
  UserCheck,
  Receipt,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { apiFetch, downloadAuthenticatedBlob } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getNoteCoverUrl } from '../components/NoteCard';
import { BuyerSellerChatModal } from '../components/BuyerSellerChatModal';
import type { StudyNote, StudentProfile, ReviewRecord, PurchaseRecord } from '../types/marketplace';

interface NoteDetailPageProps {
  noteId: string;
  onNavigate: (path: string) => void;
}

export function NoteDetailPage({ noteId, onNavigate }: NoteDetailPageProps) {
  const { firebaseUser, wishlistIds, toggleWishlist, openAuthModal } = useAuth();
  const [note, setNote] = useState<StudyNote | null>(null);
  const [seller, setSeller] = useState<StudentProfile | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [purchaseRecord, setPurchaseRecord] = useState<PurchaseRecord | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  // Review state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');

  // Report state
  const [reportTarget, setReportTarget] = useState<{
    type: 'note' | 'review';
    id: string;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Copyrighted or plagiarized content');
  const [reportDetails, setReportDetails] = useState('');

  const loadNote = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{
        note: StudyNote;
        seller: StudentProfile | null;
        hasPurchased: boolean;
        purchaseRecord: PurchaseRecord | null;
        reviews: ReviewRecord[];
      }>(`/notes/${noteId}`);
      setNote(data.note);
      setSeller(data.seller);
      setHasPurchased(data.hasPurchased);
      setPurchaseRecord(data.purchaseRecord);
      setReviews(data.reviews || []);

      if (data.seller) {
        const profileData = await apiFetch<{ isFollowing: boolean }>(
          `/profiles/${data.seller.uid}`
        ).catch(() => ({ isFollowing: false }));
        setIsFollowing(profileData.isFollowing);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load study note.');
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleClaimFree = async () => {
    if (!firebaseUser) {
      openAuthModal('login');
      return;
    }
    setBusyAction(true);
    setError('');
    try {
      await apiFetch(`/notes/${noteId}/claim-free`, { method: 'POST' });
      setActionMessage('Free study note unlocked! You can now download the full PDF.');
      await loadNote();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to claim note.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!note) return;
    setBusyAction(true);
    try {
      await downloadAuthenticatedBlob(`/notes/${note.id}/download`, `${note.title}.pdf`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!purchaseRecord) return;
    try {
      await downloadAuthenticatedBlob(
        `/payments/receipt/${purchaseRecord.id}`,
        `receipt-${purchaseRecord.receiptNumber}.pdf`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to download receipt.');
    }
  };

  const handleToggleFollow = async () => {
    if (!firebaseUser) {
      openAuthModal('login');
      return;
    }
    if (!seller) return;
    setBusyAction(true);
    try {
      if (isFollowing) {
        await apiFetch(`/follow/${seller.uid}`, { method: 'DELETE' });
        setIsFollowing(false);
      } else {
        await apiFetch(`/follow/${seller.uid}`, { method: 'POST' });
        setIsFollowing(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update follow status.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setBusyAction(true);
    try {
      await apiFetch(`/notes/${noteId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
      setComment('');
      setActionMessage('Thank you! Your verified review has been published.');
      await loadNote();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    if (!firebaseUser) {
      openAuthModal('login');
      return;
    }
    try {
      await apiFetch(`/reviews/${reviewId}/helpful`, { method: 'POST' });
      await loadNote();
    } catch {
      // ignore
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportTarget.type,
          targetId: reportTarget.id,
          targetLabel: reportTarget.label,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      setReportTarget(null);
      setReportDetails('');
      setActionMessage('Report submitted for administrator review.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Study Note Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">{error || 'This study note may have been removed.'}</p>
        <button
          type="button"
          onClick={() => onNavigate('/explore')}
          className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Back to Explore Notes
        </button>
      </div>
    );
  }

  const isWishlisted = wishlistIds.includes(note.id);
  const isOwner = firebaseUser?.uid === note.sellerId;
  const alreadyReviewed = reviews.some((r) => r.buyerId === firebaseUser?.uid);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate('/explore')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </button>

      {actionMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split View */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Cover + Description + Preview + Reviews */}
        <div className="space-y-8 lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
              <img
                src={getNoteCoverUrl(note)}
                alt={note.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span>Class {note.classLevel}</span>
                <span aria-hidden="true">·</span>
                <span className="text-blue-700">{note.subject}</span>
                <span aria-hidden="true">·</span>
                <span>Chapter: {note.chapterName}</span>
                <span aria-hidden="true">·</span>
                <span>{note.board}</span>
              </div>

              <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                {note.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-6 border-y border-slate-100 py-3 text-sm text-slate-600 tabular-nums">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {note.averageRating > 0 ? note.averageRating.toFixed(1) : 'No ratings'} ({note.ratingCount} reviews)
                </span>
                <span>{note.purchaseCount} student downloads</span>
                <span>{note.pageCount} pages · {(note.fileSizeBytes / 1024).toFixed(0)} KB PDF</span>
              </div>

              <div className="mt-5">
                <h2 className="font-display text-base font-semibold text-slate-900">
                  About These Study Notes
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {note.description}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4 text-blue-600" />
                  Preview Sample Pages (First 2 Pages)
                </button>
                {!isOwner && seller?.uid !== 'cbse_ncert_library' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!firebaseUser) {
                        openAuthModal('login');
                        return;
                      }
                      setShowChatModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Ask Seller About Notes
                  </button>
                )}
                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() =>
                      setReportTarget({ type: 'note', id: note.id, label: note.title })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Report Note
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Ratings &amp; Verified Reviews
              </h2>
              <span className="font-mono text-sm font-semibold text-slate-700 tabular-nums">
                {note.averageRating > 0 ? `${note.averageRating.toFixed(1)} / 5.0` : 'Unrated'}
              </span>
            </div>

            {hasPurchased && !isOwner && !alreadyReviewed && (
              <form
                onSubmit={handleSubmitReview}
                className="mt-6 rounded-xl border border-blue-100 bg-blue-50/40 p-5"
              >
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Write a Verified Review
                </h3>
                <div className="mt-3 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      aria-label={`Rate ${star} stars`}
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-medium text-slate-600 tabular-nums">
                    {rating} out of 5 stars
                  </span>
                </div>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How helpful were these notes for your exam prep and chapter revision?"
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-blue-600 focus:outline-none"
                />
                {reviewError && <p className="mt-2 text-xs text-red-600">{reviewError}</p>}
                <button
                  type="submit"
                  disabled={busyAction}
                  className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Publish Review
                </button>
              </form>
            )}

            {!hasPurchased && !isOwner && (
              <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-600">
                Only students who have claimed or purchased this note can submit a verified review.
              </p>
            )}

            <div className="mt-6 divide-y divide-slate-100">
              {reviews.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">No student reviews yet.</p>
              ) : (
                reviews.map((rev) => (
                  <div key={rev.id} className="py-5 first:pt-2 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {rev.buyerName}{' '}
                        <span className="font-normal text-slate-500">@{rev.buyerUsername}</span>
                      </div>
                      <span className="text-xs font-medium text-emerald-700">
                        Verified Purchase
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(5 - rev.rating)}
                      </span>
                      <span>·</span>
                      <span>{new Date(rev.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{rev.comment}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => handleHelpful(rev.id)}
                        className="inline-flex items-center gap-1 hover:text-blue-700 tabular-nums"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        Helpful ({rev.helpfulCount || 0})
                      </button>
                      {firebaseUser && (
                        <button
                          type="button"
                          onClick={() =>
                            setReportTarget({
                              type: 'review',
                              id: rev.id,
                              label: `Review by ${rev.buyerName}`,
                            })
                          }
                          className="inline-flex items-center gap-1 hover:text-red-600"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          Report
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Sticky Purchase / Download Module & Seller Card */}
        <div className="space-y-6 lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-500">Price</span>
                <span className="font-display text-3xl font-extrabold tabular-nums text-slate-900">
                  {note.isFree || note.price === 0 ? (
                    <span className="text-emerald-700">Free</span>
                  ) : (
                    `₹${note.price}`
                  )}
                </span>
              </div>

              <div className="mt-5 space-y-2.5">
                {hasPurchased ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={busyAction}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Full PDF ({note.pageCount} pages)
                    </button>
                    {purchaseRecord && (
                      <button
                        type="button"
                        onClick={handleDownloadReceipt}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Receipt className="h-4 w-4" />
                        Download Receipt ({purchaseRecord.receiptNumber})
                      </button>
                    )}
                  </>
                ) : note.isFree || note.price === 0 ? (
                  <button
                    type="button"
                    onClick={handleClaimFree}
                    disabled={busyAction}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                  >
                    {busyAction ? 'Unlocking...' : 'Claim Free Study Notes'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!firebaseUser) {
                        openAuthModal('login');
                        return;
                      }
                      onNavigate(`/checkout/${note.id}`);
                    }}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                  >
                    Buy Now · ₹{note.price}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => toggleWishlist(note.id)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    isWishlisted
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Bookmark className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                  {isWishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
                </button>
              </div>

              <div className="mt-5 flex items-start gap-2.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <span>
                  Originality attested by author. Protected PDF delivery unlocked exclusively for
                  authorized learners.
                </span>
              </div>
            </div>

            {/* Seller Card */}
            {seller && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <span className="text-xs font-medium text-slate-500">Created by</span>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-display text-sm font-bold text-blue-700">
                    {seller.avatarUrl ? (
                      <img
                        src={seller.avatarUrl}
                        alt={seller.fullName}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      seller.fullName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-bold text-slate-900">
                      {seller.fullName}
                    </h3>
                    <p className="truncate text-xs text-slate-500">
                      @{seller.username} · Class {seller.classLevel} ({seller.board})
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center text-xs tabular-nums">
                  <div>
                    <div className="font-bold text-slate-900">{seller.followersCount}</div>
                    <div className="text-slate-500">Followers</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{seller.uploadedNotesCount}</div>
                    <div className="text-slate-500">Notes</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      {seller.averageRating > 0 ? seller.averageRating.toFixed(1) : 'New'}
                    </div>
                    <div className="text-slate-500">Rating</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/profile/${seller.uid}`)}
                    className={`rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${
                      isOwner || seller.uid === 'cbse_ncert_library' ? 'col-span-2' : ''
                    }`}
                  >
                    View Profile
                  </button>
                  {!isOwner && seller.uid !== 'cbse_ncert_library' && (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      disabled={busyAction}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
                        isFollowing
                          ? 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-3.5 w-3.5" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" />
                          Follow
                        </>
                      )}
                    </button>
                  )}
                </div>

                {seller.uid === 'cbse_ncert_library' ? (
                  <p className="mt-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-center text-[11px] font-medium text-blue-800">
                    Open-Access CBSE NCERT Library · Claim Free &amp; Download Anytime
                  </p>
                ) : !isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!firebaseUser) {
                        openAuthModal('login');
                        return;
                      }
                      setShowChatModal(true);
                    }}
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat with Seller About Notes
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate('/dashboard?tab=messages')}
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-2.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    View Buyer Inquiries
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sample Pages PDF Preview Modal */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Sample Pages Preview — {note.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Showing up to first 2 sample pages. Full {note.pageCount}-page PDF unlocks after purchase/claim.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <iframe
              title="Sample pages PDF preview"
              src={`/api/notes/${note.id}/preview`}
              className="h-full w-full flex-1 bg-slate-100"
            />
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">
              Report {reportTarget.type === 'note' ? 'Study Note' : 'Review'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{reportTarget.label}</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="Copyrighted or plagiarized content">
                Copyrighted or plagiarized content
              </option>
              <option value="Misleading or incomplete pages">Misleading or incomplete pages</option>
              <option value="Inappropriate or abusive language">
                Inappropriate or abusive language
              </option>
              <option value="Spam or promotional content">Spam or promotional content</option>
            </select>
            <textarea
              rows={3}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Provide details for our moderation team..."
              className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Buyer / Seller Chat Modal */}
      {showChatModal && note && (
        <BuyerSellerChatModal
          note={note}
          onClose={() => setShowChatModal(false)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
