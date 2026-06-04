'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant';
type Message = { role: Role; content: string };

type MatchedFacility = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  level: string;
  bed_based: boolean;
  beds_available: number;
  freshness: 'green' | 'amber' | 'red';
  in_network: boolean;
  referral_contact: { name?: string; email?: string; phone?: string } | null;
};

// Availability reads differently for overnight (beds) vs outpatient (accepting) care.
function availability(f: MatchedFacility): { chip: string; tone: 'green' | 'amber' | 'red'; detail: string } {
  if (!f.bed_based) {
    return { chip: 'Accepting clients', tone: 'green', detail: 'Outpatient · no beds needed' };
  }
  if (f.beds_available > 0) {
    return {
      chip: FRESH_LABEL[f.freshness],
      tone: f.freshness,
      detail: `${f.beds_available} bed${f.beds_available === 1 ? '' : 's'} open`,
    };
  }
  return { chip: 'Call to confirm', tone: 'red', detail: 'Beds not available right now — call to confirm' };
}

const GREETING =
  "Hi — I'm really glad you're here. Reaching out is a brave first step, and you don't have to have it all figured out. Whenever you're ready, tell me a little about what's going on.";

const FRESH_LABEL = {
  green: 'Beds confirmed recently',
  amber: 'Availability updated this week',
  red: 'Call to confirm current availability',
} as const;

export default function MatchPage() {
  // Warm acknowledgment gate before the conversation begins.
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<MatchedFacility[] | null>(null);
  const [seekerName, setSeekerName] = useState<string | undefined>(undefined);
  const [shared, setShared] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember the gathered face sheet so a returning person can re-match without
  // redoing the conversation.
  const [faceSheet, setFaceSheet] = useState<Record<string, unknown> | null>(null);
  const [savedSheet, setSavedSheet] = useState<Record<string, unknown> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, matches, finishing]);

  // Keep the cursor in the chat box so you can keep typing without re-clicking.
  useEffect(() => {
    if (acknowledged && !busy && !matches) inputRef.current?.focus();
  }, [acknowledged, busy, matches]);

  useEffect(() => {
    try {
      if (localStorage.getItem('wc_ack')) setAcknowledged(true);
      const raw = localStorage.getItem('wc_face_sheet');
      if (raw) setSavedSheet(JSON.parse(raw));
      const m = localStorage.getItem('wc_matches');
      if (m) {
        const p = JSON.parse(m);
        if (Array.isArray(p.facilities) && p.facilities.length) {
          setMatches(p.facilities);
          setSeekerName(p.name);
          setShared(!!p.shared);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Completion: the Companion has gathered the full face sheet. Match on the
  // de-identified subset, then (with the consent captured in-conversation) hand the
  // face sheet to the recommended programs so their intake teams have it in hand.
  // Match on the de-identified subset. When `share` is true (first completion), also
  // store the face sheet + send it to the recommended programs. A refresh re-matches
  // only (no re-emailing the programs).
  async function runMatch(sheet: Record<string, unknown>, opts: { share: boolean }) {
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheet),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not find matches');

      const facilities: MatchedFacility[] = data.facilities ?? [];
      const name = typeof sheet.full_name === 'string' ? sheet.full_name.split(' ')[0] : undefined;
      setMatches(facilities);
      setSeekerName(name);

      let didShare = false;
      if (opts.share && facilities.length > 0) {
        const h = await fetch('/api/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: data.match_id,
            facility_ids: facilities.map((f) => f.id),
            face_sheet: sheet,
            consents: { email: sheet.consent_contact === true, share: sheet.consent_share === true },
          }),
        });
        const hd = await h.json().catch(() => ({}));
        didShare = !!hd.shared;
        setShared(didShare);
      }

      // Persist the results so navigating to a profile and back restores the list.
      try {
        let prevShared = false;
        try {
          prevShared = JSON.parse(localStorage.getItem('wc_matches') || '{}').shared === true;
        } catch {
          /* ignore */
        }
        localStorage.setItem('wc_matches', JSON.stringify({ facilities, name, shared: didShare || prevShared }));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish up');
    } finally {
      setFinishing(false);
    }
  }

  async function complete(sheet: Record<string, unknown>) {
    setFaceSheet(sheet);
    try {
      localStorage.setItem('wc_face_sheet', JSON.stringify(sheet));
    } catch {
      /* ignore */
    }
    await runMatch(sheet, { share: true });
  }

  function startOver() {
    try {
      localStorage.removeItem('wc_face_sheet');
      localStorage.removeItem('wc_matches');
    } catch {
      /* ignore */
    }
    setSavedSheet(null);
    setFaceSheet(null);
    setMatches(null);
    setShared(false);
    setMessages([{ role: 'assistant', content: GREETING }]);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError(null);

    const firstUser = next.findIndex((m) => m.role === 'user');
    const payload = next.slice(firstUser);
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    // Captured during the stream; run AFTER it closes so completion work
    // (match → share) never blocks the chat or leaves it stuck on "…".
    let pendingIntake: Record<string, unknown> | null = null;

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      if (!res.ok || !res.body) throw new Error('Intake is unavailable right now');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 2);
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'text') {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                role: 'assistant',
                content: copy[copy.length - 1].content + evt.text,
              };
              return copy;
            });
          } else if (evt.type === 'intake') {
            pendingIntake = evt.data as Record<string, unknown>;
          } else if (evt.type === 'error') {
            setError(evt.message ?? 'Something went wrong');
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }

    // Stream is closed and the chat is responsive again — now do completion work.
    if (pendingIntake) await complete(pendingIntake);
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col px-4 py-6">
      {/* Warm welcome + required acknowledgment before the conversation starts */}
      {!acknowledged && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-2xl">
              🤝
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Hi, I&apos;m your Wellness Companion</h2>
            <p className="mt-2 text-sm text-slate-600">
              Think of me as a caring guide — not a doctor or counselor. I&apos;m here to listen for a few key
              things and help connect you with treatment programs that actually fit you.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-teal-600">•</span>
                <span>
                  Our conversation isn&apos;t medical care, therapy, or crisis treatment — it&apos;s a warm way
                  to get you to the people who can help.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-teal-600">•</span>
                <span>
                  I&apos;ll only ask a handful of simple questions. Share as much or as little as you&apos;d like.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-teal-600">•</span>
                <span>
                  If you&apos;re ever in danger or crisis, please call <strong>911</strong>, or call or text{' '}
                  <strong>988</strong> — they&apos;re there for you right now.
                </span>
              </li>
            </ul>

            <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={ackChecked}
                onChange={(e) => setAckChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-teal-700"
              />
              <span>
                I understand this is a supportive guide to help me find care — not medical or crisis treatment.
              </span>
            </label>

            <button
              onClick={() => {
                if (!ackChecked) return;
                try {
                  localStorage.setItem('wc_ack', '1');
                } catch {
                  /* ignore */
                }
                setAcknowledged(true);
              }}
              disabled={!ackChecked}
              className="mt-4 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              I understand — let&apos;s begin
            </button>
          </div>
        </div>
      )}

      <header className="mb-3">
        <h1 className="text-xl font-semibold text-slate-800">Let&apos;s find care that fits</h1>
        <p className="text-sm text-slate-500">
          No account needed. We ask a few things so we can match you to treatment and pass the basics to the
          programs you choose.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Wellness Companion is a resource navigator — not a medical or crisis service. We connect you with
          treatment programs and the counselors who work there.
        </p>
      </header>

      <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        In an emergency, call <strong>911</strong>. In crisis or having thoughts of suicide, call or text{' '}
        <strong>988</strong> (Suicide &amp; Crisis Lifeline) right now.
      </div>

      {savedSheet && !matches && !messages.some((m) => m.role === 'user') && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
          <span>
            Welcome back
            {typeof savedSheet.full_name === 'string' ? `, ${savedSheet.full_name.split(' ')[0]}` : ''} — we
            saved your information, so you don&apos;t have to start over.
          </span>
          <button
            onClick={() => runMatch(savedSheet, { share: false })}
            disabled={finishing}
            className="rounded-md bg-teal-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {finishing ? 'Refreshing…' : 'Refresh my matches'}
          </button>
          <button onClick={startOver} className="text-xs text-teal-700 underline">
            Start a new conversation
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2 text-sm text-white'
                  : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm text-slate-800'
              }
            >
              {m.content || (busy && i === messages.length - 1 ? '…' : '')}
            </div>
          </div>
        ))}

        {finishing && !matches && (
          <p className="text-sm text-slate-500">Pulling together the places that fit…</p>
        )}

        {matches && (
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-semibold text-slate-700">
              {seekerName ? `Thank you, ${seekerName}. ` : ''}
              {matches.length > 0 ? 'Here are places that may fit' : 'No open matches right now'}
            </h2>

            {matches.length > 0 && shared && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                ✓ We&apos;ve shared your details with these programs so their intake team has what they need —
                they may reach out to you. You&apos;re always welcome to contact them directly too.
              </div>
            )}

            {matches.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    const s = faceSheet ?? savedSheet;
                    if (s) runMatch(s, { share: false });
                  }}
                  disabled={finishing}
                  className="rounded-md border border-teal-300 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                >
                  {finishing ? 'Refreshing…' : '↻ Refresh matches'}
                </button>
                <button onClick={startOver} className="text-xs text-slate-500 underline">
                  Start a new conversation
                </button>
              </div>
            )}

            {matches.length === 0 && (
              <p className="text-sm text-slate-500">
                We couldn&apos;t find an open bed matching your needs this moment. Call <strong>988</strong> or
                <strong> SAMHSA&apos;s helpline at 1-800-662-4357</strong> — they can help you find options 24/7.
              </p>
            )}

            {matches.map((f) => {
              const a = availability(f);
              return (
              <div key={f.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/programs/${f.id}`} className="font-medium text-teal-700 hover:underline">
                    {f.name}
                  </Link>
                  <span
                    className={
                      'shrink-0 rounded-full px-2 py-0.5 text-xs ' +
                      (a.tone === 'green'
                        ? 'bg-green-100 text-green-800'
                        : a.tone === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {a.chip}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {[f.city, f.state].filter(Boolean).join(', ')}
                  {f.in_network ? ' · In-network' : ''} · {a.detail}
                </p>
                {f.referral_contact && (f.referral_contact.phone || f.referral_contact.email) && (
                  <p className="mt-2 text-sm text-slate-700">
                    Reach their intake team
                    {f.referral_contact.name ? ` (${f.referral_contact.name})` : ''}:{' '}
                    {f.referral_contact.phone && <span className="font-medium">{f.referral_contact.phone}</span>}
                    {f.referral_contact.phone && f.referral_contact.email ? ' · ' : ''}
                    {f.referral_contact.email && (
                      <a className="font-medium text-teal-700 underline" href={`mailto:${f.referral_contact.email}`}>
                        {f.referral_contact.email}
                      </a>
                    )}
                  </p>
                )}
                <Link
                  href={`/programs/${f.id}`}
                  className="mt-2 inline-block text-xs font-medium text-teal-700 hover:underline"
                >
                  View profile, photos &amp; reviews →
                </Link>
              </div>
              );
            })}
            <Link
              href="/programs"
              className="block pt-1 text-center text-sm font-medium text-teal-700 hover:underline"
            >
              Don&apos;t see the right fit? Browse all programs →
            </Link>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!matches && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || finishing || !input.trim()}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Send'}
          </button>
        </form>
      )}
    </main>
  );
}
