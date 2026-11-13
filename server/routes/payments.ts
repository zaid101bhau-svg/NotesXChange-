import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { requireAuth, type AuthRequest } from '../firebaseAdmin.ts';
import { fsGetDoc, fsSetDoc, fsUpdateDoc, fsQuery, newDocId } from '../firestoreRest.ts';
import { createNotification, computeBadges } from '../notifications.ts';
import { recordVerifiedPaidEntitlement } from '../storage.ts';
import { getCuratedCbseNote } from '../cbseLibrary.ts';

const router = Router();

function getRazorpayClient(): { client: Razorpay; keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return {
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
    keySecret,
  };
}

async function getCommissionPercent(token?: string): Promise<number> {
  try {
    const doc = await fsGetDoc<{ commissionRatePercent?: number }>('platform_settings', 'global', token);
    if (doc.exists && typeof doc.data?.commissionRatePercent === 'number') {
      return doc.data.commissionRatePercent;
    }
  } catch {
    // Fallback to env default
  }
  const envRate = Number(process.env.PLATFORM_COMMISSION_PERCENT || 15);
  return Number.isFinite(envRate) ? envRate : 15;
}

function makeReceiptNumber(): string {
  return `NX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

async function finalizeSuccessfulPurchase(params: {
  transactionId: string;
  buyerId: string;
  sellerId: string;
  noteId: string;
  noteTitle: string;
  sellerName: string;
  amount: number;
  commissionAmount: number;
  paymentType: 'free' | 'paid';
  razorpayPaymentId?: string;
  paymentMethod: string;
  token?: string;
}) {
  const existing = await fsQuery<Record<string, unknown>>('purchases', {
    filters: [
      { field: 'buyerId', op: 'EQUAL', value: params.buyerId },
      { field: 'noteId', op: 'EQUAL', value: params.noteId },
      { field: 'status', op: 'EQUAL', value: 'completed' },
    ],
    limit: 1,
    token: params.token,
  });
  if (existing.length > 0) return existing[0];

  const now = new Date().toISOString();
  const receiptNumber = makeReceiptNumber();
  const sellerEarning = Math.max(0, Number((params.amount - params.commissionAmount).toFixed(2)));
  const purchaseId = newDocId();

  const purchaseData = {
    id: purchaseId,
    buyerId: params.buyerId,
    noteId: params.noteId,
    noteTitle: params.noteTitle,
    sellerId: params.sellerId,
    sellerName: params.sellerName,
    amount: params.amount,
    commissionAmount: params.commissionAmount,
    sellerEarning,
    paymentType: params.paymentType,
    transactionId: params.transactionId,
    receiptNumber,
    status: 'completed',
    createdAt: now,
  };

  await Promise.all([
    fsSetDoc('purchases', purchaseId, purchaseData, params.token),
    fsUpdateDoc(
      'transactions',
      params.transactionId,
      {
        status: 'success',
        razorpayPaymentId: params.razorpayPaymentId || '',
        paymentMethod: params.paymentMethod,
        receiptNumber,
        updatedAt: now,
      },
      params.token
    ),
  ]);

  const [noteSnap, sellerSnap] = await Promise.all([
    fsGetDoc<Record<string, unknown>>('notes', params.noteId, params.token).catch(() => ({
      exists: false,
      id: params.noteId,
      data: null,
    })),
    fsGetDoc<Record<string, unknown>>('student_profiles', params.sellerId, params.token).catch(() => ({
      exists: false,
      id: params.sellerId,
      data: null,
    })),
  ]);

  if (noteSnap.exists && noteSnap.data) {
    await fsUpdateDoc(
      'notes',
      params.noteId,
      { purchaseCount: Number(noteSnap.data.purchaseCount || 0) + 1, updatedAt: now },
      params.token
    );
  }

  if (sellerSnap.exists && sellerSnap.data) {
    const s = sellerSnap.data;
    const nextSales = Number(s.totalSalesCount || 0) + 1;
    const nextPoints = Number(s.contributionPoints || 0) + (params.paymentType === 'paid' ? 15 : 5);
    const badges = computeBadges({
      uploadedNotesCount: Number(s.uploadedNotesCount || 0),
      totalSalesCount: nextSales,
      averageRating: Number(s.averageRating || 0),
      followersCount: Number(s.followersCount || 0),
      contributionPoints: nextPoints,
    });
    await fsUpdateDoc(
      'student_profiles',
      params.sellerId,
      { totalSalesCount: nextSales, contributionPoints: nextPoints, badges, updatedAt: now },
      params.token
    );
  }

  await Promise.all([
    createNotification({
      userId: params.buyerId,
      type: 'purchase_success',
      prefKey: 'purchases',
      title: params.paymentType === 'free' ? 'Free notes unlocked' : 'Purchase confirmed',
      message: `Your PDF "${params.noteTitle}" is now unlocked for download (Receipt ${receiptNumber}).`,
      linkPath: `/notes/${params.noteId}`,
      token: params.token,
    }),
    createNotification({
      userId: params.sellerId,
      type: 'new_sale',
      prefKey: 'sales',
      title: params.paymentType === 'free' ? 'New note download' : 'New note sale!',
      message:
        params.paymentType === 'free'
          ? `A student claimed your free notes "${params.noteTitle}".`
          : `You earned ₹${sellerEarning} from "${params.noteTitle}".`,
      linkPath: '/dashboard',
      token: params.token,
    }),
  ]);

  return purchaseData;
}

const ALLOWED_PAYMENT_METHODS = ['upi', 'card', 'netbanking', 'wallet', 'paylater'] as const;

// 1. Payment Gateway Config & Supported Methods
router.get('/payments/config', async (_req, res) => {
  try {
    const rzp = getRazorpayClient();
    const commissionRatePercent = await getCommissionPercent();
    res.json({
      gateway: 'Razorpay',
      configured: Boolean(rzp),
      keyId: rzp ? rzp.keyId : null,
      commissionRatePercent,
      supportedMethods: [
        {
          id: 'upi',
          label: 'UPI & QR Code',
          providers: ['Google Pay', 'PhonePe', 'Paytm UPI', 'BHIM', 'FamPay UPI'],
          description: 'Instant QR scan or UPI ID approval across all NPCI-supported apps.',
        },
        {
          id: 'card',
          label: 'Credit & Debit Cards',
          providers: ['Visa', 'Mastercard', 'RuPay', 'Maestro'],
          description: 'PCI-DSS tokenized card checkout directly through Razorpay.',
        },
        {
          id: 'netbanking',
          label: 'Netbanking',
          providers: ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB'],
          description: 'Direct bank login across 50+ Indian retail banks.',
        },
        {
          id: 'wallet',
          label: 'Digital Wallets',
          providers: ['Amazon Pay', 'Paytm', 'PhonePe', 'Mobikwik', 'Freecharge'],
          description: 'One-tap payment using supported RBI-compliant digital wallets.',
        },
        {
          id: 'paylater',
          label: 'Pay Later & EMI',
          providers: ['Simpl', 'LazyPay', 'ICICI PayLater'],
          description: 'Short-term pay-later options when enabled on the merchant account.',
        },
      ],
      supportedPayoutMethods: ['UPI', 'Bank Transfer', 'Guardian Bank Account'],
      fampayNotice:
        'FamPay UPI payments are accepted only through an authorized Razorpay UPI merchant flow when permitted by NPCI/issuer limits.',
      missingEnvMessage: rzp
        ? null
        : 'Razorpay credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) are not configured on the server yet.',
    });
  } catch (error) {
    console.error('Payments config error:', error);
    res.status(500).json({ error: 'Unable to load payment gateway configuration.' });
  }
});

// 2. Claim Free Note (₹0)
router.post('/notes/:id/claim-free', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const noteId = req.params.id;
    const curatedFallback = getCuratedCbseNote(noteId);
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', noteId, token).catch(() => ({
      exists: false,
      id: noteId,
      data: null,
    }));
    if ((!noteSnap.exists || !noteSnap.data || noteSnap.data.status !== 'approved') && !curatedFallback) {
      res.status(404).json({ error: 'Study note not found.' });
      return;
    }
    const note = (noteSnap.data || curatedFallback) as Record<string, unknown>;
    if (!note.isFree && Number(note.price) > 0) {
      res.status(400).json({ error: 'This is a paid note. Please use checkout.' });
      return;
    }
    if (note.sellerId === uid) {
      res.status(400).json({ error: 'You already own the notes you uploaded.' });
      return;
    }

    const existing = await fsQuery('purchases', {
      filters: [
        { field: 'buyerId', op: 'EQUAL', value: uid },
        { field: 'noteId', op: 'EQUAL', value: noteId },
        { field: 'status', op: 'EQUAL', value: 'completed' },
      ],
      limit: 1,
      token,
    });
    if (existing.length > 0) {
      res.json({ purchase: existing[0], alreadyOwned: true });
      return;
    }

    const now = new Date().toISOString();
    const txId = newDocId();
    const receiptNumber = makeReceiptNumber();
    await fsSetDoc(
      'transactions',
      txId,
      {
        id: txId,
        buyerId: uid,
        sellerId: String(note.sellerId),
        noteId,
        noteTitle: String(note.title),
        razorpayOrderId: '',
        razorpayPaymentId: '',
        amount: 0,
        discountAmount: 0,
        commissionAmount: 0,
        finalPayableAmount: 0,
        paymentMethod: 'free',
        status: 'created',
        receiptNumber,
        createdAt: now,
        updatedAt: now,
      },
      token
    );

    const purchase = await finalizeSuccessfulPurchase({
      transactionId: txId,
      buyerId: uid,
      sellerId: String(note.sellerId),
      noteId,
      noteTitle: String(note.title),
      sellerName: String(note.sellerName),
      amount: 0,
      commissionAmount: 0,
      paymentType: 'free',
      paymentMethod: 'free',
      token,
    });

    res.status(201).json({ purchase });
  } catch (error) {
    console.error('Free note claim error:', error);
    res.status(500).json({ error: 'Unable to claim free study note.' });
  }
});

// 3. Create Server-Side Razorpay Order (Paid Notes)
router.post('/payments/create-order', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const { noteId, paymentMethod } = req.body;
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', String(noteId), token);
    if (!noteSnap.exists || !noteSnap.data || noteSnap.data.status !== 'approved') {
      res.status(404).json({ error: 'Study note is unavailable.' });
      return;
    }
    const note = noteSnap.data;
    if (note.isFree || Number(note.price) <= 0) {
      res.status(400).json({ error: 'Free notes do not require payment.' });
      return;
    }
    if (note.sellerId === uid) {
      res.status(400).json({ error: 'You cannot purchase your own study note.' });
      return;
    }

    const existingPurchase = await fsQuery('purchases', {
      filters: [
        { field: 'buyerId', op: 'EQUAL', value: uid },
        { field: 'noteId', op: 'EQUAL', value: String(note.id) },
        { field: 'status', op: 'EQUAL', value: 'completed' },
      ],
      limit: 1,
      token,
    });
    if (existingPurchase.length > 0) {
      res.status(409).json({ error: 'You have already purchased this study note.' });
      return;
    }

    const rzp = getRazorpayClient();
    if (!rzp) {
      res.status(503).json({
        error:
          'Live payment gateway is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server environment secrets.',
        requiresCredentials: true,
      });
      return;
    }

    const commissionPercent = await getCommissionPercent(token);
    const basePrice = Number(note.price);
    const commissionAmount = Number(((basePrice * commissionPercent) / 100).toFixed(2));
    const finalPayableAmount = basePrice;
    const amountInPaise = Math.round(finalPayableAmount * 100);
    const receiptNumber = makeReceiptNumber();

    const order = await rzp.client.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptNumber,
      notes: { noteId: String(note.id), buyerId: uid, sellerId: String(note.sellerId) },
    });

    const now = new Date().toISOString();
    const txId = newDocId();
    await fsSetDoc(
      'transactions',
      txId,
      {
        id: txId,
        buyerId: uid,
        sellerId: String(note.sellerId),
        noteId: String(note.id),
        noteTitle: String(note.title),
        razorpayOrderId: order.id,
        razorpayPaymentId: '',
        amount: basePrice,
        discountAmount: 0,
        commissionAmount,
        finalPayableAmount,
        paymentMethod: ALLOWED_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'razorpay',
        status: 'created',
        receiptNumber,
        createdAt: now,
        updatedAt: now,
      },
      token
    );

    res.status(201).json({
      transactionId: txId,
      razorpayOrderId: order.id,
      amountInPaise,
      currency: 'INR',
      keyId: rzp.keyId,
      noteTitle: String(note.title),
      commissionAmount,
      finalPayableAmount,
    });
  } catch (error: unknown) {
    console.error('Create Razorpay order failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create payment order.' });
  }
});

// 4. Verify Razorpay Payment Signature
router.post('/payments/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const { transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature, paymentMethod } = req.body;

    const rzp = getRazorpayClient();
    if (!rzp) {
      res.status(503).json({ error: 'Payment verification unavailable: Razorpay credentials missing.' });
      return;
    }

    const txSnap = await fsGetDoc<Record<string, unknown>>('transactions', String(transactionId), token);
    if (!txSnap.exists || !txSnap.data || txSnap.data.buyerId !== uid) {
      res.status(404).json({ error: 'Transaction record not found.' });
      return;
    }
    const tx = txSnap.data;
    if (tx.razorpayOrderId !== razorpay_order_id) {
      res.status(400).json({ error: 'Order ID mismatch.' });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', rzp.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await fsUpdateDoc(
        'transactions',
        String(tx.id),
        {
          status: 'failed',
          failureReason: 'Payment signature verification failed.',
          updatedAt: new Date().toISOString(),
        },
        token
      );
      res.status(400).json({ error: 'Invalid payment signature.' });
      return;
    }

    recordVerifiedPaidEntitlement({
      buyerId: uid,
      noteId: String(tx.noteId),
      transactionId: String(tx.id),
      razorpayOrderId: String(razorpay_order_id),
      razorpayPaymentId: String(razorpay_payment_id),
      amount: Number(tx.finalPayableAmount),
    });

    let resolvedMethod = ALLOWED_PAYMENT_METHODS.includes(paymentMethod)
      ? String(paymentMethod)
      : String(tx.paymentMethod || 'razorpay');
    try {
      const paymentDetails = await rzp.client.payments.fetch(String(razorpay_payment_id));
      if (
        typeof paymentDetails?.method === 'string' &&
        ALLOWED_PAYMENT_METHODS.includes(paymentDetails.method as (typeof ALLOWED_PAYMENT_METHODS)[number])
      ) {
        resolvedMethod = paymentDetails.method;
      }
    } catch {
      // Keep client-selected validated payment method if optional lookup fails
    }

    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', String(tx.noteId), token);
    const purchase = await finalizeSuccessfulPurchase({
      transactionId: String(tx.id),
      buyerId: uid,
      sellerId: String(tx.sellerId),
      noteId: String(tx.noteId),
      noteTitle: String(tx.noteTitle),
      sellerName: String(noteSnap.data?.sellerName || 'Seller'),
      amount: Number(tx.finalPayableAmount),
      commissionAmount: Number(tx.commissionAmount),
      paymentType: 'paid',
      razorpayPaymentId: razorpay_payment_id,
      paymentMethod: resolvedMethod,
      token,
    });

    res.json({ verified: true, purchase });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// 5. Record Payment Failure
router.post('/payments/mark-failed', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { transactionId, reason } = req.body;
    const token = req.idToken!;
    const snap = await fsGetDoc<Record<string, unknown>>('transactions', String(transactionId), token);
    if (!snap.exists || snap.data?.buyerId !== req.user!.uid) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    if (snap.data.status !== 'success') {
      await fsUpdateDoc(
        'transactions',
        String(transactionId),
        {
          status: 'failed',
          failureReason: String(reason || 'Payment cancelled or failed at gateway').slice(0, 300),
          updatedAt: new Date().toISOString(),
        },
        token
      );
    }
    res.json({ status: 'failed' });
  } catch {
    res.status(500).json({ error: 'Unable to update transaction status.' });
  }
});

// 6. Razorpay Webhook Endpoint
router.post('/payments/webhook', async (req: Request & { rawBody?: Buffer }, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      res.status(503).json({ error: 'Webhook secret not configured.' });
      return;
    }
    const signature = req.headers['x-razorpay-signature'];
    if (typeof signature !== 'string' || !req.rawBody) {
      res.status(400).json({ error: 'Missing webhook signature.' });
      return;
    }
    const expected = crypto.createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex');
    if (expected !== signature) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    try {
      const payload = JSON.parse(req.rawBody.toString('utf8')) as {
        event?: string;
        payload?: { payment?: { entity?: Record<string, unknown> } };
      };
      const entity = payload.payload?.payment?.entity;
      const notesMeta = (entity?.notes || {}) as Record<string, unknown>;
      if (
        (payload.event === 'payment.captured' || payload.event === 'order.paid') &&
        typeof notesMeta.buyerId === 'string' &&
        typeof notesMeta.noteId === 'string' &&
        typeof entity?.id === 'string' &&
        typeof entity?.order_id === 'string'
      ) {
        recordVerifiedPaidEntitlement({
          buyerId: notesMeta.buyerId,
          noteId: notesMeta.noteId,
          transactionId: String(notesMeta.transactionId || ''),
          razorpayOrderId: entity.order_id,
          razorpayPaymentId: entity.id,
          amount: Number(entity.amount || 0) / 100,
        });
      }
    } catch {
      // Ignore malformed optional webhook payload fields after signature validation
    }

    res.json({ received: true });
  } catch {
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// 7. Payment History & Receipt PDF
router.get('/payments/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const [transactions, purchases, refunds] = await Promise.all([
      fsQuery<Record<string, unknown>>('transactions', {
        filters: [{ field: 'buyerId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('purchases', {
        filters: [{ field: 'buyerId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('refund_requests', {
        filters: [{ field: 'buyerId', op: 'EQUAL', value: uid }],
        token,
      }),
    ]);

    res.json({
      transactions: transactions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      purchases: purchases.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      refunds: refunds.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    });
  } catch {
    res.status(500).json({ error: 'Unable to fetch payment history.' });
  }
});

router.get('/payments/receipt/:purchaseId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const purchaseSnap = await fsGetDoc<Record<string, unknown>>('purchases', req.params.purchaseId, req.idToken);
    if (!purchaseSnap.exists || !purchaseSnap.data) {
      res.status(404).json({ error: 'Receipt not found.' });
      return;
    }
    const p = purchaseSnap.data;
    if (p.buyerId !== req.user!.uid && !req.isAdmin) {
      res.status(403).json({ error: 'Unauthorized to download this receipt.' });
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 420]);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText('NOTE XCHANGE - OFFICIAL STUDY NOTES RECEIPT', {
      x: 42,
      y: 365,
      size: 16,
      font: fontBold,
      color: rgb(0.11, 0.31, 0.85),
    });
    page.drawText('Learn Together. Share Knowledge. Grow Together.', {
      x: 42,
      y: 344,
      size: 10,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.48),
    });

    const lines = [
      `Receipt Number: ${p.receiptNumber}`,
      `Transaction ID: ${p.transactionId}`,
      `Purchase Date: ${new Date(String(p.createdAt)).toLocaleString('en-IN')}`,
      `Study Note: ${p.noteTitle}`,
      `Author / Seller: ${p.sellerName}`,
      `Payment Type: ${p.paymentType === 'free' ? 'Free Resource Claim' : 'Verified Paid Order'}`,
      `Amount Paid: INR ${Number(p.amount).toFixed(2)}`,
      `Status: ${String(p.status).toUpperCase()}`,
    ];

    lines.forEach((line, idx) => {
      page.drawText(line, {
        x: 42,
        y: 300 - idx * 26,
        size: 11,
        font: idx === 6 ? fontBold : fontRegular,
        color: rgb(0.08, 0.12, 0.2),
      });
    });

    const bytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${p.receiptNumber}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch {
    res.status(500).json({ error: 'Unable to generate receipt.' });
  }
});

// 8. Seller Earnings & Payouts
async function calculateSellerSummary(sellerId: string, token: string) {
  const [userSnap, purchases, payouts] = await Promise.all([
    fsGetDoc<Record<string, unknown>>('users', sellerId, token),
    fsQuery<Record<string, unknown>>('purchases', {
      filters: [{ field: 'sellerId', op: 'EQUAL', value: sellerId }],
      token,
    }),
    fsQuery<Record<string, unknown>>('seller_payouts', {
      filters: [{ field: 'sellerId', op: 'EQUAL', value: sellerId }],
      token,
    }),
  ]);

  const completedPurchases = purchases.filter((p) => p.status === 'completed');
  const paidSales = completedPurchases.filter((p) => p.paymentType === 'paid');
  const grossEarnings = Number(paidSales.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(2));
  const platformCommission = Number(paidSales.reduce((s, p) => s + Number(p.commissionAmount || 0), 0).toFixed(2));
  const netEarnings = Number(paidSales.reduce((s, p) => s + Number(p.sellerEarning || 0), 0).toFixed(2));

  const completedPayouts = Number(
    payouts
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + Number(p.amount || 0), 0)
      .toFixed(2)
  );
  const pendingSettlements = Number(
    payouts
      .filter((p) => p.status === 'pending' || p.status === 'approved')
      .reduce((s, p) => s + Number(p.amount || 0), 0)
      .toFixed(2)
  );
  const availableBalance = Math.max(0, Number((netEarnings - completedPayouts - pendingSettlements).toFixed(2)));

  return {
    summary: {
      totalSales: completedPurchases.length,
      grossEarnings,
      platformCommission,
      netEarnings,
      completedPayouts,
      pendingSettlements,
      availableBalance,
      sellerEligibilityStatus: String(userSnap.data?.sellerEligibilityStatus || 'not_applied'),
    },
    payouts: payouts.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    sales: completedPurchases.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  };
}

router.get('/seller/earnings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await calculateSellerSummary(req.user!.uid, req.idToken!);
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Unable to calculate seller earnings.' });
  }
});

router.post('/seller/payouts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const { amount, payoutMethod } = req.body;
    const [userSnap, profileSnap, earningsData] = await Promise.all([
      fsGetDoc<Record<string, unknown>>('users', uid, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', uid, token),
      calculateSellerSummary(uid, token),
    ]);

    const userData = userSnap.data;
    if (userData?.sellerEligibilityStatus !== 'verified') {
      res.status(403).json({
        error: 'Seller eligibility and guardian/KYC verification must be approved before requesting payouts.',
      });
      return;
    }

    const reqAmount = Number(amount);
    if (!Number.isFinite(reqAmount) || reqAmount < 100) {
      res.status(400).json({ error: 'Minimum payout withdrawal amount is ₹100.' });
      return;
    }
    if (reqAmount > earningsData.summary.availableBalance) {
      res.status(400).json({ error: 'Requested payout exceeds your available balance.' });
      return;
    }

    const now = new Date().toISOString();
    const id = newDocId();
    const payout = {
      id,
      sellerId: uid,
      sellerName: String(profileSnap.data?.fullName || 'Seller'),
      amount: Number(reqAmount.toFixed(2)),
      status: 'pending',
      payoutMethod: String(payoutMethod || 'UPI').slice(0, 60),
      accountReference: String(userData.payoutUpiOrBankRef || 'Verified Account'),
      adminNote: '',
      createdAt: now,
      updatedAt: now,
    };
    await fsSetDoc('seller_payouts', id, payout, token);
    res.status(201).json({ payout });
  } catch {
    res.status(500).json({ error: 'Unable to request seller payout.' });
  }
});

// 9. Refund Requests
router.post('/refunds', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const { purchaseId, reason } = req.body;
    if (!reason || String(reason).trim().length < 5) {
      res.status(400).json({ error: 'Please explain the reason for your refund request.' });
      return;
    }

    const purchaseSnap = await fsGetDoc<Record<string, unknown>>('purchases', String(purchaseId), token);
    if (!purchaseSnap.exists || !purchaseSnap.data || purchaseSnap.data.buyerId !== uid) {
      res.status(404).json({ error: 'Purchase record not found.' });
      return;
    }
    const purchase = purchaseSnap.data;
    if (purchase.paymentType === 'free' || Number(purchase.amount) <= 0) {
      res.status(400).json({ error: 'Free note claims are not eligible for monetary refunds.' });
      return;
    }
    if (purchase.status === 'refunded') {
      res.status(409).json({ error: 'This purchase has already been refunded.' });
      return;
    }

    const existing = await fsQuery('refund_requests', {
      filters: [{ field: 'purchaseId', op: 'EQUAL', value: String(purchase.id) }],
      limit: 1,
      token,
    });
    if (existing.length > 0) {
      res.status(409).json({ error: 'A refund request is already filed for this purchase.' });
      return;
    }

    const now = new Date().toISOString();
    const id = newDocId();
    const refundReq = {
      id,
      purchaseId: String(purchase.id),
      transactionId: String(purchase.transactionId),
      buyerId: uid,
      sellerId: String(purchase.sellerId),
      noteId: String(purchase.noteId),
      noteTitle: String(purchase.noteTitle),
      amount: Number(purchase.amount),
      reason: String(reason).trim().slice(0, 1000),
      status: 'pending',
      adminNote: '',
      razorpayRefundId: '',
      createdAt: now,
      updatedAt: now,
    };
    await fsSetDoc('refund_requests', id, refundReq, token);
    res.status(201).json({ refund: refundReq });
  } catch {
    res.status(500).json({ error: 'Unable to submit refund request.' });
  }
});

export default router;
