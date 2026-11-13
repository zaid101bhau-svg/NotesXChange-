import React, { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  User,
  FileText,
  ShoppingBag,
  Bookmark,
  Users,
  Rss,
  Star,
  MessageSquare,
  Bell,
  Receipt,
  Settings,
  IndianRupee,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  LogOut,
  MessagesSquare,
} from 'lucide-react';
import { apiFetch, downloadAuthenticatedBlob } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { NoteCard } from '../components/NoteCard';
import { MessagesInbox } from '../components/MessagesInbox';
import type {
  StudyNote,
  PurchaseRecord,
  ReviewRecord,
  FollowerRecord,
  ActivityRecord,
  NotificationRecord,
  TransactionRecord,
  FeedbackRecord,
  SellerEarningsSummary,
  SellerPayoutRecord,
  RefundRequestRecord,
} from '../types/marketplace';

interface DashboardPageProps {
  queryString: string;
  onNavigate: (path: string) => void;
}

type TabId =
  | 'overview'
  | 'profile'
  | 'uploaded'
  | 'earnings'
  | 'purchased'
  | 'wishlist'
  | 'followers'
  | 'following'
  | 'feed'
  | 'reviews'
  | 'messages'
  | 'feedback'
  | 'notifications'
  | 'payments'
  | 'settings';

export function DashboardPage({ queryString, onNavigate }: DashboardPageProps) {
  const {
    firebaseUser,
    userAccount,
    profile,
    notificationSettings,
    refreshSession,
    logout,
    openAuthModal,
  } = useAuth();

  const initialTab = (new URLSearchParams(queryString).get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewRecord[]>([]);
  const [uploadedNotes, setUploadedNotes] = useState<StudyNote[]>([]);
  const [wishlistNotes, setWishlistNotes] = useState<StudyNote[]>([]);
  const [followers, setFollowers] = useState<FollowerRecord[]>([]);
  const [following, setFollowing] = useState<FollowerRecord[]>([]);
  const [feed, setFeed] = useState<ActivityRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRequestRecord[]>([]);
  const [myFeedback, setMyFeedback] = useState<FeedbackRecord[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [earnings, setEarnings] = useState<{
    summary: SellerEarningsSummary;
    payouts: SellerPayoutRecord[];
    sales: PurchaseRecord[];
  } | null>(null);

  // Modals / Inline Forms
  const [editingNote, setEditingNote] = useState<StudyNote | null>(null);
  const [refundModalPurchase, setRefundModalPurchase] = useState<PurchaseRecord | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Seller eligibility form
  const [payoutUpi, setPayoutUpi] = useState(userAccount?.payoutUpiOrBankRef || '');
  const [guardianName, setGuardianName] = useState(userAccount?.parentGuardianName || '');
  const [guardianEmail, setGuardianEmail] = useState(userAccount?.parentGuardianEmail || '');
  const [confirmOrig, setConfirmOrig] = useState(false);

  // Payout withdrawal form
  const [payoutAmount, setPayoutAmount] = useState('100');
  const [payoutMethod, setPayoutMethod] = useState('UPI');

  useEffect(() => {
    const tabParam = new URLSearchParams(queryString).get('tab') as TabId | null;
    if (tabParam) setActiveTab(tabParam);
  }, [queryString]);

  const loadDashboard = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const [overview, wishlistRes, feedRes, notifRes, payHistRes, fbRes, earnRes, chatRes] =
        await Promise.all([
          apiFetch<{
            purchases: PurchaseRecord[];
            myReviews: ReviewRecord[];
            uploadedNotes: StudyNote[];
            followers: FollowerRecord[];
            following: FollowerRecord[];
          }>('/dashboard/overview'),
          apiFetch<{ notes: StudyNote[] }>('/wishlist'),
          apiFetch<{ activities: ActivityRecord[] }>('/feed/following'),
          apiFetch<{ notifications: NotificationRecord[] }>('/notifications'),
          apiFetch<{ transactions: TransactionRecord[]; refunds: RefundRequestRecord[] }>(
            '/payments/history'
          ),
          apiFetch<{ feedback: FeedbackRecord[] }>('/feedback/my'),
          apiFetch<{
            summary: SellerEarningsSummary;
            payouts: SellerPayoutRecord[];
            sales: PurchaseRecord[];
          }>('/seller/earnings'),
          apiFetch<{ totalUnread: number }>('/note-chats/threads').catch(() => ({
            totalUnread: 0,
          })),
        ]);

      setPurchases(overview.purchases || []);
      setMyReviews(overview.myReviews || []);
      setUploadedNotes(overview.uploadedNotes || []);
      setFollowers(overview.followers || []);
      setFollowing(overview.following || []);
      setWishlistNotes(wishlistRes.notes || []);
      setFeed(feedRes.activities || []);
      setNotifications(notifRes.notifications || []);
      setTransactions(payHistRes.transactions || []);
      setRefunds(payHistRes.refunds || []);
      setMyFeedback(fbRes.feedback || []);
      setEarnings(earnRes);
      setUnreadChatCount(chatRes.totalUnread || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Student Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to manage your study notes, purchases, wishlist, following feed, and earnings.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  const isSeller = Boolean(profile?.roles?.includes('seller'));

  const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard; sellerOnly?: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'uploaded', label: 'My Uploaded Notes', icon: FileText, sellerOnly: true },
    { id: 'earnings', label: 'Seller Earnings', icon: IndianRupee, sellerOnly: true },
    { id: 'purchased', label: 'My Purchased Notes', icon: ShoppingBag },
    { id: 'wishlist', label: 'My Wishlist', icon: Bookmark },
    { id: 'followers', label: 'My Followers', icon: Users },
    { id: 'following', label: 'My Following', icon: Users },
    { id: 'feed', label: 'Following Feed', icon: Rss },
    { id: 'messages', label: 'Buyer / Seller Chat', icon: MessagesSquare },
    { id: 'reviews', label: 'My Reviews', icon: Star },
    { id: 'feedback', label: 'My Feedback', icon: MessageSquare },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'payments', label: 'Payment History', icon: Receipt },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  const visibleTabs = tabs.filter((t) => !t.sellerOnly || isSeller);

  const handleSaveNoteEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    setError('');
    try {
      await apiFetch(`/notes/${editingNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editingNote.title,
          chapterName: editingNote.chapterName,
          description: editingNote.description,
          price: editingNote.price,
        }),
      });
      setEditingNote(null);
      setNotice('Study note updated.');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update note.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiFetch(`/notes/${noteId}`, { method: 'DELETE' });
      setNotice('Study note deleted.');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to delete note.');
    }
  };

  const handleApplyEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/seller/apply-eligibility', {
        method: 'POST',
        body: JSON.stringify({
          payoutUpiOrBankRef: payoutUpi,
          parentGuardianName: guardianName,
          parentGuardianEmail: guardianEmail,
          confirmOriginality: confirmOrig,
        }),
      });
      setNotice('Seller eligibility & guardian verification submitted for admin review.');
      await refreshSession();
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/seller/payouts', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(payoutAmount), payoutMethod }),
      });
      setNotice('Payout withdrawal request submitted.');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to request payout.');
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalPurchase) return;
    setError('');
    try {
      await apiFetch('/refunds', {
        method: 'POST',
        body: JSON.stringify({ purchaseId: refundModalPurchase.id, reason: refundReason }),
      });
      setRefundModalPurchase(null);
      setRefundReason('');
      setNotice('Refund request submitted for admin review.');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit refund request.');
    }
  };

  const handleMarkRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' });
    await refreshSession();
    await loadDashboard();
  };

  const handleMarkAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'POST' });
    await refreshSession();
    await loadDashboard();
  };

  const handleToggleNotifPref = async (key: string, val: boolean) => {
    await apiFetch('/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...notificationSettings, [key]: val }),
    });
    await refreshSession();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Student Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Welcome back, {profile?.fullName || firebaseUser.email}
            {profile?.classLevel ? ` · Class ${profile.classLevel} (${profile.board})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSeller && (
            <button
              type="button"
              onClick={() => onNavigate('/upload')}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Upload New Notes
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('/onboarding')}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit Profile &amp; Roles
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Sidebar Nav */}
        <aside className="lg:col-span-3">
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 lg:flex-col">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.id === 'messages' && unreadChatCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        active ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {unreadChatCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Viewport */}
        <main className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ) : (
            <>
              {/* 1. OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
                    <StatTile label="Purchased Notes" value={purchases.length} />
                    <StatTile label="Saved Wishlist" value={wishlistNotes.length} />
                    <StatTile label="Followers" value={followers.length} />
                    <StatTile label="Following" value={following.length} />
                  </div>

                  {isSeller && earnings && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-lg font-bold text-slate-900">
                          Seller Earnings Snapshot
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('earnings')}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Manage Payouts →
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
                        <StatTile label="Total Sales" value={earnings.summary.totalSales} />
                        <StatTile
                          label="Net Earnings"
                          value={`₹${earnings.summary.netEarnings}`}
                        />
                        <StatTile
                          label="Available Balance"
                          value={`₹${earnings.summary.availableBalance}`}
                        />
                        <StatTile
                          label="Pending Settlements"
                          value={`₹${earnings.summary.pendingSettlements}`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Recent Activity from Followed Students
                    </h2>
                    {feed.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        Follow student creators on the marketplace to see their new notes here.
                      </p>
                    ) : (
                      <div className="mt-4 divide-y divide-slate-100">
                        {feed.slice(0, 5).map((act) => (
                          <div key={act.id} className="flex items-center justify-between py-3 text-sm">
                            <div>
                              <span className="font-medium text-slate-800">{act.summary}</span>
                              <div className="text-xs text-slate-500">
                                {new Date(act.createdAt).toLocaleString('en-IN')}
                              </div>
                            </div>
                            {act.noteId && (
                              <button
                                type="button"
                                onClick={() => onNavigate(`/notes/${act.noteId}`)}
                                className="text-xs font-semibold text-blue-600 hover:underline shrink-0"
                              >
                                Open →
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. MY PROFILE */}
              {activeTab === 'profile' && profile && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900">
                        {profile.fullName}
                      </h2>
                      <p className="text-sm text-slate-600">
                        @{profile.username} · Class {profile.classLevel} · {profile.board}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-violet-700 capitalize">
                        Active Roles: {profile.roles.join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/profile/${profile.uid}`)}
                        className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700"
                      >
                        Public Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('/onboarding')}
                        className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        Edit Info &amp; Roles
                      </button>
                    </div>
                  </div>
                  {profile.bio && (
                    <p className="mt-4 text-sm leading-relaxed text-slate-700">{profile.bio}</p>
                  )}
                </div>
              )}

              {/* 3. MY UPLOADED NOTES */}
              {activeTab === 'uploaded' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      My Uploaded Study Notes
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('/upload')}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Upload Notes
                    </button>
                  </div>

                  {uploadedNotes.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      You have not uploaded any study notes yet.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {uploadedNotes.map((note) => (
                        <div
                          key={note.id}
                          className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <div className="text-xs font-medium text-slate-500">
                              Class {note.classLevel} · {note.subject} ·{' '}
                              <span
                                className={`font-semibold capitalize ${
                                  note.status === 'approved'
                                    ? 'text-emerald-700'
                                    : note.status === 'pending'
                                      ? 'text-amber-700'
                                      : 'text-red-700'
                                }`}
                              >
                                {note.status}
                              </span>
                            </div>
                            <h3 className="mt-1 font-display text-base font-semibold text-slate-900">
                              {note.title}
                            </h3>
                            <div className="mt-1 text-xs text-slate-600 tabular-nums">
                              {note.isFree ? 'Free' : `₹${note.price}`} · {note.purchaseCount}{' '}
                              downloads · ★ {note.averageRating || 'New'}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingNote(note)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. SELLER EARNINGS & PAYOUTS */}
              {activeTab === 'earnings' && earnings && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 tabular-nums">
                    <StatTile label="Total Sales" value={earnings.summary.totalSales} />
                    <StatTile label="Gross Earnings" value={`₹${earnings.summary.grossEarnings}`} />
                    <StatTile
                      label="Commission"
                      value={`₹${earnings.summary.platformCommission}`}
                    />
                    <StatTile label="Net Earnings" value={`₹${earnings.summary.netEarnings}`} />
                    <StatTile
                      label="Available"
                      value={`₹${earnings.summary.availableBalance}`}
                    />
                    <StatTile
                      label="Pending Payouts"
                      value={`₹${earnings.summary.pendingSettlements}`}
                    />
                  </div>

                  {/* Seller Eligibility / KYC Gate */}
                  {earnings.summary.sellerEligibilityStatus !== 'verified' ? (
                    <form
                      onSubmit={handleApplyEligibility}
                      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
                    >
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Seller Eligibility &amp; Payout Verification (Status:{' '}
                        <span className="capitalize text-blue-700">
                          {earnings.summary.sellerEligibilityStatus.replace('_', ' ')}
                        </span>
                        )
                      </h2>
                      <p className="text-xs text-slate-600">
                        Per student safety and payment-provider KYC rules, payouts are unlocked only
                        after verifying seller eligibility and parent/guardian details for minors.
                      </p>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            UPI ID or Guardian Bank Reference *
                          </label>
                          <input
                            type="text"
                            required
                            value={payoutUpi}
                            onChange={(e) => setPayoutUpi(e.target.value)}
                            placeholder="guardian@upi or Bank Ref"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                          />
                        </div>
                        {userAccount?.isMinor && (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Parent / Guardian Full Name *
                              </label>
                              <input
                                type="text"
                                required
                                value={guardianName}
                                onChange={(e) => setGuardianName(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Parent / Guardian Email *
                              </label>
                              <input
                                type="email"
                                required
                                value={guardianEmail}
                                onChange={(e) => setGuardianEmail(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmOrig}
                          onChange={(e) => setConfirmOrig(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          I confirm all notes sold are original and guardian/payment-provider terms
                          are satisfied.
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={earnings.summary.sellerEligibilityStatus === 'pending'}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {earnings.summary.sellerEligibilityStatus === 'pending'
                          ? 'Verification Pending Admin Review'
                          : 'Submit Seller Verification'}
                      </button>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleRequestPayout}
                      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
                    >
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Request Seller Payout (Verified Seller)
                      </h2>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <input
                          type="number"
                          min="100"
                          max={Math.max(100, earnings.summary.availableBalance)}
                          value={payoutAmount}
                          onChange={(e) => setPayoutAmount(e.target.value)}
                          className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm tabular-nums"
                          placeholder="Amount (min ₹100)"
                        />
                        <select
                          value={payoutMethod}
                          onChange={(e) => setPayoutMethod(e.target.value)}
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                        >
                          <option value="UPI">UPI Settlement</option>
                          <option value="Bank Transfer">Bank Transfer (IMPS / NEFT)</option>
                          <option value="Guardian Bank Account">Guardian Verified Bank Account</option>
                        </select>
                        <button
                          type="submit"
                          disabled={earnings.summary.availableBalance < 100}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Withdraw ₹{payoutAmount}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Payout History */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h3 className="font-display text-base font-bold text-slate-900">
                      Payout History ({earnings.payouts.length})
                    </h3>
                    {earnings.payouts.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No payout requests yet.</p>
                    ) : (
                      <div className="mt-3 divide-y divide-slate-100 text-sm tabular-nums">
                        {earnings.payouts.map((po) => (
                          <div key={po.id} className="flex items-center justify-between py-3">
                            <div>
                              <span className="font-semibold text-slate-900">₹{po.amount}</span> ·{' '}
                              {po.payoutMethod} ({po.accountReference})
                              <div className="text-xs text-slate-500">
                                {new Date(po.createdAt).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                            <span className="text-xs font-semibold capitalize text-blue-700">
                              {po.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. MY PURCHASED NOTES */}
              {activeTab === 'purchased' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    My Purchased &amp; Claimed Notes
                  </h2>
                  {purchases.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      You haven&apos;t claimed or purchased any study notes yet.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {purchases.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                        >
                          <div>
                            <button
                              type="button"
                              onClick={() => onNavigate(`/notes/${p.noteId}`)}
                              className="font-display text-base font-semibold text-slate-900 hover:text-blue-700 text-left"
                            >
                              {p.noteTitle}
                            </button>
                            <div className="mt-1 text-xs text-slate-500 tabular-nums">
                              By {p.sellerName} ·{' '}
                              {p.paymentType === 'free' ? 'Free Claim' : `₹${p.amount}`} · Receipt{' '}
                              {p.receiptNumber} · Status: {p.status}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {p.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadAuthenticatedBlob(
                                    `/notes/${p.noteId}/download`,
                                    `${p.noteTitle}.pdf`
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                              >
                                <Download className="h-3.5 w-3.5" />
                                PDF
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                downloadAuthenticatedBlob(
                                  `/payments/receipt/${p.id}`,
                                  `receipt-${p.receiptNumber}.pdf`
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              Receipt
                            </button>
                            {p.paymentType === 'paid' && p.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => setRefundModalPurchase(p)}
                                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                              >
                                Request Refund
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 6. MY WISHLIST */}
              {activeTab === 'wishlist' && (
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Saved Wishlist</h2>
                  {wishlistNotes.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                      Your wishlist is empty. Save notes while browsing to revisit them later.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {wishlistNotes.map((n) => (
                        <NoteCard key={n.id} note={n} onNavigate={onNavigate} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 7 & 8. FOLLOWERS / FOLLOWING */}
              {(activeTab === 'followers' || activeTab === 'following') && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-slate-900 capitalize">
                    My {activeTab}
                  </h2>
                  <div className="mt-4 divide-y divide-slate-100">
                    {(activeTab === 'followers' ? followers : following).length === 0 ? (
                      <p className="text-sm text-slate-500">No connections in this list yet.</p>
                    ) : (
                      (activeTab === 'followers' ? followers : following).map((item) => {
                        const targetUid =
                          activeTab === 'followers' ? item.followerId : item.followingId;
                        const name =
                          activeTab === 'followers' ? item.followerName : item.followingName;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-3 text-sm"
                          >
                            <button
                              type="button"
                              onClick={() => onNavigate(`/profile/${targetUid}`)}
                              className="font-semibold text-slate-900 hover:text-blue-700"
                            >
                              {name}
                            </button>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => onNavigate(`/profile/${targetUid}`)}
                                className="text-xs font-semibold text-blue-600 hover:underline"
                              >
                                View Profile
                              </button>
                              {activeTab === 'following' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiFetch(`/follow/${targetUid}`, { method: 'DELETE' });
                                    await loadDashboard();
                                  }}
                                  className="text-xs font-semibold text-red-600 hover:underline"
                                >
                                  Unfollow
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* 9. FOLLOWING FEED */}
              {activeTab === 'feed' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-slate-900">Following Feed</h2>
                  {feed.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Follow top contributors to see their new uploaded notes and free materials here.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {feed.map((act) => (
                        <div key={act.id} className="flex items-center justify-between gap-4 py-4">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{act.summary}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              <button
                                type="button"
                                onClick={() => onNavigate(`/profile/${act.actorId}`)}
                                className="font-semibold text-violet-700 hover:underline"
                              >
                                @{act.actorUsername}
                              </button>{' '}
                              · {new Date(act.createdAt).toLocaleString('en-IN')}
                            </p>
                          </div>
                          {act.noteId && (
                            <button
                              type="button"
                              onClick={() => onNavigate(`/notes/${act.noteId}`)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-blue-700 shrink-0"
                            >
                              View Note
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 10. BUYER / SELLER CHAT INBOX */}
              {activeTab === 'messages' && (
                <MessagesInbox
                  onNavigate={onNavigate}
                  onUnreadCountChange={setUnreadChatCount}
                />
              )}

              {/* 11. MY REVIEWS */}
              {activeTab === 'reviews' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-slate-900">My Reviews</h2>
                  {myReviews.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      You have not posted any note reviews yet.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {myReviews.map((rev) => (
                        <div key={rev.id} className="py-4 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-amber-600 tabular-nums">
                              ★ {rev.rating} / 5
                            </span>
                            <button
                              type="button"
                              onClick={() => onNavigate(`/notes/${rev.noteId}`)}
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              View Note →
                            </button>
                          </div>
                          <p className="mt-1.5 text-slate-700">{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 11. MY FEEDBACK */}
              {activeTab === 'feedback' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-bold text-slate-900">My Feedback</h2>
                    <button
                      type="button"
                      onClick={() => onNavigate('/feedback')}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Submit New Feedback
                    </button>
                  </div>
                  {myFeedback.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No feedback submitted yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {myFeedback.map((fb) => (
                        <div key={fb.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-blue-700">{fb.category}</span>
                            <span className="text-slate-600">{fb.status}</span>
                          </div>
                          <p className="mt-2 text-slate-700">{fb.message}</p>
                          {fb.adminReply && (
                            <p className="mt-2 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-900">
                              <strong>Admin Reply:</strong> {fb.adminReply}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 12. NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-bold text-slate-900">
                        Notification Center
                      </h2>
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Mark All as Read
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">No notifications yet.</p>
                    ) : (
                      <div className="mt-4 divide-y divide-slate-100">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`flex items-start justify-between gap-4 py-3.5 ${
                              n.isRead ? 'opacity-70' : ''
                            }`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                              <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {new Date(n.createdAt).toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!n.isRead && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkRead(n.id)}
                                  className="text-xs font-semibold text-blue-600 hover:underline"
                                >
                                  Mark read
                                </button>
                              )}
                              {n.linkPath && (
                                <button
                                  type="button"
                                  onClick={() => onNavigate(n.linkPath!)}
                                  className="text-xs font-semibold text-slate-700 hover:underline"
                                >
                                  Open
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {notificationSettings && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        Notification Settings
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                        {[
                          { key: 'newFollowers', label: 'New followers' },
                          { key: 'purchases', label: 'Purchase confirmations' },
                          { key: 'sales', label: 'New note sales' },
                          { key: 'reviews', label: 'New note reviews' },
                          { key: 'feedbackReplies', label: 'Admin feedback replies' },
                          { key: 'followedUploads', label: 'New uploads from followed students' },
                        ].map((pref) => (
                          <label key={pref.key} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(
                                (notificationSettings as unknown as Record<string, boolean>)[
                                  pref.key
                                ]
                              )}
                              onChange={(e) => handleToggleNotifPref(pref.key, e.target.checked)}
                            />
                            <span>{pref.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 13. PAYMENT HISTORY */}
              {activeTab === 'payments' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 overflow-x-auto">
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Payment &amp; Transaction History
                    </h2>
                    {transactions.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">No transactions recorded yet.</p>
                    ) : (
                      <table className="mt-4 w-full text-left text-xs">
                        <thead className="border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="py-2.5 pr-4">Transaction ID</th>
                            <th className="py-2.5 pr-4">Notes</th>
                            <th className="py-2.5 pr-4">Amount</th>
                            <th className="py-2.5 pr-4">Method</th>
                            <th className="py-2.5 pr-4">Date</th>
                            <th className="py-2.5 pr-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 tabular-nums">
                          {transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td className="py-3 pr-4 font-mono">{tx.id.slice(0, 12)}</td>
                              <td className="py-3 pr-4 font-medium text-slate-900">
                                {tx.noteTitle}
                              </td>
                              <td className="py-3 pr-4 font-semibold">
                                ₹{tx.finalPayableAmount}
                              </td>
                              <td className="py-3 pr-4 font-medium uppercase">
                                {tx.paymentMethod === 'paylater' ? 'Pay Later' : tx.paymentMethod}
                              </td>
                              <td className="py-3 pr-4">
                                {new Date(tx.createdAt).toLocaleDateString('en-IN')}
                              </td>
                              <td className="py-3 pr-4 font-semibold capitalize">{tx.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {refunds.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        My Refund Requests
                      </h3>
                      <div className="mt-3 divide-y divide-slate-100 text-sm">
                        {refunds.map((rf) => (
                          <div key={rf.id} className="flex items-center justify-between py-3">
                            <div>
                              <span className="font-semibold">{rf.noteTitle}</span> · ₹{rf.amount}
                              <div className="text-xs text-slate-500">{rf.reason}</div>
                            </div>
                            <span className="text-xs font-semibold capitalize text-violet-700">
                              {rf.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 14. ACCOUNT SETTINGS */}
              {activeTab === 'settings' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Account &amp; Privacy Settings
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Account status:{' '}
                      <span className="font-semibold capitalize">{userAccount?.status}</span> ·
                      Email Verified:{' '}
                      <span className="font-semibold">
                        {firebaseUser.emailVerified ? 'Yes' : 'Pending'}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => onNavigate('/onboarding')}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800"
                    >
                      Switch / Combine Buyer &amp; Seller Roles
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch('/account/request-deletion', { method: 'POST' });
                        setNotice('Account deletion request recorded for privacy compliance.');
                        await refreshSession();
                      }}
                      className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Request Account Deletion
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        onNavigate('/');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Secure Logout
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Edit Note Modal */}
      {editingNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveNoteEdit}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">Edit Study Notes</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={editingNote.title}
                onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chapter</label>
              <input
                type="text"
                required
                value={editingNote.chapterName}
                onChange={(e) => setEditingNote({ ...editingNote, chapterName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Price (₹, set 0 for Free)
              </label>
              <input
                type="number"
                min="0"
                value={editingNote.price}
                onChange={(e) =>
                  setEditingNote({ ...editingNote, price: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={editingNote.description}
                onChange={(e) => setEditingNote({ ...editingNote, description: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Refund Request Modal */}
      {refundModalPurchase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitRefund}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display text-lg font-bold text-slate-900">Request Refund</h3>
            <p className="text-xs text-slate-600">
              {refundModalPurchase.noteTitle} · Amount ₹{refundModalPurchase.amount}
            </p>
            <textarea
              required
              minLength={5}
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explain why you are requesting a refund..."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundModalPurchase(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
