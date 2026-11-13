import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Users,
  FileText,
  IndianRupee,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type {
  UserAccount,
  StudentProfile,
  StudyNote,
  CategoryItem,
  TransactionRecord,
  RefundRequestRecord,
  SellerPayoutRecord,
  FeedbackRecord,
  ReportRecord,
  ReviewRecord,
} from '../types/marketplace';

interface AdminOverview {
  analytics: {
    totalStudents: number;
    totalBuyers: number;
    totalSellers: number;
    totalNotes: number;
    approvedNotes: number;
    pendingNotes: number;
    totalPurchases: number;
    grossVolume: number;
    platformRevenue: number;
    popularSubjects: { name: string; count: number }[];
    topContributors: StudentProfile[];
  };
  students: (UserAccount & { profile: StudentProfile | null })[];
  notes: StudyNote[];
  categories: CategoryItem[];
  transactions: TransactionRecord[];
  refunds: RefundRequestRecord[];
  payouts: SellerPayoutRecord[];
  feedback: FeedbackRecord[];
  reports: ReportRecord[];
  reviews: ReviewRecord[];
  commissionRatePercent: number;
}

export function AdminPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { firebaseUser, isAdmin } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<'analytics' | 'notes' | 'students' | 'payments' | 'community'>(
    'analytics'
  );
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Inline forms
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [commissionInput, setCommissionInput] = useState('15');
  const [feedbackCatFilter, setFeedbackCatFilter] = useState('All');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const loadAdmin = useCallback(async () => {
    if (!firebaseUser || !isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<AdminOverview>('/admin/overview');
      setData(res);
      setCommissionInput(String(res.commissionRatePercent ?? 15));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, isAdmin]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  if (!firebaseUser || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Shield className="mx-auto h-10 w-10 text-violet-700" />
        <h1 className="mt-3 font-display text-2xl font-bold text-slate-900">
          Administrator Access Required
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Only authorized platform administrators can access moderation, payouts, and analytics.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Return Home
        </button>
      </div>
    );
  }

  const handleModerateNote = async (noteId: string, status: 'approved' | 'rejected' | 'removed') => {
    setError('');
    try {
      await apiFetch(`/admin/notes/${noteId}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Note status updated to ${status}.`);
      await loadAdmin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to moderate note.');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName, description: newCategoryDesc }),
      });
      setNewCategoryName('');
      setNewCategoryDesc('');
      setNotice('Category added.');
      await loadAdmin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add category.');
    }
  };

  const handleStudentStatus = async (uid: string, status: 'active' | 'suspended') => {
    await apiFetch(`/admin/students/${uid}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setNotice(`Student account marked ${status}.`);
    await loadAdmin();
  };

  const handleSellerEligibility = async (
    uid: string,
    sellerEligibilityStatus: 'verified' | 'rejected'
  ) => {
    await apiFetch(`/admin/students/${uid}/seller-eligibility`, {
      method: 'PATCH',
      body: JSON.stringify({ sellerEligibilityStatus }),
    });
    setNotice(`Seller eligibility updated to ${sellerEligibilityStatus}.`);
    await loadAdmin();
  };

  const handleUpdateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/admin/settings/commission', {
      method: 'PUT',
      body: JSON.stringify({ commissionRatePercent: Number(commissionInput) }),
    });
    setNotice('Platform commission rate updated.');
    await loadAdmin();
  };

  const handleRefundAction = async (
    id: string,
    status: 'approved' | 'rejected' | 'processed'
  ) => {
    setError('');
    try {
      await apiFetch(`/admin/refunds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Refund marked ${status}.`);
      await loadAdmin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Refund update failed.');
    }
  };

  const handlePayoutAction = async (
    id: string,
    status: 'approved' | 'completed' | 'rejected'
  ) => {
    await apiFetch(`/admin/payouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setNotice(`Payout marked ${status}.`);
    await loadAdmin();
  };

  const handleFeedbackUpdate = async (
    id: string,
    status: 'Pending' | 'Reviewed' | 'Resolved'
  ) => {
    await apiFetch(`/admin/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminReply: replyDrafts[id] }),
    });
    setNotice('Feedback response saved & student notified.');
    await loadAdmin();
  };

  const handleDeleteFeedback = async (id: string) => {
    await apiFetch(`/admin/feedback/${id}`, { method: 'DELETE' });
    setNotice('Feedback entry removed.');
    await loadAdmin();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-violet-700">NOTE XCHANGE Governance</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Admin Panel</h1>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
          {[
            { id: 'analytics', label: 'Analytics' },
            { id: 'notes', label: 'Notes & Categories' },
            { id: 'students', label: 'Students & KYC' },
            { id: 'payments', label: 'Payments & Refunds' },
            { id: 'community', label: 'Feedback & Reports' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
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

      {loading || !data ? (
        <div className="mt-8 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ) : (
        <div className="mt-8 space-y-8">
          {/* 1. ANALYTICS */}
          {tab === 'analytics' && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 tabular-nums">
                <MetricCard label="Total Students" value={data.analytics.totalStudents} icon={Users} />
                <MetricCard label="Buyers" value={data.analytics.totalBuyers} icon={Users} />
                <MetricCard label="Sellers" value={data.analytics.totalSellers} icon={Users} />
                <MetricCard label="Total Notes" value={data.analytics.totalNotes} icon={FileText} />
                <MetricCard label="Total Purchases" value={data.analytics.totalPurchases} icon={FileText} />
                <MetricCard
                  label="Platform Revenue"
                  value={`₹${data.analytics.platformRevenue}`}
                  icon={IndianRupee}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Popular Subjects
                  </h2>
                  {data.analytics.popularSubjects.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No approved notes yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3 tabular-nums">
                      {data.analytics.popularSubjects.map((s) => (
                        <div key={s.name} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span className="font-mono font-semibold text-blue-700">
                            {s.count} notes
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Top Contributors
                  </h2>
                  {data.analytics.topContributors.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No contributors yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3 tabular-nums">
                      {data.analytics.topContributors.map((c) => (
                        <div key={c.uid} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-800">
                            {c.fullName} (@{c.username})
                          </span>
                          <span className="font-mono text-violet-700">
                            {c.contributionPoints} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 2. NOTES MODERATION & CATEGORIES */}
          {tab === 'notes' && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Study Notes Moderation Queue ({data.notes.length})
                </h2>
                <div className="mt-4 divide-y divide-slate-100">
                  {data.notes.length === 0 ? (
                    <p className="text-sm text-slate-500">No notes uploaded yet.</p>
                  ) : (
                    data.notes.map((n) => (
                      <div
                        key={n.id}
                        className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-500">
                            Class {n.classLevel} · {n.subject} · {n.board} ·{' '}
                            <span className="font-semibold capitalize text-blue-700">
                              {n.status}
                            </span>
                          </div>
                          <p className="font-display text-base font-semibold text-slate-900">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            By {n.sellerName} (@{n.sellerUsername}) ·{' '}
                            {n.isFree ? 'Free' : `₹${n.price}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/api/notes/${n.id}/preview`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Preview PDF
                          </a>
                          <button
                            type="button"
                            onClick={() => handleModerateNote(n.id, 'approved')}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModerateNote(n.id, 'rejected')}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModerateNote(n.id, 'removed')}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Remove Copyrighted
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">Manage Categories</h2>
                <form onSubmit={handleAddCategory} className="mt-4 flex flex-wrap gap-3">
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={newCategoryDesc}
                    onChange={(e) => setNewCategoryDesc(e.target.value)}
                    placeholder="Short description"
                    className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Add Category
                  </button>
                </form>
                <div className="mt-4 divide-y divide-slate-100 text-sm">
                  {data.categories.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <span className="font-semibold text-slate-900">{c.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{c.description}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/admin/categories/${c.id}`, { method: 'DELETE' });
                          await loadAdmin();
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. STUDENT MANAGEMENT & SELLER KYC */}
          {tab === 'students' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 overflow-x-auto">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Students &amp; Seller Payout Eligibility ({data.students.length})
              </h2>
              <table className="mt-4 w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Student</th>
                    <th className="py-2.5 pr-4">Class / Board</th>
                    <th className="py-2.5 pr-4">Minor / Guardian</th>
                    <th className="py-2.5 pr-4">Account Status</th>
                    <th className="py-2.5 pr-4">Seller KYC</th>
                    <th className="py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((st) => (
                    <tr key={st.uid}>
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-slate-900">
                          {st.profile?.fullName || 'Onboarding Pending'}
                        </div>
                        <div className="text-slate-500">{st.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        {st.profile ? `Class ${st.profile.classLevel} · ${st.profile.board}` : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        {st.isMinor
                          ? `Minor (${st.parentGuardianEmail || 'No guardian email'})`
                          : '18+'}
                      </td>
                      <td className="py-3 pr-4 font-semibold capitalize">{st.status}</td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold capitalize text-blue-700">
                          {st.sellerEligibilityStatus}
                        </span>
                        {st.payoutUpiOrBankRef && (
                          <div className="text-[11px] text-slate-500">{st.payoutUpiOrBankRef}</div>
                        )}
                      </td>
                      <td className="py-3 space-x-2 whitespace-nowrap">
                        {st.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleStudentStatus(st.uid, 'suspended')}
                            className="rounded-lg border border-red-200 px-2.5 py-1 font-semibold text-red-600"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStudentStatus(st.uid, 'active')}
                            className="rounded-lg border border-emerald-200 px-2.5 py-1 font-semibold text-emerald-700"
                          >
                            Reactivate
                          </button>
                        )}
                        {st.sellerEligibilityStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSellerEligibility(st.uid, 'verified')}
                              className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white"
                            >
                              Verify Seller
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSellerEligibility(st.uid, 'rejected')}
                              className="rounded-lg bg-slate-200 px-2.5 py-1 font-semibold text-slate-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. PAYMENTS, COMMISSION, REFUNDS & PAYOUTS */}
          {tab === 'payments' && (
            <div className="space-y-8">
              <form
                onSubmit={handleUpdateCommission}
                className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Platform Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm tabular-nums"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white"
                >
                  Save Commission Rate
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Refund Requests ({data.refunds.length})
                </h2>
                <div className="mt-4 divide-y divide-slate-100 text-sm">
                  {data.refunds.length === 0 ? (
                    <p className="text-slate-500">No refund requests.</p>
                  ) : (
                    data.refunds.map((rf) => (
                      <div
                        key={rf.id}
                        className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{rf.noteTitle}</span> · ₹
                          {rf.amount} ·{' '}
                          <span className="font-semibold capitalize text-violet-700">
                            {rf.status}
                          </span>
                          <p className="text-xs text-slate-600">{rf.reason}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleRefundAction(rf.id, 'approved')}
                            className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefundAction(rf.id, 'processed')}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Process Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefundAction(rf.id, 'rejected')}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Seller Payout Requests ({data.payouts.length})
                </h2>
                <div className="mt-4 divide-y divide-slate-100 text-sm">
                  {data.payouts.length === 0 ? (
                    <p className="text-slate-500">No seller payout requests.</p>
                  ) : (
                    data.payouts.map((po) => (
                      <div
                        key={po.id}
                        className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{po.sellerName}</span> · ₹
                          {po.amount} ({po.payoutMethod} · {po.accountReference}) ·{' '}
                          <span className="font-semibold capitalize text-blue-700">{po.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handlePayoutAction(po.id, 'approved')}
                            className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePayoutAction(po.id, 'completed')}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Mark Completed
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePayoutAction(po.id, 'rejected')}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. COMMUNITY: FEEDBACK, REPORTS & REVIEW MODERATION */}
          {tab === 'community' && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                    <h2 className="font-display text-lg font-bold text-slate-900">
                      Student Feedback Management
                    </h2>
                  </div>
                  <select
                    value={feedbackCatFilter}
                    onChange={(e) => setFeedbackCatFilter(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="All">All Categories</option>
                    <option value="Website Experience">Website Experience</option>
                    <option value="Buying Experience">Buying Experience</option>
                    <option value="Selling Experience">Selling Experience</option>
                    <option value="Notes Quality">Notes Quality</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="mt-4 space-y-4">
                  {data.feedback
                    .filter((f) => feedbackCatFilter === 'All' || f.category === feedbackCatFilter)
                    .map((fb) => (
                      <div key={fb.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-900">
                            {fb.studentName} · {fb.category} · ★ {fb.rating}/5
                          </span>
                          <span className="font-semibold text-blue-700">{fb.status}</span>
                        </div>
                        <p className="mt-2 text-slate-700">{fb.message}</p>
                        {fb.screenshotUrl && (
                          <a
                            href={fb.screenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline"
                          >
                            View Attached Screenshot →
                          </a>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={replyDrafts[fb.id] ?? fb.adminReply ?? ''}
                            onChange={(e) =>
                              setReplyDrafts({ ...replyDrafts, [fb.id]: e.target.value })
                            }
                            placeholder="Write reply to student..."
                            className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleFeedbackUpdate(fb.id, 'Reviewed')}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedbackUpdate(fb.id, 'Resolved')}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            Reply &amp; Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFeedback(fb.id)}
                            aria-label="Remove feedback"
                            className="rounded-lg border border-red-200 p-1.5 text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Abuse &amp; Copyright Reports ({data.reports.length})
                </h2>
                <div className="mt-4 divide-y divide-slate-100 text-sm">
                  {data.reports.length === 0 ? (
                    <p className="text-slate-500">No reports filed.</p>
                  ) : (
                    data.reports.map((rp) => (
                      <div
                        key={rp.id}
                        className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            [{rp.targetType.toUpperCase()}] {rp.targetLabel} ·{' '}
                            <span className="text-violet-700 capitalize">{rp.status}</span>
                          </div>
                          <p className="text-xs text-slate-600">
                            {rp.reason} — {rp.details}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/admin/reports/${rp.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  status: 'resolved',
                                  hideTargetReview: rp.targetType === 'review',
                                }),
                              });
                              await loadAdmin();
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/admin/reports/${rp.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'dismissed' }),
                              });
                              await loadAdmin();
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
