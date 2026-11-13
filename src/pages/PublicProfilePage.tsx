import { useEffect, useState, useCallback } from 'react';
import { Award, Star, UserCheck, UserPlus, Flag } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { NoteCard } from '../components/NoteCard';
import type { StudentProfile, StudyNote, FollowerRecord } from '../types/marketplace';

interface PublicProfilePageProps {
  targetUid: string;
  onNavigate: (path: string) => void;
}

export function PublicProfilePage({ targetUid, onNavigate }: PublicProfilePageProps) {
  const { firebaseUser, openAuthModal } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [followers, setFollowers] = useState<FollowerRecord[]>([]);
  const [following, setFollowing] = useState<FollowerRecord[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{
        profile: StudentProfile;
        notes: StudyNote[];
        followers: FollowerRecord[];
        following: FollowerRecord[];
        isFollowing: boolean;
      }>(`/profiles/${targetUid}`);
      setProfile(data.profile);
      setNotes(data.notes || []);
      setFollowers(data.followers || []);
      setFollowing(data.following || []);
      setIsFollowing(data.isFollowing);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load student profile.');
    } finally {
      setLoading(false);
    }
  }, [targetUid]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleToggleFollow = async () => {
    if (!firebaseUser) {
      openAuthModal('login');
      return;
    }
    try {
      if (isFollowing) {
        await apiFetch(`/follow/${targetUid}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/follow/${targetUid}`, { method: 'POST' });
      }
      await loadProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to update follow status.');
    }
  };

  const handleReportUser = async () => {
    if (!firebaseUser || !profile) {
      openAuthModal('login');
      return;
    }
    await apiFetch('/reports', {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'user',
        targetId: profile.uid,
        targetLabel: `${profile.fullName} (@${profile.username})`,
        reason: 'Account review requested',
        details: 'Reported from public profile page.',
      }),
    });
    setError('Report submitted for moderation review.');
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Student Profile Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => onNavigate('/contributors')}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          View Contributors
        </button>
      </div>
    );
  }

  const isOwnProfile = firebaseUser?.uid === profile.uid;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {error && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-800">
          {error}
        </div>
      )}

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-blue-100 font-display text-2xl font-bold text-blue-700">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                profile.fullName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                {profile.fullName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                <span className="text-slate-700">@{profile.username}</span>
                <span aria-hidden="true">·</span>
                <span>Class {profile.classLevel}</span>
                <span aria-hidden="true">·</span>
                <span>{profile.board}</span>
                {profile.schoolName && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{profile.schoolName}</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-violet-700 capitalize">
                Roles: {profile.roles.join(' · ')}
              </p>
              {profile.bio && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {profile.uid === 'cbse_ncert_library' ? (
              <span className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
                Open-Access CBSE Library
              </span>
            ) : isOwnProfile ? (
              <button
                type="button"
                onClick={() => onNavigate('/onboarding')}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                    isFollowing
                      ? 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Follow
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReportUser}
                  aria-label="Report user"
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:text-red-600"
                >
                  <Flag className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-5 tabular-nums">
          <button
            type="button"
            onClick={() => setListModal('followers')}
            className="text-left hover:text-blue-700"
          >
            <div className="font-display text-xl font-bold text-slate-900">
              {profile.followersCount}
            </div>
            <div className="text-xs text-slate-500 underline decoration-dotted">Followers</div>
          </button>
          <button
            type="button"
            onClick={() => setListModal('following')}
            className="text-left hover:text-blue-700"
          >
            <div className="font-display text-xl font-bold text-slate-900">
              {profile.followingCount}
            </div>
            <div className="text-xs text-slate-500 underline decoration-dotted">Following</div>
          </button>
          <div>
            <div className="font-display text-xl font-bold text-slate-900">
              {profile.uploadedNotesCount}
            </div>
            <div className="text-xs text-slate-500">Uploaded Notes</div>
          </div>
          <div>
            <div className="flex items-center gap-1 font-display text-xl font-bold text-slate-900">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {profile.averageRating > 0 ? profile.averageRating.toFixed(1) : 'New'}
            </div>
            <div className="text-xs text-slate-500">Average Rating</div>
          </div>
          <div>
            <div className="font-display text-xl font-bold text-violet-700">
              {profile.contributionPoints}
            </div>
            <div className="text-xs text-slate-500">Contribution Points</div>
          </div>
        </div>

        {profile.badges?.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs font-semibold text-blue-700">
            <Award className="h-4 w-4 text-violet-700" />
            <span>Earned Badges:</span>
            <span className="text-slate-700">{profile.badges.join(' · ')}</span>
          </div>
        )}
      </div>

      {/* Uploaded Notes */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-bold text-slate-900">
          Study Notes by {profile.fullName}
        </h2>
        {notes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
            No published study notes from this student yet.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>

      {/* Followers / Following Modal */}
      {listModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold capitalize text-slate-900">
                {listModal}
              </h3>
              <button
                type="button"
                onClick={() => setListModal(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {(listModal === 'followers' ? followers : following).length === 0 ? (
                <p className="text-sm text-slate-500">No students in this list yet.</p>
              ) : (
                (listModal === 'followers' ? followers : following).map((item) => {
                  const uid = listModal === 'followers' ? item.followerId : item.followingId;
                  const name = listModal === 'followers' ? item.followerName : item.followingName;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setListModal(null);
                        onNavigate(`/profile/${uid}`);
                      }}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      <span>{name}</span>
                      <span className="text-xs text-blue-600">View Profile →</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
