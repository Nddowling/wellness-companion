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
  miles: number | null;
  referral_contact: { name?: string; email?: string; phone?: string } | null;
};

type Choice<T extends string> = {
  value: T;
  label: string;
  detail: string;
};

// Bump when the acknowledgment-gate / Terms consent text changes. Anyone who
// accepted an older version is re-prompted to review the current disclosure.
const TERMS_VERSION = '2026-10-13T18:36:00.000Z';

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
  { label: 'ZIP location', encouragement: 'Enter a ZIP code so matching programs can be ordered by approximate distance.' },
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
  showMobileDetail = true,
}: {
  name: string;
  choices: readonly Choice<T>[];
  selected: T | null;
  onChange: (value: T) => void;
  showMobileDetail?: boolean;
}) {
  const selectedChoice = choices.find((choice) => choice.value === selected);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={
              'flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border px-2 py-2 transition sm:min-h-20 sm:items-start sm:gap-3 sm:p-3 ' +
              (selected === choice.value
                ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40')
            }
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              aria-label={`${choice.label}. ${choice.detail}`}
              checked={selected === choice.value}
              onChange={() => onChange(choice.value)}
              className="h-4 w-4 shrink-0 accent-teal-700 sm:mt-1"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-snug text-ink sm:text-sm">{choice.label}</span>
              <span className="mt-0.5 hidden text-xs leading-relaxed text-slate-500 sm:block">{choice.detail}</span>
            </span>
          </label>
        ))}
      </div>
      {selectedChoice && showMobileDetail && (
        <p aria-live="polite" className="mt-2 rounded-lg bg-teal-50 px-2.5 py-2 text-xs leading-snug text-teal-900 sm:hidden">
          {selectedChoice.detail}
        </p>
      )}
    </>
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
  const [zipCode, setZipCode] = useState<string | null>(null);
  const [payerType, setPayerType] = useState<PayerType | null>(null);
  const [payerCarrier, setPayerCarrier] = useState('');

  const [matches, setMatches] = useState<MatchedFacility[] | null>(null);
  const [routedFacilityIds, setRoutedFacilityIds] = useState<string[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [connectChoice, setConnectChoice] = useState<ConnectChoice | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
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
    // Avoid opening the mobile keyboard before the person chooses to type.
    if (!window.matchMedia('(min-width: 640px)').matches) return;
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
    setContactName('');
    setContactEmail('');
    setContactPhone('');
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
    setZipCode(null);
    setPayerType(null);
    setPayerCarrier('');
    setMatches(null);
    setRoutedFacilityIds([]);
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
    // Keep the five-digit ZIP only in form state for transient distance ranking.
    // The API derives ZIP3 for the saved match and never persists this exact ZIP.
    setZipCode(normalized.slice(0, 5));
    matchRequestKeyRef.current = null;
    setZipInput('');
    setStepIdx(3);
  }

  async function runMatch() {
    if (!careLevel || !concernCategory || !zipCode || !payerType) {
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
        zip_code: zipCode,
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
      setRoutedFacilityIds(
        Array.isArray(data.routedFacilityIds)
          ? data.routedFacilityIds.filter((id: unknown): id is string => typeof id === 'string')
          : [],
      );
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
    if (!matchId || !matches?.length || !routedFacilityIds.length) {
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
    const name = contactName.trim().replace(/\s+/g, ' ');
    const email = contactEmail.trim().toLowerCase();
    const phone = contactPhone.trim();

    if (connectChoice !== 'neither' && (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name))) {
      setError('Enter your name.');
      return;
    }
    if (connectChoice !== 'neither' && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setError('Enter a valid email address.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (consentShare && (phone.length > 50 || digits.length < 7 || digits.length > 15)) {
      setError('Enter a valid phone number.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const contact = connectChoice === 'neither'
        ? {}
        : {
            name,
            email,
            ...(consentShare ? { phone } : {}),
          };
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
      setContactName('');
      setContactEmail('');
      setContactPhone('');
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
  const routedIds = new Set(routedFacilityIds);
  const routedCount = matches?.filter((facility) => routedIds.has(facility.id)).length ?? 0;

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
                Matching sends your five-digit ZIP to our server to estimate distance, along with the selected
                directory filters. Only ZIP3 is saved in the match summary; no name, phone, or email is required
                to see results.
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
                Make four explicit choices, see programs, then decide whether to share contact details. The form
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
            className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-white p-3 shadow-sm sm:mt-4 sm:p-5"
          >
            {phase === 'intake' && stepIdx === 0 && (
              <form
                id="match-care-form"
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
                  <div className="mt-3 sm:mt-4">
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
              </form>
            )}

            {phase === 'intake' && stepIdx === 1 && (
              <form
                id="match-concern-form"
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
                  <div className="mt-3 sm:mt-4">
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
              </form>
            )}

            {phase === 'intake' && stepIdx === 2 && (
              <form id="match-zip-form" onSubmit={saveZipRegion}>
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">What ZIP code should we search near?</legend>
                  <p id="zip-privacy" className="mt-1 text-sm leading-relaxed text-slate-600">
                    Enter a 5-digit ZIP code. We use it briefly to order eligible programs by approximate distance
                    between ZIP-area centers. Only the first three digits are saved with your match.
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
              </form>
            )}

            {phase === 'intake' && stepIdx === 3 && (
              <form id="match-payer-form" onSubmit={submitPayer}>
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">How would care be paid for?</legend>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Choose payment type. Never enter policy, member, group, or subscriber numbers.
                  </p>
                  {zipCode && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600 sm:mt-2 sm:rounded-md sm:bg-slate-50 sm:px-3 sm:py-2">
                      <p>ZIP {zipCode} · only ZIP3 saved</p>
                      <button
                        type="button"
                        onClick={() => {
                          setZipInput(zipCode);
                          setStepIdx(2);
                          setError(null);
                        }}
                        className="shrink-0 font-semibold text-teal-700 underline underline-offset-2 sm:mt-1"
                      >
                        Change ZIP
                      </button>
                    </div>
                  )}
                  <div className="mt-3 sm:mt-4">
                    <ChoiceCards
                      name="payer-type"
                      choices={PAYER_CHOICES}
                      selected={payerType}
                      showMobileDetail={false}
                      onChange={(value) => {
                        setPayerType(value);
                        if (value !== 'commercial') setPayerCarrier('');
                        setError(null);
                      }}
                    />
                  </div>
                </fieldset>

                {payerType === 'commercial' && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:mt-4 sm:p-3">
                    <label htmlFor="payer-carrier" className="block text-sm font-semibold text-ink">
                      Exact carrier (optional)
                    </label>
                    <p id="carrier-help" className="mt-0.5 text-xs leading-snug text-slate-500">
                      A listed carrier does not prove network status or coverage. Verify directly; skip if unsure.
                    </p>
                    <select
                      id="payer-carrier"
                      value={payerCarrier}
                      onChange={(event) => setPayerCarrier(event.target.value)}
                      aria-describedby="carrier-help"
                      className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:max-w-md"
                    >
                      <option value="">No exact carrier / skip</option>
                      {COMMERCIAL_CARRIER_NAMES.map((carrier) => (
                        <option key={carrier} value={carrier}>{carrier}</option>
                      ))}
                    </select>
                  </div>
                )}

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
              <form id="match-connect-form" onSubmit={runHandoff}>
                <fieldset>
                  <legend className="text-lg font-semibold text-ink">What would you like to happen next?</legend>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    Contact is optional and applies only to your {routedCount} contact-shortlist program{routedCount === 1 ? '' : 's'}.
                    Browse-only programs never receive your details through this match. Choose one exact permission;
                    no AI model interprets or changes it.
                    {!emailCopyAvailable && ' Email copies are not currently available, so that option is hidden.'}
                  </p>
                  <div className="mt-3 space-y-2 sm:mt-4">
                    {([
                      ['programs', 'Contact-shortlist programs may contact me by email or phone'],
                      ...(emailCopyAvailable
                        ? ([
                            ['email', 'Email me one copy of my contact shortlist'],
                            ['both', 'Both: shortlist programs may contact me and email me the shortlist'],
                          ] as const)
                        : []),
                      ['neither', 'Neither: do not save my contact details'],
                    ] as readonly (readonly [ConnectChoice, string])[]).map(([value, label]) => (
                      <label
                        key={value}
                        className={
                          'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition sm:min-h-12 sm:gap-3 sm:py-2.5 ' +
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
                            setContactName('');
                            setContactEmail('');
                            setContactPhone('');
                            setError(null);
                          }}
                          className="h-4 w-4 shrink-0 accent-teal-700"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {connectChoice && connectChoice !== 'neither' && (
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:mt-5 sm:space-y-4 sm:p-4">
                    <p className="text-xs leading-relaxed text-slate-600">
                      We keep these contact details for this connection. Do not enter an address, birth date,
                      insurance member information, or medical details.
                    </p>
                    <label htmlFor="contact-name" className="block text-sm font-semibold text-ink">
                      Name
                      <input
                        ref={contactRef}
                        id="contact-name"
                        type="text"
                        autoComplete="name"
                        maxLength={120}
                        value={contactName}
                        onChange={(event) => {
                          setContactName(event.target.value);
                          setError(null);
                        }}
                        required
                        className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-normal text-ink outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:mt-2 sm:max-w-md sm:px-4 sm:py-3"
                      />
                    </label>
                    <label htmlFor="contact-email" className="block text-sm font-semibold text-ink">
                      Email address
                      <input
                        id="contact-email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={contactEmail}
                        onChange={(event) => {
                          setContactEmail(event.target.value);
                          setError(null);
                        }}
                        required
                        className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-normal text-ink outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:mt-2 sm:max-w-md sm:px-4 sm:py-3"
                      />
                    </label>
                    {(connectChoice === 'programs' || connectChoice === 'both') && (
                      <label htmlFor="contact-phone" className="block text-sm font-semibold text-ink">
                        Phone number
                        <input
                          id="contact-phone"
                          type="tel"
                          autoComplete="tel"
                          maxLength={50}
                          value={contactPhone}
                          onChange={(event) => {
                            setContactPhone(event.target.value);
                            setError(null);
                          }}
                          required
                          className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-normal text-ink outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:mt-2 sm:max-w-md sm:px-4 sm:py-3"
                        />
                      </label>
                    )}
                  </div>
                )}

              </form>
            )}

            {phase === 'results' && matches && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-ink">
                  {matches.length
                    ? `${matches.length} directory option${matches.length === 1 ? '' : 's'} based on your choices`
                    : 'No directory matches for these choices'}
                </h2>

                {matches.length > 0 && (
                  <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-xs leading-relaxed text-teal-900">
                    <p>
                      Nearest first from ZIP {zipCode}. Distance, openings, and insurance must be confirmed directly.
                      {' '}{routedCount > 0
                        ? `Only ${routedCount} marked contact-shortlist program${routedCount === 1 ? '' : 's'} can receive your details if you choose.`
                        : 'These are browse-only results; no program receives your details.'}
                    </p>
                    <details className="mt-1">
                      <summary className="cursor-pointer font-semibold underline underline-offset-2">How these results work</summary>
                      <p className="mt-1">
                        Distance is approximate between ZIP-area centers, not a driving route or verified street
                        address. Matches may be farther away when nearby programs do not meet your filters. Confirm
                        location, travel needs, services, and availability with each program. Browse-only results
                        never receive your contact details through this match.
                      </p>
                      {payerType === 'commercial' && (
                        <p className="mt-1">
                          {payerCarrier
                            ? `These programs list ${payerCarrier} as a payment option.`
                            : 'These programs list commercial insurance, but no exact carrier was selected.'}
                          {' '}This does not confirm network participation, eligibility, authorization, or what
                          your plan will pay. Verify with the program and insurer.
                        </p>
                      )}
                    </details>
                  </div>
                )}

                {shared && (
                  <div role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    ✓ Your name, email, and phone are available in Clear Bed only to the marked contact-shortlist programs.
                    Their authorized users may see them and may reach out; Clear Bed cannot confirm that anyone viewed them.
                  </div>
                )}

                {contactSaved === true && !shared && connectChoice !== 'neither' && (
                  <div role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
                    ✓ Your requested contact choice was saved for this match.
                  </div>
                )}

                {emailSent === true && (
                  <div role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
                    📬 A copy of your contact shortlist is on its way to the email address you chose.
                  </div>
                )}

                {emailSent === false && (
                  <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    The email copy could not be sent. Your matches remain below, and you can contact each program directly.
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
                      : 'No directory options matched this combination of listed program level, broad focus, and reported payment information. Try different filters or broaden your search.'}{' '}
                    You can broaden the search or call <strong>SAMHSA&apos;s National Helpline at 1-800-662-4357</strong>.
                    In immediate danger call <strong>911</strong>; for crisis support call or text <strong>988</strong>.
                  </p>
                )}

                {matches.map((facility) => {
                  const currentAvailability = availability(facility);
                  const isRouted = routedIds.has(facility.id);
                  return (
                    <article key={facility.id} className="rounded-lg border border-slate-200 p-3">
                      <span
                        className={
                          'mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                          (isRouted ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600')
                        }
                      >
                        {isRouted ? 'Contact shortlist' : 'Browse-only result'}
                      </span>
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
                      <p className="mt-1 text-xs text-slate-600">
                        {facility.miles !== null
                          ? `About ${facility.miles} miles from ZIP ${zipCode} (straight-line ZIP-center estimate)`
                          : 'Distance unavailable; confirm this program’s location directly.'}
                      </p>
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

          {error && (
            <p id="match-error" role="alert" className="mt-2 shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          {phase === 'intake' && (
            <div className="mt-2 shrink-0 rounded-xl bg-white p-2 shadow-sm sm:mt-3 sm:p-3">
              <button
                type="submit"
                form={['match-care-form', 'match-concern-form', 'match-zip-form', 'match-payer-form'][stepIdx]}
                disabled={stepIdx < 2 ? !activeChoiceReady : stepIdx === 2 ? !zipInput.trim() : !payerType || busy}
                aria-describedby={error ? 'match-error' : undefined}
                className="min-h-11 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {stepIdx === 2 ? 'Use this ZIP and continue' : stepIdx === 3 ? 'Find directory options' : 'Continue'}
              </button>
            </div>
          )}

          {phase === 'connect' && (
            <div className="mt-2 shrink-0 rounded-xl bg-white p-2 shadow-sm sm:mt-3 sm:p-3">
              <button
                type="submit"
                form="match-connect-form"
                disabled={!connectChoice || busy}
                aria-describedby={error ? 'match-error' : undefined}
                className="min-h-11 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Saving your choice…' : connectChoice === 'neither' ? 'Confirm no contact' : 'Confirm this permission'}
              </button>
            </div>
          )}

          {phase === 'results' && matches && !connectCompleted && (
            <div className="mt-2 shrink-0 rounded-xl bg-white p-2 shadow-sm sm:mt-3 sm:p-3">
              <button
                type="button"
                onClick={routedCount > 0 ? startConnect : startOver}
                className="min-h-11 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                {routedCount > 0 ? 'Choose how to connect →' : 'Start a new search'}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
