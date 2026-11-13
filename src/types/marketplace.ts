export type EducationBoard = 'CBSE' | 'ICSE' | 'State Board' | 'Other';
export type StudentRole = 'buyer' | 'seller' | 'explorer';
export type AgeGroup = 'under_13' | '13_to_17' | '18_plus';
export type AccountStatus = 'active' | 'suspended' | 'deletion_requested';
export type SellerEligibilityStatus = 'not_applied' | 'pending' | 'verified' | 'rejected';
export type NoteStatus = 'pending' | 'approved' | 'rejected' | 'removed';
export type FeedbackCategory =
  | 'Website Experience'
  | 'Buying Experience'
  | 'Selling Experience'
  | 'Notes Quality'
  | 'Bug Report'
  | 'Feature Request'
  | 'Other';
export type FeedbackStatus = 'Pending' | 'Reviewed' | 'Resolved';

export interface UserAccount {
  uid: string;
  email: string;
  emailVerified: boolean;
  status: AccountStatus;
  ageGroup: AgeGroup;
  isMinor: boolean;
  parentGuardianName?: string;
  parentGuardianEmail?: string;
  parentGuardianConsent: boolean;
  sellerEligibilityStatus: SellerEligibilityStatus;
  payoutUpiOrBankRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfile {
  uid: string;
  fullName: string;
  username: string;
  classLevel: number;
  schoolName?: string;
  board: EducationBoard;
  avatarUrl?: string;
  bio?: string;
  roles: StudentRole[];
  followersCount: number;
  followingCount: number;
  uploadedNotesCount: number;
  totalSalesCount: number;
  averageRating: number;
  contributionPoints: number;
  badges: string[];
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudyNote {
  id: string;
  sellerId: string;
  sellerUsername: string;
  sellerName: string;
  title: string;
  description: string;
  classLevel: number;
  subject: string;
  chapterName: string;
  board: EducationBoard;
  price: number;
  isFree: boolean;
  coverUrl?: string;
  pdfFileId: string;
  pageCount: number;
  fileSizeBytes: number;
  status: NoteStatus;
  originalityAttested: boolean;
  averageRating: number;
  ratingCount: number;
  purchaseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface PurchaseRecord {
  id: string;
  buyerId: string;
  noteId: string;
  noteTitle: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  commissionAmount: number;
  sellerEarning: number;
  paymentType: 'free' | 'paid';
  transactionId: string;
  receiptNumber: string;
  status: 'completed' | 'refunded';
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  buyerId: string;
  sellerId: string;
  noteId: string;
  noteTitle: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount: number;
  discountAmount: number;
  commissionAmount: number;
  finalPayableAmount: number;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallet' | 'paylater' | 'free' | 'razorpay';
  status: 'created' | 'pending' | 'success' | 'failed' | 'refunded';
  failureReason?: string;
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  noteId: string;
  buyerId: string;
  buyerName: string;
  buyerUsername: string;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  helpfulVoters?: string[];
  reportedCount: number;
  status: 'active' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

export interface FollowerRecord {
  id: string;
  followerId: string;
  followingId: string;
  followerName: string;
  followingName: string;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  actorId: string;
  actorUsername: string;
  actorName: string;
  type: 'note_uploaded' | 'free_note_uploaded' | 'profile_updated';
  noteId?: string;
  noteTitle?: string;
  subject?: string;
  classLevel?: number;
  isFree?: boolean;
  summary: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  linkPath?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationSettings {
  uid: string;
  newFollowers: boolean;
  purchases: boolean;
  sales: boolean;
  reviews: boolean;
  feedbackReplies: boolean;
  followedUploads: boolean;
  updatedAt: string;
}

export interface FeedbackRecord {
  id: string;
  userId: string;
  studentName: string;
  category: FeedbackCategory;
  rating: number;
  message: string;
  screenshotUrl?: string;
  isAnonymous: boolean;
  status: FeedbackStatus;
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestRecord {
  id: string;
  purchaseId: string;
  transactionId: string;
  buyerId: string;
  sellerId: string;
  noteId: string;
  noteTitle: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  adminNote?: string;
  razorpayRefundId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerPayoutRecord {
  id: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  payoutMethod: string;
  accountReference: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  targetType: 'note' | 'review' | 'user';
  targetId: string;
  targetLabel: string;
  reason: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerEarningsSummary {
  totalSales: number;
  grossEarnings: number;
  platformCommission: number;
  netEarnings: number;
  completedPayouts: number;
  pendingSettlements: number;
  availableBalance: number;
  sellerEligibilityStatus: SellerEligibilityStatus;
}

export interface NoteChatThread {
  id: string;
  noteId: string;
  noteTitle: string;
  noteSubject?: string;
  noteClassLevel?: number;
  notePrice?: number;
  buyerId: string;
  buyerName: string;
  buyerUsername?: string;
  sellerId: string;
  sellerName: string;
  sellerUsername?: string;
  lastMessageText?: string;
  lastSenderId?: string;
  lastMessageAt?: string;
  buyerUnreadCount: number;
  sellerUnreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteChatMessage {
  id: string;
  threadId: string;
  noteId: string;
  buyerId: string;
  sellerId: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller';
  topicTag?: string;
  text: string;
  createdAt: string;
}
