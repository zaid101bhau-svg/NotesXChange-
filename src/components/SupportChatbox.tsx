import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Headphones,
  X,
  Send,
  RotateCcw,
  Sparkles,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface SupportChatboxProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const INITIAL_WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi! Welcome to NOTE XCHANGE 24×7 Customer Care. Ask me anything about downloading notes, UPI/Card/Netbanking payments, 7-day refunds, or becoming a verified student seller.',
  timestamp: new Date().toISOString(),
};

function renderFormattedText(text: string) {
  return text.split('\n').map((line, lineIdx) => {
    const cleanLine = line.replace(/^\s*\*\s+/, '• ');
    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lineIdx} className="block">
        {parts.map((part, partIdx) =>
          part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
            <strong key={partIdx} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={partIdx}>{part}</span>
          )
        )}
      </span>
    );
  });
}

const QUICK_PROMPTS = [
  'How do I download my purchased PDF?',
  'What payment options are supported?',
  'How does the 7-day refund policy work?',
  'How do I start selling my notes?',
];

export function SupportChatbox({ currentPath, onNavigate }: SupportChatboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen, messages, sending]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput('');
    setError('');
    setSending(true);

    try {
      const data = await apiFetch<{ reply: string; timestamp: string }>('/support/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          currentPath,
        }),
      });

      const assistantMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: data.reply,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach 24×7 Customer Care. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        ...INITIAL_WELCOME,
        timestamp: new Date().toISOString(),
      },
    ]);
    setError('');
    setInput('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="NOTE XCHANGE 24x7 Customer Care AI Chatbox"
            className="mb-3 flex h-[32rem] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] sm:w-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-violet-700 px-4 py-3.5 text-white">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Headphones className="h-5 w-5" />
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-blue-700 bg-emerald-400"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-display text-sm font-bold leading-tight">
                    <span>NOTE XCHANGE Care</span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                      24×7 AI
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-100">
                    Instant help · Orders, Refunds &amp; Seller Support
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleReset}
                  title="Start new conversation"
                  aria-label="Reset conversation"
                  className="rounded-lg p-1.5 text-blue-100 hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Close chatbox"
                  aria-label="Close customer care chatbox"
                  className="rounded-lg p-1.5 text-blue-100 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages Thread */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'rounded-br-sm bg-blue-600 text-white'
                        : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-2xs'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-violet-700">
                        <Sparkles className="h-3 w-3" />
                        <span>Customer Care Agent</span>
                      </div>
                    )}
                    {msg.role === 'assistant' ? renderFormattedText(msg.text) : msg.text}
                  </div>
                </div>
              ))}

              {/* Quick topic chips before first user message */}
              {messages.length === 1 && !sending && (
                <div className="pt-1">
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">
                    Popular support questions:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600" />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-600"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Human Support Escalation Strip */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-3.5 py-1.5 text-[11px] text-slate-500">
              <span>Need human review?</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/feedback');
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                >
                  Submit Ticket
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('/contact');
                  }}
                  className="font-semibold text-slate-700 hover:underline"
                >
                  Contact Desk
                </button>
              </div>
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask 24×7 support anything..."
                maxLength={1500}
                className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send support message"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating 24x7 Launcher Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close 24x7 Customer Care' : 'Open 24x7 Customer Care'}
        className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-shadow"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {isOpen ? <X className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
          {!isOpen && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-emerald-400" />
          )}
        </span>
        <span className="hidden sm:inline">24×7 Support</span>
      </motion.button>
    </div>
  );
}
