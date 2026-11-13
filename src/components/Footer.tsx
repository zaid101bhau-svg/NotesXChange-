import { Logo } from './Logo';

export function Footer({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Learn Together. Share Knowledge. Grow Together. A trusted student-to-student educational
              marketplace built for Class 6 to Class 12 learners across CBSE, ICSE, and State Boards.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">Marketplace</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              <li>
                <button type="button" onClick={() => onNavigate('/explore')} className="hover:text-blue-700">
                  Explore Notes
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/contributors')} className="hover:text-blue-700">
                  Top Contributors
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/upload')} className="hover:text-blue-700">
                  Upload Study Notes
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/feedback')} className="hover:text-blue-700">
                  Feedback & Suggestions
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">Support & Legal</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-600">
              <li>
                <button type="button" onClick={() => onNavigate('/about')} className="hover:text-blue-700">
                  About Us
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/contact')} className="hover:text-blue-700">
                  Contact & Support
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/privacy')} className="hover:text-blue-700">
                  Privacy Policy & Student Safety
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/terms')} className="hover:text-blue-700">
                  Terms & Refund Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} NOTE XCHANGE. Built for Class 6–12 students.</p>
          <p>Original student study notes · Verified payments · Parent & guardian safeguards</p>
        </div>
      </div>
    </footer>
  );
}
