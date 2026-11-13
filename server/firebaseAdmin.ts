import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { fsGetDoc } from './firestoreRest.ts';

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(adminApp);
export const BOOTSTRAPPED_ADMIN_EMAILS = new Set(['zaid101bhau@gmail.com']);

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  idToken?: string;
  isAdmin?: boolean;
}

export async function checkIsAdmin(
  uid: string,
  token: string,
  email?: string,
  emailVerified?: boolean
): Promise<boolean> {
  if (email && emailVerified && BOOTSTRAPPED_ADMIN_EMAILS.has(email.toLowerCase())) {
    return true;
  }
  try {
    const adminDoc = await fsGetDoc('admins', uid, token);
    return adminDoc.exists;
  } catch {
    return false;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.idToken = token;
    req.isAdmin = await checkIsAdmin(decoded.uid, token, decoded.email, decoded.email_verified);

    try {
      const userDoc = await fsGetDoc<{ status?: string }>('users', decoded.uid, token);
      if (userDoc.exists && userDoc.data?.status === 'suspended' && !req.isAdmin) {
        res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
        return;
      }
    } catch {
      // User doc may not exist yet before onboarding
    }
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.idToken = token;
    req.isAdmin = await checkIsAdmin(decoded.uid, token, decoded.email, decoded.email_verified);
  } catch {
    // Ignore invalid optional token
  }
  next();
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, async () => {
    if (!req.isAdmin) {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    next();
  });
}
