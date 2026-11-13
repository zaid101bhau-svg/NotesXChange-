import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CreditCard,
  Smartphone,
  Landmark,
  Wallet,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Download,
  RotateCcw,
  Ban,
  X,
  Sparkles,
  FileText,
  Receipt,
} from 'lucide-react';
import { apiFetch, downloadAuthenticatedBlob } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { StudyNote, PurchaseRecord } from '../types/marketplace';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };
  }
}

type CheckoutPaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'paylater';

interface SupportedMethodMeta {
  id: CheckoutPaymentMethod;
  label: string;
  providers: string[];
  description: string;
}

interface CheckoutPageProps {
  noteId: string;
  onNavigate: (path: string) => void;
}

const POPULAR_BANKS = [
  { code: '', label: 'Choose preferred bank inside Razorpay' },
  { code: 'SBIN', label: 'State Bank of India (SBI)' },
  { code: 'HDFC', label: 'HDFC Bank' },
  { code: 'ICIC', label: 'ICICI Bank' },
  { code: 'UTIB', label: 'Axis Bank' },
  { code: 'KKBK', label: 'Kotak Mahindra Bank' },
  { code: 'PUNB', label: 'Punjab National Bank (PNB)' },
];

const POPULAR_WALLETS = [
  { code: '', label: 'Choose preferred wallet inside Razorpay' },
  { code: 'amazonpay', label: 'Amazon Pay' },
  { code: 'paytm', label: 'Paytm Wallet' },
  { code: 'phonepe', label: 'PhonePe Wallet' },
  { code: 'mobikwik', label: 'MobiKwik' },
  { code: 'freecharge', label: 'Freecharge' },
];

const UPI_APP_HINTS = ['Google Pay', 'PhonePe', 'Paytm UPI', 'BHIM', 'FamPay UPI'];

export function CheckoutPage({ noteId, onNavigate }: CheckoutPageProps) {
  const { firebaseUser, profile, openAuthModal } = useAuth();
  const [note, setNote] = useState<StudyNote | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [preferredBank, setPreferredBank] = useState('');
  const [preferredWallet, setPreferredWallet] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState<{
    configured: boolean;
    commissionRatePercent: number;
    supportedMethods?: SupportedMethodMeta[];
    fampayNotice: string;
    missingEnvMessage: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [completedPurchase, setCompletedPurchase] = useState<PurchaseRecord | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    if (!showRefundModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowRefundModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showRefundModal]);

  useEffect(() => {
    let mounted = true;
    async function loadCheckout() {
      setLoading(true);
      try {
        const [noteData, configData] = await Promise.all([
          apiFetch<{ note: StudyNote; hasPurchased: boolean; purchaseRecord: PurchaseRecord | null }>(
            `/notes/${noteId}`
          ),
          apiFetch<{
            configured: boolean;
            commissionRatePercent: number;
            supportedMethods?: SupportedMethodMeta[];
            fampayNotice: string;
            missingEnvMessage: string | null;
          }>('/payments/config'),
        ]);
        if (mounted) {
          setNote(noteData.note);
          setGatewayConfig(configData);
          if (noteData.hasPurchased && noteData.purchaseRecord) {
            setCompletedPurchase(noteData.purchaseRecord);
          }
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Unable to load checkout.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCheckout();
    return () => {
      mounted = false;
    };
  }, [noteId]);

  const handlePayNow = async () => {
    if (!firebaseUser) {
      openAuthModal('login');
      return;
    }
    if (!note) return;

    const trimmedUpi = upiId.trim();
    if (paymentMethod === 'upi' && trimmedUpi && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(trimmedUpi)) {
      setError('Please enter a valid UPI ID (for example: student@okicici) or leave it blank to scan QR.');
      return;
    }

    setError('');
    setBusy(true);

    try {
      const order = await apiFetch<{
        transactionId: string;
        razorpayOrderId: string;
        amountInPaise: number;
        currency: string;
        keyId: string;
        noteTitle: string;
      }>('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ noteId: note.id, paymentMethod }),
      });

      if (!window.Razorpay) {
        throw new Error(
          'Razorpay checkout script is unavailable. Please disable script blockers and reload.'
        );
      }

      const prefill: Record<string, string> = {
        name: profile?.fullName || '',
        email: firebaseUser.email || '',
        method: paymentMethod,
      };
      if (paymentMethod === 'upi' && trimmedUpi) {
        prefill.vpa = trimmedUpi;
      }
      if (paymentMethod === 'netbanking' && preferredBank) {
        prefill.bank = preferredBank;
      }
      if (paymentMethod === 'wallet' && preferredWallet) {
        prefill.wallet = preferredWallet;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency,
        name: 'NOTE XCHANGE',
        description: order.noteTitle,
        order_id: order.razorpayOrderId,
        prefill,
        config: {
          display: {
            sequence: [`block.${paymentMethod}`],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        theme: { color: '#2563EB' },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verification = await apiFetch<{ verified: boolean; purchase: PurchaseRecord }>(
              '/payments/verify',
              {
                method: 'POST',
                body: JSON.stringify({
                  transactionId: order.transactionId,
                  paymentMethod,
                  ...response,
                }),
              }
            );
            setCompletedPurchase(verification.purchase);
          } catch (verifyErr: unknown) {
            setError(
              verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed.'
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: async () => {
            await apiFetch('/payments/mark-failed', {
              method: 'POST',
              body: JSON.stringify({
                transactionId: order.transactionId,
                reason: 'Checkout modal closed by user before payment completion.',
              }),
            }).catch(() => {});
            setError('Payment was cancelled before completion.');
            setBusy(false);
          },
        },
      });

      rzp.on('payment.failed', async (resp: unknown) => {
        const desc =
          typeof resp === 'object' &&
          resp &&
          'error' in resp &&
          typeof (resp as { error?: { description?: string } }).error?.description === 'string'
            ? (resp as { error: { description: string } }).error.description
            : 'Payment failed at gateway.';
        await apiFetch('/payments/mark-failed', {
          method: 'POST',
          body: JSON.stringify({ transactionId: order.transactionId, reason: desc }),
        }).catch(() => {});
        setError(`Payment failed: ${desc}`);
        setBusy(false);
      });

      rzp.open();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to initiate payment.');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Note Not Available</h1>
        <button
          type="button"
          onClick={() => onNavigate('/explore')}
          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  if (completedPurchase) {
    const celebrationParticles = [
      { x: -115, y: -70, rotate: -35, color: 'bg-blue-500', delay: 0.05 },
      { x: -75, y: -105, rotate: 25, color: 'bg-violet-500', delay: 0.08 },
      { x: -28, y: -118, rotate: -18, color: 'bg-emerald-500', delay: 0.1 },
      { x: 32, y: -115, rotate: 42, color: 'bg-amber-400', delay: 0.07 },
      { x: 82, y: -98, rotate: -28, color: 'bg-blue-600', delay: 0.11 },
      { x: 118, y: -62, rotate: 30, color: 'bg-violet-600', delay: 0.09 },
      { x: -125, y: -15, rotate: 48, color: 'bg-emerald-400', delay: 0.12 },
      { x: 126, y: -12, rotate: -45, color: 'bg-amber-500', delay: 0.06 },
      { x: -90, y: 38, rotate: -20, color: 'bg-violet-400', delay: 0.14 },
      { x: 92, y: 36, rotate: 22, color: 'bg-blue-400', delay: 0.13 },
    ];

    const handleDownloadNow = async () => {
      setDownloadingPdf(true);
      setError('');
      try {
        await downloadAuthenticatedBlob(`/notes/${note.id}/download`, `${note.title}.pdf`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to download PDF right now.');
      } finally {
        setDownloadingPdf(false);
      }
    };

    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-white p-7 sm:p-9 shadow-sm"
        >
          {/* Subtle celebration header aura */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-50/90 via-blue-50/40 to-transparent" />

          {/* Celebratory badge & particle burst */}
          <div className="relative flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center">
              {celebrationParticles.map((p, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    x: p.x,
                    y: p.y,
                    scale: [0, 1.15, 0.9],
                    rotate: p.rotate,
                  }}
                  transition={{ duration: 1.15, delay: p.delay, ease: 'easeOut' }}
                  className={`pointer-events-none absolute h-2.5 w-2.5 rounded-sm ${p.color}`}
                />
              ))}

              <motion.div
                initial={{ scale: 0.8, opacity: 0.7 }}
                animate={{ scale: [0.85, 1.55], opacity: [0.6, 0] }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                className="pointer-events-none absolute h-16 w-16 rounded-full border-2 border-emerald-400"
              />

              <motion.div
                initial={{ scale: 0.4, rotate: -18 }}
                animate={{ scale: [0.4, 1.12, 1], rotate: [-18, 6, 0] }}
                transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.08 }}
                className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md"
              >
                <CheckCircle2 className="h-9 w-9" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.35 }}
              className="mt-5"
            >
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Payment Successful
              </div>
              <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-slate-900">
                Study Notes Unlocked!
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Thank you for supporting peer learning. Your full PDF and official receipt are ready.
              </p>
            </motion.div>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Purchase Summary Box */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.35 }}
            className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/90 p-5 text-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
              <span className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                <FileText className="h-4 w-4 text-blue-600" />
                Purchase Summary
              </span>
              <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 capitalize">
                {completedPurchase.status}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Study Note</span>
                <span className="text-right font-semibold text-slate-900">
                  {completedPurchase.noteTitle}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Class &amp; Subject</span>
                <span className="text-right font-medium text-slate-800">
                  Class {note.classLevel} · {note.subject} ({note.board})
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Author / Seller</span>
                <span className="font-medium text-slate-800">{completedPurchase.sellerName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Receipt Number</span>
                <span className="font-mono text-xs font-semibold text-slate-900">
                  {completedPurchase.receiptNumber}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-xs text-slate-700">
                  {completedPurchase.transactionId}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">Purchase Date</span>
                <span className="text-slate-800">
                  {new Date(completedPurchase.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2.5 tabular-nums">
                <span className="font-semibold text-slate-900">Total Amount Paid</span>
                <span className="font-display text-lg font-extrabold text-blue-700">
                  ₹{Number(completedPurchase.amount).toFixed(2)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Primary Download & Secondary Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.35 }}
            className="mt-6 space-y-3"
          >
            <button
              type="button"
              onClick={handleDownloadNow}
              disabled={downloadingPdf}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloadingPdf
                ? 'Preparing PDF Download...'
                : `Download Now · Full PDF (${note.pageCount} pages)`}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  downloadAuthenticatedBlob(
                    `/payments/receipt/${completedPurchase.id}`,
                    `receipt-${completedPurchase.receiptNumber}.pdf`
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Receipt className="h-3.5 w-3.5 text-slate-600" />
                Download Official Receipt
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(`/notes/${note.id}`)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  View Note &amp; Rate
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard')}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                >
                  Go to My Purchases →
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const commissionRate = gatewayConfig?.commissionRatePercent ?? 15;
  const platformFeeIncluded = Number(((note.price * commissionRate) / 100).toFixed(2));

  const methodCards: Array<{
    id: CheckoutPaymentMethod;
    title: string;
    subtitle: string;
    providers: string[];
    icon: typeof Smartphone;
    accent: string;
  }> = [
    {
      id: 'upi',
      title: 'UPI & QR Code',
      subtitle: `Instant zero-fee UPI payment via QR scan or UPI ID. ${gatewayConfig?.fampayNotice || ''}`,
      providers: UPI_APP_HINTS,
      icon: Smartphone,
      accent: 'text-blue-600',
    },
    {
      id: 'card',
      title: 'Credit & Debit Cards',
      subtitle:
        'Secured directly via Razorpay PCI-DSS tokenization. Card details and CVV are never stored by NOTE XCHANGE.',
      providers: ['Visa', 'Mastercard', 'RuPay', 'Maestro'],
      icon: CreditCard,
      accent: 'text-violet-700',
    },
    {
      id: 'netbanking',
      title: 'Netbanking (50+ Indian Banks)',
      subtitle: 'Log in securely to your bank portal to authorize instant payment.',
      providers: ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB'],
      icon: Landmark,
      accent: 'text-emerald-700',
    },
    {
      id: 'wallet',
      title: 'Digital Wallets',
      subtitle: 'Pay quickly using verified RBI-compliant mobile and shopping wallets.',
      providers: ['Amazon Pay', 'Paytm', 'PhonePe', 'MobiKwik', 'Freecharge'],
      icon: Wallet,
      accent: 'text-indigo-600',
    },
    {
      id: 'paylater',
      title: 'Pay Later & Cardless EMI',
      subtitle: 'Split or defer payments through supported providers when eligible on Razorpay.',
      providers: ['Simpl', 'LazyPay', 'ICICI PayLater'],
      icon: Clock,
      accent: 'text-amber-700',
    },
  ];

  const selectedMethodTitle =
    methodCards.find((m) => m.id === paymentMethod)?.title || 'Razorpay Checkout';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate(`/notes/${note.id}`)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Note Details
      </button>

      <h1 className="mt-4 font-display text-3xl font-bold text-slate-900">Secure Checkout</h1>
      <p className="mt-1 text-sm text-slate-600">
        Choose from UPI, Cards, Netbanking, Digital Wallets, or Pay Later via verified Razorpay
        checkout.
      </p>

      {gatewayConfig && !gatewayConfig.configured && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Payment Gateway Credentials Required</p>
            <p className="mt-1 text-xs leading-relaxed">
              {gatewayConfig.missingEnvMessage} Configure{' '}
              <code className="font-mono">RAZORPAY_KEY_ID</code>,{' '}
              <code className="font-mono">RAZORPAY_KEY_SECRET</code>, and{' '}
              <code className="font-mono">RAZORPAY_WEBHOOK_SECRET</code> in environment secrets to
              process real UPI, Card, Netbanking, Wallet, and Pay Later transactions. NOTE XCHANGE
              never simulates fake payment successes.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-slate-900">Select Payment Option</h2>
            <p className="mt-1 text-xs text-slate-500">
              All options settle instantly and generate an official PDF receipt.
            </p>

            <div className="mt-4 space-y-3">
              {methodCards.map((option) => {
                const Icon = option.icon;
                const active = paymentMethod === option.id;
                return (
                  <div
                    key={option.id}
                    className={`rounded-xl border transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-3 p-4">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={active}
                        onChange={() => {
                          setPaymentMethod(option.id);
                          setError('');
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                            <Icon className={`h-4 w-4 ${option.accent}`} />
                            {option.title}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {option.providers.slice(0, 3).join(' · ')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {option.subtitle}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {option.providers.map((provider) => (
                            <span
                              key={provider}
                              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
                            >
                              {provider}
                            </span>
                          ))}
                        </div>
                      </div>
                    </label>

                    {/* Method-specific quick prefill options */}
                    {active && option.id === 'upi' && (
                      <div className="border-t border-blue-100 px-4 py-3 bg-white/70 rounded-b-xl">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          UPI ID / VPA (Optional — leave blank to scan QR in Razorpay)
                        </label>
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="e.g. studentname@okicici or 9876543210@ybl"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        />
                      </div>
                    )}

                    {active && option.id === 'netbanking' && (
                      <div className="border-t border-blue-100 px-4 py-3 bg-white/70 rounded-b-xl">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Preferred Bank (Optional)
                        </label>
                        <select
                          value={preferredBank}
                          onChange={(e) => setPreferredBank(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        >
                          {POPULAR_BANKS.map((bank) => (
                            <option key={bank.code || 'any'} value={bank.code}>
                              {bank.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {active && option.id === 'wallet' && (
                      <div className="border-t border-blue-100 px-4 py-3 bg-white/70 rounded-b-xl">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Preferred Wallet (Optional)
                        </label>
                        <select
                          value={preferredWallet}
                          onChange={(e) => setPreferredWallet(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                        >
                          {POPULAR_WALLETS.map((wallet) => (
                            <option key={wallet.code || 'any'} value={wallet.code}>
                              {wallet.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-xs leading-relaxed text-slate-600">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-900">
                <RotateCcw className="h-4 w-4 text-blue-600" />
                Refund Policy &amp; Buyer Protection
              </h3>
              <button
                type="button"
                onClick={() => setShowRefundModal(true)}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Read Full Refund Policy →
              </button>
            </div>

            <ul className="mt-3 space-y-1.5 text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                <span>
                  <strong className="text-slate-800">7-Day Eligibility Window:</strong> Request a
                  refund within 7 days if the PDF is corrupted, unreadable, materially differs from
                  its 2-page preview/description, or violates originality rules.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                <span>
                  <strong className="text-slate-800">Original Source Settlement:</strong> Approved
                  refunds are returned via Razorpay to your original UPI, card, bank, or wallet
                  account (5–7 business days).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-violet-600 mt-0.5" />
                <span>
                  <strong className="text-slate-800">Minor Safeguards:</strong> Students under 18
                  must complete paid purchases with parent or guardian permission.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-slate-900">Order Summary</h2>
            <div className="mt-4 space-y-3 border-b border-slate-100 pb-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Notes Title</span>
                <span className="text-right font-semibold text-slate-900">{note.title}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Seller</span>
                <span className="font-medium text-slate-800">{note.sellerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">Selected Method</span>
                <span className="font-semibold text-blue-700">{selectedMethodTitle}</span>
              </div>
              <div className="flex justify-between gap-3 tabular-nums">
                <span className="text-slate-600">Base Price</span>
                <span className="font-medium text-slate-900">₹{note.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3 tabular-nums">
                <span className="text-slate-600">Discount</span>
                <span className="font-medium text-emerald-700">₹0.00</span>
              </div>
              <div className="flex justify-between gap-3 tabular-nums text-xs text-slate-500">
                <span>Platform Commission ({commissionRate}% included)</span>
                <span>₹{platformFeeIncluded.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between tabular-nums">
              <span className="font-display text-base font-bold text-slate-900">
                Final Payable Amount
              </span>
              <span className="font-display text-2xl font-extrabold text-blue-700">
                ₹{note.price.toFixed(2)}
              </span>
            </div>

            <button
              type="button"
              onClick={handlePayNow}
              disabled={busy || !gatewayConfig?.configured}
              className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Opening Razorpay...' : `Pay Now · ₹${note.price}`}
            </button>

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
              <span>HMAC-SHA256 verified order &amp; webhook protection.</span>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Before paying, review our{' '}
              <button
                type="button"
                onClick={() => setShowRefundModal(true)}
                className="font-semibold text-blue-600 hover:underline"
              >
                Refund Policy
              </button>{' '}
              (7-day buyer protection for defective or misrepresented notes).
            </p>
          </div>
        </div>
      </div>

      {/* Refund Policy Modal */}
      {showRefundModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          onClick={() => setShowRefundModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-policy-modal-title"
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="refund-policy-modal-title"
                    className="font-display text-xl font-bold text-slate-900"
                  >
                    NOTE XCHANGE Refund Policy
                  </h2>
                  <p className="text-xs text-slate-500">
                    Clear buyer protection conditions for Class 6–12 study note purchases
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                aria-label="Close Refund Policy"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm text-slate-700">
              <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  1. Eligible Conditions for a Refund (Within 7 Days)
                </h3>
                <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-emerald-950">
                  <li>
                    <strong>Corrupted or Unreadable PDF:</strong> The downloaded PDF fails to open,
                    contains blank pages, or has illegible scans.
                  </li>
                  <li>
                    <strong>Materially Misrepresented Content:</strong> The full PDF significantly
                    differs from its title, Class/Board/Subject tags, description, or 2-page sample
                    preview.
                  </li>
                  <li>
                    <strong>Copyright or Originality Violation:</strong> The material is proven to
                    be an unauthorized textbook scan or pirated coaching module.
                  </li>
                  <li>
                    <strong>Duplicate Payment:</strong> Accidental double charge for the exact same
                    study note transaction.
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
                  <Ban className="h-4 w-4 text-red-600" />
                  2. Non-Refundable Situations
                </h3>
                <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
                  <li>
                    Change of mind or exam completion after downloading accurate notes that match the
                    sample preview and description.
                  </li>
                  <li>
                    Refund requests submitted more than <strong>7 calendar days</strong> after the
                    purchase date.
                  </li>
                  <li>Free study note claims (₹0) and accounts suspended for policy abuse.</li>
                </ul>
              </section>

              <section className="space-y-2 text-xs leading-relaxed text-slate-600">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  3. How to Request &amp; Settlement Timeline
                </h3>
                <p>
                  Open <strong>Dashboard → Purchased Notes</strong>, select the order, and click{' '}
                  <strong>Request Refund</strong> with a brief explanation. Our moderation team
                  reviews all requests within <strong>24–48 business hours</strong>.
                </p>
                <p>
                  Once approved and processed, the refund is issued directly via Razorpay back to
                  your original payment source (UPI, Card, Netbanking, Wallet, or Pay Later). Bank
                  settlements typically reflect within <strong>5–7 business days</strong>. Access to
                  the refunded PDF is revoked upon refund completion.
                </p>
              </section>

              <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 text-xs leading-relaxed text-violet-950">
                <h3 className="font-display text-sm font-bold text-violet-900">
                  4. Student &amp; Parent/Guardian Safeguards
                </h3>
                <p className="mt-1">
                  Students under 18 must have parent or legal guardian permission before completing a
                  paid checkout. Parents or guardians may contact support or submit a refund inquiry
                  for unauthorized minor transactions.
                </p>
              </section>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowRefundModal(false);
                  onNavigate('/terms');
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                View Full Terms &amp; Refund Policy Page
              </button>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Got It · Continue Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
