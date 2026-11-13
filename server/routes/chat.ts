import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../firebaseAdmin.ts';
import { fsGetDoc, fsSetDoc, fsUpdateDoc, fsQuery, newDocId } from '../firestoreRest.ts';
import { createNotification } from '../notifications.ts';
import { broadcastChatEvent } from '../chatWs.ts';
import { CBSE_CURATOR_UID, getCuratedCbseNote } from '../cbseLibrary.ts';

const router = Router();

// 1. List all Buyer & Seller chat threads for the authenticated user
router.get('/note-chats/threads', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;

    const [asBuyer, asSeller] = await Promise.all([
      fsQuery<Record<string, unknown>>('note_chat_threads', {
        filters: [{ field: 'buyerId', op: 'EQUAL', value: uid }],
        token,
      }),
      fsQuery<Record<string, unknown>>('note_chat_threads', {
        filters: [{ field: 'sellerId', op: 'EQUAL', value: uid }],
        token,
      }),
    ]);

    const mergedMap = new Map<string, Record<string, unknown>>();
    for (const t of [...asBuyer, ...asSeller]) {
      if (typeof t.id === 'string') mergedMap.set(t.id, t);
    }

    const threads = Array.from(mergedMap.values()).sort((a, b) =>
      String(b.lastMessageAt || b.updatedAt || b.createdAt).localeCompare(
        String(a.lastMessageAt || a.updatedAt || a.createdAt)
      )
    );

    const totalUnread = threads.reduce((sum, t) => {
      const unread = t.buyerId === uid ? Number(t.buyerUnreadCount || 0) : Number(t.sellerUnreadCount || 0);
      return sum + unread;
    }, 0);

    res.json({ threads, totalUnread });
  } catch (error) {
    console.error('Failed to load chat threads:', error);
    res.status(500).json({ error: 'Unable to load buyer/seller messages.' });
  }
});

// 2. Open or initialize a Buyer -> Seller thread for a specific study note
router.post('/note-chats/open', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    if (!req.user!.email_verified) {
      res.status(403).json({ error: 'Please verify your email address to message sellers.' });
      return;
    }

    const noteId = String(req.body.noteId || '').trim();
    if (!noteId || !/^[a-zA-Z0-9_\-]+$/.test(noteId)) {
      res.status(400).json({ error: 'Valid note ID is required.' });
      return;
    }

    const curatedFallback = getCuratedCbseNote(noteId);
    const noteSnap = await fsGetDoc<Record<string, unknown>>('notes', noteId, token).catch(() => ({
      exists: false,
      id: noteId,
      data: null,
    }));
    if ((!noteSnap.exists || !noteSnap.data) && !curatedFallback) {
      res.status(404).json({ error: 'Study note not found.' });
      return;
    }
    const note = (noteSnap.data || curatedFallback) as Record<string, unknown>;
    const sellerId = String(note.sellerId);

    if (sellerId === CBSE_CURATOR_UID) {
      res.status(400).json({
        error:
          'These free NCERT Class 6–7 notes belong to the NOTE XCHANGE Open CBSE Library. Use the 24x7 AI Assistant button at the bottom-right for instant help!',
      });
      return;
    }

    if (sellerId === uid) {
      res.status(400).json({
        error: 'You are the seller of these notes. View buyer inquiries in Dashboard → Messages.',
      });
      return;
    }

    const threadId = `${noteId}_${uid}`;
    const [existingThreadSnap, buyerProfileSnap, sellerProfileSnap] = await Promise.all([
      fsGetDoc<Record<string, unknown>>('note_chat_threads', threadId, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', uid, token),
      fsGetDoc<Record<string, unknown>>('student_profiles', sellerId, token),
    ]);

    const now = new Date().toISOString();
    let thread = existingThreadSnap.data;

    if (!existingThreadSnap.exists || !thread) {
      const buyerName = String(buyerProfileSnap.data?.fullName || req.user!.email?.split('@')[0] || 'Student Buyer').slice(
        0,
        100
      );
      const buyerUsername = String(buyerProfileSnap.data?.username || 'student').slice(0, 40);
      const sellerName = String(sellerProfileSnap.data?.fullName || note.sellerName || 'Note Author').slice(0, 100);
      const sellerUsername = String(sellerProfileSnap.data?.username || note.sellerUsername || 'seller').slice(0, 40);

      thread = {
        id: threadId,
        noteId,
        noteTitle: String(note.title).slice(0, 140),
        noteSubject: String(note.subject || '').slice(0, 80),
        noteClassLevel: Number(note.classLevel || 10),
        notePrice: Number(note.price || 0),
        buyerId: uid,
        buyerName,
        buyerUsername,
        sellerId,
        sellerName,
        sellerUsername,
        lastMessageText: '',
        lastSenderId: '',
        lastMessageAt: now,
        buyerUnreadCount: 0,
        sellerUnreadCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await fsSetDoc('note_chat_threads', threadId, thread, token);
    } else if (Number(thread.buyerUnreadCount || 0) > 0) {
      await fsUpdateDoc('note_chat_threads', threadId, { buyerUnreadCount: 0, updatedAt: now }, token);
      thread = { ...thread, buyerUnreadCount: 0, updatedAt: now };
    }

    const messages = await fsQuery<Record<string, unknown>>('note_chat_messages', {
      filters: [{ field: 'threadId', op: 'EQUAL', value: threadId }],
      token,
    });
    messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    res.json({ thread, messages });
  } catch (error) {
    console.error('Failed to open note chat:', error);
    res.status(500).json({ error: 'Unable to open chat with seller.' });
  }
});

// 3. Fetch messages in a thread & clear caller's unread count
router.get('/note-chats/:threadId/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const threadId = req.params.threadId;

    const threadSnap = await fsGetDoc<Record<string, unknown>>('note_chat_threads', threadId, token);
    if (!threadSnap.exists || !threadSnap.data) {
      res.status(404).json({ error: 'Conversation thread not found.' });
      return;
    }
    const thread = threadSnap.data;
    if (thread.buyerId !== uid && thread.sellerId !== uid && !req.isAdmin) {
      res.status(403).json({ error: 'Unauthorized to view this conversation.' });
      return;
    }

    const messages = await fsQuery<Record<string, unknown>>('note_chat_messages', {
      filters: [{ field: 'threadId', op: 'EQUAL', value: threadId }],
      token,
    });
    messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    const isBuyer = thread.buyerId === uid;
    const unreadField = isBuyer ? 'buyerUnreadCount' : 'sellerUnreadCount';
    if ((isBuyer || thread.sellerId === uid) && Number(thread[unreadField] || 0) > 0) {
      const now = new Date().toISOString();
      await fsUpdateDoc('note_chat_threads', threadId, { [unreadField]: 0, updatedAt: now }, token);
      thread[unreadField] = 0;
      broadcastChatEvent([String(thread.buyerId), String(thread.sellerId)], {
        type: 'chat:read',
        threadId,
        readerId: uid,
      });
    }

    res.json({ thread, messages });
  } catch (error) {
    console.error('Failed to fetch thread messages:', error);
    res.status(500).json({ error: 'Unable to load conversation messages.' });
  }
});

// 4. Send a message in a Buyer/Seller thread
router.post('/note-chats/:threadId/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    if (!req.user!.email_verified) {
      res.status(403).json({ error: 'Please verify your email address before sending messages.' });
      return;
    }

    const threadId = req.params.threadId;
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const topicTag =
      typeof req.body.topicTag === 'string' ? req.body.topicTag.trim().slice(0, 60) : 'General Question';

    if (!text || text.length > 1200) {
      res.status(400).json({ error: 'Message must be between 1 and 1200 characters.' });
      return;
    }

    const threadSnap = await fsGetDoc<Record<string, unknown>>('note_chat_threads', threadId, token);
    if (!threadSnap.exists || !threadSnap.data) {
      res.status(404).json({ error: 'Conversation thread not found.' });
      return;
    }
    const thread = threadSnap.data;
    if (thread.buyerId !== uid && thread.sellerId !== uid) {
      res.status(403).json({ error: 'Only participants in this note chat can send messages.' });
      return;
    }

    const senderRole: 'buyer' | 'seller' = thread.buyerId === uid ? 'buyer' : 'seller';
    const senderName =
      senderRole === 'buyer' ? String(thread.buyerName || 'Student Buyer') : String(thread.sellerName || 'Seller');
    const recipientId = senderRole === 'buyer' ? String(thread.sellerId) : String(thread.buyerId);

    const now = new Date().toISOString();
    const messageId = newDocId();
    const message = {
      id: messageId,
      threadId,
      noteId: String(thread.noteId),
      buyerId: String(thread.buyerId),
      sellerId: String(thread.sellerId),
      senderId: uid,
      senderName: senderName.slice(0, 100),
      senderRole,
      topicTag: topicTag || 'General Question',
      text,
      createdAt: now,
    };

    const nextBuyerUnread = senderRole === 'seller' ? Number(thread.buyerUnreadCount || 0) + 1 : 0;
    const nextSellerUnread = senderRole === 'buyer' ? Number(thread.sellerUnreadCount || 0) + 1 : 0;

    const threadUpdates = {
      lastMessageText: text.slice(0, 500),
      lastSenderId: uid,
      lastMessageAt: now,
      buyerUnreadCount: nextBuyerUnread,
      sellerUnreadCount: nextSellerUnread,
      updatedAt: now,
    };

    await Promise.all([
      fsSetDoc('note_chat_messages', messageId, message, token),
      fsUpdateDoc('note_chat_threads', threadId, threadUpdates, token),
    ]);

    const updatedThread = { ...thread, ...threadUpdates };

    broadcastChatEvent([String(thread.buyerId), String(thread.sellerId)], {
      type: 'chat:message',
      thread: updatedThread,
      message,
    });

    await createNotification({
      userId: recipientId,
      type: 'buyer_seller_message',
      title: `New message on "${String(thread.noteTitle).slice(0, 48)}"`,
      message: `${senderName}: "${text.slice(0, 110)}"`,
      linkPath: '/dashboard?tab=messages',
      token,
    });

    res.status(201).json({ thread: updatedThread, message });
  } catch (error) {
    console.error('Failed to send chat message:', error);
    res.status(500).json({ error: 'Unable to send message.' });
  }
});

// 5. Mark thread as read
router.post('/note-chats/:threadId/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const token = req.idToken!;
    const threadId = req.params.threadId;

    const threadSnap = await fsGetDoc<Record<string, unknown>>('note_chat_threads', threadId, token);
    if (!threadSnap.exists || !threadSnap.data) {
      res.status(404).json({ error: 'Thread not found.' });
      return;
    }
    const thread = threadSnap.data;
    if (thread.buyerId !== uid && thread.sellerId !== uid) {
      res.status(403).json({ error: 'Unauthorized.' });
      return;
    }

    const unreadField = thread.buyerId === uid ? 'buyerUnreadCount' : 'sellerUnreadCount';
    await fsUpdateDoc(
      'note_chat_threads',
      threadId,
      { [unreadField]: 0, updatedAt: new Date().toISOString() },
      token
    );

    broadcastChatEvent([String(thread.buyerId), String(thread.sellerId)], {
      type: 'chat:read',
      threadId,
      readerId: uid,
    });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unable to mark conversation read.' });
  }
});

export default router;
