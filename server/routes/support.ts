import { Router } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { optionalAuth, type AuthRequest } from '../firebaseAdmin.ts';

const router = Router();

const SUPPORT_SYSTEM_INSTRUCTION = `You are the 24x7 Customer Care Assistant for NOTE XCHANGE ("Learn Together. Share Knowledge. Grow Together."), an educational study-notes marketplace for Class 6 to Class 12 students across CBSE, ICSE, and State Boards.

Your role:
- Provide polite, clear, accurate, concise customer care answers to students, parents, and sellers 24x7.
- Keep responses focused and easy to scan (2 to 5 short sentences or brief bullet points). Avoid unnecessary fluff.
- NEVER ask users for passwords, OTPs, CVVs, UPI PINs, bank PINs, or API keys.

Accurate Platform Facts:
1. Buying & Free Notes:
   - Free notes (₹0) must be claimed using "Claim Free Note" on the note page before downloading the full PDF.
   - Every study note provides a free 2-page PDF sample preview before purchase.
   - Paid notes unlock immediately after verified Razorpay payment.
2. Payment Options:
   - Powered by Razorpay with server-side HMAC-SHA256 verification.
   - Supported options: UPI & QR Code (Google Pay, PhonePe, Paytm UPI, BHIM, and FamPay UPI within NPCI/issuer limits), Credit & Debit Cards (Visa, Mastercard, RuPay, Maestro), Netbanking (50+ Indian banks), Digital Wallets (Amazon Pay, Paytm, PhonePe, MobiKwik, Freecharge), and Pay Later & EMI (Simpl, LazyPay, ICICI PayLater where eligible).
   - Official PDF receipts can be downloaded right after checkout or anytime from Dashboard -> Payment History.
3. Refund Policy:
   - Refund requests can be submitted within 7 calendar days of purchase via Dashboard -> Purchased Notes -> Request Refund.
   - Eligible reasons: corrupted/unreadable PDF, content materially different from its description or 2-page preview, copyright/originality violations, or duplicate charges.
   - Free (₹0) claims and change-of-mind after downloading accurate notes are not eligible.
   - Moderation reviews requests within 24-48 business hours. Approved Razorpay refunds settle back to the original payment method in 5-7 business days, and PDF access is revoked.
4. Selling & Payouts:
   - Students can enable the Seller role in Onboarding or Dashboard -> Profile Settings, then upload original PDFs on /upload with an originality attestation.
   - New uploads undergo moderation approval before appearing publicly.
   - Default platform commission is 15%.
   - Payout withdrawals (minimum ₹100 via UPI Settlement, Bank Transfer IMPS/NEFT, or Guardian Verified Bank Account) require Seller Eligibility & Payout Verification (including parent/guardian verification for minors under 18).
5. Student Safety & Human Escalation:
   - Learners under 18 require parent/guardian consent during onboarding and permission for paid purchases.
   - If a user needs manual account intervention, copyright takedown, order investigation, or bug reporting, tell them they can submit a ticket anytime on the Feedback page (/feedback) or email support@notexchange.edu.in (/contact).`;

interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 12000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

router.post('/support/chat', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          '24x7 AI Customer Care is temporarily unavailable because GEMINI_API_KEY is not configured. Please use the Feedback or Contact Support page.',
      });
      return;
    }

    const { message, history, currentPath } = req.body as {
      message?: unknown;
      history?: unknown;
      currentPath?: unknown;
    };

    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    if (!cleanMessage) {
      res.status(400).json({ error: 'Please enter a question or support message.' });
      return;
    }
    if (cleanMessage.length > 1500) {
      res.status(400).json({ error: 'Support message must be under 1500 characters.' });
      return;
    }

    const safeHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history)) {
      const recent = history.slice(-12) as ChatHistoryTurn[];
      for (const turn of recent) {
        if (
          turn &&
          (turn.role === 'user' || turn.role === 'assistant') &&
          typeof turn.text === 'string' &&
          turn.text.trim()
        ) {
          safeHistory.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.text.trim().slice(0, 1500) }],
          });
        }
      }
    }

    const contextNote = [
      `Current page: ${typeof currentPath === 'string' ? currentPath.slice(0, 120) : '/'}`,
      req.user ? 'User status: Signed-in student' : 'User status: Guest visitor',
    ].join(' | ');

    const systemInstruction = `${SUPPORT_SYSTEM_INSTRUCTION}\n\nSession Context: ${contextNote}`;

    const isTransientError = (err: unknown): boolean => {
      const e = err as { status?: number; message?: string; name?: string };
      const msg = err instanceof Error ? err.message : String(e?.message || '');
      return (
        e?.status === 503 ||
        e?.status === 500 ||
        e?.name === 'AbortError' ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('"code":503') ||
        msg.includes('TIMEOUT')
      );
    };

    const askModel = async (model: string, useLowThinking: boolean) => {
      const chat = ai.chats.create({
        model,
        history: safeHistory,
        config: useLowThinking
          ? { systemInstruction, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : { systemInstruction },
      });
      return Promise.race([
        chat.sendMessage({ message: cleanMessage }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('UNAVAILABLE TIMEOUT'), { status: 503 })), 12500)
        ),
      ]);
    };

    let response;
    const attempts: Array<{ model: string; lowThink: boolean; delayMs: number }> = [
      { model: 'gemini-4-hydrogen', lowThink: true, delayMs: 0 },
      { model: 'gemini-3.1-flash-lite', lowThink: false, delayMs: 200 },
    ];

    let lastErr: unknown;
    for (const attempt of attempts) {
      if (attempt.delayMs > 0) {
        await new Promise((r) => setTimeout(r, attempt.delayMs));
      }
      try {
        response = await askModel(attempt.model, attempt.lowThink);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        if (!isTransientError(err)) {
          throw err;
        }
      }
    }
    if (lastErr) {
      throw lastErr;
    }

    const replyText = (response?.text ?? '').trim();

    if (!replyText) {
      res.status(502).json({
        error: 'Our AI care agent could not generate a reply right now. Please try again.',
      });
      return;
    }

    res.json({
      reply: replyText,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('Support AI chat error:', error);
    const errObj = error as { status?: number; code?: string | number; message?: string };
    const status = typeof errObj?.status === 'number' ? errObj.status : undefined;
    const rawMsg = error instanceof Error ? error.message : String(errObj?.message || 'Unable to reach 24x7 support.');

    if (
      status === 403 ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('API key not valid') ||
      rawMsg.includes('403')
    ) {
      res.status(503).json({
        error:
          '24x7 AI Customer Care is unable to authenticate with Gemini right now. Please check GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }
    if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
      res.status(429).json({
        error: 'High support volume right now. Please wait a moment and try again.',
      });
      return;
    }
    if (status === 503 || rawMsg.includes('UNAVAILABLE')) {
      res.status(503).json({
        error:
          'Our 24×7 AI Care service is experiencing temporary high demand. Please try again in a few seconds or use the Submit Ticket link below.',
      });
      return;
    }
    if (status === 404 || rawMsg.includes('NOT_FOUND')) {
      res.status(502).json({
        error: `AI support model unavailable: ${rawMsg.slice(0, 240)}`,
      });
      return;
    }
    if (status === 400 || rawMsg.includes('INVALID_ARGUMENT')) {
      res.status(400).json({
        error: `AI support request error: ${rawMsg.slice(0, 240)}`,
      });
      return;
    }
    res.status(502).json({
      error: 'Unable to process your support request right now. Please try again shortly.',
    });
  }
});

export default router;
