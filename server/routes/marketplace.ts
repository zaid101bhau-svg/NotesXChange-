import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import Razorpay from 'razorpay';
import { requireAuth, optionalAuth, type AuthRequest } from '../firebaseAdmin.ts';
import {
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc,
  fsDeleteDoc,
  fsQuery,
  newDocId,
} from '../firestoreRest.ts';
import { DEFAULT_SUBJECTS, DEFAULT_CATEGORIES, seedTaxonomyAsAdmin } from '../seed.ts';
import {
  CBSE_CURATOR_UID,
  CBSE_CURATOR_PROFILE,
  listCuratedCbseNotes,
  getCuratedCbseNote,
} from '../cbseLibrary.ts';
import {
  savePdfAndPreview,
  saveValidatedImage,
  deleteStoredPdf,
  getPrivatePdfPath,
  getPreviewPdfPath,
  hasVerifiedPaidEntitlement,
  recordVerifiedPaidEntitlement,
} from '../storage.ts';
import { createNotification, computeBadges } from '../notifications.ts';

const router = Router();

const uploadFields = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadSingleImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 1. Public Taxonomy & Marketplace Metadata
router.get('/catalog/meta', async (_req, res) => {
  try {
    const [subjectsList, categoriesList, settingsDoc] = await Promise.all([
      fsQuery<{ sortOrder?: number }>('subjects').catch(() => []),
      fsQuery<{ name?: string }>('categories').catch(() => []),
      fsGetDoc<{ commissionRatePercent?: number }>('platform_settings', 'global').catch(() => ({
        exists: false,
        data: null,
      })),
    ]);

    const subjectMap = new Map<string, Record<string, unknown>>();
    for (const def of DEFAULT_SUBJECTS) {
      subjectMap.set(def.id, def);
    }
    for (const item of subjectsList as Array<Record<string, unknown>>) {
      if (typeof item.id === 'string') {
        subjectMap.set(item.id, item);
      }
    }
    const subjects = Array.from(subjectMap.values()).sort(
      (a, b) => Number(a.sortOrder || 99) - Number(b.sortOrder || 99)
    );
    const categories =
      categoriesList.length > 0
        ? categoriesList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        : DEFAULT_CATEGORIES.map((c) => ({ ...c, createdAt: new Date().toISOString() }));

    const envRate = Number(process.env.PLATFORM_COMMISSION_PERCENT || 15);
    res.json({
      subjects,
      categories,
      commissionRatePercent:
        settingsDoc.exists && typeof settingsDoc.data?.commissionRatePercent === 'number'
          ? settingsDoc.data.commissionRatePercent
          : Number.isFinite(envRate)
            ? envRate
            : 15,
    });
  } catch (error) {
    console.error('Failed to fetch catalog meta:', error);
    res.status(500).json({ error: 'Unable to load catalog metadata.' });
  }
});

// 2. Session Bootstrap & Account Sync
router.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const email = req.user!.email || '';
    const emailVerified = Boolean(req.user!.email_verified);

    const [userSnap, profileSnap, notifSettingsSnap] = await Promise.all([
      fsGetDoc<Record<string, unknown>>('users', uid, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', uid, token),
      fsGetDoc<Record<string, unknown>>('notification_settings', uid, token),
    ]);

    const now = new Date().toISOString();
    let userAccount = userSnap.data;
    if (!userSnap.exists && emailVerified) {
      userAccount = {
        uid,
        email,
        emailVerified,
        status: 'active',
        ageGroup: '13_to_17',
        isMinor: true,
        parentGuardianName: '',
        parentGuardianEmail: '',
        parentGuardianConsent: false,
        sellerEligibilityStatus: 'not_applied',
        payoutUpiOrBankRef: '',
        createdAt: now,
        updatedAt: now,
      };
      await fsSetDoc('users', uid, userAccount, token);
    } else if (userAccount && userAccount.emailVerified !== emailVerified && emailVerified) {
      await fsUpdateDoc('users', uid, { emailVerified, updatedAt: now }, token);
      userAccount.emailVerified = emailVerified;
    }

    if (req.isAdmin) {
      const adminDoc = await fsGetDoc('admins', uid, token).catch(() => ({ exists: false }));
      if (!adminDoc.exists) {
        await fsSetDoc('admins', uid, { uid, email, role: 'super_admin', createdAt: now }, token);
      }
      seedTaxonomyAsAdmin(token, uid);
    }

    res.json({
      userAccount:
        userAccount ||
        ({
          uid,
          email,
          emailVerified,
          status: 'active',
          ageGroup: '13_to_17',
          isMinor: true,
          parentGuardianConsent: false,
          sellerEligibilityStatus: 'not_applied',
          createdAt: now,
          updatedAt: now,
        } as Record<string, unknown>),
      profile: profileSnap.data,
      isAdmin: Boolean(req.isAdmin),
      notificationSettings: notifSettingsSnap.exists
        ? notifSettingsSnap.data
        : {
            uid,
            newFollowers: true,
            purchases: true,
            sales: true,
            reviews: true,
            feedbackReplies: true,
            followedUploads: true,
            updatedAt: now,
          },
    });
  } catch (error) {
    console.error('Failed to sync auth session:', error);
    res.status(500).json({ error: 'Unable to verify user session.' });
  }
});

// 3. Student Onboarding & Profile Upsert
router.post('/profile/onboarding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    if (!req.user!.email_verified) {
      res.status(403).json({
        error: 'Please verify your email address before completing your student profile.',
      });
      return;
    }

    const {
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
      parentGuardianConsent,
    } = req.body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    const cleanUsername = String(username || '').trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,40}$/.test(cleanUsername)) {
      res.status(400).json({ error: 'Username must be 3-40 alphanumeric or underscore characters.' });
      return;
    }
    const numericClass = Number(classLevel);
    if (!Number.isInteger(numericClass) || numericClass < 6 || numericClass > 12) {
      res.status(400).json({ error: 'Class must be between Class 6 and Class 12.' });
      return;
    }
    if (!['CBSE', 'ICSE', 'State Board', 'Other'].includes(board)) {
      res.status(400).json({ error: 'Please select a valid education board.' });
      return;
    }

    const validRoles = Array.isArray(roles)
      ? roles.filter((r: unknown) => r === 'buyer' || r === 'seller' || r === 'explorer')
      : ['explorer'];
    if (validRoles.length === 0) {
      res.status(400).json({ error: 'Please select at least one student role.' });
      return;
    }

    const isMinor = ageGroup !== '18_plus';
    if (isMinor && !parentGuardianConsent) {
      res.status(400).json({
        error: 'Students under 18 require parent or guardian acknowledgment to use NOTE XCHANGE.',
      });
      return;
    }

    const existingUsernames = await fsQuery<{ uid: string }>('student_profiles', {
      filters: [{ field: 'username', op: 'EQUAL', value: cleanUsername }],
      token,
    });
    if (existingUsernames.some((p) => p.uid !== uid)) {
      res.status(409).json({ error: 'This username is already taken. Please choose another.' });
      return;
    }

    const now = new Date().toISOString();
    const [existingProfileSnap, existingUserSnap] = await Promise.all([
      fsGetDoc<Record<string, unknown>>('student_profiles', uid, token),
      fsGetDoc<Record<string, unknown>>('users', uid, token),
    ]);
    const existingProfile = existingProfileSnap.data;
    const existingUser = existingUserSnap.data;

    const profileData = {
      uid,
      fullName: fullName.trim().slice(0, 100),
      username: cleanUsername,
      classLevel: numericClass,
      schoolName: String(schoolName || '').trim().slice(0, 140),
      board,
      avatarUrl: String(avatarUrl || existingProfile?.avatarUrl || '').trim().slice(0, 500),
      bio: String(bio || '').trim().slice(0, 400),
      roles: Array.from(new Set(validRoles)),
      followersCount: Number(existingProfile?.followersCount ?? 0),
      followingCount: Number(existingProfile?.followingCount ?? 0),
      uploadedNotesCount: Number(existingProfile?.uploadedNotesCount ?? 0),
      totalSalesCount: Number(existingProfile?.totalSalesCount ?? 0),
      averageRating: Number(existingProfile?.averageRating ?? 0),
      contributionPoints: Number(existingProfile?.contributionPoints ?? 0),
      badges: Array.isArray(existingProfile?.badges) ? existingProfile.badges : [],
      onboardingCompleted: true,
      createdAt: String(existingProfile?.createdAt ?? now),
      updatedAt: now,
    };

    const userData = {
      uid,
      email: req.user!.email || '',
      emailVerified: Boolean(req.user!.email_verified),
      status: String(existingUser?.status || 'active'),
      ageGroup: ageGroup || '13_to_17',
      isMinor,
      parentGuardianName: String(parentGuardianName || '').trim().slice(0, 120),
      parentGuardianEmail: String(parentGuardianEmail || '').trim().slice(0, 254),
      parentGuardianConsent: Boolean(parentGuardianConsent),
      sellerEligibilityStatus: String(existingUser?.sellerEligibilityStatus || 'not_applied'),
      payoutUpiOrBankRef: String(existingUser?.payoutUpiOrBankRef || ''),
      createdAt: String(existingUser?.createdAt || now),
      updatedAt: now,
    };

    await Promise.all([
      fsSetDoc('student_profiles', uid, profileData, token),
      fsSetDoc('users', uid, userData, token),
    ]);

    if (existingProfile) {
      const actId = newDocId();
      await fsSetDoc(
        'activities',
        actId,
        {
          id: actId,
          actorId: uid,
          actorUsername: cleanUsername,
          actorName: profileData.fullName,
          type: 'profile_updated',
          summary: `${profileData.fullName} updated their Class ${numericClass} (${board}) study profile.`,
          createdAt: now,
        },
        token
      );
    }

    res.json({ profile: profileData });
  } catch (error) {
    console.error('Onboarding failed:', error);
    res.status(500).json({ error: 'Unable to save student profile.' });
  }
});

router.post('/uploads/image', requireAuth, uploadSingleImage.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided.' });
      return;
    }
    const url = saveValidatedImage(req.file.buffer, 'img');
    res.json({ url });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Image upload failed.' });
  }
});

router.post('/seller/apply-eligibility', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const { payoutUpiOrBankRef, parentGuardianName, parentGuardianEmail, confirmOriginality } = req.body;
    if (!confirmOriginality) {
      res.status(400).json({ error: 'You must confirm originality and payment compliance.' });
      return;
    }
    if (!payoutUpiOrBankRef || String(payoutUpiOrBankRef).trim().length < 4) {
      res.status(400).json({ error: 'Please provide a valid payout UPI ID or guardian bank reference.' });
      return;
    }

    const userSnap = await fsGetDoc<Record<string, unknown>>('users', uid, token);
    const userData = userSnap.data;
    if (userData?.isMinor && (!parentGuardianName || !parentGuardianEmail)) {
      res.status(400).json({
        error: 'Minors must provide parent or guardian verification details before enabling seller payouts.',
      });
      return;
    }

    await fsUpdateDoc(
      'users',
      uid,
      {
        sellerEligibilityStatus: 'pending',
        payoutUpiOrBankRef: String(payoutUpiOrBankRef).trim().slice(0, 160),
        parentGuardianName: String(parentGuardianName || userData?.parentGuardianName || '').trim().slice(0, 120),
        parentGuardianEmail: String(parentGuardianEmail || userData?.parentGuardianEmail || '').trim().slice(0, 254),
        updatedAt: new Date().toISOString(),
      },
      token
    );

    res.json({ sellerEligibilityStatus: 'pending' });
  } catch (error) {
    console.error('Seller eligibility submission failed:', error);
    res.status(500).json({ error: 'Unable to submit seller eligibility request.' });
  }
});

router.post('/account/request-deletion', requireAuth, async (req: AuthRequest, res) => {
  try {
    await fsUpdateDoc(
      'users',
      req.user!.uid,
      { status: 'deletion_requested', updatedAt: new Date().toISOString() },
      req.idToken
    );
    res.json({ status: 'deletion_requested' });
  } catch {
    res.status(500).json({ error: 'Unable to submit deletion request.' });
  }
});

// 4. Notes Marketplace Search, Filtering, and Listing
router.get('/notes', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      q,
      classLevel,
      subject,
      chapter,
      board,
      pricing,
      minPrice,
      maxPrice,
      sort,
      sellerId,
      includeUnapproved,
    } = req.query;

    const filters = [];
    if (sellerId && typeof sellerId === 'string') {
      filters.push({ field: 'sellerId', op: 'EQUAL' as const, value: sellerId });
    } else if (!(includeUnapproved === 'true' && req.isAdmin)) {
      filters.push({ field: 'status', op: 'EQUAL' as const, value: 'approved' });
    }

    let notes = await fsQuery<Record<string, unknown>>('notes', {
      filters,
      token: req.idToken,
    });

    if (!(includeUnapproved === 'true' && req.isAdmin)) {
      const existingIds = new Set(notes.map((n) => String(n.id)));
      const curated = listCuratedCbseNotes().filter((cn) => !existingIds.has(cn.id));
      if (!sellerId || sellerId === CBSE_CURATOR_UID) {
        notes = [...notes, ...(curated as unknown as Record<string, unknown>[])];
      }
    }

    if (sellerId && req.user?.uid !== sellerId && !req.isAdmin) {
      notes = notes.filter((n) => n.status === 'approved');
    }
    if (classLevel && classLevel !== 'all') {
      const cls = Number(classLevel);
      notes = notes.filter((n) => n.classLevel === cls);
    }
    if (subject && subject !== 'all') {
      const subj = String(subject).toLowerCase();
      notes = notes.filter((n) => String(n.subject).toLowerCase() === subj);
    }
    if (chapter && typeof chapter === 'string' && chapter.trim()) {
      const ch = chapter.trim().toLowerCase();
      notes = notes.filter((n) => String(n.chapterName).toLowerCase().includes(ch));
    }
    if (board && board !== 'all') {
      notes = notes.filter((n) => n.board === board);
    }
    if (pricing === 'free') {
      notes = notes.filter((n) => n.isFree === true || n.price === 0);
    } else if (pricing === 'paid') {
      notes = notes.filter((n) => !n.isFree && Number(n.price) > 0);
    }
    if (minPrice !== undefined && minPrice !== '') {
      const minP = Number(minPrice);
      if (Number.isFinite(minP)) notes = notes.filter((n) => Number(n.price) >= minP);
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const maxP = Number(maxPrice);
      if (Number.isFinite(maxP)) notes = notes.filter((n) => Number(n.price) <= maxP);
    }
    if (q && typeof q === 'string' && q.trim()) {
      const term = q.trim().toLowerCase();
      notes = notes.filter(
        (n) =>
          String(n.title).toLowerCase().includes(term) ||
          String(n.description).toLowerCase().includes(term) ||
          String(n.subject).toLowerCase().includes(term) ||
          String(n.chapterName).toLowerCase().includes(term) ||
          String(n.sellerUsername).toLowerCase().includes(term) ||
          String(n.sellerName).toLowerCase().includes(term)
      );
    }

    if (sort === 'highest_rated') {
      notes.sort(
        (a, b) =>
          Number(b.averageRating || 0) - Number(a.averageRating || 0) ||
          Number(b.ratingCount || 0) - Number(a.ratingCount || 0)
      );
    } else if (sort === 'most_popular') {
      notes.sort((a, b) => Number(b.purchaseCount || 0) - Number(a.purchaseCount || 0));
    } else if (sort === 'price_low') {
      notes.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sort === 'price_high') {
      notes.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else {
      notes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    res.json({ notes });
  } catch (error) {
    console.error('Failed to search notes:', error);
    res.status(500).json({ error: 'Unable to load notes.' });
  }
});

// 5. Note Detail + Purchase Access Check + Reviews
router.get('/notes/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    const curatedFallback = getCuratedCbseNote(id);
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', id, req.idToken).catch(() => ({
      exists: false,
      id,
      data: null,
    }));
    if (!noteSnap.exists && !curatedFallback) {
      res.status(404).json({ error: 'Study note not found.' });
      return;
    }
    const note = (noteSnap.data || curatedFallback) as Record<string, unknown>;
    if (note.status !== 'approved' && req.user?.uid !== note.sellerId && !req.isAdmin) {
      res.status(404).json({ error: 'Study note is not available.' });
      return;
    }

    const [sellerSnap, reviewsList] = await Promise.all([
      String(note.sellerId) === CBSE_CURATOR_UID
        ? Promise.resolve({ exists: true, id: CBSE_CURATOR_UID, data: CBSE_CURATOR_PROFILE })
        : fsGetDoc('student_profiles', String(note.sellerId), req.idToken).catch(() => ({
            exists: false,
            id: String(note.sellerId),
            data: null,
          })),
      fsQuery<Record<string, unknown>>('reviews', {
        filters: [
          { field: 'noteId', op: 'EQUAL', value: id },
          { field: 'status', op: 'EQUAL', value: 'active' },
        ],
        token: req.idToken,
      }).catch(() => []),
    ]);

    let hasPurchased = false;
    let purchaseRecord = null;
    if (req.user) {
      if (req.user.uid === note.sellerId || req.isAdmin) {
        hasPurchased = true;
      } else {
        const purchases = await fsQuery<Record<string, unknown>>('purchases', {
          filters: [
            { field: 'buyerId', op: 'EQUAL', value: req.user.uid },
            { field: 'noteId', op: 'EQUAL', value: id },
            { field: 'status', op: 'EQUAL', value: 'completed' },
          ],
          limit: 1,
          token: req.idToken,
        });
        if (purchases.length > 0) {
          hasPurchased = true;
          purchaseRecord = purchases[0];
        }
      }
    }

    const reviews = reviewsList.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({
      note,
      seller: sellerSnap.data,
      hasPurchased,
      purchaseRecord,
      reviews,
    });
  } catch (error) {
    console.error('Failed to fetch note detail:', error);
    res.status(500).json({ error: 'Unable to fetch note details.' });
  }
});

// 6. Upload Original Study Notes
router.post(
  '/notes',
  requireAuth,
  uploadFields.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const token = req.idToken!;
      const profileSnap = await fsGetDoc<Record<string, unknown>>('student_profiles', uid, token);
      if (!profileSnap.exists || !profileSnap.data) {
        res.status(400).json({ error: 'Please complete your Student Onboarding profile first.' });
        return;
      }
      const profile = profileSnap.data;
      const roles = Array.isArray(profile.roles) ? profile.roles : [];
      if (!roles.includes('seller') && !req.isAdmin) {
        res.status(403).json({
          error: 'Enable the Seller role in your Dashboard or Profile Settings before uploading notes.',
        });
        return;
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const pdfFile = files?.pdf?.[0];
      if (!pdfFile) {
        res.status(400).json({ error: 'A valid PDF study note file is required.' });
        return;
      }

      const { title, description, classLevel, subject, chapterName, board, price, originalityAttested, defaultCoverUrl } =
        req.body;

      if (!title || String(title).trim().length < 4) {
        res.status(400).json({ error: 'Note title must be at least 4 characters.' });
        return;
      }
      if (!description || String(description).trim().length < 10) {
        res.status(400).json({ error: 'Please provide a clear description (minimum 10 characters).' });
        return;
      }
      const numericClass = Number(classLevel);
      if (!Number.isInteger(numericClass) || numericClass < 6 || numericClass > 12) {
        res.status(400).json({ error: 'Class must be between 6 and 12.' });
        return;
      }
      if (!subject || !chapterName || !board) {
        res.status(400).json({ error: 'Subject, Chapter Name, and Education Board are required.' });
        return;
      }
      if (originalityAttested !== 'true' && originalityAttested !== true) {
        res.status(400).json({
          error: 'You must attest that these study notes are your original work or properly authorized.',
        });
        return;
      }

      const numericPrice = Math.max(0, Math.round(Number(price || 0)));
      const isFree = numericPrice === 0;
      const { fileId, pageCount, fileSizeBytes } = await savePdfAndPreview(pdfFile.buffer);

      let coverUrl = String(defaultCoverUrl || '').trim();
      const coverFile = files?.cover?.[0];
      if (coverFile) {
        coverUrl = saveValidatedImage(coverFile.buffer, 'cover');
      }

      const now = new Date().toISOString();
      const noteId = newDocId();
      const status = req.isAdmin ? 'approved' : 'pending';

      const noteData = {
        id: noteId,
        sellerId: uid,
        sellerUsername: String(profile.username),
        sellerName: String(profile.fullName),
        title: String(title).trim().slice(0, 140),
        description: String(description).trim().slice(0, 2000),
        classLevel: numericClass,
        subject: String(subject).trim().slice(0, 80),
        chapterName: String(chapterName).trim().slice(0, 120),
        board: String(board),
        price: numericPrice,
        isFree,
        coverUrl,
        pdfFileId: fileId,
        pageCount,
        fileSizeBytes,
        status,
        originalityAttested: true,
        averageRating: 0,
        ratingCount: 0,
        purchaseCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      await fsSetDoc('notes', noteId, noteData, token);

      if (status === 'approved') {
        const nextUploaded = Number(profile.uploadedNotesCount || 0) + 1;
        const nextPoints = Number(profile.contributionPoints || 0) + 25;
        const badges = computeBadges({
          uploadedNotesCount: nextUploaded,
          totalSalesCount: Number(profile.totalSalesCount || 0),
          averageRating: Number(profile.averageRating || 0),
          followersCount: Number(profile.followersCount || 0),
          contributionPoints: nextPoints,
        });
        await fsUpdateDoc(
          'student_profiles',
          uid,
          { uploadedNotesCount: nextUploaded, contributionPoints: nextPoints, badges, updatedAt: now },
          token
        );

        const actId = newDocId();
        await fsSetDoc(
          'activities',
          actId,
          {
            id: actId,
            actorId: uid,
            actorUsername: profile.username,
            actorName: profile.fullName,
            type: isFree ? 'free_note_uploaded' : 'note_uploaded',
            noteId,
            noteTitle: noteData.title,
            subject: noteData.subject,
            classLevel: numericClass,
            isFree,
            summary: `${profile.fullName} uploaded ${isFree ? 'free' : `₹${numericPrice}`} notes: ${noteData.title}`,
            createdAt: now,
          },
          token
        );

        const followers = await fsQuery<{ followerId: string }>('followers', {
          filters: [{ field: 'followingId', op: 'EQUAL', value: uid }],
          token,
        });
        await Promise.all(
          followers.map((f) =>
            createNotification({
              userId: f.followerId,
              type: 'followed_upload',
              prefKey: 'followedUploads',
              title: `New notes from ${profile.fullName}`,
              message: `${profile.fullName} published "${noteData.title}" (Class ${numericClass} ${noteData.subject}).`,
              linkPath: `/notes/${noteId}`,
              token,
            })
          )
        );
      }

      res.status(201).json({ note: noteData });
    } catch (error: unknown) {
      console.error('Upload note failed:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to upload study notes.' });
    }
  }
);

// 7. Edit / Delete Notes
router.patch('/notes/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    const token = req.idToken!;
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', id, token);
    if (!noteSnap.exists || !noteSnap.data) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    const note = noteSnap.data;
    if (note.sellerId !== req.user!.uid && !req.isAdmin) {
      res.status(403).json({ error: 'Only the author or an administrator can edit this note.' });
      return;
    }

    const { title, description, price, chapterName } = req.body;
    const nextPrice = price !== undefined ? Math.max(0, Math.round(Number(price))) : Number(note.price);
    const updates = {
      title: title ? String(title).trim().slice(0, 140) : note.title,
      description: description ? String(description).trim().slice(0, 2000) : note.description,
      chapterName: chapterName ? String(chapterName).trim().slice(0, 120) : note.chapterName,
      price: nextPrice,
      isFree: nextPrice === 0,
      updatedAt: new Date().toISOString(),
    };
    await fsUpdateDoc('notes', id, updates, token);
    res.json({ note: { ...note, ...updates } });
  } catch {
    res.status(500).json({ error: 'Unable to update note.' });
  }
});

router.delete('/notes/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    const token = req.idToken!;
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', id, token);
    if (!noteSnap.exists || !noteSnap.data) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    const note = noteSnap.data;
    if (note.sellerId !== req.user!.uid && !req.isAdmin) {
      res.status(403).json({ error: 'Unauthorized to delete this note.' });
      return;
    }
    deleteStoredPdf(String(note.pdfFileId || ''));
    await fsDeleteDoc('notes', id, token);
    res.json({ deleted: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete note.' });
  }
});

// 8. Sample Pages PDF Preview
router.get('/notes/:id/preview', async (req, res) => {
  try {
    const curatedFallback = getCuratedCbseNote(req.params.id);
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', req.params.id).catch(() => ({
      exists: false,
      id: req.params.id,
      data: null,
    }));
    const noteData = noteSnap.data || curatedFallback;
    if (!noteData) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    const previewPath = getPreviewPdfPath(String(noteData.pdfFileId || ''));
    if (!previewPath) {
      res.status(404).json({ error: 'Sample preview not available.' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.id}-sample.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(previewPath).pipe(res);
  } catch {
    res.status(500).json({ error: 'Unable to load sample preview.' });
  }
});

// 9. Secure Full PDF Download
router.get('/notes/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const curatedFallback = getCuratedCbseNote(req.params.id);
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', req.params.id, token).catch(() => ({
      exists: false,
      id: req.params.id,
      data: null,
    }));
    if (!noteSnap.exists && !curatedFallback) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    const note = (noteSnap.data || curatedFallback) as Record<string, unknown>;

    let authorized = uid === note.sellerId || Boolean(req.isAdmin);
    const isPaidNote = !note.isFree && Number(note.price || 0) > 0;

    if (!authorized) {
      const purchases = await fsQuery<Record<string, unknown>>('purchases', {
        filters: [
          { field: 'buyerId', op: 'EQUAL', value: uid },
          { field: 'noteId', op: 'EQUAL', value: String(note.id) },
          { field: 'status', op: 'EQUAL', value: 'completed' },
        ],
        limit: 1,
        token,
      });

      if (purchases.length > 0) {
        if (!isPaidNote) {
          authorized = true;
        } else if (hasVerifiedPaidEntitlement(uid, String(note.id))) {
          authorized = true;
        } else {
          // Cross-check Razorpay gateway payment status when ledger is missing (e.g. cold restart)
          const purchase = purchases[0];
          const txId = String(purchase.transactionId || '');
          const txSnap = txId
            ? await fsGetDoc<Record<string, unknown>>('transactions', txId, token).catch(() => ({
                exists: false,
                data: null,
              }))
            : { exists: false, data: null };
          const keyId = process.env.RAZORPAY_KEY_ID?.trim();
          const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
          if (
            txSnap.exists &&
            txSnap.data?.status === 'success' &&
            txSnap.data?.razorpayPaymentId &&
            txSnap.data?.razorpayOrderId &&
            keyId &&
            keySecret
          ) {
            try {
              const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
              const payment = await rzp.payments.fetch(String(txSnap.data.razorpayPaymentId));
              if (
                (payment.status === 'captured' || payment.status === 'authorized') &&
                payment.order_id === String(txSnap.data.razorpayOrderId)
              ) {
                recordVerifiedPaidEntitlement({
                  buyerId: uid,
                  noteId: String(note.id),
                  transactionId: txId,
                  razorpayOrderId: String(txSnap.data.razorpayOrderId),
                  razorpayPaymentId: String(txSnap.data.razorpayPaymentId),
                  amount: Number(txSnap.data.finalPayableAmount || note.price || 0),
                });
                authorized = true;
              }
            } catch {
              authorized = false;
            }
          }
        }
      }
    }

    if (!authorized) {
      res.status(403).json({
        error: note.isFree
          ? 'Please claim this free note first to unlock the full PDF download.'
          : 'Verified purchase confirmation is required before downloading this PDF.',
      });
      return;
    }

    const pdfPath = getPrivatePdfPath(String(note.pdfFileId || ''));
    if (!pdfPath) {
      res.status(404).json({ error: 'PDF file is missing on storage.' });
      return;
    }

    const safeTitle = String(note.title).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'study-notes';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(pdfPath).pipe(res);
  } catch (error) {
    console.error('PDF download error:', error);
    res.status(500).json({ error: 'Unable to download PDF.' });
  }
});

// 10. Contributors, Public Profile, Follow/Unfollow, Following Feed
router.get('/contributors', async (_req, res) => {
  try {
    const profiles = await fsQuery<Record<string, unknown>>('student_profiles', {
      filters: [{ field: 'onboardingCompleted', op: 'EQUAL', value: true }],
    });
    profiles.sort(
      (a, b) =>
        Number(b.contributionPoints || 0) - Number(a.contributionPoints || 0) ||
        Number(b.averageRating || 0) - Number(a.averageRating || 0) ||
        Number(b.totalSalesCount || 0) - Number(a.totalSalesCount || 0)
    );
    res.json({ contributors: profiles });
  } catch {
    res.status(500).json({ error: 'Unable to load contributors.' });
  }
});

router.get('/profiles/:uid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (targetUid === CBSE_CURATOR_UID) {
      res.json({
        profile: CBSE_CURATOR_PROFILE,
        notes: listCuratedCbseNotes(),
        followers: [],
        following: [],
        isFollowing: false,
      });
      return;
    }

    const canSeeUnapproved = req.user?.uid === targetUid || Boolean(req.isAdmin);
    const noteFilters = [{ field: 'sellerId', op: 'EQUAL' as const, value: targetUid }];
    if (!canSeeUnapproved) {
      noteFilters.push({ field: 'status', op: 'EQUAL' as const, value: 'approved' });
    }

    const [profileSnap, allNotes, followers, following] = await Promise.all([
      fsGetDoc<Record<string, unknown>>('student_profiles', targetUid, req.idToken),
      fsQuery<Record<string, unknown>>('notes', {
        filters: noteFilters,
        token: req.idToken,
      }),
      fsQuery<Record<string, unknown>>('followers', {
        filters: [{ field: 'followingId', op: 'EQUAL', value: targetUid }],
        token: req.idToken,
      }),
      fsQuery<Record<string, unknown>>('followers', {
        filters: [{ field: 'followerId', op: 'EQUAL', value: targetUid }],
        token: req.idToken,
      }),
    ]);

    if (!profileSnap.exists) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const notes = allNotes
      .filter((n) => n.status === 'approved' || req.user?.uid === targetUid || req.isAdmin)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const isFollowing = req.user ? followers.some((f) => f.followerId === req.user!.uid) : false;

    res.json({
      profile: profileSnap.data,
      notes,
      followers,
      following,
      isFollowing,
    });
  } catch {
    res.status(500).json({ error: 'Unable to load student profile.' });
  }
});

router.post('/follow/:targetUid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const followerId = req.user!.uid;
    const followingId = req.params.targetUid;
    const token = req.idToken!;
    if (followerId === followingId) {
      res.status(400).json({ error: 'You cannot follow your own account.' });
      return;
    }

    const followId = `${followerId}_${followingId}`;
    const [followSnap, followerProfileSnap, targetProfileSnap] = await Promise.all([
      fsGetDoc('followers', followId, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', followerId, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', followingId, token),
    ]);

    if (!targetProfileSnap.exists || !targetProfileSnap.data) {
      res.status(404).json({ error: 'Target student profile not found.' });
      return;
    }
    if (followSnap.exists) {
      res.status(409).json({ error: 'Already following this student.' });
      return;
    }

    const followerProfile = followerProfileSnap.data || { fullName: 'Student', followingCount: 0 };
    const targetProfile = targetProfileSnap.data;
    const now = new Date().toISOString();

    const nextTargetFollowers = Number(targetProfile.followersCount || 0) + 1;
    const nextPoints = Number(targetProfile.contributionPoints || 0) + 5;
    const badges = computeBadges({
      uploadedNotesCount: Number(targetProfile.uploadedNotesCount || 0),
      totalSalesCount: Number(targetProfile.totalSalesCount || 0),
      averageRating: Number(targetProfile.averageRating || 0),
      followersCount: nextTargetFollowers,
      contributionPoints: nextPoints,
    });

    await Promise.all([
      fsSetDoc(
        'followers',
        followId,
        {
          id: followId,
          followerId,
          followingId,
          followerName: String(followerProfile.fullName),
          followingName: String(targetProfile.fullName),
          createdAt: now,
        },
        token
      ),
      fsUpdateDoc(
        'student_profiles',
        followerId,
        { followingCount: Number(followerProfile.followingCount || 0) + 1, updatedAt: now },
        token
      ),
      fsUpdateDoc(
        'student_profiles',
        followingId,
        {
          followersCount: nextTargetFollowers,
          contributionPoints: nextPoints,
          badges,
          updatedAt: now,
        },
        token
      ),
    ]);

    await createNotification({
      userId: followingId,
      type: 'new_follower',
      prefKey: 'newFollowers',
      title: 'New follower',
      message: `${followerProfile.fullName} started following your study notes.`,
      linkPath: `/profile/${followerId}`,
      token,
    });

    res.json({ following: true, followersCount: nextTargetFollowers });
  } catch (error) {
    console.error('Follow failed:', error);
    res.status(500).json({ error: 'Unable to follow student.' });
  }
});

router.delete('/follow/:targetUid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const followerId = req.user!.uid;
    const followingId = req.params.targetUid;
    const token = req.idToken!;
    const followId = `${followerId}_${followingId}`;

    const [followSnap, followerProfileSnap, targetProfileSnap] = await Promise.all([
      fsGetDoc('followers', followId, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', followerId, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', followingId, token),
    ]);

    if (!followSnap.exists) {
      res.status(404).json({ error: 'Follow relationship not found.' });
      return;
    }

    const now = new Date().toISOString();
    const nextFollowerFollowing = Math.max(0, Number(followerProfileSnap.data?.followingCount || 1) - 1);
    const nextTargetFollowers = Math.max(0, Number(targetProfileSnap.data?.followersCount || 1) - 1);

    await Promise.all([
      fsDeleteDoc('followers', followId, token),
      fsUpdateDoc('student_profiles', followerId, { followingCount: nextFollowerFollowing, updatedAt: now }, token),
      fsUpdateDoc('student_profiles', followingId, { followersCount: nextTargetFollowers, updatedAt: now }, token),
    ]);

    res.json({ following: false, followersCount: nextTargetFollowers });
  } catch {
    res.status(500).json({ error: 'Unable to unfollow student.' });
  }
});

router.get('/feed/following', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const followingList = await fsQuery<{ followingId: string }>('followers', {
      filters: [{ field: 'followerId', op: 'EQUAL', value: uid }],
      token,
    });
    const followedIds = new Set(followingList.map((f) => f.followingId));
    if (followedIds.size === 0) {
      res.json({ activities: [] });
      return;
    }
    const allActivities = await fsQuery<Record<string, unknown>>('activities', { token });
    const activities = allActivities
      .filter((a) => followedIds.has(String(a.actorId)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 60);
    res.json({ activities });
  } catch {
    res.status(500).json({ error: 'Unable to load following feed.' });
  }
});

// 11. Rating & Review System
router.post('/notes/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const noteId = req.params.id;
    const uid = req.user!.uid;
    const token = req.idToken!;
    const { rating, comment } = req.body;

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
      return;
    }
    if (!comment || String(comment).trim().length < 5) {
      res.status(400).json({ error: 'Please write a meaningful review (at least 5 characters).' });
      return;
    }

    const curatedNoteFallback = getCuratedCbseNote(noteId);
    const [noteSnap, profileSnap, existingReviews, purchases] = await Promise.all([
      fsGetDoc<Record<string, unknown>>('notes', noteId, token).catch(() => ({
        exists: false,
        id: noteId,
        data: null,
      })),
      fsGetDoc<Record<string, unknown>>('student_profiles', uid, token),
      fsQuery('reviews', {
        filters: [
          { field: 'noteId', op: 'EQUAL', value: noteId },
          { field: 'buyerId', op: 'EQUAL', value: uid },
        ],
        limit: 1,
        token,
      }),
      fsQuery('purchases', {
        filters: [
          { field: 'buyerId', op: 'EQUAL', value: uid },
          { field: 'noteId', op: 'EQUAL', value: noteId },
          { field: 'status', op: 'EQUAL', value: 'completed' },
        ],
        limit: 1,
        token,
      }),
    ]);

    if (!noteSnap.exists && !curatedNoteFallback) {
      res.status(404).json({ error: 'Study note not found.' });
      return;
    }
    const note = (noteSnap.data || curatedNoteFallback) as Record<string, unknown>;
    if (note.sellerId === uid) {
      res.status(400).json({ error: 'You cannot review your own uploaded notes.' });
      return;
    }
    if (existingReviews.length > 0) {
      res.status(409).json({ error: 'You have already submitted a review for this study note.' });
      return;
    }
    if (purchases.length === 0) {
      res.status(403).json({
        error: note.isFree
          ? 'Please claim and download this free note before reviewing it.'
          : 'Only verified purchasers can review paid study notes.',
      });
      return;
    }

    const profile = profileSnap.data || { fullName: 'Verified Student', username: 'student' };
    const now = new Date().toISOString();
    const reviewId = newDocId();
    const reviewData = {
      id: reviewId,
      noteId,
      buyerId: uid,
      buyerName: String(profile.fullName),
      buyerUsername: String(profile.username),
      rating: numRating,
      comment: String(comment).trim().slice(0, 1200),
      verifiedPurchase: true,
      helpfulCount: 0,
      helpfulVoters: [],
      reportedCount: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await fsSetDoc('reviews', reviewId, reviewData, token);

    const allNoteReviews = await fsQuery<{ rating: number }>('reviews', {
      filters: [
        { field: 'noteId', op: 'EQUAL', value: noteId },
        { field: 'status', op: 'EQUAL', value: 'active' },
      ],
      token,
    });
    const avg =
      allNoteReviews.length > 0
        ? Number((allNoteReviews.reduce((s, r) => s + Number(r.rating), 0) / allNoteReviews.length).toFixed(2))
        : 0;

    if (noteSnap.exists) {
      await fsUpdateDoc('notes', noteId, { averageRating: avg, ratingCount: allNoteReviews.length, updatedAt: now }, token);
    }

    const sellerNotes = await fsQuery<{ averageRating: number; ratingCount: number }>('notes', {
      filters: [
        { field: 'sellerId', op: 'EQUAL', value: String(note.sellerId) },
        { field: 'status', op: 'EQUAL', value: 'approved' },
      ],
      token,
    });
    const ratedNotes = sellerNotes.filter((n) => Number(n.ratingCount || 0) > 0);
    const sellerAvg =
      ratedNotes.length > 0
        ? Number((ratedNotes.reduce((s, n) => s + Number(n.averageRating), 0) / ratedNotes.length).toFixed(2))
        : 0;

    const sellerSnap = await fsGetDoc<Record<string, unknown>>('student_profiles', String(note.sellerId), token);
    if (sellerSnap.exists && sellerSnap.data) {
      const s = sellerSnap.data;
      const nextPoints = Number(s.contributionPoints || 0) + (numRating >= 4 ? 10 : 2);
      const badges = computeBadges({
        uploadedNotesCount: Number(s.uploadedNotesCount || 0),
        totalSalesCount: Number(s.totalSalesCount || 0),
        averageRating: sellerAvg,
        followersCount: Number(s.followersCount || 0),
        contributionPoints: nextPoints,
      });
      await fsUpdateDoc(
        'student_profiles',
        String(note.sellerId),
        { averageRating: sellerAvg, contributionPoints: nextPoints, badges, updatedAt: now },
        token
      );
    }

    await createNotification({
      userId: String(note.sellerId),
      type: 'new_review',
      prefKey: 'reviews',
      title: 'New verified review',
      message: `${profile.fullName} rated "${note.title}" ${numRating}/5 stars.`,
      linkPath: `/notes/${noteId}`,
      token,
    });

    res.status(201).json({ review: reviewData, averageRating: avg, ratingCount: allNoteReviews.length });
  } catch (error) {
    console.error('Review submission failed:', error);
    res.status(500).json({ error: 'Unable to submit review.' });
  }
});

router.post('/reviews/:reviewId/helpful', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const snap = await fsGetDoc<Record<string, unknown>>('reviews', req.params.reviewId, token);
    if (!snap.exists || !snap.data) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }
    const voters: string[] = Array.isArray(snap.data.helpfulVoters) ? snap.data.helpfulVoters : [];
    const hasVoted = voters.includes(uid);
    const nextVoters = hasVoted ? voters.filter((v) => v !== uid) : [...voters, uid];
    await fsUpdateDoc(
      'reviews',
      req.params.reviewId,
      { helpfulVoters: nextVoters, helpfulCount: nextVoters.length, updatedAt: new Date().toISOString() },
      token
    );
    res.json({ helpfulCount: nextVoters.length, voted: !hasVoted });
  } catch {
    res.status(500).json({ error: 'Unable to update helpful vote.' });
  }
});

// 12. Wishlists
router.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const items = await fsQuery<{ noteId: string }>('wishlists', {
      filters: [{ field: 'userId', op: 'EQUAL', value: uid }],
      token,
    });
    const noteIds = items.map((i) => i.noteId);
    const noteSnaps = await Promise.all(
      noteIds.map((id) =>
        fsGetDoc<Record<string, unknown>>('notes', id, token).catch(() => ({
          exists: false,
          id,
          data: null,
        }))
      )
    );
    const notes = noteSnaps
      .map((s, idx) => (s.exists && s.data ? s.data : getCuratedCbseNote(noteIds[idx])))
      .filter((n): n is Record<string, unknown> => Boolean(n && n.status === 'approved'));
    res.json({ noteIds, notes });
  } catch {
    res.status(500).json({ error: 'Unable to fetch wishlist.' });
  }
});

router.post('/wishlist/:noteId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const noteId = req.params.noteId;
    const id = `${uid}_${noteId}`;
    const existing = await fsGetDoc('wishlists', id, token);
    if (existing.exists) {
      await fsDeleteDoc('wishlists', id, token);
      res.json({ wishlisted: false });
    } else {
      await fsSetDoc('wishlists', id, { id, userId: uid, noteId, createdAt: new Date().toISOString() }, token);
      res.json({ wishlisted: true });
    }
  } catch {
    res.status(500).json({ error: 'Unable to update wishlist.' });
  }
});

// 13. Notifications & Settings
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await fsQuery<Record<string, unknown>>('notifications', {
      filters: [{ field: 'userId', op: 'EQUAL', value: req.user!.uid }],
      token: req.idToken,
    });
    items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({
      notifications: items,
      unreadCount: items.filter((n) => !n.isRead).length,
    });
  } catch {
    res.status(500).json({ error: 'Unable to load notifications.' });
  }
});

router.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    await fsUpdateDoc('notifications', req.params.id, { isRead: true }, req.idToken);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to mark notification as read.' });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const unread = await fsQuery<{ id: string }>('notifications', {
      filters: [
        { field: 'userId', op: 'EQUAL', value: req.user!.uid },
        { field: 'isRead', op: 'EQUAL', value: false },
      ],
      token,
    });
    await Promise.all(unread.map((n) => fsUpdateDoc('notifications', n.id, { isRead: true }, token)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to mark notifications as read.' });
  }
});

router.put('/notifications/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const settings = {
      uid,
      newFollowers: req.body.newFollowers !== false,
      purchases: req.body.purchases !== false,
      sales: req.body.sales !== false,
      reviews: req.body.reviews !== false,
      feedbackReplies: req.body.feedbackReplies !== false,
      followedUploads: req.body.followedUploads !== false,
      updatedAt: new Date().toISOString(),
    };
    await fsSetDoc('notification_settings', uid, settings, req.idToken);
    res.json({ notificationSettings: settings });
  } catch {
    res.status(500).json({ error: 'Unable to save notification settings.' });
  }
});

// 14. Feedback & Reports
router.get('/feedback/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const feedback = await fsQuery<Record<string, unknown>>('feedback', {
      filters: [{ field: 'userId', op: 'EQUAL', value: req.user!.uid }],
      token: req.idToken,
    });
    feedback.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ feedback });
  } catch {
    res.status(500).json({ error: 'Unable to fetch feedback history.' });
  }
});

router.post('/feedback', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { studentName, category, rating, message, screenshotUrl, isAnonymous } = req.body;
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5.' });
      return;
    }
    if (!message || String(message).trim().length < 5) {
      res.status(400).json({ error: 'Feedback message must be at least 5 characters.' });
      return;
    }

    const now = new Date().toISOString();
    const id = newDocId();
    const item = {
      id,
      userId: uid,
      studentName: isAnonymous ? 'Anonymous Student' : String(studentName || 'Student').trim().slice(0, 100),
      category: String(category || 'Other'),
      rating: numRating,
      message: String(message).trim().slice(0, 2000),
      screenshotUrl: String(screenshotUrl || '').trim().slice(0, 500),
      isAnonymous: Boolean(isAnonymous),
      status: 'Pending',
      adminReply: '',
      createdAt: now,
      updatedAt: now,
    };
    await fsSetDoc('feedback', id, item, req.idToken);
    res.status(201).json({ feedback: item });
  } catch {
    res.status(500).json({ error: 'Unable to submit feedback.' });
  }
});

router.post('/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetType, targetId, targetLabel, reason, details } = req.body;
    if (!['note', 'review', 'user'].includes(targetType) || !targetId || !reason) {
      res.status(400).json({ error: 'Target and reason are required to submit a report.' });
      return;
    }
    const now = new Date().toISOString();
    const id = newDocId();
    const report = {
      id,
      reporterId: req.user!.uid,
      targetType,
      targetId: String(targetId),
      targetLabel: String(targetLabel || targetId).slice(0, 140),
      reason: String(reason).slice(0, 120),
      details: String(details || '').slice(0, 1000),
      status: 'open',
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    };
    await fsSetDoc('reports', id, report, req.idToken);
    res.status(201).json({ report });
  } catch {
    res.status(500).json({ error: 'Unable to submit report.' });
  }
});

// 15. Student Dashboard Overview
router.get('/dashboard/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const [purchases, myReviews, uploadedNotes, followers, following] = await Promise.all([
      fsQuery<Record<string, unknown>>('purchases', {
        filters: [{ field: 'buyerId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('reviews', {
        filters: [{ field: 'buyerId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('notes', {
        filters: [{ field: 'sellerId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('followers', {
        filters: [{ field: 'followingId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('followers', {
        filters: [{ field: 'followerId', op: 'EQUAL', value: uid }],
        token,
      }),
    ]);

    res.json({
      purchases: purchases.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      myReviews: myReviews.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      uploadedNotes: uploadedNotes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      followers,
      following,
    });
  } catch {
    res.status(500).json({ error: 'Unable to load dashboard overview.' });
  }
});

// Public Featured Reviews
router.get('/reviews/featured', async (_req, res) => {
  try {
    const allReviews = await fsQuery<Record<string, unknown>>('reviews', {
      filters: [{ field: 'status', op: 'EQUAL', value: 'active' }],
      limit: 30,
    });
    const reviews = allReviews
      .filter((r) => r.verifiedPurchase && Number(r.rating) >= 4)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 6);
    res.json({ reviews });
  } catch {
    res.status(500).json({ error: 'Unable to fetch featured reviews.' });
  }
});

export default router;
