import { useEffect, useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { SupportChatbox } from './components/SupportChatbox';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { UploadNotePage } from './pages/UploadNotePage';
import { DashboardPage } from './pages/DashboardPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { ContributorsPage } from './pages/ContributorsPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { AdminPage } from './pages/AdminPage';
import {
  AboutPage,
  ContactPage,
  PrivacyPolicyPage,
  TermsPage,
} from './pages/InfoPages';

function AppShell() {
  const { firebaseUser, profile, authLoading, resendVerification } = useAuth();
  const [locationUrl, setLocationUrl] = useState(
    () => window.location.pathname + window.location.search
  );
  const [verificationSent, setVerificationSent] = useState(false);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setLocationUrl(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Auto-redirect newly registered users without onboarding directly to /onboarding
  useEffect(() => {
    if (!authLoading && firebaseUser && profile === null) {
      const pathname = locationUrl.split('?')[0];
      if (pathname === '/' || pathname === '/dashboard') {
        navigate('/onboarding');
      }
    }
  }, [authLoading, firebaseUser, profile, locationUrl, navigate]);

  const [pathname, queryString = ''] = locationUrl.split('?');

  const renderPage = () => {
    if (pathname === '/' || pathname === '') {
      return <HomePage onNavigate={navigate} />;
    }
    if (pathname === '/explore') {
      return <ExplorePage queryString={queryString} onNavigate={navigate} />;
    }
    if (pathname.startsWith('/notes/')) {
      const noteId = pathname.slice('/notes/'.length);
      return <NoteDetailPage noteId={noteId} onNavigate={navigate} />;
    }
    if (pathname.startsWith('/checkout/')) {
      const noteId = pathname.slice('/checkout/'.length);
      return <CheckoutPage noteId={noteId} onNavigate={navigate} />;
    }
    if (pathname === '/onboarding') {
      return <OnboardingPage onNavigate={navigate} />;
    }
    if (pathname === '/upload') {
      return <UploadNotePage onNavigate={navigate} />;
    }
    if (pathname === '/dashboard') {
      return <DashboardPage queryString={queryString} onNavigate={navigate} />;
    }
    if (pathname.startsWith('/profile/')) {
      const uid = pathname.slice('/profile/'.length);
      return <PublicProfilePage targetUid={uid} onNavigate={navigate} />;
    }
    if (pathname === '/contributors') {
      return <ContributorsPage onNavigate={navigate} />;
    }
    if (pathname === '/feedback') {
      return <FeedbackPage />;
    }
    if (pathname === '/admin') {
      return <AdminPage onNavigate={navigate} />;
    }
    if (pathname === '/about') {
      return <AboutPage onNavigate={navigate} />;
    }
    if (pathname === '/contact') {
      return <ContactPage onNavigate={navigate} />;
    }
    if (pathname === '/privacy') {
      return <PrivacyPolicyPage />;
    }
    if (pathname === '/terms') {
      return <TermsPage />;
    }
    return <HomePage onNavigate={navigate} />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar currentPath={pathname} onNavigate={navigate} />

      {firebaseUser && !firebaseUser.emailVerified && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-900">
          <span>
            Please verify your email address ({firebaseUser.email}) to unlock full marketplace
            features.{' '}
          </span>
          <button
            type="button"
            onClick={async () => {
              await resendVerification();
              setVerificationSent(true);
            }}
            className="font-semibold underline hover:text-amber-700"
          >
            {verificationSent ? 'Verification email sent!' : 'Resend verification email'}
          </button>
        </div>
      )}

      <main className="flex-1">{renderPage()}</main>

      <Footer onNavigate={navigate} />
      <AuthModal />
      <SupportChatbox currentPath={pathname} onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
