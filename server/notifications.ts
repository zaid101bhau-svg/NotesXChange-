import { fsSetDoc, newDocId } from './firestoreRest.ts';

export type NotificationPrefKey =
  | 'newFollowers'
  | 'purchases'
  | 'sales'
  | 'reviews'
  | 'feedbackReplies'
  | 'followedUploads';

export async function createNotification(params: {
  userId: string;
  type: string;
  prefKey?: NotificationPrefKey;
  title: string;
  message: string;
  linkPath?: string;
  token?: string;
}) {
  try {
    const id = newDocId();
    await fsSetDoc(
      'notifications',
      id,
      {
        id,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkPath: params.linkPath || '/dashboard',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      params.token
    );
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export function computeBadges(stats: {
  uploadedNotesCount: number;
  totalSalesCount: number;
  averageRating: number;
  followersCount: number;
  contributionPoints: number;
}): string[] {
  const badges: string[] = [];
  if (stats.uploadedNotesCount >= 1) badges.push('Rising Contributor');
  if (stats.uploadedNotesCount >= 5 || stats.contributionPoints >= 150) badges.push('Top Contributor');
  if (stats.averageRating >= 4.5 && stats.totalSalesCount >= 3) badges.push('Excellent Notes');
  if (stats.followersCount >= 5 || stats.totalSalesCount >= 10) badges.push('Community Favourite');
  return badges;
}
