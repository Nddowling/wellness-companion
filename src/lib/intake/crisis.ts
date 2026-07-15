export type CrisisCategory =
  | 'suicide_or_self_harm'
  | 'overdose_or_medical_emergency'
  | 'violence_or_immediate_danger'
  | 'poisoning'
  | 'dangerous_withdrawal';

type IntakeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type CrisisAssessment = {
  categories: CrisisCategory[];
  response: string;
};

const SUICIDE_OR_SELF_HARM = [
  /\bsuicid\w*\b/,
  /\bself[\s-]*harm\w*\b/,
  /\b(?:kill|hurt|harm|cut|hang)\s+(?:myself|ourselves)\b/,
  /\b(?:end|take)\s+my\s+(?:own\s+)?life\b/,
  /\b(?:want|wish|plan(?:ning)?|going)\s+to\s+die\b/,
  /\bdo\s+not\s+want\s+to\s+(?:live|be\s+alive)\b/,
  /\bdon't\s+want\s+to\s+(?:live|be\s+alive)\b/,
  /\bbetter\s+off\s+dead\b/,
  /\bkms\b/,
];

const OVERDOSE_OR_MEDICAL_EMERGENCY = [
  /\boverdos(?:e|ed|ing)\b/,
  /\bod(?:'d|ed|ing)?\b/,
  /\b(?:unresponsive|unconscious)\b/,
  /\b(?:not|isn't|isnt|stopped)\s+breathing\b/,
  /\b(?:barely|hardly)\s+breathing\b/,
  /\b(?:slow|shallow|irregular)\s+breathing\b/,
  /\bgasping\b/,
  /\b(?:can't|cannot|couldn't|won't|will\s+not)\s+(?:wake|wake\s+up|be\s+awakened)\b/,
  /\b(?:blue|grey|gray)\s+(?:lips|face|skin)\b/,
  /\btook\s+too\s+much\b/,
];

const VIOLENCE_OR_IMMEDIATE_DANGER = [
  /\b(?:in|there(?:'s|\s+is))\s+immediate\s+danger\b/,
  /\b(?:fear|afraid|scared)\s+(?:for\s+)?(?:my|their|his|her|our)\s+life\b/,
  /\b(?:has|have|holding|carrying|pointing|pulled|brandishing)\s+(?:a\s+)?(?:loaded\s+)?(?:gun|knife|weapon)\b/,
  /\b(?:gun|knife|weapon)\s+(?:to|at|on)\b/,
  /\b(?:threaten(?:ing|ed)?|going|trying|plans?)\s+to\s+(?:kill|shoot|stab|attack|hurt)\b/,
  /\b(?:being|getting)\s+(?:attacked|assaulted|beaten|shot|stabbed)\b/,
  /\b(?:shoot|stab|kill|attack|hurt)\s+(?:me|him|her|them|someone)\s+(?:now|tonight)\b/,
  /\b(?:domestic\s+violence|abuse|assault)\s+(?:is\s+)?(?:happening\s+)?(?:right\s+)?now\b/,
];

const POISONING = [
  /\bpoison(?:ed|ing)?\b/,
  /\btoxic\s+(?:exposure|chemical|fumes?)\b/,
  /\bcarbon\s+monoxide\b/,
  /\b(?:drank|swallowed|ingested|inhaled|ate)\s+(?:some\s+|a\s+)?(?:bleach|antifreeze|cleaner|pesticide|chemical|fumes?|rat\s+poison)\b/,
];

const WITHDRAWAL_SUBSTANCE =
  '(?:alcohol|beer|wine|liquor|booze|benzodiazepines?|benzos?|xanax|alprazolam|ativan|lorazepam|valium|diazepam|klonopin|clonazepam)';
const EXPLICIT_WITHDRAWAL = '(?:withdrawals?|withdrawing|detoxing|coming\\s+off)';
const DANGEROUS_WITHDRAWAL_SYMPTOM =
  '(?:shak(?:e|es|ing|y)|seizures?|hallucinat\\w*|confus\\w*|cannot\\s+stop\\s+vomiting|can\'t\\s+stop\\s+vomiting)';

const DANGEROUS_WITHDRAWAL = [
  new RegExp(`\\b${WITHDRAWAL_SUBSTANCE}\\b[^\\n.!?]{0,80}\\b${EXPLICIT_WITHDRAWAL}\\b`),
  new RegExp(`\\b${EXPLICIT_WITHDRAWAL}\\b[^\\n.!?]{0,80}\\b${WITHDRAWAL_SUBSTANCE}\\b`),
  new RegExp(
    `\\b(?:stopped|quit)(?:\\s+using|\\s+taking|\\s+drinking)?\\b[^\\n.!?]{0,80}\\b${WITHDRAWAL_SUBSTANCE}\\b[^\\n.!?]{0,80}\\b${DANGEROUS_WITHDRAWAL_SYMPTOM}\\b`,
  ),
  new RegExp(
    `\\b${WITHDRAWAL_SUBSTANCE}\\b[^\\n.!?]{0,80}\\b(?:stopped|quit)(?:\\s+using|\\s+taking|\\s+drinking)?\\b[^\\n.!?]{0,80}\\b${DANGEROUS_WITHDRAWAL_SYMPTOM}\\b`,
  ),
  new RegExp(
    `\\b(?:stopped|quit)\\s+drinking\\b[^\\n.!?]{0,80}\\b${DANGEROUS_WITHDRAWAL_SYMPTOM}\\b`,
  ),
  new RegExp(
    `\\b${DANGEROUS_WITHDRAWAL_SYMPTOM}\\b[^\\n.!?]{0,80}\\b(?:after|since)\\b[^\\n.!?]{0,40}\\b(?:stopped|quit)\\s+drinking\\b`,
  ),
  /\b(?:delirium\s+tremens|dts?)\b/,
];

const DETECTORS: ReadonlyArray<{
  category: CrisisCategory;
  patterns: readonly RegExp[];
}> = [
  { category: 'suicide_or_self_harm', patterns: SUICIDE_OR_SELF_HARM },
  { category: 'overdose_or_medical_emergency', patterns: OVERDOSE_OR_MEDICAL_EMERGENCY },
  { category: 'violence_or_immediate_danger', patterns: VIOLENCE_OR_IMMEDIATE_DANGER },
  { category: 'poisoning', patterns: POISONING },
  { category: 'dangerous_withdrawal', patterns: DANGEROUS_WITHDRAWAL },
];

type DetectionMatch = {
  start: number;
  end: number;
};

// Contrast words and coordinating conjunctions that introduce a new subject
// separate the local meaning of a match. This prevents an unrelated historical
// fact later in the same sentence from masking a present danger statement.
const SEMANTIC_BOUNDARY =
  /\b(?:but|however|yet|although|whereas)\b|\b(?:and|or)\s+(?=(?:(?:now|today|tonight)\s+)?(?:i|we|he|she|they|someone|my|our|his|her|their)\b)/g;

const NEGATION_PREFIXES = [
  /\b(?:not|never|no\s+longer)\s+(?:(?:currently|actively|presently|now)\s+)?$/,
  /\b(?:do\s+not|don't|does\s+not|doesn't|did\s+not|didn't)\s+(?:(?:currently|actively|presently|now)\s+)?(?:want|plan|intend|mean|expect|try|trying)?(?:\s+to)?\s*$/,
  /\b(?:am|is|are|was|were)\s+not\s+(?:(?:currently|actively|presently|now)\s+)?(?:having|experiencing|planning|going|trying)?(?:\s+to)?\s*$/,
  /\b(?:deny|denies|denied|denying)\s+(?:any\s+|being\s+|feeling\s+|having\s+)?$/,
  /\bwithout\s+(?:any\s+)?$/,
  /\bnot\s+true\s+that\s+(?:i|we|he|she|they|someone)\s+(?:am|are|is|was|were)\s+$/,
];

// A negation inside one of these constructions is not reassuring. Treat it as
// ambiguous and keep the gate closed (for example, "I can't promise I am not
// suicidal").
const UNCERTAIN_NEGATION =
  /\b(?:not\s+sure|unsure|don't\s+know|do\s+not\s+know|can't\s+(?:promise|say)|cannot\s+(?:promise|say))\b/;

const NEGATION_REVERSAL = /^\s*(?:until\b|except(?:\s+for)?\b|but\s+now\b)/;

const NUMBER_WORD =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|many|several|multiple)';
const CLEARLY_REMOTE_SUFFIX = new RegExp(
  `^\\s*(?:about\\s+)?(?:(?:\\d+|${NUMBER_WORD})\\s+(?:full\\s+)?(?:years?|decades?)\\s+ago\\b|` +
    '(?:years|many\\s+years|decades?|a\\s+long\\s+time)\\s+ago\\b|' +
    '(?:long\\s+ago|last\\s+year|in\\s+the\\s+past|during\\s+childhood|as\\s+a\\s+(?:child|teenager))\\b)',
);

const CLEARLY_REMOTE_PREFIX = new RegExp(
  `(?:\\b(?:\\d+|${NUMBER_WORD})\\s+(?:full\\s+)?(?:years?|decades?)\\s+ago\\b|` +
    '\\b(?:years\\s+ago|long\\s+ago|last\\s+year|in\\s+the\\s+past|previously|formerly|used\\s+to|' +
    'during\\s+childhood|as\\s+a\\s+(?:child|teenager))\\b)[^.!?;]{0,56}$',
);

const CLEARLY_CURRENT_PREFIX =
  /\b(?:now|right\s+now|currently|today|tonight|just)\b[^.!?;]{0,24}$/;
const CLEARLY_CURRENT_SUFFIX =
  /^\s*(?:again\s+)?(?:now|right\s+now|currently|today|tonight|just\s+now)\b|\bagain\s+(?:now|today|tonight)\b/;

function normalizeForDetection(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function patternMatches(pattern: RegExp, text: string): DetectionMatch[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const matches: DetectionMatch[] = [];

  for (const match of text.matchAll(matcher)) {
    if (match.index === undefined) continue;
    matches.push({ start: match.index, end: match.index + match[0].length });
  }

  return matches;
}

function clauseBounds(text: string, match: DetectionMatch): { start: number; end: number } {
  const before = text.slice(0, match.start);
  const after = text.slice(match.end);
  const punctuationLeftBoundary = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf(';'),
  );
  const semanticLeftBoundary = [...before.matchAll(SEMANTIC_BOUNDARY)].at(-1);
  const leftBoundary = Math.max(
    punctuationLeftBoundary + 1,
    semanticLeftBoundary?.index === undefined
      ? 0
      : semanticLeftBoundary.index + semanticLeftBoundary[0].length,
  );
  const punctuationRightOffsets = ['.', '!', '?', ';']
    .map((separator) => after.indexOf(separator))
    .filter((offset) => offset >= 0);
  const semanticRightBoundary = [...after.matchAll(SEMANTIC_BOUNDARY)][0]?.index;
  const rightOffsets = [
    ...punctuationRightOffsets,
    ...(semanticRightBoundary === undefined ? [] : [semanticRightBoundary]),
  ];

  return {
    start: leftBoundary,
    end: rightOffsets.length > 0 ? match.end + Math.min(...rightOffsets) : text.length,
  };
}

function isExplicitlyNegated(text: string, match: DetectionMatch): boolean {
  const bounds = clauseBounds(text, match);
  const prefix = text.slice(Math.max(bounds.start, match.start - 120), match.start);
  const suffix = text.slice(match.end, Math.min(bounds.end, match.end + 48));

  if (!NEGATION_PREFIXES.some((pattern) => pattern.test(prefix))) return false;
  if (UNCERTAIN_NEGATION.test(prefix)) return false;
  if (NEGATION_REVERSAL.test(suffix)) return false;
  return true;
}

function isClearlyHistorical(text: string, match: DetectionMatch): boolean {
  const bounds = clauseBounds(text, match);
  const prefix = text.slice(Math.max(bounds.start, match.start - 96), match.start);
  const suffix = text.slice(match.end, Math.min(bounds.end, match.end + 96));

  // Present-time or repeat-event language keeps an otherwise historical-looking
  // statement latched. "Overdosed years ago and again today" is current danger.
  if (CLEARLY_CURRENT_PREFIX.test(prefix) || CLEARLY_CURRENT_SUFFIX.test(suffix)) return false;

  return CLEARLY_REMOTE_SUFFIX.test(suffix) || CLEARLY_REMOTE_PREFIX.test(prefix);
}

function isActionableMatch(text: string, match: DetectionMatch): boolean {
  return !isExplicitlyNegated(text, match) && !isClearlyHistorical(text, match);
}

function crisisResponse(categories: readonly CrisisCategory[]): string {
  const has = (category: CrisisCategory) => categories.includes(category);
  const immediate911 =
    has('overdose_or_medical_emergency') ||
    has('violence_or_immediate_danger') ||
    has('dangerous_withdrawal');
  const lines = ['This directory intake is not emergency or crisis support.'];

  if (immediate911) {
    lines.push('Call 911 now.');
  }
  if (has('suicide_or_self_harm')) {
    lines.push(
      'For suicide or self-harm crisis support, call or text 988 (the Suicide & Crisis Lifeline) now. If anyone is in immediate physical danger, call 911 now.',
    );
  }
  if (has('poisoning')) {
    lines.push(
      'For suspected poisoning or toxic exposure, call Poison Control at 1-800-222-1222 now. If anyone has trouble breathing, cannot be awakened, or is in immediate danger, call 911 now.',
    );
  }
  if (has('dangerous_withdrawal')) {
    lines.push(
      'Alcohol or benzodiazepine withdrawal can be dangerous; a qualified medical professional must assess it.',
    );
  }
  if (has('overdose_or_medical_emergency') || has('dangerous_withdrawal')) {
    lines.push('Do not drive yourself or the person in danger.');
  }

  lines.push(
    'This intake is stopped. To use the directory later, start a fresh intake after the immediate danger has been addressed.',
  );
  return lines.join(' ');
}

/**
 * Deterministic, fail-safe intake gate. Only user-authored text is inspected so
 * a prior assistant resource message cannot trigger itself. Every submitted user
 * turn is considered: a later "I'm safe" message cannot reset an earlier signal.
 */
export function detectCrisis(messages: readonly IntakeMessage[]): CrisisAssessment | null {
  const userText = messages
    .filter((message) => message.role === 'user')
    .map((message) => normalizeForDetection(message.content))
    .filter(Boolean);

  const categories = DETECTORS.filter(({ patterns }) =>
    userText.some((text) =>
      patterns.some((pattern) =>
        patternMatches(pattern, text).some((match) => isActionableMatch(text, match)),
      ),
    ),
  ).map(({ category }) => category);

  if (categories.length === 0) return null;
  return { categories, response: crisisResponse(categories) };
}
