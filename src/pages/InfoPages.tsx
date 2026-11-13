import { ShieldCheck, Mail, BookOpen, Scale } from 'lucide-react';

export function AboutPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div>
        <p className="text-xs font-semibold text-violet-700">About NOTE XCHANGE</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">
          Learn Together. Share Knowledge. Grow Together.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          NOTE XCHANGE is an educational marketplace built exclusively for students from Class 6 to
          Class 12 across CBSE, ICSE, and State Boards. Our mission is to turn diligent classroom
          note-taking into shared academic support and fair student rewards.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            Peer-Verified Original Notes
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Every note carries author originality attestation, a 2-page PDF preview, and ratings
            restricted exclusively to verified claimants and purchasers.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <ShieldCheck className="h-6 w-6 text-violet-700" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            Student Safety First
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Age safeguards, parent/guardian consent for learners under 18, private PDF storage, and
            verified seller eligibility protect our student community.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onNavigate('/explore')}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Explore Notes
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/contact')}
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-800"
        >
          Contact Support
        </button>
      </div>
    </div>
  );
}

export function ContactPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">Contact &amp; Student Support</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        Need help with an order, seller payout verification, copyright takedown, or account deletion
        request? Reach our moderation and support desk directly.
      </p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <Mail className="h-5 w-5 text-blue-600" />
          <h2 className="mt-3 font-display text-base font-bold text-slate-900">Support Desk</h2>
          <p className="mt-1 text-sm text-slate-600">support@notexchange.edu.in</p>
          <p className="mt-2 text-xs text-slate-500">Response window: within 24–48 business hours.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <ShieldCheck className="h-5 w-5 text-violet-700" />
          <h2 className="mt-3 font-display text-base font-bold text-slate-900">
            In-App Feedback &amp; Reports
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Submit bugs, copyright reports, or seller inquiries directly from your account.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/feedback')}
            className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
          >
            Open Feedback Center →
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
        <ShieldCheck className="h-4 w-4" />
        Privacy &amp; Student Protection Policy
      </div>
      <h1 className="font-display text-3xl font-bold text-slate-900">
        Privacy Policy &amp; Class 6–12 Student Safeguards
      </h1>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-display text-base font-bold text-slate-900">
            1. Minor Protection &amp; Guardian Consent
          </h2>
          <p className="mt-1">
            NOTE XCHANGE serves learners aged 11–18 (Classes 6–12). Students under 18 must provide
            parent or legal guardian acknowledgment during onboarding. Personal email addresses,
            guardian contacts, and payout references are strictly isolated from public profiles.
          </p>
        </section>
        <section>
          <h2 className="font-display text-base font-bold text-slate-900">
            2. Payment &amp; KYC Compliance
          </h2>
          <p className="mt-1">
            We never store credit/debit card numbers, CVVs, or UPI PINs. All paid checkouts are
            processed via authorized Razorpay payment gateways. Seller payouts are disabled until
            identity, guardian consent (for minors), and payment-provider eligibility are verified.
          </p>
        </section>
        <section>
          <h2 className="font-display text-base font-bold text-slate-900">
            3. Private PDF Security &amp; Data Deletion
          </h2>
          <p className="mt-1">
            Paid PDF files are stored in private server storage and streamed only after verifying an
            authenticated completed purchase. Students or guardians may request account deletion at
            any time from Account Settings.
          </p>
        </section>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center gap-2 text-violet-700 text-xs font-semibold">
        <Scale className="h-4 w-4" />
        Platform Rules &amp; Refund Terms
      </div>
      <h1 className="font-display text-3xl font-bold text-slate-900">
        Terms, Conditions &amp; Refund Policy
      </h1>

      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="font-display text-base font-bold text-slate-900">
            1. Original Content &amp; Copyright Compliance
          </h2>
          <p className="mt-1">
            Sellers may upload only original handwritten or self-authored digital study notes, or
            properly authorized materials. Uploading scanned commercial textbooks, pirated PDFs, or
            unauthorized coaching institute modules results in immediate removal and account
            suspension.
          </p>
        </section>
        <section>
          <h2 className="font-display text-base font-bold text-slate-900">
            2. Buyer Refund Policy
          </h2>
          <p className="mt-1">
            Students may submit a refund request within 7 days of a paid purchase if the delivered
            PDF is unreadable, incomplete compared to its description, or violates copyright rules.
            Verified refunds are processed to the original UPI/card source through Razorpay after
            admin review.
          </p>
        </section>
        <section>
          <h2 className="font-display text-base font-bold text-slate-900">
            3. Commission &amp; Seller Settlements
          </h2>
          <p className="mt-1">
            A transparent platform fee (default 15%) supports secure PDF hosting, payment gateway
            charges, and moderation. Eligible verified sellers can withdraw available balances once
            thresholds (₹100 minimum) are met.
          </p>
        </section>
      </div>
    </div>
  );
}
