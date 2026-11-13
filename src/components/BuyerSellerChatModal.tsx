import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Send, X, BookOpen, ShieldCheck, ExternalLink } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChatWebSocket, type ChatWsEvent } from '../lib/useChatWebSocket';
import type { NoteChatMessage, NoteChatThread, StudyNote } from '../types/marketplace';

interface BuyerSellerChatModalProps {
  note: StudyNote;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const TOPIC_TAGS = [
  'General Question',
  'Syllabus & Chapters',
  'Pages & Format',
  'Diagrams & Solutions',
  'Purchase & Access',
];

const BUYER_QUICK_QUESTIONS = [
  'Does this cover the complete NCERT & board exam syllabus for this chapter?',
  'Are clean handwritten diagrams, formulas, and derivations included?',
  'Are solved numericals or previous year questions included?',
  'Which academic year/edition are these study notes prepared for?',
];

export function BuyerSellerChatModal({ note, onClose, onNavigate }: BuyerSellerChatModalProps) {
  const { firebaseUser } = useAuth();
  const [thread, setThread] = useState<NoteChatThread | null>(null);
  const [messages, setMessages] = useState<NoteChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [topicTag, setTopicTag] = useState('General Question');
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{ thread: NoteChatThread; messages: NoteChatMessage[] }>(
        '/note-chats/open',
        {
          method: 'POST',
          body: JSON.stringify({ noteId: note.id }),
        }
      );
      setThread(data.thread);
      setMessages(data.messages || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open chat with seller.');
    } finally {
      setLoading(false);
    }
  }, [note.id]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleWsEvent = useCallback(
    (event: ChatWsEvent) => {
      if (event.type === 'chat:message' && thread && event.thread.id === thread.id) {
        setThread(event.thread);
        setMessages((prev) =>
          prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]
        );
      }
    },
    [thread]
  );

  const { connected } = useChatWebSocket(Boolean(firebaseUser), handleWsEvent);

  const handleSend = async (overrideText?: string) => {
    const clean = (overrideText ?? text).trim();
    if (!clean || !thread || sending) return;
    setSending(true);
    setError('');
    try {
      const data = await apiFetch<{ thread: NoteChatThread; message: NoteChatMessage }>(
        `/note-chats/${thread.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ text: clean, topicTag }),
        }
      );
      setThread(data.thread);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Chat with Seller"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[36rem] max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-400 shrink-0" />
              <h2 className="truncate font-display text-sm font-bold">
                Chat with {note.sellerName}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
                {connected ? 'Live' : 'Synced'}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-300">
              @{note.sellerUsername} · {note.title} ({note.isFree ? 'Free' : `₹${note.price}`})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close buyer seller chatbox"
            className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Note context strip */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-blue-50/60 px-5 py-2 text-[11px] text-slate-700">
          <span className="inline-flex items-center gap-1.5 truncate font-medium">
            <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            Class {note.classLevel} · {note.subject} · {note.pageCount} pages
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('/dashboard?tab=messages');
            }}
            className="inline-flex items-center gap-1 shrink-0 font-semibold text-blue-700 hover:underline"
          >
            All Chats
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-12 w-3/4 animate-pulse rounded-xl bg-slate-200" />
              <div className="ml-auto h-12 w-2/3 animate-pulse rounded-xl bg-blue-100" />
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-900">
                  Ask {note.sellerName} directly about these study notes
                </p>
                <p className="mt-1">
                  Clarify chapter coverage, handwriting legibility, diagram quality, solved
                  examples, or board alignment before downloading or purchasing.
                </p>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-500">
                  Tap a quick question to start:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BUYER_QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      disabled={sending}
                      className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-left text-[11px] font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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

        {/* Topic Tag + Safety Reminder */}
        <div className="border-t border-slate-200 bg-white px-4 pt-2.5 pb-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {TOPIC_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTopicTag(tag)}
                  className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${
                    topicTag === tag
                      ? 'bg-violet-100 text-violet-800 border border-violet-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-white px-4 pb-3 pt-1"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask about chapter notes, diagrams, pages..."
            maxLength={1200}
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !text.trim() || !thread}
            aria-label="Send message to seller"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <span>
            Keep all payments &amp; PDF downloads inside NOTE XCHANGE for 7-day refund protection.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
