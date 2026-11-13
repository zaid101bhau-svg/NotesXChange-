import { Router } from 'express';
import Razorpay from 'razorpay';
import { requireAdmin, type AuthRequest } from '../firebaseAdmin.ts';
import { fsGetDoc, fsSetDoc, fsUpdateDoc, fsDeleteDoc, fsQuery, newDocId } from '../firestoreRest.ts';
import { createNotification, computeBadges } from '../notifications.ts';
import { deleteStoredPdf, revokeVerifiedPaidEntitlement } from '../storage.ts';

const router = Router();
router.use(requireAdmin);

// 1. Admin Dashboard Overview & Analytics
router.get('/overview', async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const [
      users,
      profiles,
      notes,
      purchases,
      transactions,
      categories,
      refunds,
      payouts,
      feedback,
      reports,
      reviews,
      settingsDoc,
    ] = await Promise.all([
      fsQuery<Record<string, unknown>>('users', { token }),
      fsQuery<Record<string, unknown>>('student_profiles', { token }),
      fsQuery<Record<string, unknown>>('notes', { token }),
      fsQuery<Record<string, unknown>>('purchases', { token }),
      fsQuery<Record<string, unknown>>('transactions', { token }),
      fsQuery<Record<string, unknown>>('categories', { token }),
      fsQuery<Record<string, unknown>>('refund_requests', { token }),
      fsQuery<Record<string, unknown>>('seller_payouts', { token }),
      fsQuery<Record<string, unknown>>('feedback', { token }),
      fsQuery<Record<string, unknown>>('reports', { token }),
      fsQuery<Record<string, unknown>>('reviews', { token }),
      fsGetDoc<{ commissionRatePercent?: number }>('platform_settings', 'global', token),
    ]);

    notes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    transactions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    const totalBuyers = profiles.filter((p) => Array.isArray(p.roles) && p.roles.includes('buyer')).length;
    const totalSellers = profiles.filter((p) => Array.isArray(p.roles) && p.roles.includes('seller')).length;
    const completedPurchases = purchases.filter((p) => p.status === 'completed');
    const platformRevenue = Number(
      completedPurchases.reduce((s, p) => s + Number(p.commissionAmount || 0), 0).toFixed(2)
    );
    const grossVolume = Number(completedPurchases.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));

    const subjectCounts: Record<string, number> = {};
    for (const n of notes) {
      if (n.status === 'approved') {
        const subj = String(n.subject);
        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
      }
    }
    const popularSubjects = Object.entries(subjectCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topContributors = [...profiles]
      .sort((a, b) => Number(b.contributionPoints || 0) - Number(a.contributionPoints || 0))
      .slice(0, 8);

    res.json({
      analytics: {
        totalStudents: profiles.length || users.length,
        totalBuyers,
        totalSellers,
        totalNotes: notes.length,
        approvedNotes: notes.filter((n) => n.status === 'approved').length,
        pendingNotes: notes.filter((n) => n.status === 'pending').length,
        totalPurchases: completedPurchases.length,
        grossVolume,
        platformRevenue,
        popularSubjects,
        topContributors,
      },
      students: users.map((u) => ({
        ...u,
        profile: profiles.find((p) => p.uid === u.uid) || null,
      })),
      notes,
      categories,
      transactions,
      refunds: refunds.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      payouts: payouts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      feedback: feedback.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      reports: reports.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      reviews: reviews.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      commissionRatePercent:
        settingsDoc.exists && typeof settingsDoc.data?.commissionRatePercent === 'number'
          ? settingsDoc.data.commissionRatePercent
          : 15,
    });
  } catch (error) {
    console.error('Admin overview failed:', error);
    res.status(500).json({ error: 'Unable to load admin analytics.' });
  }
});

// 2. Student Account Status & Seller Eligibility Management
router.patch('/students/:uid/status', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Invalid account status.' });
      return;
    }
    await fsUpdateDoc('users', req.params.uid, { status, updatedAt: new Date().toISOString() }, req.idToken);
    res.json({ ok: true, status });
  } catch {
    res.status(500).json({ error: 'Unable to update student status.' });
  }
});

router.patch('/students/:uid/seller-eligibility', async (req: AuthRequest, res) => {
  try {
    const { sellerEligibilityStatus } = req.body;
    if (!['verified', 'rejected', 'pending'].includes(sellerEligibilityStatus)) {
      res.status(400).json({ error: 'Invalid eligibility status.' });
      return;
    }
    await fsUpdateDoc(
      'users',
      req.params.uid,
      { sellerEligibilityStatus, updatedAt: new Date().toISOString() },
      req.idToken
    );
    await createNotification({
      userId: req.params.uid,
      type: 'seller_verification',
      title: sellerEligibilityStatus === 'verified' ? 'Seller payouts verified' : 'Seller verification update',
      message:
        sellerEligibilityStatus === 'verified'
          ? 'Your seller identity & guardian eligibility has been verified. Payout requests are now enabled.'
          : 'Your seller payout verification status was updated. Please review your details in Dashboard.',
      linkPath: '/dashboard',
      token: req.idToken,
    });
    res.json({ ok: true, sellerEligibilityStatus });
  } catch {
    res.status(500).json({ error: 'Unable to update seller eligibility.' });
  }
});

// 3. Note Moderation
router.patch('/notes/:id/moderate', async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const { status, reason } = req.body;
    if (!['approved', 'rejected', 'removed'].includes(status)) {
      res.status(400).json({ error: 'Invalid moderation status.' });
      return;
    }

    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', req.params.id, token);
    if (!noteSnap.exists || !noteSnap.data) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }

    const note = noteSnap.data;
    const now = new Date().toISOString();
    const prevStatus = note.status;
    await fsUpdateDoc('notes', req.params.id, { status, updatedAt: now }, token);

    if (status === 'removed') {
      deleteStoredPdf(String(note.pdfFileId || ''));
    }

    if (status === 'approved' && prevStatus !== 'approved') {
      const sellerSnap = await fsGetDoc<Record<string, unknown>>('student_profiles', String(note.sellerId), token);
      if (sellerSnap.exists && sellerSnap.data) {
        const s = sellerSnap.data;
        const nextUploaded = Number(s.uploadedNotesCount || 0) + 1;
        const nextPoints = Number(s.contributionPoints || 0) + 25;
        const badges = computeBadges({
          uploadedNotesCount: nextUploaded,
          totalSalesCount: Number(s.totalSalesCount || 0),
          averageRating: Number(s.averageRating || 0),
          followersCount: Number(s.followersCount || 0),
          contributionPoints: nextPoints,
        });
        await fsUpdateDoc(
          'student_profiles',
          String(note.sellerId),
          { uploadedNotesCount: nextUploaded, contributionPoints: nextPoints, badges, updatedAt: now },
          token
        );

        const actId = newDocId();
        await fsSetDoc(
          'activities',
          actId,
          {
            id: actId,
            actorId: String(note.sellerId),
            actorUsername: String(s.username),
            actorName: String(s.fullName),
            type: note.isFree ? 'free_note_uploaded' : 'note_uploaded',
            noteId: String(note.id),
            noteTitle: String(note.title),
            subject: String(note.subject),
            classLevel: Number(note.classLevel),
            isFree: Boolean(note.isFree),
            summary: `${s.fullName} published ${note.isFree ? 'free' : `₹${note.price}`} notes: ${note.title}`,
            createdAt: now,
          },
          token
        );

        const followers = await fsQuery<{ followerId: string }>('followers', {
          filters: [{ field: 'followingId', op: 'EQUAL', value: String(note.sellerId) }],
          token,
        });
        await Promise.all(
          followers.map((f) =>
            createNotification({
              userId: f.followerId,
              type: 'followed_upload',
              prefKey: 'followedUploads',
              title: `New notes from ${s.fullName}`,
              message: `${s.fullName} published "${note.title}" (Class ${note.classLevel} ${note.subject}).`,
              linkPath: `/notes/${note.id}`,
              token,
            })
          )
        );
      }
    }

    await createNotification({
      userId: String(note.sellerId),
      type: 'note_moderation',
      title: `Notes ${status}`,
      message:
        status === 'approved'
          ? `Your study notes "${note.title}" are now live on the marketplace.`
          : `Your study notes "${note.title}" were marked ${status}${reason ? `: ${reason}` : '.'}`,
      linkPath: status === 'approved' ? `/notes/${note.id}` : '/dashboard',
      token,
    });

    res.json({ ok: true, status });
  } catch (error) {
    console.error('Moderation failed:', error);
    res.status(500).json({ error: 'Unable to moderate note.' });
  }
});

// 4. Categories & Commission Rate
router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    if (!name || String(name).trim().length < 2) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const id = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const cat = {
      id,
      name: String(name).trim().slice(0, 80),
      description: String(description || '').trim().slice(0, 300),
      createdAt: new Date().toISOString(),
    };
    await fsSetDoc('categories', id, cat, req.idToken);
    res.status(201).json({ category: cat });
  } catch {
    res.status(500).json({ error: 'Unable to create category.' });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res) => {
  try {
    await fsDeleteDoc('categories', req.params.id, req.idToken);
    res.json({ deleted: true });
  } catch {
    res.status(500).json({ error: 'Unable to delete category.' });
  }
});

router.put('/settings/commission', async (req: AuthRequest, res) => {
  try {
    const rate = Number(req.body.commissionRatePercent);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      res.status(400).json({ error: 'Commission rate must be between 0% and 50%.' });
      return;
    }
    const cleanRate = Number(rate.toFixed(1));
    await fsSetDoc(
      'platform_settings',
      'global',
      { commissionRatePercent: cleanRate, updatedAt: new Date().toISOString() },
      req.idToken
    );
    res.json({ commissionRatePercent: cleanRate });
  } catch {
    res.status(500).json({ error: 'Unable to update commission rate.' });
  }
});

// 5. Refunds Approval & Gateway Processing
router.patch('/refunds/:id', async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const { status, adminNote } = req.body;
    if (!['approved', 'rejected', 'processed'].includes(status)) {
      res.status(400).json({ error: 'Invalid refund status.' });
      return;
    }
    const snap = await fsGetDoc<Record<string, unknown>>('refund_requests', req.params.id, token);
    if (!snap.exists || !snap.data) {
      res.status(404).json({ error: 'Refund request not found.' });
      return;
    }
    const r = snap.data;
    let razorpayRefundId = String(r.razorpayRefundId || '');

    if (status === 'processed') {
      const txSnap = await fsGetDoc<Record<string, unknown>>('transactions', String(r.transactionId), token);
      const tx = txSnap.data;
      if (tx?.razorpayPaymentId) {
        const keyId = process.env.RAZORPAY_KEY_ID?.trim();
        const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
        if (!keyId || !keySecret) {
          res.status(503).json({
            error: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required to process gateway refunds.',
          });
          return;
        }
        const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const refundResp = await rzp.payments.refund(String(tx.razorpayPaymentId), {
          amount: Math.round(Number(r.amount) * 100),
          notes: { refundRequestId: String(r.id) },
        });
        razorpayRefundId = refundResp.id;
      }

      await Promise.all([
        fsUpdateDoc('purchases', String(r.purchaseId), { status: 'refunded' }, token),
        fsUpdateDoc(
          'transactions',
          String(r.transactionId),
          { status: 'refunded', updatedAt: new Date().toISOString() },
          token
        ),
      ]);
      revokeVerifiedPaidEntitlement(String(r.buyerId), String(r.noteId));
    }

    await fsUpdateDoc(
      'refund_requests',
      req.params.id,
      {
        status,
        adminNote: String(adminNote || '').slice(0, 500),
        razorpayRefundId,
        updatedAt: new Date().toISOString(),
      },
      token
    );

    await createNotification({
      userId: String(r.buyerId),
      type: 'refund_update',
      title: `Refund ${status}`,
      message: `Your refund request for "${r.noteTitle}" (₹${r.amount}) has been marked ${status}.`,
      linkPath: '/dashboard',
      token,
    });

    res.json({ ok: true, status, razorpayRefundId });
  } catch (error: unknown) {
    console.error('Refund update failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to process refund.' });
  }
});

// 6. Seller Payouts Approval
router.patch('/payouts/:id', async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const { status, adminNote } = req.body;
    if (!['approved', 'completed', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid payout status.' });
      return;
    }
    const snap = await fsGetDoc<Record<string, unknown>>('seller_payouts', req.params.id, token);
    if (!snap.exists || !snap.data) {
      res.status(404).json({ error: 'Payout request not found.' });
      return;
    }
    await fsUpdateDoc(
      'seller_payouts',
      req.params.id,
      { status, adminNote: String(adminNote || '').slice(0, 500), updatedAt: new Date().toISOString() },
      token
    );
    await createNotification({
      userId: String(snap.data.sellerId),
      type: 'payout_update',
      title: `Payout ${status}`,
      message: `Your payout request of ₹${snap.data.amount} is now ${status}.`,
      linkPath: '/dashboard',
      token,
    });
    res.json({ ok: true, status });
  } catch {
    res.status(500).json({ error: 'Unable to update payout.' });
  }
});

// 7. Admin Feedback Management
router.patch('/feedback/:id', async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const { status, adminReply } = req.body;
    if (status && !['Pending', 'Reviewed', 'Resolved'].includes(status)) {
      res.status(400).json({ error: 'Invalid feedback status.' });
      return;
    }
    const snap = await fsGetDoc<Record<string, unknown>>('feedback', req.params.id, token);
    if (!snap.exists || !snap.data) {
      res.status(404).json({ error: 'Feedback not found.' });
      return;
    }
    const now = new Date().toISOString();
    const updates: Record<string, string> = { updatedAt: now };
    if (status) updates.status = status;
    if (adminReply !== undefined) {
      updates.adminReply = String(adminReply).slice(0, 1200);
      updates.repliedAt = now;
    }
    await fsUpdateDoc('feedback', req.params.id, updates, token);

    await createNotification({
      userId: String(snap.data.userId),
      type: 'feedback_reply',
      prefKey: 'feedbackReplies',
      title: 'Admin responded to your feedback',
      message: adminReply
        ? `Reply: "${String(adminReply).slice(0, 120)}"`
        : `Your feedback status was updated to ${status}.`,
      linkPath: '/feedback',
      token,
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to update feedback.' });
  }
});

router.delete('/feedback/:id', async (req: AuthRequest, res) => {
  try {
    await fsDeleteDoc('feedback', req.params.id, req.idToken);
    res.json({ deleted: true });
  } catch {
    res.status(500).json({ error: 'Unable to remove feedback.' });
  }
});

// 8. Admin Reports & Review Moderation
router.patch('/reports/:id', async (req: AuthRequest, res) => {
  try {
    const token = req.idToken!;
    const { status, adminNote, hideTargetReview } = req.body;
    const snap = await fsGetDoc<Record<string, unknown>>('reports', req.params.id, token);
    if (!snap.exists || !snap.data) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    const report = snap.data;
    await fsUpdateDoc(
      'reports',
      req.params.id,
      {
        status: status || report.status,
        adminNote: String(adminNote || '').slice(0, 500),
        updatedAt: new Date().toISOString(),
      },
      token
    );
    if (hideTargetReview && report.targetType === 'review') {
      await fsUpdateDoc(
        'reviews',
        String(report.targetId),
        { status: 'hidden', updatedAt: new Date().toISOString() },
        token
      );
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to update report.' });
  }
});

router.patch('/reviews/:id/moderate', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'hidden'].includes(status)) {
      res.status(400).json({ error: 'Invalid review status.' });
      return;
    }
    await fsUpdateDoc('reviews', req.params.id, { status, updatedAt: new Date().toISOString() }, req.idToken);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to moderate review.' });
  }
});

export default router;
