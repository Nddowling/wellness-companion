'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Logo } from '@/components/Logo';
import { Dialog } from '@/components/ui';
import {
  PAYER_LABELS,
  type LevelOfCare,
  type PayerType,
} from '@/lib/constants';
import { COMMERCIAL_CARRIER_NAMES } from '@/lib/payers';
import { createClient } from '@/lib/supabase/client';

type ConcernCategory = 'substance_use' | 'mental_health' | 'co_occurring' | 'unsure';
type Phase = 'intake' | 'matching' | 'results' | 'connect';
type ConnectChoice = 'programs' | 'email' | 'both' | 'neither';
type ContactMethod = 'phone' | 'email';

type MatchedFacility = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  level: string;
  bed_based: boolean;
  beds_available: number;
  freshness: 'green' | 'amber' | 'red';
  provider_reported: boolean;
  region_match: boolean;
  referral_contact: { name?: string; email?: string; phone?: string } | null;
};

type Choice<T extends string> = {
  value: T;
  label: string;
  detail: string;
};

// Bump when the acknowledgment-gate / Terms consent text changes. Anyone who
// accepted an older version is re-prompted to review the current disclosure.
const TERMS_VERSION = '2026-07-15T17:21:00.000Z';

const LEVEL_CHOICES: readonly Choice<LevelOfCare>[] = [
  {
    value: 'detox',
    label: 'Detox services',
    detail: 'A directory category for withdrawal-management services; confirm the setting directly.',
  },
  {
    value: 'residential',
    label: 'Residential',
    detail: 'Programs where a person stays overnight.',
  },
  {
    value: 'php',
    label: 'Day program (PHP)',
    detail: 'Structured daytime treatment while living elsewhere.',
  },
  {
    value: 'iop',
    label: 'Intensive outpatient (IOP)',
    detail: 'Scheduled treatment several times per week.',
  },
  {
    value: 'op',
    label: 'Outpatient',
    detail: 'Regular scheduled visits while living at home.',
  },
];

const CONCERN_CHOICES: readonly Choice<ConcernCategory>[] = [
  {
    value: 'substance_use',
    label: 'Substance-use treatment',
    detail: 'Browse addiction-treatment programs without describing substances, symptoms, or history.',
  },
  {
    value: 'co_occurring',
    label: 'Co-occurring support',
    detail: 'Only show addiction programs that document co-occurring mental-health services.',
  },
  {
    value: 'mental_health',
    label: 'Standalone mental-health care',
    detail: 'Clear Bed does not currently match standalone mental-health providers, but we will show next steps.',
  },
  {
    value: 'unsure',
    label: 'Not sure',
    detail: 'Use the broad addiction-treatment directory without making a clinical assumption.',
  },
];

const PAYER_CHOICES: readonly Choice<PayerType>[] = [
  { value: 'medicaid', label: PAYER_LABELS.medicaid, detail: 'State Medicaid or a Medicaid managed-care plan.' },
  { value: 'medicare', label: PAYER_LABELS.medicare, detail: 'Original Medicare or Medicare Advantage.' },
  {
    value: 'commercial',
    label: 'Employer or private insurance',
    detail: 'Optionally choose a supported carrier; never enter policy or member details.',
  },
  { value: 'tricare', label: PAYER_LABELS.tricare, detail: 'Military health coverage.' },
  { value: 'self_pay', label: PAYER_LABELS.self_pay, detail: 'Paying directly, including when uninsured.' },
];

const FILTER_STEPS = [
  { label: 'Program type', encouragement: 'Choose a directory filter. A provider determines the appropriate clinical level.' },
  { label: 'General focus', encouragement: 'Choose one broad category. We do not need a treatment or medical narrative.' },
  { label: 'ZIP region', encouragement: 'Enter a ZIP code. Only its first three digits remain after you continue.' },
  { label: 'Payment', encouragement: 'Choose a general payment category. Never enter member or policy numbers.' },
] as const;

const FRESH_LABEL = {
  green: 'Bed report updated recently',
  amber: 'Bed report updated this week',
  red: 'Call to confirm current availability',
} as const;

function availability(facility: MatchedFacility): {
  chip: string;
  tone: 'green' | 'amber' | 'red';
  detail: string;
} {
  if (facility.level === 'detox') {
    return {
      chip: 'Call to confirm setting',
      tone: 'amber',
      detail: 'Detox setting and scheduling are not specified in this directory category',
    };
  }
  if (!facility.bed_based) {
    return {
      chip: 'Call for scheduling',
      tone: 'amber',
      detail: 'Outpatient level listed · current openings not reported',
    };
  }
  if (facility.beds_available > 0 && facility.freshness !== 'red') {
    return {
      chip: facility.provider_reported ? FRESH_LABEL[facility.freshness] : 'Recent directory report',
      tone: facility.freshness,
      detail: `${facility.beds_available} bed${facility.beds_available === 1 ? '' : 's'} reported · call to confirm`,
    };
  }
  return { chip: 'Call to confirm', tone: 'red', detail: 'Availability is not recently confirmed' };
}

function ChoiceCards<T extends string>({
  name,
  choices,
  selected,
  onChange,
}: {
  name: string;
  choices: readonly Choice<T>[];
  selected: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {choices.map((choice) => (
        <label
          key={choice.value}
          className={
            'flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border p-3 transition ' +
            (selected === choice.value
              ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
              : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40')
          }
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={selected === choice.value}
            onChange={() => onChange(choice.value)}
            className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">{choice.label}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{choice.detail}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export default function MatchPage() {
  const supabase = useMemo(() => createClient(), []);
  const [acknowledged, setAcknowledged] = useState(false);
  const [ackChecked, setAckChecked] = useState(false);

  const [phase, setPhase] = useState<Phase>('intake');
  const [stepIdx, setStepIdx] = useState(0);
  const [careLevel, setCareLevel] = useState<LevelOfCare | null>(null);
  const [concernCategory, setConcernCategory] = useState<ConcernCategory | null>(null);
  const [zipInput, setZipInput] = useState('');
  const [regionZip3, setRegionZip3] = useState<string | null>(null);
  const [payerType, setPayerType] = useState<PayerType | null>(null);
  const [payerCarrier, setPayerCarrier] = useState('');

  const [matches, setMatches] = useState<MatchedFacility[] | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connectChoice, setConnectChoice] = useState<ConnectChoice | null>(null);
  const [contactMethod, setContactMethod] = useState<ContactMethod | null>(null);
  const [contactValue, setContactValue] = useState('');
  const [connectCompleted, setConnectCompleted] = useState(false);
  const [contactSaved, setContactSaved] = useState<boolean | null>(null);
  const [shared, setShared] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailCopyAvailable, setEmailCopyAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const matchRequestKeyRef = useRef<string | null>(null);

  const step = FILTER_STEPS[stepIdx] ?? FILTER_STEPS[FILTER_STEPS.length - 1];
  const progressPct = Math.round(((stepIdx + 1) / FILTER_STEPS.length) * 100);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase, stepIdx]);

  useEffect(() => {
    if (acknowledged && phase === 'intake' && stepIdx === 2) zipRef.current?.focus();
    if (phase === 'connect' && connectChoice && connectChoice !== 'neither') contactRef.current?.focus();
  }, [acknowledged, connectChoice, phase, stepIdx]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const accepted = (data.user?.user_metadata as { terms_accepted_at?: string } | undefined)
        ?.terms_accepted_at;
      if (accepted && accepted >= TERMS_VERSION) setAcknowledged(true);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    fetch('/api/handoff', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setEmailCopyAvailable(data.emailCopyAvailable === true);
      })
      .catch(() => {
        if (active) setEmailCopyAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function resetConnect() {
    setConnectChoice(null);
    setContactMethod(null);
    setContactValue('');
    setConnectCompleted(false);
    setContactSaved(null);
    setShared(false);
    setEmailSent(null);
  }

  function startOver() {
    matchRequestKeyRef.current = null;
    setPhase('intake');
    setStepIdx(0);
    setCareLevel(null);
    setConcernCategory(null);
    setZipInput('');
    setRegionZip3(null);
    setPayerType(null);
    setPayerCarrier('');
    setMatches(null);
    setMatchId(null);
    setError(null);
    resetConnect();
  }

  function continueSelection() {
    setError(null);
    if (stepIdx === 0) {
      if (!careLevel) return setError('Choose a program type to continue.');
      setStepIdx(1);
      return;
    }
    if (stepIdx === 1) {
      if (!concernCategory) return setError('Choose a general focus to continue.');
      setStepIdx(2);
    }
  }

  function saveZipRegion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalized = zipInput.trim();
    if (!/^\d{5}(?:-?\d{4})?$/.test(normalized)) {
      setError('Enter a valid 5-digit ZIP code.');
      return;
    }
    // The full ZIP exists only in this input while the person is on this step.
    // Retain only ZIP3 for the next screen and the /api/match request.
    setRegionZip3(normalized.slice(0, 3));
    setZipInput('');
    setStepIdx(3);
  }

  async function runMatch() {
    if (!careLevel || !concernCategory || !regionZip3 || !payerType) {
      setError('Complete each directory filter before finding options.');
      return;
    }
    setPhase('matching');
    setBusy(true);
    setError(null);
    try {
      const requestKey = matchRequestKeyRef.current ?? crypto.randomUUID();
      matchRequestKeyRef.current = requestKey;
      const payload: Record<string, string> = {
        care_level_needed: careLevel,
        concern_category: concernCategory,
        region_zip3: regionZip3,
        payer_type: payerType,
      };
      if (payerType === 'commercial' && payerCarrier) payload.payer_carrier = payerCarrier;

      const response = await fetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': requestKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not find directory options');
      }

      setMatches(Array.isArray(data.facilities) ? data.facilities : []);
      setMatchId(typeof data.match_id === 'string' ? data.match_id : null);
      setPhase('results');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not find directory options');
      setPhase('intake');
    } finally {
      setBusy(false);
    }
  }

  function submitPayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!payerType) {
      setError('Choose a payment category to continue.');
      return;
    }
    void runMatch();
  }

  function startConnect() {
    setError(null);
    setPhase('connect');
  }

  async function runHandoff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matchId || !matches?.length) {
      setPhase('results');
      return;
    }
    if (!connectChoice) {
      setError('Choose one connection option.');
      return;
    }

    const consentShare = connectChoice === 'programs' || connectChoice === 'both';
    const consentEmail = connectChoice === 'email' || connectChoice === 'both';
    if (consentEmail && !emailCopyAvailable) {
      setError('Email copies are temporarily unavailable. You can still let programs contact you or reach out directly.');
      return;
    }
    const requiredMethod: ContactMethod | null =
      connectChoice === 'neither' ? null : consentEmail ? 'email' : contactMethod;
    const value = contactValue.trim();

    if (connectChoice !== 'neither' && !requiredMethod) {
      setError('Choose whether the programs may use a phone number or email address.');
      return;
    }
    if (requiredMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    if (requiredMethod === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        setError('Enter a valid phone number.');
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const contact =
        requiredMethod === 'email'
          ? { email: value }
          : requiredMethod === 'phone'
            ? { phone: value }
            : {};
      const response = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          contact,
          // These booleans come directly from the checked radio option above.
          // No model, natural-language parser, or inferred payload can grant consent.
          consents: { email: consentEmail, share: consentShare },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not complete that connection choice');
      }

      setShared(data.shared === true);
      setContactSaved(data.contactSaved === true);
      setEmailSent(typeof data.emailSent === 'boolean' ? data.emailSent : null);
      setConnectCompleted(true);
      setContactValue('');
      setPhase('results');
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : 'Could not complete that connection choice'}. ` +
          'You can still contact the programs directly below.',
      );
    } finally {
      setBusy(false);
    }
  }

  const activeChoiceReady =
    (stepIdx === 0 && Boolean(careLevel)) || (stepIdx === 1 && Boolean(concernCategory));

  return (
    <main className="grid h-[100dvh] min-h-0 overflow-hidden lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Dialog
        open={!acknowledged}
        onClose={() => undefined}
        title="Hi, I’m your Clear Bed Recovery companion"
        placement="center"
        className="!max-w-md"
        hideClose
        closeOnEscape={false}
        closeOnBackdrop={false}
      >
        <div className="p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-2xl">🤝</div>
          <p className="text-sm text-slate-600">
            This is a treatment-directory guide, not a doctor or counselor. You will choose a few limited filters
            and see programs to review and verify.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="text-teal-600">•</span>
              <span>
                Clear Bed does not provide medical care, clinical placement, therapy, or crisis treatment. A
                qualified provider determines level of care, suitability, and admission.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600">•</span>
              <span>
                The form does not ask for a treatment narrative, diagnosis, medical history, or insurance member
                information.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600">•</span>
              <span>
                In immediate danger or a medical emergency, call <strong>911</strong>. For suicide, self-harm, or
                emotional crisis, call or text <strong>988</strong> now.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600">•</span>
              <span>
                Matching sends only ZIP3 region, directory level, payer category, coarse focus, and an optional
                supported carrier. No name, phone, or email is required to see results.
              </span>
            </li>
          </ul>
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={ackChecked}
              onChange={(event) => setAckChecked(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-teal-700"
            />
            <span>
              I understand this is a directory guide—not medical, placement, or crisis care—and I reviewed and
              agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline underline-offset-2"
                onClick={(event) => event.stopPropagation()}
              >
                Terms of Service
              </a>{' '}
              &amp;{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-teal-700 underline underline-offset-2"
                onClick={(event) => event.stopPropagation()}
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>
          <button
            type="button"
            onClick={async () => {
              if (!ackChecked) return;
              try {
                await supabase.auth.updateUser({
                  data: { terms_accepted_at: new Date().toISOString() },
                });
              } catch {
                // Account metadata is a convenience; the explicit session gate still applies.
              }
              setAcknowledged(true);
            }}
            disabled={!ackChecked}
            className="mt-4 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            I understand — let&apos;s begin
          </button>
        </div>
      </Dialog>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-ink via-brand to-teal-800 p-8 text-white lg:flex">
        <Link href="/" aria-label="Clear Bed Recovery — home">
          <Logo tone="light" className="text-2xl" />
        </Link>

        <div className="flex flex-col items-center text-center">
          <div className="max-w-[17rem] rounded-2xl bg-white/95 px-5 py-4 text-sm text-ink shadow-lg">
            {phase === 'connect'
              ? 'Contact is optional and comes after results. Your checked choice controls the permissions.'
              : phase === 'results'
                ? 'These are filter-based directory options—not personal or clinical recommendations.'
                : step.encouragement}
          </div>
        </div>

        <ol className="space-y-1" aria-label="Directory guide steps">
          {FILTER_STEPS.map((item, index) => {
            const done = index < stepIdx || phase === 'matching' || phase === 'results' || phase === 'connect';
            const current = phase === 'intake' && index === stepIdx;
            return (
              <li
                key={item.label}
                aria-current={current ? 'step' : undefined}
                className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0"
              >
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
                  {done ? '✓' : index + 1}
                </span>
                <span className={current ? 'font-semibold' : done ? 'text-white/80' : 'text-white/45'}>
                  {item.label}
                </span>
              </li>
            );
          })}
          <li
            aria-current={phase === 'connect' ? 'step' : undefined}
            className="flex items-center gap-3 border-t border-white/10 py-3"
          >
            <span
              className={
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ' +
                (connectCompleted
                  ? 'bg-sage text-ink'
                  : phase === 'connect'
                    ? 'bg-white text-ink'
                    : 'border border-white/30 text-white/50')
              }
            >
              {connectCompleted ? '✓' : 5}
            </span>
            <span className={phase === 'connect' ? 'font-semibold' : 'text-white/45'}>Connect (optional)</span>
          </li>
        </ol>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col bg-[#eef5f2]">
        <div className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-3xl flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:py-6 lg:px-8">
          <div className="mb-2 flex items-center justify-between gap-3 pr-16 sm:hidden">
            <Link href="/" aria-label="Clear Bed Recovery — home">
              <Logo className="text-lg" />
            </Link>
            <button
              type="button"
              onClick={startOver}
              className="min-h-11 shrink-0 rounded-full border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
            >
              Start over
            </button>
          </div>

          <Link href="/" aria-label="Clear Bed Recovery — home" className="mb-4 hidden sm:block lg:hidden">
            <Logo className="text-xl" />
          </Link>

          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mb-4 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
            <span className="sm:hidden">
              <strong>Emergency: </strong>
              <a href="tel:911" className="font-semibold underline underline-offset-2">911</a>. Crisis:{' '}
              <a href="tel:988" className="font-semibold underline underline-offset-2">call or text 988</a>.
            </span>
            <span className="hidden sm:inline">
              <strong>In an emergency, call </strong>
              <a href="tel:911" className="font-semibold underline underline-offset-2">911</a>. In crisis or having
              thoughts of suicide, <a href="tel:988" className="font-semibold underline underline-offset-2">call or text 988</a>{' '}
              (Suicide &amp; Crisis Lifeline) now.
            </span>
          </div>

          <div className="hidden items-start justify-between gap-3 sm:flex">
            <div>
              <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
                Narrow the directory <span className="italic text-brand">without a clinical intake.</span>
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Make four explicit choices, see programs, then decide whether to share any contact method. The form
                does not send a narrative or contact information to an AI model.
              </p>
            </div>
            <button
              type="button"
              onClick={startOver}
              className="shrink-0 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
            >
              Start over
            </button>
          </div>

          {phase === 'intake' && (
            <div className="mt-1 sm:mt-5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-teal-700">
                <span>{step.label}</span>
                <span className="text-slate-400">Step {stepIdx + 1} of {FILTER_STEPS.length}</span>
              </div>
              <div
                role="progressbar"
                aria-label="Directory questions progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
                aria-valuetext={`${step.label}: step ${stepIdx + 1} of ${FILTER_STEPS.length}`}
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-teal-100"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sage to-brand transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'connect' && (
            <div className="mt-1 flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 sm:mt-5">
              <span className="text-xs font-semibold text-teal-800">Optional connection choice</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPhase('results');
                }}
                className="shrink-0 text-xs font-semibold text-teal-800 underline hover:text-teal-900"
              >
                Back to matches
              </button>
            </div>
          )}

          <div
            ref={scrollRef}
            role="region"
            aria-label="Clear Bed directory guide"
            aria-live="polite"
            aria-busy={busy || phase === 'matching'}
            className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-sm sm:mt-4 sm:p-5"
          >
            {phase === 'intake' && stepIdx === 0 && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  continueSelection();
                }}
              >
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">What kind of program are you looking for?</legend>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    This is a directory filter, not a recommendation or assessment. If you are unsure, choose the
                    closest browsing category and confirm the setting with a qualified provider.
                  </p>
                  <div className="mt-4">
                    <ChoiceCards
                      name="care-level"
                      choices={LEVEL_CHOICES}
                      selected={careLevel}
                      onChange={(value) => {
                        setCareLevel(value);
                        setError(null);
                      }}
                    />
                  </div>
                </fieldset>
                <button
                  type="submit"
                  disabled={!activeChoiceReady}
                  className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Continue
                </button>
              </form>
            )}

            {phase === 'intake' && stepIdx === 1 && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  continueSelection();
                }}
              >
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">What broad directory focus should we use?</legend>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    No details about substances, symptoms, diagnoses, or treatment history are needed.
                  </p>
                  <div className="mt-4">
                    <ChoiceCards
                      name="concern-category"
                      choices={CONCERN_CHOICES}
                      selected={concernCategory}
                      onChange={(value) => {
                        setConcernCategory(value);
                        setError(null);
                      }}
                    />
                  </div>
                </fieldset>
                <button
                  type="submit"
                  disabled={!activeChoiceReady}
                  className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Continue
                </button>
              </form>
            )}

            {phase === 'intake' && stepIdx === 2 && (
              <form onSubmit={saveZipRegion}>
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">What ZIP code should set the search region?</legend>
                  <p id="zip-privacy" className="mt-1 text-sm leading-relaxed text-slate-600">
                    Enter a 5-digit ZIP code. When you continue, the full ZIP is discarded; only the first three
                    digits are kept and sent for regional matching.
                  </p>
                  <label htmlFor="match-zip" className="mt-5 block text-sm font-semibold text-ink">
                    ZIP code
                  </label>
                  <input
                    ref={zipRef}
                    id="match-zip"
                    name="postal-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={zipInput}
                    onChange={(event) => {
                      setZipInput(event.target.value.replace(/[^\d-]/g, '').slice(0, 10));
                      setError(null);
                    }}
                    aria-describedby="zip-privacy"
                    placeholder="e.g. 30301"
                    maxLength={10}
                    required
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:max-w-sm"
                  />
                </fieldset>
                <button
                  type="submit"
                  disabled={!zipInput.trim()}
                  className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Keep only my ZIP3 and continue
                </button>
              </form>
            )}

            {phase === 'intake' && stepIdx === 3 && (
              <form onSubmit={submitPayer}>
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">How would care be paid for?</legend>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Choose a general category. Do not enter a policy, member, group, or subscriber number.
                  </p>
                  {regionZip3 && (
                    <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Regional search: ZIP3 {regionZip3}. The full ZIP is no longer kept in this form.
                    </p>
                  )}
                  <div className="mt-4">
                    <ChoiceCards
                      name="payer-type"
                      choices={PAYER_CHOICES}
                      selected={payerType}
                      onChange={(value) => {
                        setPayerType(value);
                        if (value !== 'commercial') setPayerCarrier('');
                        setError(null);
                      }}
                    />
                  </div>
                </fieldset>

                {payerType === 'commercial' && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label htmlFor="payer-carrier" className="block text-sm font-semibold text-ink">
                      Exact carrier (optional)
                    </label>
                    <p id="carrier-help" className="mt-1 text-xs leading-relaxed text-slate-500">
                      Choosing one requires a program to list that carrier. It does not prove network status or
                      coverage. Skip it if you are unsure.
                    </p>
                    <select
                      id="payer-carrier"
                      value={payerCarrier}
                      onChange={(event) => setPayerCarrier(event.target.value)}
                      aria-describedby="carrier-help"
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-ink focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:max-w-md"
                    >
                      <option value="">No exact carrier / skip</option>
                      {COMMERCIAL_CARRIER_NAMES.map((carrier) => (
                        <option key={carrier} value={carrier}>{carrier}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!payerType || busy}
                  className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Find directory options
                </button>
              </form>
            )}

            {phase === 'matching' && (
              <div role="status" className="flex min-h-40 items-center justify-center text-center">
                <div>
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
                  <p className="mt-3 text-sm font-medium text-slate-600">Applying your choices to the directory…</p>
                </div>
              </div>
            )}

            {phase === 'connect' && (
              <form onSubmit={runHandoff}>
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">What would you like to happen next?</legend>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Contact is optional. Choose one exact permission; no AI model interprets or changes this choice.
                    {!emailCopyAvailable && ' Email copies are not currently available, so that option is hidden.'}
                  </p>
                  <div className="mt-4 space-y-2">
                    {([
                      ['programs', 'Programs displayed in this match may contact me'],
                      ...(emailCopyAvailable
                        ? ([
                            ['email', 'Email me one copy of these matches'],
                            ['both', 'Both: programs may contact me and email my matches'],
                          ] as const)
                        : []),
                      ['neither', 'Neither: keep my contact details private'],
                    ] as readonly (readonly [ConnectChoice, string])[]).map(([value, label]) => (
                      <label
                        key={value}
                        className={
                          'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ' +
                          (connectChoice === value
                            ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
                            : 'border-slate-200 hover:border-teal-300')
                        }
                      >
                        <input
                          type="radio"
                          name="connect-choice"
                          value={value}
                          checked={connectChoice === value}
                          onChange={() => {
                            setConnectChoice(value);
                            setContactMethod(value === 'email' || value === 'both' ? 'email' : null);
                            setContactValue('');
                            setError(null);
                          }}
                          className="h-4 w-4 shrink-0 accent-teal-700"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {connectChoice === 'programs' && (
                  <fieldset className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <legend className="px-1 text-sm font-semibold text-ink">Which one contact method may they use?</legend>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {(['phone', 'email'] as const).map((method) => (
                        <label key={method} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name="contact-method"
                            value={method}
                            checked={contactMethod === method}
                            onChange={() => {
                              setContactMethod(method);
                              setContactValue('');
                              setError(null);
                            }}
                            className="h-4 w-4 accent-teal-700"
                          />
                          {method === 'phone' ? 'Phone number' : 'Email address'}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}

                {connectChoice && connectChoice !== 'neither' && (connectChoice !== 'programs' || contactMethod) && (
                  <div className="mt-4">
                    <label htmlFor="contact-value" className="block text-sm font-semibold text-ink">
                      {connectChoice === 'email' || connectChoice === 'both' || contactMethod === 'email'
                        ? 'Email address'
                        : 'Phone number'}
                    </label>
                    <input
                      ref={contactRef}
                      id="contact-value"
                      type={connectChoice === 'email' || connectChoice === 'both' || contactMethod === 'email' ? 'email' : 'tel'}
                      autoComplete={connectChoice === 'email' || connectChoice === 'both' || contactMethod === 'email' ? 'email' : 'tel'}
                      value={contactValue}
                      onChange={(event) => {
                        setContactValue(event.target.value.slice(0, 200));
                        setError(null);
                      }}
                      required
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-ink outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:max-w-md"
                    />
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={!connectChoice || busy}
                    className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Saving your choice…' : connectChoice === 'neither' ? 'Confirm no contact' : 'Confirm this permission'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setPhase('results');
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel and keep browsing
                  </button>
                </div>
              </form>
            )}

            {phase === 'results' && matches && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-ink">
                  {matches.length ? 'Directory options based on your choices' : 'No directory matches for these choices'}
                </h2>

                {matches.length > 0 && payerType === 'commercial' && payerCarrier && (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                    These programs list {payerCarrier} as a payment option. That does not confirm current network
                    participation, eligibility, authorization, or what your plan will pay. Verify with the program
                    and insurer.
                  </p>
                )}

                {matches.length > 0 && payerType === 'commercial' && !payerCarrier && (
                  <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                    These programs list commercial insurance, but an exact carrier and network status were not
                    confirmed. Verify both with the program and insurer.
                  </p>
                )}

                {matches.some((facility) => !facility.region_match) && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                    Programs in ZIP3 {regionZip3} are ranked first. Options labeled outside that region are broader
                    directory fallbacks based on the other filters—not nearby matches. Confirm location and travel
                    needs directly with each program.
                  </p>
                )}

                {shared && (
                  <div role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    ✓ Your chosen contact method is available in Clear Bed to the programs displayed in this match.
                    Their authorized users may see it and may reach out; Clear Bed cannot confirm that anyone viewed it.
                  </div>
                )}

                {contactSaved === true && !shared && connectChoice !== 'neither' && (
                  <div role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
                    ✓ Your requested contact choice was saved for this match.
                  </div>
                )}

                {emailSent === true && (
                  <div role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
                    📬 A copy of these matches is on its way to the email address you chose.
                  </div>
                )}

                {emailSent === false && (
                  <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    The email copy could not be sent. Your matches remain below, and you can contact each program directly.
                  </div>
                )}

                {matches.length > 0 && !connectCompleted && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                    <p className="text-sm text-ink">
                      Results come first. If you want, you may now give one explicit permission for program contact
                      {emailCopyAvailable ? ', one emailed copy, both, or neither.' : ', or choose neither.'}
                    </p>
                    <button
                      type="button"
                      onClick={startConnect}
                      className="mt-2 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800 sm:w-auto sm:py-2"
                    >
                      Choose how to connect →
                    </button>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Prefer to reach out yourself? Each available program intake contact appears below.
                    </p>
                  </div>
                )}

                {connectCompleted && connectChoice === 'neither' && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    No contact details were provided, saved, or shared. You can use the direct program contacts below.
                  </div>
                )}

                {matches.length === 0 && (
                  <p className="text-sm leading-relaxed text-slate-600">
                    {concernCategory === 'mental_health'
                      ? 'Clear Bed is an addiction-treatment directory, including some programs that document co-occurring services. It does not list or match standalone mental-health providers.'
                      : 'No directory options matched this combination of ZIP3 region, listed program level, broad focus, and reported payment information.'}{' '}
                    You can broaden the search or call <strong>SAMHSA&apos;s National Helpline at 1-800-662-4357</strong>.
                    In immediate danger call <strong>911</strong>; for crisis support call or text <strong>988</strong>.
                  </p>
                )}

                {matches.map((facility) => {
                  const currentAvailability = availability(facility);
                  return (
                    <article key={facility.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <Link href={`/programs/${facility.id}`} className="font-medium text-teal-700 hover:underline">
                          {facility.name}
                        </Link>
                        <span
                          className={
                            'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs ' +
                            (currentAvailability.tone === 'green'
                              ? 'bg-green-100 text-green-800'
                              : currentAvailability.tone === 'amber'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600')
                          }
                        >
                          {currentAvailability.chip}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {[facility.city, facility.state].filter(Boolean).join(', ')}
                        {[facility.city, facility.state].filter(Boolean).length ? ' · ' : ''}
                        Payment option listed—verify benefits · {currentAvailability.detail}
                      </p>
                      {!facility.region_match && (
                        <p className="mt-1 text-xs font-semibold text-amber-800">Outside your requested ZIP3 region</p>
                      )}
                      {facility.referral_contact && (facility.referral_contact.phone || facility.referral_contact.email) && (
                        <p className="mt-2 text-sm text-slate-700">
                          Reach their intake team
                          {facility.referral_contact.name ? ` (${facility.referral_contact.name})` : ''}:{' '}
                          {facility.referral_contact.phone && <span className="font-medium">{facility.referral_contact.phone}</span>}
                          {facility.referral_contact.phone && facility.referral_contact.email ? ' · ' : ''}
                          {facility.referral_contact.email && (
                            <a className="font-medium text-teal-700 underline" href={`mailto:${facility.referral_contact.email}`}>
                              {facility.referral_contact.email}
                            </a>
                          )}
                        </p>
                      )}
                      <Link href={`/programs/${facility.id}`} className="mt-2 inline-block text-xs font-medium text-teal-700 hover:underline">
                        View profile, photos &amp; reviews →
                      </Link>
                    </article>
                  );
                })}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link href="/programs" className="text-sm font-medium text-teal-700 hover:underline">
                    Browse all programs →
                  </Link>
                  <button type="button" onClick={startOver} className="text-xs text-slate-500 underline">
                    Start a new search
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </main>
  );
}
