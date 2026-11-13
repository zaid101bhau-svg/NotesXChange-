import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Star, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch, uploadFormWithProgress } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { FeedbackCategory, FeedbackRecord } from '../types/marketplace';

const CATEGORIES: FeedbackCategory[] = [
  'Website Experience',
  'Buying Experience',
  'Selling Experience',
  'Notes Quality',
  'Bug Report',
  'Feature Request',
  'Other',
];

export function FeedbackPage() {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const [studentName, setStudentName] = useState(profile?.fullName || '');
  const [category, setCategory] = useState<FeedbackCategory>('Website Experience');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [myFeedback, setMyFeedback] = useState<FeedbackRecord[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile?.fullName && !studentName) {
      setStudentName(profile.fullName);
    }
  }, [profile, studentName]);

  const loadMyFeedback = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const res = await apiFetch<{ feedback: FeedbackRecord[] }>('/feedback/my');
      setMyFeedback(res.feedback || []);
    } catch {
      // ignore
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadMyFeedback();
  }, [loadMyFeedback]);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await uploadFormWithProgress<{ url: string }>('/uploads/image', form, () => {});
      setScreenshotUrl(res.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to upload screenshot.');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      openAuthModal('login');
      return;
    }
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          studentName: studentName.trim() || profile?.fullName || 'Student',
          category,
          rating,
          message,
          screenshotUrl,
          isAnonymous,
        }),
      });
      setMessage('');
      setScreenshotUrl('');
      setSuccess('Your feedback has been submitted. Our admin team will review it shortly.');
      await loadMyFeedback();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to submit feedback.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">We Value Your Feedback!</h1>
        <p className="mt-1 text-sm text-slate-600">
          Help us improve NOTE XCHANGE for Class 6–12 students. Report bugs, request features, or
          share your buying and selling experience.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7"
        >
          <h2 className="font-display text-lg font-bold text-slate-900">Submit Feedback</h2>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Student Name</label>
            <input
              type="text"
              disabled={isAnonymous}
              value={isAnonymous ? 'Anonymous Student' : studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Feedback Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Overall Experience Rating
              </label>
              <div className="flex items-center gap-1 pt-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    aria-label={`Rate ${s} stars`}
                    className="p-0.5"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Feedback Message *
            </label>
            <textarea
              required
              minLength={5}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your experience, suggestion, or issue in detail..."
              className="w-full rounded-xl border border-slate-300 p-3.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              {uploadingImg
                ? 'Uploading...'
                : screenshotUrl
                  ? 'Screenshot Attached'
                  : 'Attach Optional Screenshot'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleScreenshotUpload}
                className="hidden"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              Submit anonymously
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {firebaseUser ? (busy ? 'Submitting...' : 'Submit Feedback') : 'Sign In to Submit Feedback'}
          </button>
        </form>

        {/* My Feedback History */}
        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-violet-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">My Feedback</h2>
            </div>

            {!firebaseUser ? (
              <p className="mt-3 text-sm text-slate-600">
                Sign in to view your submitted feedback, review status, and read administrator
                replies.
              </p>
            ) : myFeedback.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                You haven&apos;t submitted any feedback yet.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {myFeedback.map((fb) => (
                  <div key={fb.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-blue-700">{fb.category}</span>
                      <span
                        className={`font-semibold ${
                          fb.status === 'Resolved'
                            ? 'text-emerald-700'
                            : fb.status === 'Reviewed'
                              ? 'text-violet-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {fb.status}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-700">{fb.message}</p>
                    <div className="mt-2 text-xs text-slate-500 tabular-nums">
                      Rating: {fb.rating}/5 · {new Date(fb.createdAt).toLocaleDateString('en-IN')}
                    </div>
                    {fb.adminReply && (
                      <div className="mt-3 rounded-lg bg-blue-50/70 p-3 text-xs text-slate-800">
                        <span className="font-semibold text-blue-800">Admin Reply: </span>
                        {fb.adminReply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
