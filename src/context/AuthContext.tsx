import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import type {
  UserAccount,
  StudentProfile,
  NotificationSettings,
  SubjectItem,
  CategoryItem,
} from '../types/marketplace';

interface AuthContextValue {
  firebaseUser: User | null;
  userAccount: UserAccount | null;
  profile: StudentProfile | null;
  isAdmin: boolean;
  notificationSettings: NotificationSettings | null;
  unreadNotifications: number;
  wishlistIds: string[];
  subjects: SubjectItem[];
  categories: CategoryItem[];
  commissionRatePercent: number;
  authLoading: boolean;
  authModalOpen: boolean;
  authModalMode: 'login' | 'signup' | 'reset';
  openAuthModal: (mode?: 'login' | 'signup' | 'reset') => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  toggleWishlist: (noteId: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [commissionRatePercent, setCommissionRatePercent] = useState(15);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'reset'>('login');

  const loadCatalogMeta = useCallback(async () => {
    try {
      const meta = await apiFetch<{
        subjects: SubjectItem[];
        categories: CategoryItem[];
        commissionRatePercent: number;
      }>('/catalog/meta');
      setSubjects(meta.subjects || []);
      setCategories(meta.categories || []);
      setCommissionRatePercent(meta.commissionRatePercent ?? 15);
    } catch (error) {
      console.error('Failed to load catalog meta:', error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setUserAccount(null);
      setProfile(null);
      setIsAdmin(false);
      setNotificationSettings(null);
      setUnreadNotifications(0);
      setWishlistIds([]);
      return;
    }

    try {
      const [me, notifs, wishlist] = await Promise.all([
        apiFetch<{
          userAccount: UserAccount;
          profile: StudentProfile | null;
          isAdmin: boolean;
          notificationSettings: NotificationSettings;
        }>('/auth/me'),
        apiFetch<{ unreadCount: number }>('/notifications').catch(() => ({ unreadCount: 0 })),
        apiFetch<{ noteIds: string[] }>('/wishlist').catch(() => ({ noteIds: [] })),
      ]);

      setUserAccount(me.userAccount);
      setProfile(me.profile);
      setIsAdmin(me.isAdmin);
      setNotificationSettings(me.notificationSettings);
      setUnreadNotifications(notifs.unreadCount || 0);
      setWishlistIds(wishlist.noteIds || []);
    } catch (error) {
      console.error('Session sync failed:', error);
    }
  }, []);

  useEffect(() => {
    loadCatalogMeta();
  }, [loadCatalogMeta]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshSession();
      } else {
        setUserAccount(null);
        setProfile(null);
        setIsAdmin(false);
        setUnreadNotifications(0);
        setWishlistIds([]);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [refreshSession]);

  const openAuthModal = (mode: 'login' | 'signup' | 'reset' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleAuthProvider);
    await refreshSession();
    setAuthModalOpen(false);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    await refreshSession();
    setAuthModalOpen(false);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await refreshSession();
    setAuthModalOpen(false);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserAccount(null);
    setProfile(null);
    setIsAdmin(false);
    setUnreadNotifications(0);
    setWishlistIds([]);
  };

  const toggleWishlist = async (noteId: string) => {
    if (!auth.currentUser) {
      openAuthModal('login');
      return false;
    }
    const res = await apiFetch<{ wishlisted: boolean }>(`/wishlist/${noteId}`, { method: 'POST' });
    setWishlistIds((prev) =>
      res.wishlisted ? Array.from(new Set([...prev, noteId])) : prev.filter((id) => id !== noteId)
    );
    return res.wishlisted;
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userAccount,
        profile,
        isAdmin,
        notificationSettings,
        unreadNotifications,
        wishlistIds,
        subjects,
        categories,
        commissionRatePercent,
        authLoading,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        resendVerification,
        logout,
        refreshSession,
        toggleWishlist,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
