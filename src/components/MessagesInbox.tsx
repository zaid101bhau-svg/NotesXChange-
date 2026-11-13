import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, ExternalLink, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChatWebSocket, type ChatWsEvent } from '../lib/useChatWebSocket';
import type { NoteChatMessage, NoteChatThread } from '../types/marketplace';

interface MessagesInboxProps {
  onNavigate: (path: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

const TOPIC_TAGS = [
  'General Question',
  'Syllabus & Chapters',
  'Pages & Format',
  'Diagrams & Solutions',
  'Purchase & Access',
];

const SELLER_QUICK_REPLIES = [
  'Yes, these notes cover the complete chapter syllabus including key derivations.',
  'Handwritten diagrams and step-by-step solved examples are included.',
  'You can check the 2-page PDF preview on the note page for handwriting clarity!',
];

export function MessagesInbox({ onNavigate, onUnreadCountChange }: MessagesInboxProps) {
  const { firebaseUser } = useAuth();
  const [threads, setThreads] = useState<NoteChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NoteChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [topicTag, setTopicTag] = useState('General Question');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const data = await apiFetch<{ threads: NoteChatThread[]; totalUnread: number }>(
        '/note-chats/threads'
      );
      setThreads(data.threads || []);
      onUnreadCountChange?.(data.totalUnread || 0);
      if (data.threads.length > 0) {
        setSelectedThreadId((prev) => prev || data.threads[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setLoadingThreads(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      setLoadingMessages(true);
      setError('');
      try {
        const data = await apiFetch<{ thread: NoteChatThread; messages: NoteChatMessage[] }>(
          `/note-chats/${threadId}/messages`
        );
        setMessages(data.messages || []);
        setThreads((prev) => {
          const next = prev.map((t) => (t.id === threadId ? data.thread : t));
          const unread = next.reduce((sum, t) => {
            const count =
              t.buyerId === firebaseUser?.uid
                ? Number(t.buyerUnreadCount || 0)
                : Number(t.sellerUnreadCount || 0);
            return sum + count;
          }, 0);
          onUnreadCountChange?.(unread);
          return next;
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load messages.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [firebaseUser?.uid, onUnreadCountChange]
  );

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages(selectedThreadId);
    }
  }, [selectedThreadId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleWsEvent = useCallback(
    (event: ChatWsEvent) => {
      if (event.type === 'chat:message') {
        setThreads((prev) => {
          const exists = prev.some((t) => t.id === event.thread.id);
          const updated = exists
            ? prev.map((t) => (t.id === event.thread.id ? event.thread : t))
            : [event.thread, ...prev];
          return [...updated].sort((a, b) =>
            String(b.lastMessageAt || b.updatedAt).localeCompare(
              String(a.lastMessageAt || a.updatedAt)
            )
          );
        });
        if (selectedThreadId === event.thread.id) {
          setMessages((prev) =>
            prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]
          );
        }
      }
    },
    [selectedThreadId]
  );

  const { connected } = useChatWebSocket(Boolean(firebaseUser), handleWsEvent);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;
  const amSellerInSelected = selectedThread?.sellerId === firebaseUser?.uid;

  const handleSend = async (overrideText?: string) => {
    const clean = (overrideText ?? text).trim();
    if (!clean || !selectedThread || sending) return;
    setSending(true);
    setError('');
    try {
      const data = await apiFetch<{ thread: NoteChatThread; message: NoteChatMessage }>(
        `/note-chats/${selectedThread.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ text: clean, topicTag }),
        }
      );
      setThreads((prev) => prev.map((t) => (t.id === data.thread.id ? data.thread : t)));
      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
      if (!overrideText) setText('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  if (loadingThreads) {
    return <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Buyer &amp; Seller Note Messages
          </h2>
          <p className="text-xs text-slate-500">
            Share study note syllabus details, page previews, and chapter clarifications in real time.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            connected
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`}
          />
          {connected ? 'Live Sync Active' : 'Synced'}
        </span>
      </div>

      {threads.length === 0 ? (
        <div className="p-10 text-center">
          <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-display text-base font-bold text-slate-900">
            No Buyer or Seller Conversations Yet
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Click &ldquo;Chat with Seller&rdquo; on any study note page to ask about chapter
            coverage, or wait for interested buyers to message you about your uploaded notes.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/explore')}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Explore Study Notes
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[30rem]">
          {/* Thread List */}
          <div className="border-b border-slate-200 md:col-span-5 md:border-b-0 md:border-r divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
            {threads.map((t) => {
              const isSeller = t.sellerId === firebaseUser?.uid;
              const peerName = isSeller ? t.buyerName : t.sellerName;
              const peerUsername = isSeller ? t.buyerUsername : t.sellerUsername;
              const unread = isSeller ? Number(t.sellerUnreadCount || 0) : Number(t.buyerUnreadCount || 0);
              const active = t.id === selectedThreadId;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedThreadId(t.id)}
                  className={`w-full p-4 text-left transition-colors ${
                    active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        isSeller
                          ? 'bg-violet-50 text-violet-700 border border-violet-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {isSeller ? 'Buyer Inquiry' : 'Asked Seller'}
                    </span>
                    {unread > 0 && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                        {unread}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 truncate font-display text-sm font-bold text-slate-900">
                    {peerName}{' '}
                    {peerUsername && (
                      <span className="font-normal text-xs text-slate-500">@{peerUsername}</span>
                    )}
                  </p>
                  <p className="truncate text-xs font-medium text-blue-700">{t.noteTitle}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {t.lastMessageText || 'Conversation opened'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Thread Conversation */}
          <div className="flex flex-col md:col-span-7 max-h-[32rem]">
            {selectedThread ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-sm font-bold text-slate-900">
                      {selectedThread.noteTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {amSellerInSelected
                        ? `Buyer: ${selectedThread.buyerName}`
                        : `Seller: ${selectedThread.sellerName}`}{' '}
                      · {selectedThread.noteSubject} (Class {selectedThread.noteClassLevel})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/notes/${selectedThread.noteId}`)}
                    className="inline-flex items-center gap-1 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    View Note
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4 bg-slate-50/40">
                  {loadingMessages ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-8">
                      No messages yet. Start the conversation below!
                    </p>
                  ) : (
                    messages.map((m) => {
                      const isMine = m.senderId === firebaseUser?.uid;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                              isMine
                                ? 'rounded-br-sm bg-blue-600 text-white'
                                : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-2xs'
                            }`}
                          >
                            {m.topicTag && (
                              <div
                                className={`mb-1 text-[10px] font-semibold ${
                                  isMine ? 'text-blue-100' : 'text-violet-700'
                                }`}
                              >
                                {m.topicTag}
                              </div>
                            )}
                            <p className="whitespace-pre-wrap">{m.text}</p>
                          </div>
                          <span className="mt-1 px-1 text-[10px] text-slate-400">
                            {isMine ? 'You' : m.senderName} ·{' '}
                            {new Date(m.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {error && (
                  <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {amSellerInSelected && (
                  <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 bg-white px-4 pt-2 pb-1">
                    {SELLER_QUICK_REPLIES.map((qr) => (
                      <button
                        key={qr}
                        type="button"
                        onClick={() => handleSend(qr)}
                        disabled={sending}
                        className="shrink-0 rounded-lg border border-blue-200 bg-blue-50/40 px-2.5 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-50"
                      >
                        {qr.slice(0, 42)}…
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 bg-white px-4 pt-2 pb-1">
                  {TOPIC_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTopicTag(tag)}
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${
                        topicTag === tag
                          ? 'bg-violet-100 text-violet-800 border border-violet-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2 bg-white px-4 pb-3 pt-1.5"
                >
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      amSellerInSelected
                        ? 'Reply with chapter details, page count, or clarifications...'
                        : 'Ask the seller about these notes...'
                    }
                    maxLength={1200}
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    aria-label="Send chat message"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-[10px] text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span>All note orders &amp; refunds are protected inside NOTE XCHANGE.</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
