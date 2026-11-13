import React, { useState, useEffect } from 'react';
import { BookOpen, IndianRupee, Compass, Check, Upload, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiFetch, uploadFormWithProgress } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { AgeGroup, EducationBoard, StudentRole } from '../types/marketplace';

interface OnboardingPageProps {
  onNavigate: (path: string) => void;
}

const ROLE_OPTIONS: {
  id: StudentRole;
  title: string;
  subtitle: string;
  bullets: string[];
  icon: typeof BookOpen;
}[] = [
  {
    id: 'buyer',
    title: 'BUYER',
    subtitle: 'Students who want to purchase & learn from study notes.',
    bullets: [
      'Browse Notes across Class 6–12',
      'Purchase Notes & Download PDFs',
      'Rate, Review & Save to Wishlist',
    ],
    icon: BookOpen,
  },
  {
    id: 'seller',
    title: 'SELLER',
    subtitle: 'Students who want to share and sell original study materials.',
    bullets: [
      'Upload Original PDF Notes & Set Prices',
      'Track Sales & Manage Earnings',
      'View Seller Analytics Dashboard',
    ],
    icon: IndianRupee,
  },
  {
    id: 'explorer',
    title: 'EXPLORER',
    subtitle: 'Students who want to explore free materials & community.',
    bullets: [
      'Explore Notes & Free Resources',
      'Discover Popular Subjects',
      'Follow Top Contributors',
    ],
    icon: Compass,
  },
];

export function OnboardingPage({ onNavigate }: OnboardingPageProps) {
  const { firebaseUser, userAccount, profile, refreshSession, openAuthModal } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || firebaseUser?.displayName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [classLevel, setClassLevel] = useState<number>(profile?.classLevel || 10);
  const [schoolName, setSchoolName] = useState(profile?.schoolName || '');
  const [board, setBoard] = useState<EducationBoard>(profile?.board || 'CBSE');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || firebaseUser?.photoURL || '');
  const [roles, setRoles] = useState<StudentRole[]>(profile?.roles || ['buyer', 'explorer']);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(userAccount?.ageGroup || '13_to_17');
  const [parentGuardianName, setParentGuardianName] = useState(userAccount?.parentGuardianName || '');
  const [parentGuardianEmail, setParentGuardianEmail] = useState(userAccount?.parentGuardianEmail || '');
  const [parentGuardianConsent, setParentGuardianConsent] = useState<boolean>(
    userAccount?.parentGuardianConsent || false
  );

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setUsername(profile.username);
      setClassLevel(profile.classLevel);
      setSchoolName(profile.schoolName || '');
      setBoard(profile.board);
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatarUrl || '');
      setRoles(profile.roles || ['explorer']);
    } else if (firebaseUser?.displayName && !fullName) {
      setFullName(firebaseUser.displayName);
    }
  }, [profile, firebaseUser, fullName]);

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Sign in to Complete Student Onboarding
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Create an account or sign in first so we can fetch your verified email address.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('signup')}
          className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Sign Up / Sign In
        </button>
      </div>
    );
  }

  const toggleRole = (role: StudentRole) => {
    setRoles((prev) => {
      if (prev.includes(role)) {
        return prev.length > 1 ? prev.filter((r) => r !== role) : prev;
      }
      return [...prev, role];
    });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await uploadFormWithProgress<{ url: string }>('/uploads/image', form, () => {});
      setAvatarUrl(res.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to upload profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await apiFetch('/profile/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          username,
          classLevel,
          schoolName,
          board,
          bio,
          avatarUrl,
          roles,
          ageGroup,
          parentGuardianName,
          parentGuardianEmail,
          parentGuardianConsent: ageGroup === '18_plus' ? true : parentGuardianConsent,
        }),
      });
      await refreshSession();
      onNavigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save student profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs font-semibold tracking-wide text-violet-700">
          Student Information &amp; Role Setup
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">
          Complete Your NOTE XCHANGE Profile
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Personalize your Class 6–12 learning space and choose how you want to participate. You can
          combine Buyer and Seller roles or update them anytime.
        </p>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {/* Student Details Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="font-display text-lg font-bold text-slate-900">Student Information</h2>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-blue-50 font-display text-xl font-bold text-blue-700">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile preview"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                (fullName || 'NX').slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                {uploadingAvatar ? 'Uploading...' : 'Upload Profile Picture'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
              <p className="mt-1.5 text-xs text-slate-500">PNG, JPG, or WebP up to 5MB.</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Aarav Sharma"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                minLength={3}
                pattern="^[a-zA-Z0-9_]+$"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="aarav_notes10"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Verified Email (Auto-fetched)
              </label>
              <input
                type="email"
                readOnly
                value={firebaseUser.email || ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class (6–12) *</label>
              <select
                value={classLevel}
                onChange={(e) => setClassLevel(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              >
                {[6, 7, 8, 9, 10, 11, 12].map((c) => (
                  <option key={c} value={c}>
                    Class {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Education Board *
              </label>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value as EducationBoard)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="CBSE">CBSE</option>
                <option value="ICSE">ICSE</option>
                <option value="State Board">State Board</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                School Name (Optional)
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Delhi Public School"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Short Bio</label>
              <textarea
                rows={3}
                maxLength={400}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your favorite subjects, exam goals, or note-taking style..."
                className="w-full rounded-xl border border-slate-300 p-3.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Age Safeguards & Guardian Consent (Part 18) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Student Age Safeguard &amp; Guardian Consent
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Because NOTE XCHANGE serves Class 6–12 students, students under 18 require parent or
            guardian acknowledgment. Payouts to minors require verified guardian &amp; KYC approval.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { id: 'under_13', label: 'Under 13 years (Class 6–7)' },
              { id: '13_to_17', label: '13 to 17 years (Class 8–12)' },
              { id: '18_plus', label: '18+ years' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm ${
                  ageGroup === opt.id
                    ? 'border-blue-600 bg-blue-50/40 font-semibold text-slate-900'
                    : 'border-slate-200 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="ageGroup"
                  checked={ageGroup === opt.id}
                  onChange={() => setAgeGroup(opt.id as AgeGroup)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {ageGroup !== '18_plus' && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent / Guardian Name *
                </label>
                <input
                  type="text"
                  required
                  value={parentGuardianName}
                  onChange={(e) => setParentGuardianName(e.target.value)}
                  placeholder="Parent or guardian full name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent / Guardian Email *
                </label>
                <input
                  type="email"
                  required
                  value={parentGuardianEmail}
                  onChange={(e) => setParentGuardianEmail(e.target.value)}
                  placeholder="guardian@example.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                />
              </div>
              <label className="sm:col-span-2 flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={parentGuardianConsent}
                  onChange={(e) => setParentGuardianConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm that my parent or legal guardian has reviewed and permitted my use of
                  NOTE XCHANGE for educational study note sharing and supervised transactions.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* 3 Interactive Student Role Cards */}
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Select Your Student Role(s)
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose one or combine multiple roles (e.g., Buyer + Seller).
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROLE_OPTIONS.map((role) => {
              const selected = roles.includes(role.id);
              const Icon = role.icon;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={`flex flex-col justify-between rounded-2xl border p-6 text-left transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </div>

                    <h3 className="mt-4 font-display text-base font-bold text-slate-900">
                      {role.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{role.subtitle}</p>

                    <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
                      {role.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold">·</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          {profile?.onboardingCompleted && (
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-blue-600 px-7 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {busy ? 'Saving Profile...' : 'Save & Continue to Dashboard'}
          </button>
        </div>
      </form>
    </div>
  );
}
