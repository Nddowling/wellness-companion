'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { COMMON_PAYER_CHIPS } from '@/lib/payers';

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
// Bump when the acknowledgment-gate / Terms consent text changes — anyone who
// accepted an older version is re-prompted so they see (and agree to) the current one.
const TERMS_VERSION = '2026-06-12';

const STEPS = [
  {
    key: 'contact',
    label: 'Start with you',
    opener: "Hey — I'm really glad you reached out. Before we look at programs, what's your first name?",
    encouragement: 'This stays private. It just lets a real program follow up, and it saves your place so nothing gets lost.',
    chips: [],
    placeholder: 'First name',
  },
  {
    key: 'need',
    label: 'What you need',
    opener: 'What kind of support are you looking for?',
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
    chips: COMMON_PAYER_CHIPS,
    placeholder: 'Medicaid, Blue Cross, Aetna, self-pay…',
  },
  {
    key: 'identity',
    label: 'Connect (optional)',
    opener: 'Great — what’s the best phone number to reach you?',
    encouragement: 'Your details stay private and are only used to connect you with care you choose.',
    chips: [],
    placeholder: 'Phone number',
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

// The model ends a follow-up question with a hidden quick-reply line:
//   [[chips]] Alcohol | Opioids | A mix | Not sure
// Split an assistant message into the visible text + its suggested chips, hiding
// any in-progress marker so the raw "[[chips]]" never flashes mid-stream.
// Robust to model variance: [[chips]], [[ chips ]], single brackets, any case.
const CHIP_RE = /\[\[?\s*chips\s*\]?\]/i;
function parseChips(content: string): { text: string; chips: string[] } {
  const m = content.match(CHIP_RE);
  if (!m || m.index === undefined) {
    // Hide a partially-streamed marker at the very end (e.g. "\n[[chi").
    const partial = content.match(/\n*\[\[?\s*c?h?i?p?s?\s*\]?\]?$/i);
    return { text: (partial ? content.slice(0, partial.index) : content).trimEnd(), chips: [] };
  }
  const chips = content
    .slice(m.index + m[0].length)
    // options up to the end of that line, split on | (or commas as a fallback)
    .split('\n')[0]
    .split(/[|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  return { text: content.slice(0, m.index).trimEnd(), chips };
}

export default function MatchPage() {
  // Warm acknowledgment gate before the conversation begins.
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const [stepIdx, setStepIdx] = useState(0);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: STEPS[0].opener }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Accumulated face sheet, merged from each step's recorded fields.
  const [faceSheet, setFaceSheet] = useState<Record<string, unknown>>({});

  // intake  → the 3 de-identified questions that produce matches
  // matching → running the match
  // results → showing matches (the value moment — before any personal info)
  // connect → the OPTIONAL follow-on: name/phone/consent so programs can reach out
  const [phase, setPhase] = useState<'intake' | 'matching' | 'results' | 'connect'>('intake');
  const [matches, setMatches] = useState<MatchedFacility[] | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [seekerName, setSeekerName] = useState<string | undefined>(undefined);
  const [shared, setShared] = useState(false);
  // True when the handoff minted a brand-new login for this (previously anonymous)
  // seeker — so we can tell them an account now exists and to check their inbox.
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anonymous visitors can use the whole funnel; an account is created at handoff.
  // Live per-turn autosave only runs for signed-in seekers — anonymous transcripts
  // are persisted in one shot when the account is created (see runHandoff).
  const [loggedIn, setLoggedIn] = useState(false);

  const supabase = createClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Server-side conversation row id (created on first save). Kept in a ref so the
  // debounced autosave always targets the same row without re-render churn.
  const conversationIdRef = useRef<string | null>(null);
  // The early lead row (name+email) captured at the start — threaded into the hand-off
  // so it updates that same vault row instead of creating a duplicate.
  const contactIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  // Latest snapshot for autosave — refs avoid stale closures inside async saves.
  const dataRef = useRef({ messages, matches, matchId, faceSheet });
  dataRef.current = { messages, matches, matchId, faceSheet };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, phase]);

  // Keep the cursor in the box so people can keep typing without re-clicking.
  useEffect(() => {
    if (
      acknowledged &&
      !busy &&
      (phase === 'intake' || phase === 'connect') &&
      window.matchMedia('(min-width: 640px)').matches
    ) {
      inputRef.current?.focus();
    }
  }, [acknowledged, busy, phase]);

  // Terms are accepted once per ACCOUNT (not per browser): skip the gate if this
  // user already accepted. The chat itself always starts fresh on load/login — we
  // never resume a prior conversation here; past ones live on /conversations.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setLoggedIn(!!data.user);
      const accepted = (data.user?.user_metadata as { terms_accepted_at?: string } | undefined)
        ?.terms_accepted_at;
      // Only skip the gate if they accepted the CURRENT terms — a prior acceptance
      // from before the consent changed re-prompts (ISO timestamps compare lexically).
      if (accepted && accepted >= TERMS_VERSION) setAcknowledged(true);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Restore an in-tab results session so "view a profile → back" returns to the
  // matches instead of restarting the flow (and re-showing the consent gate).
  // sessionStorage is tab-scoped, so a brand-new visit still starts clean.
  useEffect(() => {
    // Deliberate post-hydration restore from a browser-only store: render the
    // default (SSR-matching) state first, then swap in the saved results. Reading
    // sessionStorage in a lazy initializer instead would cause a hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = sessionStorage.getItem('wc_match_session');
      if (!raw) return;
      const s = JSON.parse(raw) as {
        messages?: Message[];
        matches?: MatchedFacility[];
        matchId?: string | null;
        faceSheet?: Record<string, unknown>;
        shared?: boolean;
        accountCreated?: boolean;
        seekerName?: string;
      };
      if (!s || !s.matchId || !Array.isArray(s.matches)) return;
      if (Array.isArray(s.messages)) setMessages(s.messages);
      setMatches(s.matches);
      setMatchId(s.matchId);
      setFaceSheet(s.faceSheet ?? {});
      setShared(!!s.shared);
      setAccountCreated(!!s.accountCreated);
      setSeekerName(s.seekerName);
      setStepIdx(4);
      setPhase('results');
      setAcknowledged(true);
    } catch {
      /* ignore a corrupt snapshot */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Mirror the results state into that tab-scoped session whenever it changes, so a
  // profile round-trip can restore it (see the rehydrate effect above). startOver clears it.
  useEffect(() => {
    if (phase !== 'results' || !matches || !matchId) return;
    try {
      sessionStorage.setItem(
        'wc_match_session',
        JSON.stringify({ messages, matches, matchId, faceSheet, shared, accountCreated, seekerName })
      );
    } catch {
      /* ignore quota/availability errors */
    }
  }, [phase, matches, matchId, faceSheet, shared, accountCreated, seekerName, messages]);

  // Persist the transcript to the seeker's private history (best-effort, debounced).
  // Only once there's real user content, so we never create empty rows.
  async function saveConversation() {
    const d = dataRef.current;
    const firstUser = d.messages.find((m) => m.role === 'user');
    if (!firstUser) return;
    if (savingRef.current) {
      dirtyRef.current = true; // a newer save is needed once this one lands
      return;
    }
    savingRef.current = true;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: conversationIdRef.current,
          title: firstUser.content.slice(0, 80),
          messages: d.messages,
          match_id: d.matchId,
          matched_facilities: (d.matches ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            city: f.city,
            state: f.state,
          })),
          face_sheet: d.faceSheet,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { id?: string };
      if (j.id) conversationIdRef.current = j.id;
    } catch {
      /* best-effort — a failed history save never breaks the live chat */
    } finally {
      savingRef.current = false;
      if (dirtyRef.current) {
        dirtyRef.current = false;
        void saveConversation();
      }
    }
  }

  // Debounced autosave on any meaningful change once the conversation has begun.
  // Only for signed-in seekers — anonymous transcripts are saved at handoff instead.
  useEffect(() => {
    if (!acknowledged || !loggedIn) return;
    if (!messages.some((m) => m.role === 'user')) return;
    const t = setTimeout(() => void saveConversation(), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, matches, matchId, shared, acknowledged, loggedIn]);

  // Phase 1 is just the first 3 steps (need, location, coverage) — they produce
  // matches. Identity (STEPS[4]) is the optional "connect" phase, after results.
  const MATCH_STEPS = 4;
  const step = STEPS[stepIdx];

  // A step can ask more than one question (e.g. "need" asks level, then concern), so
  // the bar must move on every answer — not just when a step completes — or it looks
  // frozen. Fill = completed steps + partial credit for answers within the current step.
  const openerPos = messages.map((m) => m.content).lastIndexOf(step.opener);
  const answersInStep =
    openerPos === -1 ? 0 : messages.slice(openerPos + 1).filter((m) => m.role === 'user').length;
  const withinStep = Math.min(answersInStep, 2) / 2; // 0 → 0.5 → 1 toward the next step
  const progressPct =
    phase === 'results'
      ? 100
      : Math.max(6, Math.min(96, Math.round(((stepIdx + withinStep) / MATCH_STEPS) * 100)));
  const connectAnswers = phase === 'connect' ? messages.filter((m) => m.role === 'user').length : 0;
  const connectQuestionNumber = Math.min(connectAnswers + 1, 3);
  const connectProgressPct = (connectQuestionNumber / 3) * 100;

  // Chips track the question actually on screen: the model's own suggestions for a
  // follow-up if it offered any, otherwise the step opener's curated chips, else none.
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const modelChips = lastAssistant ? parseChips(lastAssistant.content).chips : [];
  const activeChips =
    modelChips.length > 0
      ? modelChips
      : lastAssistant?.content === step.opener
        ? [...step.chips]
        : [];

  // The placeholder should track the question actually on screen, not just the step:
  // during a step's follow-up sub-questions the step default ("Outpatient, residential…")
  // would mislead, so fall back to a neutral hint until the next step opens.
  const composerHint =
    lastAssistant && lastAssistant.content !== step.opener ? 'Type your answer…' : step.placeholder;

  // Persist the lead (name + email) the moment the first step completes, so the contact
  // is saved even if they don't finish. Best-effort — never blocks the conversation.
  async function captureContact(sheet: Record<string, unknown>) {
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: sheet.full_name, email: sheet.email }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.contact_id) contactIdRef.current = d.contact_id as string;
    } catch {
      /* best-effort lead capture */
    }
  }

  // PHASE 1 → results. Match on the de-identified subset only (no identity yet) and
  // show real programs immediately. The handoff (sharing personal details) is a
  // separate, opt-in step from the results screen — see runHandoff().
  async function runMatch(sheet: Record<string, unknown>) {
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
      setMatches(facilities);
      setMatchId(data.match_id ?? null);

      try {
        // Keep only the de-identified match_id for outbound-click attribution
        // (GoToWebsiteButton reads it). The transcript is saved server-side.
        if (data.match_id) localStorage.setItem('wc_matches', JSON.stringify({ match_id: data.match_id }));
      } catch {
        /* ignore */
      }
      setPhase('results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish up');
      setPhase('intake');
    }
  }

  // PHASE 2 (opt-in) → share the seeker's details with the matched programs so their
  // intake teams can reach out. Runs after the "connect" conversation records identity.
  async function runHandoff(identitySheet: Record<string, unknown>) {
    const name =
      typeof identitySheet.full_name === 'string' ? identitySheet.full_name.split(' ')[0] : undefined;
    setSeekerName(name);

    if (!matchId || !matches || matches.length === 0) {
      setPhase('results');
      return;
    }
    try {
      const h = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          contact_id: contactIdRef.current ?? undefined,
          facility_ids: matches.map((f) => f.id),
          face_sheet: identitySheet,
          consents: {
            email: identitySheet.consent_contact === true,
            share: identitySheet.consent_share === true,
          },
          // The transcript so far, so it's saved to the seeker's history the moment
          // their account is created (anonymous chats have no per-turn autosave).
          messages: dataRef.current.messages,
          matched_facilities: (dataRef.current.matches ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            city: f.city,
            state: f.state,
          })),
        }),
      });
      const hd = await h.json().catch(() => ({}));
      const didShare = !!hd.shared;
      setShared(didShare);
      setAccountCreated(!!hd.accountCreated);
    } catch {
      setError(
        'We saved your matches, but had trouble sharing your details just now. You can still reach the programs directly below.'
      );
    }
    setPhase('results');
  }

  // Enter the optional connect (identity + consent) conversation from the results.
  function startConnect() {
    setStepIdx(4);
    setError(null);
    setMessages([{ role: 'assistant', content: STEPS[4].opener }]);
    setPhase('connect');
  }

  // Begin a fresh conversation. The current transcript is already saved to history;
  // clearing the row id means the next autosave creates a new history entry.
  function startOver() {
    conversationIdRef.current = null;
    try {
      localStorage.removeItem('wc_matches');
      sessionStorage.removeItem('wc_match_session');
    } catch {
      /* ignore */
    }
    setFaceSheet({});
    setMatches(null);
    setMatchId(null);
    setShared(false);
    setAccountCreated(false);
    setSeekerName(undefined);
    setStepIdx(0);
    setError(null);
    setMessages([{ role: 'assistant', content: STEPS[0].opener }]);
    setPhase('intake');
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || (phase !== 'intake' && phase !== 'connect')) return;

    const prior = messages; // snapshot to roll back to if this turn fails
    const history = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(history);
    setInput('');
    setBusy(true);
    setError(null);
    // Streaming assistant bubble.
    setMessages((m) => [...m, { role: 'assistant', content: '' }]);

    let stepData: Record<string, unknown> | null = null;
    let errored = false;

    // Hard stop so a stalled stream can never leave the UI frozen on "…".
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 30_000);

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: step.key, messages: history }),
        signal: ctrl.signal,
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
            errored = true;
            setError(evt.message ?? 'Something interrupted us — please try that again.');
          }
        }
      }
    } catch {
      errored = true;
      setError('Something interrupted us — please try that again.');
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }

    // On failure, roll the turn back so the person can simply re-tap their answer
    // (and we never leave a half-streamed or empty bubble behind).
    if (errored) {
      setMessages(prior);
      setInput(trimmed);
      return;
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
      if (step.key === 'contact') void captureContact(merged);
      if (phase === 'connect') {
        // Identity + consent gathered → share with the matched programs.
        await runHandoff(merged);
      } else if (stepIdx < MATCH_STEPS - 1) {
        // Still gathering the 3 de-identified questions (need → location → coverage).
        const next = stepIdx + 1;
        setStepIdx(next);
        setMessages((m) => [...m, { role: 'assistant', content: STEPS[next].opener }]);
      } else {
        // Conversation done. With a precise ZIP, send them to the neutral nearby map
        // (everyone within range, by distance, no favoritism); record the de-identified
        // demand fire-and-forget. Without one (city/state only), keep the in-page flow.
        const fullZip = typeof merged.zip === 'string' ? (merged.zip.match(/\d{5}/) || [])[0] : undefined;
        const city = typeof merged.city === 'string' ? merged.city.trim() : '';
        const st = typeof merged.state === 'string' ? merged.state.trim() : '';
        if (fullZip || (city && st)) {
          try {
            void fetch('/api/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(merged),
            });
          } catch {
            /* demand analytics is best-effort */
          }
          const q = fullZip ? `zip=${fullZip}` : `city=${encodeURIComponent(city)}&state=${encodeURIComponent(st)}`;
          router.push(`/match/nearby?${q}`);
        } else {
          await runMatch(merged);
        }
      }
    }
  }

  return (
    <main className="grid h-[100dvh] min-h-0 overflow-hidden lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* ── Acknowledgment gate ─────────────────────────────── */}
      {!acknowledged && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
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
              <span>
                I understand this is a supportive guide to help me find care — not medical or crisis treatment — and
                I&apos;ve reviewed and agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Service
                </a>{' '}
                &amp;{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-700 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              By continuing, you agree Clear Bed Recovery may email or text you about treatment options, resources, and
              offers. You can unsubscribe anytime.
            </p>
            <button
              onClick={async () => {
                if (!ackChecked) return;
                // Remember acceptance on the account so it's never asked again.
                try {
                  await supabase.auth.updateUser({
                    data: { terms_accepted_at: new Date().toISOString() },
                  });
                } catch {
                  /* non-fatal — they can still proceed this session */
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
            const done =
              i < stepIdx || (phase === 'results' && i < MATCH_STEPS) || (i === 4 && shared);
            const current =
              (phase === 'intake' && i === stepIdx) || (phase === 'connect' && i === 4);
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
      <section className="flex min-h-0 min-w-0 flex-col bg-[#eef5f2]">
        <div className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-2xl flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:py-6 lg:px-8">
          {/* Conversation-first phone toolbar */}
          <div className="mb-2 flex items-center justify-between gap-3 pr-16 sm:hidden">
            <Link href="/" aria-label="Clear Bed Recovery — home">
              <Logo className="text-lg" />
            </Link>
            <button
              onClick={startOver}
              className="min-h-11 shrink-0 rounded-full border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
            >
              New chat
            </button>
          </div>

          {/* Tablet logo; desktop uses the left rail */}
          <Link href="/" aria-label="Clear Bed Recovery — home" className="mb-4 hidden sm:block lg:hidden">
            <Logo className="text-xl" />
          </Link>

          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mb-4 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
            <span className="sm:hidden">
              <strong>Emergency: 911.</strong> Crisis:{' '}
              <a href="tel:988" className="font-semibold underline underline-offset-2">
                call or text 988
              </a>
              .
            </span>
            <span className="hidden sm:inline">
              <strong>In an emergency, call 911.</strong> In crisis or having thoughts of suicide, call or text{' '}
              <strong>988</strong> (Suicide &amp; Crisis Lifeline) right now.
            </span>
          </div>

          <div className="hidden items-start justify-between gap-3 sm:flex">
            <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
              Let&apos;s find care{' '}
              <span className="italic text-brand">that actually fits.</span>
            </h1>
            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
              <button
                onClick={startOver}
                className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
              >
                ＋ New conversation
              </button>
              {loggedIn && (
                <Link href="/conversations" className="text-xs text-slate-500 underline hover:text-teal-700">
                  Past conversations →
                </Link>
              )}
            </div>
          </div>
          <p className="mt-2 hidden text-sm text-slate-600 sm:block">
            We start with your name and email so a program can follow up, then a few quick questions — and we&apos;ll show
            you real programs near you right away, matched to your coverage and what you&apos;re looking for. You choose
            whether to share more for them to reach out. We connect you to treatment facilities; we don&apos;t provide
            treatment ourselves.
          </p>

          {/* Progress — only the 3 de-identified questions before results */}
          {phase === 'intake' && (
            <div className="mt-1 sm:mt-5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-teal-700">
                <span>{step.label}</span>
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

          {/* Connect (opt-in) banner */}
          {phase === 'connect' && (
            <div className="mt-1 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 sm:mt-5">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-teal-800">
                <span>Question {connectQuestionNumber} of 3</span>
                <button onClick={() => setPhase('results')} className="shrink-0 underline hover:text-teal-900">
                  ← Back to matches
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sage to-brand transition-all duration-500"
                  style={{ width: `${connectProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Conversation / results */}
          <div
            ref={scrollRef}
            className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-2xl bg-white p-3 shadow-sm sm:mt-4 sm:p-4"
          >
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2 text-sm text-white sm:max-w-[80%]'
                      : 'max-w-[94%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm bg-mist px-4 py-2 text-sm text-ink sm:max-w-[85%]'
                  }
                >
                  {(m.role === 'assistant' ? parseChips(m.content).text : m.content) ||
                    (busy && i === messages.length - 1 ? '…' : '')}
                </div>
              </div>
            ))}

            {/* Quick-reply chips for the question currently on screen */}
            {(phase === 'intake' || phase === 'connect') && !busy && activeChips.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {activeChips.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="min-h-11 rounded-full border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-800 transition hover:border-teal-300 hover:bg-teal-100 sm:min-h-0 sm:px-3.5 sm:py-1.5"
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

                {accountCreated && (
                  <div className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
                    📬 We&apos;ve also created a private account for you and emailed a sign-in link — log in anytime to
                    revisit these matches and pick up where you left off.
                  </div>
                )}

                {/* Opt-in connect: only after they've seen value (the matches) */}
                {matches.length > 0 && !shared && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                    <p className="text-sm text-ink">
                      Want these programs to reach out to <em>you</em>? Add your contact details and we&apos;ll share
                      them so their intake team can call — your choice, takes about a minute.
                    </p>
                    <button
                      onClick={startConnect}
                      className="mt-2 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 sm:w-auto sm:py-2"
                    >
                      Have them reach out to me →
                    </button>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Prefer to reach out yourself? Each program&apos;s intake line is below.
                    </p>
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
                      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <Link
                          href={`/programs/${f.id}`}
                          className="font-medium text-teal-700 hover:underline"
                        >
                          {f.name}
                        </Link>
                        <span
                          className={
                            'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ' +
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
          {(phase === 'intake' || phase === 'connect') && (
            <form
              className="mt-2 flex gap-2 sm:mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Or type something… (${composerHint})`}
                className="min-w-0 flex-1 rounded-xl bg-ink px-4 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50 sm:px-5"
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
