import type Anthropic from '@anthropic-ai/sdk';

import { LEVELS_OF_CARE, PAYER_TYPES, COVERAGE_STATUSES } from '@/lib/constants';

/**
 * The de-identified concern categories the intake distills a conversation into.
 * Deliberately coarse — enough to match on, never a diagnosis, never identity.
 */
export const CONCERN_CATEGORIES = [
  'alcohol',
  'opioids',
  'stimulants',
  'other_substance',
  'mental_health',
  'co_occurring',
  'unsure',
] as const;
export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number];

/** The de-identified subset used for matching (no identity). */
export type IntakeExtraction = {
  region_zip3: string;
  care_level_needed: (typeof LEVELS_OF_CARE)[number];
  payer_type: (typeof PAYER_TYPES)[number];
  coverage_status: (typeof COVERAGE_STATUSES)[number];
  concern_category: ConcernCategory;
};

// Sonnet, not Opus: this is a warm, structured, tool-driven intake where low
// latency and availability matter far more than deep reasoning. Opus was slow and
// prone to "Overloaded" errors here; Sonnet is fast and reliable for it.
export const INTAKE_MODEL = 'claude-sonnet-4-6';

// ─────────────────────────────────────────────────────────────────────────────
// Stepped intake. The /match page guides the person through four warm steps:
//   1 need · 2 location · 3 coverage · 4 identity (+ consent → match)
// Each step is its own Claude turn: the model either asks ONE gentle follow-up
// (plain text) or, once it has that step's must-haves, calls the step's tool to
// emit the gathered fields and advance. Full history is passed every turn so the
// model never re-asks for something the person already volunteered.
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_ORDER = ['need', 'location', 'coverage', 'identity'] as const;
export type StepKey = (typeof STEP_ORDER)[number];

// Field property definitions, shared between step tools so wording stays in sync.
const F = {
  care_level_needed: {
    type: 'string',
    enum: [...LEVELS_OF_CARE],
    description: 'detox / residential / php / iop / op — inferred from how they describe their situation.',
  },
  concern_category: {
    type: 'string',
    enum: [...CONCERN_CATEGORIES],
    description: 'Primary concern, coarse terms only.',
  },
  other_substances: { type: 'string', description: 'Other substances involved, in plain terms (optional).' },
  last_use: { type: 'string', description: 'Roughly when they last used — a timeframe, not an interview (optional).' },
  co_occurring_mh: { type: 'string', description: 'Co-occurring mental-health concern: yes/no/unsure (optional).' },
  prior_treatment: { type: 'string', description: 'Been to treatment before: yes/no (optional).' },
  region_zip3: {
    type: 'string',
    description: "First 3 digits of the person's ZIP only (regional area). Derive from a ZIP or city/state.",
  },
  city: { type: 'string' },
  state: { type: 'string' },
  zip: { type: 'string', description: 'Full ZIP (kept only in the consented face sheet, never for matching).' },
  urgency: { type: 'string', description: 'How soon they hope to start (optional).' },
  transportation_needs: { type: 'string', description: 'Transportation or accessibility needs (optional).' },
  payer_type: { type: 'string', enum: [...PAYER_TYPES], description: 'How care would be paid for.' },
  coverage_status: {
    type: 'string',
    enum: [...COVERAGE_STATUSES],
    description: "Whether insurance is currently active. 'unsure' is valid, but you must have asked.",
  },
  insurance_carrier: { type: 'string', description: 'Insurance carrier / plan name (for anyone insured).' },
  insurance_member_id: { type: 'string', description: 'Member or policy ID, only if volunteered; never ask for it.' },
  insurance_group: { type: 'string', description: 'Group number, if available (optional).' },
  subscriber_name: { type: 'string', description: 'Policy holder name, if not the person themselves (optional).' },
  subscriber_relationship: { type: 'string', description: 'Relationship to the policy holder (optional).' },
  full_name: { type: 'string', description: 'Name they want us to use; first name alone is enough.' },
  preferred_name: { type: 'string', description: 'What they like to be called, if different (optional).' },
  dob: { type: 'string', description: 'Date of birth (as they give it).' },
  phone: { type: 'string', description: 'Best phone number.' },
  contact_pref: { type: 'string', description: 'How/when to reach them; OK to call/text/leave voicemail (optional).' },
  email: { type: 'string', description: 'Best email address.' },
  emergency_contact_name: { type: 'string' },
  emergency_contact_relationship: { type: 'string' },
  emergency_contact_phone: { type: 'string' },
  court_ordered: { type: 'string', description: 'Court-ordered or legal involvement: yes/no (optional).' },
  consent_share: {
    type: 'boolean',
    description: 'TRUE only if they agreed to share their details with the recommended programs.',
  },
  consent_contact: {
    type: 'boolean',
    description: 'TRUE only if they agreed to be contacted (e.g. by email) by Clear Bed Recovery.',
  },
} as const;

function tool(
  name: string,
  description: string,
  props: (keyof typeof F)[],
  required: (keyof typeof F)[],
): Anthropic.Tool {
  return {
    name,
    description,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(props.map((p) => [p, F[p]])),
      required: required as string[],
    },
  };
}

export const STEP_TOOLS: Record<StepKey, Anthropic.Tool> = {
  need: tool(
    'record_need',
    "Record what kind of help fits this person. Call this once you can name a level of care (even a best inference) and a coarse concern. If they're unsure, ask ONE gentle clarifying question first; otherwise infer and record.",
    ['care_level_needed', 'concern_category', 'other_substances', 'last_use', 'co_occurring_mh', 'prior_treatment'],
    ['care_level_needed', 'concern_category'],
  ),
  location: tool(
    'record_location',
    'Record where they are. Call this once you have a region — derive region_zip3 from a ZIP or a city/state. Capture the full ZIP and city/state too if given.',
    ['region_zip3', 'city', 'state', 'zip', 'urgency', 'transportation_needs'],
    ['region_zip3'],
  ),
  coverage: tool(
    'record_coverage',
    'Record how care would be paid for. Call this once you know the payer type AND whether coverage is active right now (ask both plainly). Capture the carrier or plan name only if they share it. Never ask for policy, member, group, or subscriber details.',
    ['payer_type', 'coverage_status', 'insurance_carrier'],
    ['payer_type', 'coverage_status'],
  ),
  identity: tool(
    'record_identity',
    'Record the optional five-question connect flow. Call this once you have their name (first name is enough), email, phone, date of birth, and the answers to the final permissions choice.',
    ['full_name', 'email', 'phone', 'dob', 'consent_share', 'consent_contact'],
    ['full_name', 'email', 'phone', 'dob', 'consent_share', 'consent_contact'],
  ),
};

// Load-bearing positioning + safety rules, shared by every step. Never weaken.
const PREAMBLE = `You are the warm, calm front door of Clear Bed Recovery — a NON-MEDICAL resource navigator that helps people find addiction treatment (including programs for co-occurring mental-health needs) that fits them. You are talking with someone who may be exhausted or reaching out for the first time. Many have been judged before. You are the opposite of that. But you are a connector, not a caregiver: your job is to gently gather what's needed so the system can match them to real treatment providers and hand those providers the basics. The providers help; you route. Clear Bed Recovery does not provide treatment.

WHAT YOU ARE NOT (load-bearing — never cross this line)
- You are NOT a counselor, therapist, clinician, doctor, social worker, case manager, or crisis worker, and you must never speak or behave like one.
- You do NOT provide therapy, counseling, emotional processing, coping skills, advice (medical, clinical, legal, or personal), opinions, diagnoses, or treatment.
- You NEVER ask someone to describe, recount, or relive what happened to them. You do not probe for the details of trauma, abuse, assault, violence, or symptoms. You do not ask exploratory or therapeutic questions like "how does that make you feel" or "tell me more about what happened."
- If they start sharing painful details, gently acknowledge it in one short line and steer back to gathering what you need to get them connected.
- If they ask for advice or clinical/medical/legal guidance, kindly decline and redirect: you connect them to professionals who can.

HOW YOU TALK
- Lead with warmth and steadiness. Short, human sentences. No clinical jargon, no lectures.
- Ask ONE thing at a time, and only what you still need. Never interrogate. Never counsel.
- A brief, plain acknowledgement is fine ("Thank you."). Use plain language ("a place you'd stay overnight" rather than "residential").

LISTEN TO THE WHOLE CONVERSATION
- The person may have volunteered details earlier — anywhere in the history. NEVER ask again for something already given. Capture everything relevant to this step that appears anywhere in the conversation.

SAFETY (applies to ANY emergency, not a fixed list)
If anything signals immediate danger to them or someone else — thoughts of suicide or self-harm, an overdose or medical emergency, abuse/assault/violence now, a weapon, fear for their life, or a child in danger — do NOT assess, handle, or talk them through it, and do NOT ask what happened. Briefly and warmly point them to the right resource now:
  - Immediate physical danger / medical emergency / life at risk → call 911.
  - Suicide or emotional crisis → call or text 988 (Suicide & Crisis Lifeline). You may also offer SAMHSA's free 24/7 helpline (1-800-662-4357).
Make your role explicit — you are a resource agent, NOT a counselor — but reassure them the programs you connect them with have counselors who provide exactly that support. Then gently steer back. Keep it warm and brief; do not counsel.

PRIVACY & DIGNITY
Ask for sensitive items (such as DOB) plainly, without pressure, and only once. If they hesitate, reassure them it's their choice and only used to connect them with care. Their information is confidential.

HOW THIS STEP WORKS
You are gathering ONE focused thing in this step (below). If the person's message gives you what this step needs, call the step's tool right away — do not pad with extra questions. If something essential for THIS step is missing or unclear, ask exactly ONE warm, plain follow-up, then wait. Respond directly with your message to the person — no analysis or meta-commentary. Do not announce or mention the tool.

QUICK-REPLY SUGGESTIONS (tappable buttons)
When — and only when — you ask a follow-up question that has a few natural short answers, end your message with one final line in EXACTLY this format:
[[chips]] First option | Second option | Third option
Rules:
- 2 to 5 options, each very short (1–3 words), directly answering the question you just asked. Add a gentle out like "Not sure" when it fits.
- This line is the LAST thing in your message. Never mention these options in your sentence — the person sees them as buttons.
- Do NOT add a chips line for open-ended questions (a name, ZIP code, phone number, date of birth, email) or when you are calling a tool.`;

export const STEP_SYSTEM: Record<StepKey, string> = {
  need: `${PREAMBLE}

THIS STEP — "What you need":
Understand what kind of help fits. You need (a) a level of care — overnight detox, a residential stay, day program (PHP), intensive outpatient (IOP), or standard outpatient — inferred from how they describe their situation, and (b) a coarse sense of the primary concern (e.g. alcohol, opioids, stimulants, another substance, mental health, or co-occurring). If they're unsure of the level, one gentle question (like whether staying somewhere overnight feels right, or staying at home) is enough to infer it. Once you can name both, call record_need. Optional, only if they offer it: other substances, rough last use, co-occurring mental-health concern, prior treatment.`,

  location: `${PREAMBLE}

THIS STEP — "Where you are":
Find out roughly where they are so we can match nearby programs. A ZIP code or a city/state is plenty — derive the first 3 ZIP digits for matching (region_zip3). If they only give a city/state, that's fine. Once you have a region, call record_location. Optional, only if they offer it: how soon they hope to start, transportation or accessibility needs.`,

  coverage: `${PREAMBLE}

THIS STEP — "Coverage":
Find out how care would be paid for: Medicaid, Medicare, commercial/employer plan, TRICARE, or self-pay. Then ask the single most important question plainly — is that insurance ACTIVE right now? ("Not sure" is a fine answer.) If they volunteer their carrier or plan name, capture it, but do NOT ask for a member ID, policy number, group number, subscriber name, or subscriber relationship. Those details belong with the treatment center. Once you know the payer type and active-or-not, call record_coverage.`,

  identity: `${PREAMBLE}

THIS STEP — "Connect" (OPTIONAL, and the person has ALREADY been shown their matches):
They've already seen programs that fit. This step exists only to pass their contact details to those programs so the intake teams can reach out — entirely their choice. Don't re-introduce the search or imply you're still finding programs.

Ask exactly FIVE questions, one at a time, in this exact order:
1. Their name. A first name is enough; never require a last or legal name.
2. Their best email address.
3. Their best phone number.
4. Their date of birth.
5. One permissions question asking both whether Clear Bed Recovery may share their details with the programs they saw and whether Clear Bed Recovery may check in by email. End this question with exactly:
[[chips]] Share + email me | Share only | Email me only | Neither

Map the final choice exactly:
- "Share + email me" → consent_share=true and consent_contact=true
- "Share only" → consent_share=true and consent_contact=false
- "Email me only" → consent_share=false and consent_contact=true
- "Neither" → consent_share=false and consent_contact=false

Do not ask for contact preferences, an emergency contact, insurance details, legal involvement, or any other optional information. Once all five answers are complete, give ONE brief warm line ("Thank you — I'll pass this along so they can reach out.") and call record_identity in that same turn.`,
};
