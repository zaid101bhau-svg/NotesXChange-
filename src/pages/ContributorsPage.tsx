import { useEffect, useState } from 'react';
import { Award, Star, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { StudentProfile } from '../types/marketplace';

interface ContributorsPageProps {
  onNavigate: (path: string) => void;
}

export function ContributorsPage({ onNavigate }: ContributorsPageProps) {
  const [contributors, setContributors] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ contributors: StudentProfile[] }>('/contributors')
      .then((res) => setContributors(res.contributors || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">
          Top Contributors &amp; Leaderboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ranked by note quality, verified purchases, average student ratings, and contribution
          points.
        </p>
      </div>

      {/* Achievement Badges Legend */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { name: 'Rising Contributor', desc: 'Published first approved study note.' },
          { name: 'Top Contributor', desc: '5+ approved notes or 150+ contribution points.' },
          { name: 'Excellent Notes', desc: '4.5+ average rating with 3+ verified downloads.' },
          { name: 'Community Favourite', desc: '5+ followers or 10+ student downloads.' },
        ].map((b) => (
          <div key={b.name} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
              <Award className="h-4 w-4 text-violet-700" />
              {b.name}
            </div>
            <p className="mt-1 text-xs text-slate-600">{b.desc}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ) : contributors.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-blue-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            Leaderboard Updating
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Complete onboarding and share original study notes to earn contribution points and
            badges.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Rank</th>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Class &amp; Board</th>
                <th className="px-5 py-3.5 text-right">Notes</th>
                <th className="px-5 py-3.5 text-right">Downloads</th>
                <th className="px-5 py-3.5 text-right">Avg Rating</th>
                <th className="px-5 py-3.5 text-right">Points</th>
                <th className="px-5 py-3.5">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {contributors.map((student, index) => (
                <tr
                  key={student.uid}
                  onClick={() => onNavigate(`/profile/${student.uid}`)}
                  className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                >
                  <td className="px-5 py-4 font-mono font-bold text-violet-700">#{index + 1}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{student.fullName}</div>
                    <div className="text-xs text-slate-500">@{student.username}</div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-600">
                    Class {student.classLevel} · {student.board}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-800">
                    {student.uploadedNotesCount}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-800">
                    {student.totalSalesCount}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-800">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {student.averageRating > 0 ? student.averageRating.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-blue-700">
                    {student.contributionPoints}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-600">
                    {student.badges?.length ? student.badges.join(' · ') : 'Member'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
