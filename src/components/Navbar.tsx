import { useState } from 'react';
import { Bell, Menu, X, Shield, LayoutDashboard, LogOut, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Navbar({ currentPath, onNavigate }: NavbarProps) {
  const { firebaseUser, profile, isAdmin, unreadNotifications, openAuthModal, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Explore Notes', path: '/explore' },
    { label: 'Contributors', path: '/contributors' },
    { label: 'About', path: '/about' },
    { label: 'Feedback', path: '/feedback' },
  ];

  const handleNav = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('/')}
          className="text-left focus-visible:outline-2 focus-visible:outline-blue-600 rounded-lg"
        >
          <Logo />
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  active
                    ? 'border-blue-600 text-blue-700 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {!firebaseUser ? (
            <>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              {profile?.roles?.includes('seller') && (
                <button
                  type="button"
                  onClick={() => handleNav('/upload')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              )}
              <button
                type="button"
                onClick={() => handleNav('/dashboard?tab=notifications')}
                aria-label="Notifications"
                className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white tabular-nums">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNav('/admin')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </button>
              )}
              <button
                type="button"
                onClick={() => handleNav(profile?.onboardingCompleted ? '/dashboard' : '/onboarding')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                {profile?.onboardingCompleted ? profile.fullName.split(' ')[0] : 'Complete Profile'}
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                  currentPath === item.path ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
            {!firebaseUser ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthModal('login');
                  }}
                  className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-800"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuthModal('signup');
                  }}
                  className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white"
                >
                  Sign Up
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleNav(profile?.onboardingCompleted ? '/dashboard' : '/onboarding')}
                  className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white"
                >
                  {profile?.onboardingCompleted ? 'Student Dashboard' : 'Complete Onboarding'}
                </button>
                {profile?.roles?.includes('seller') && (
                  <button
                    type="button"
                    onClick={() => handleNav('/upload')}
                    className="rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Upload Study Notes
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleNav('/admin')}
                    className="rounded-lg border border-violet-200 bg-violet-50 py-2.5 text-sm font-semibold text-violet-700"
                  >
                    Admin Panel
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setMobileOpen(false);
                    await logout();
                    onNavigate('/');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
