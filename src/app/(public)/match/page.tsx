'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Logo } from '@/components/Logo';

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

// The four guided steps. Each is AI-backed: a tap or free text is sent to
// /api/intake for that step, which either asks one gentle follow-up or records
// the step's fields and advances. Keys match STEP_ORDER in lib/intake/prompt.
const STEPS = [
  {
    key: 'need',
    label: 'What you need',
    opener: "Hey — glad you're here. What kind of support are you looking for?",
    encouragement: "You don't have to have it all figured out. One step at a time is exactly the right pace.",
    chips: ['Outpatient', 'Residential', 'Detox', 'Not sure'],
    placeholder: 'Outpatient, residential, detox…',
  },
  {
    key: 'location',
    label: 'Where you are',
    opener: 'Got it. Roughly where are you? A ZIP code, or a city and state, is plenty.',
    encouragement: 'This just helps me find programs near you. Nothing here is shared without your say-so.',
    chips: [],
    placeholder: 'ZIP code or city, state',
  },
  {
    key: 'coverage',
    label: 'Coverage',
    opener: 'Thank you. How would care be paid for?',
    encouragement: "Coverage can be confusing — “not sure” is a perfectly fine answer.",
    chips: ['Medicaid', 'Medicare', 'Commercial', 'TRICARE', 'Self-pay'],
    placeholder: 'Medicaid, Blue Cross, self-pay…',
  },
  {
    key: 'identity',
    label: 'Your matches',
    opener: "Almost there. So the programs can reach you, what's your full name?",
    encouragement: "Your details stay private and are only used to connect you with care you choose.",
    chips: [],
    placeholder: 'Type your answer…',
  },
] as const;

const FRESH_LABEL = {
  green: 'Beds confirmed recently',
  amber: 'Availability updated this week',
  red: 'Call to confirm current availability',
} as const;

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

export default function MatchPage() {
  // Warm acknowledgment gate before the conversation begins.
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const [stepIdx, setStepIdx] = useState(0);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: STEPS[0].opener }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Accumulated face sheet, merged from each step's recorded fields.
  const [faceSheet, setFaceSheet] = useState<Record<string, unknown>>({});

  const [phase, setPhase] = useState<'intake' | 'matching' | 'results'>('intake');
  const [matches, setMatches] = useState<MatchedFacility[] | null>(null);
  const [seekerName, setSeekerName] = useState<string | undefined>(undefined);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, phase]);

  // Keep the cursor in the box so people can keep typing without re-clicking.
  useEffect(() => {
    if (acknowledged && !busy && phase === 'intake') inputRef.current?.focus();
  }, [acknowledged, busy, phase]);

  useEffect(() => {
    // Rehydrate a finished result on mount so navigating to a profile and back
    // restores the matches. Must be an effect, not a useState initializer:
    // localStorage is unavailable during SSR (would desync hydration).
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      if (localStorage.getItem('wc_ack')) setAcknowledged(true);
      const m = localStorage.getItem('wc_matches');
      if (m) {
        const p = JSON.parse(m);
        if (Array.isArray(p.facilities) && p.facilities.length) {
          setMatches(p.facilities);
          setSeekerName(p.name);
          setShared(!!p.shared);
          setPhase('results');
        }
      }
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const stepNumber = phase === 'intake' ? stepIdx + 1 : 4;
  const progressPct = phase === 'results' ? 100 : Math.round((stepNumber / 4) * 100);
  const step = STEPS[stepIdx];

  // Match on the de-identified subset; with consent, share the face sheet with the
  // recommended programs so their intake teams have it in hand.
  async function runMatch(sheet: Record<string, unknown>, opts: { share: boolean }) {
    setPhase('matching');
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

      try {
        localStorage.setItem('wc_matches', JSON.stringify({ facilities, name, shared: didShare }));
      } catch {
        /* ignore */
      }
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish up');
      setPhase('intake');
    }
  }

  function startOver() {
    try {
      localStorage.removeItem('wc_matches');
    } catch {
      /* ignore */
    }
    setFaceSheet({});
    setMatches(null);
    setShared(false);
    setSeekerName(undefined);
    setStepIdx(0);
    setError(null);
    setMessages([{ role: 'assistant', content: STEPS[0].opener }]);
    setPhase('intake');
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || phase !== 'intake') return;

    const history = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(history);
    setInput('');
    setBusy(true);
    setError(null);
    // Streaming assistant bubble.
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    let stepData: Record<string, unknown> | null = null;

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: step.key, messages: history }),
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
          } else if (evt.type === 'step') {
            stepData = evt.data as Record<string, unknown>;
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

    // Drop the streaming bubble if it ended up empty (model only called the tool).
    setMessages((m) => {
      if (m.length && m[m.length - 1].role === 'assistant' && m[m.length - 1].content === '') {
        return m.slice(0, -1);
      }
      return m;
    });

    if (stepData) {
      const merged = { ...faceSheet, ...stepData };
      setFaceSheet(merged);
      if (stepIdx < STEPS.length - 1) {
        const next = stepIdx + 1;
        setStepIdx(next);
        setMessages((m) => [...m, { role: 'assistant', content: STEPS[next].opener }]);
      } else {
        // Final step recorded — run the match (and share, if they consented).
        await runMatch(merged, { share: merged.consent_share === true });
      }
    }
  }

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* ── Acknowledgment gate ─────────────────────────────── */}
      {!acknowledged && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-2xl">🤝</div>
            <h2 className="h2 text-ink">Hi, I&apos;m your Clear Bed Recovery companion</h2>
            <p className="mt-2 text-sm text-slate-600">
              Think of me as a caring guide — not a doctor or counselor. I&apos;m here to listen for a few key
              things and help connect you with treatment programs that fit you.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-teal-600">•</span>
                <span>
                  Our conversation isn&apos;t medical care, therapy, or crisis treatment — it&apos;s a warm way to
                  reach the people who can help.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-teal-600">•</span>
                <span>I&apos;ll only ask a handful of simple questions. Share as much or as little as you&apos;d like.</span>
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
              <span>I understand this is a supportive guide to help me find care — not medical or crisis treatment.</span>
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

      {/* ── Left: brand + guide + stepper ───────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-ink via-brand to-teal-800 p-8 text-white lg:flex">
        <Link href="/" aria-label="Clear Bed Recovery — home">
          <Logo tone="light" className="text-2xl" />
        </Link>

        <div className="flex flex-col items-center text-center">
          <div className="max-w-[16rem] rounded-2xl bg-white/95 px-5 py-4 text-sm text-ink shadow-lg">
            {step.encouragement}
          </div>
        </div>

        <ol className="space-y-1">
          {STEPS.map((s, i) => {
            const done = phase === 'results' || i < stepIdx;
            const current = phase !== 'results' && i === stepIdx;
            return (
              <li key={s.key} className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0">
                <span
                  className={
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
                    (done
                      ? 'bg-sage text-ink'
                      : current
                        ? 'bg-white text-ink'
                        : 'border border-white/30 text-white/50')
                  }
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={current ? 'font-semibold' : done ? 'text-white/80' : 'text-white/45'}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* ── Right: conversation ─────────────────────────────── */}
      <section className="flex min-h-0 flex-col bg-[#eef5f2]">
        <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col px-5 py-6 lg:px-8">
          {/* Mobile logo */}
          <Link href="/" aria-label="Clear Bed Recovery — home" className="mb-4 lg:hidden">
            <Logo className="text-xl" />
          </Link>

          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>In an emergency, call 911.</strong> In crisis or having thoughts of suicide, call or text{' '}
            <strong>988</strong> (Suicide &amp; Crisis Lifeline) right now.
          </div>

          <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
            Let&apos;s find care{' '}
            <span className="italic text-brand">that actually fits.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            No account needed. Four quick questions and we&apos;ll show you real programs near you — matched to your
            coverage and what you&apos;re looking for. We connect you to treatment facilities; we don&apos;t provide
            treatment ourselves.
          </p>

          {/* Progress */}
          {phase !== 'results' && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-teal-700">
                <span>Question {stepNumber} of 4</span>
                <span className="text-slate-400">{progressPct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-teal-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sage to-brand transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Conversation / results */}
          <div ref={scrollRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2 text-sm text-white'
                      : 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-mist px-4 py-2 text-sm text-ink'
                  }
                >
                  {m.content || (busy && i === messages.length - 1 ? '…' : '')}
                </div>
              </div>
            ))}

            {/* Quick-reply chips for the current step */}
            {phase === 'intake' && !busy && step.chips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {step.chips.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="rounded-full border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-sm font-medium text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {phase === 'matching' && (
              <p className="text-sm text-slate-500">Pulling together the places that fit…</p>
            )}

            {phase === 'results' && matches && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-ink">
                  {seekerName ? `Thank you, ${seekerName}. ` : ''}
                  {matches.length > 0 ? 'Here are places that may fit' : 'No open matches right now'}
                </h2>

                {matches.length > 0 && shared && (
                  <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    ✓ We&apos;ve shared your details with these programs so their intake team has what they need —
                    they may reach out to you. You&apos;re always welcome to contact them directly too.
                  </div>
                )}

                {matches.length === 0 && (
                  <p className="text-sm text-slate-500">
                    We couldn&apos;t find an open bed matching your needs this moment. Call <strong>988</strong> or{' '}
                    <strong>SAMHSA&apos;s helpline at 1-800-662-4357</strong> — they can help you find options 24/7.
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

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href="/programs"
                    className="text-sm font-medium text-teal-700 hover:underline"
                  >
                    Browse all programs →
                  </Link>
                  <button onClick={startOver} className="text-xs text-slate-500 underline">
                    Start a new conversation
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {/* Composer */}
          {phase === 'intake' && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                ref={inputRef}
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Or type something… (${step.placeholder})`}
                className="flex-1 rounded-xl bg-ink px-4 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
              >
                {busy ? '…' : 'Send'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
