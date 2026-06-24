// Free digital resource library — the "AA pamphlet shelf" for Clear Bed Recovery.
// Gated behind a free account (the seeker / "looking for treatment" profile).
//
// To publish a resource: drop the PDF into /public/library/<file>.pdf and set
// `file` to that name. Until a file is set, the card shows as "Coming soon".

export type LibraryCategory =
  | 'Start Here'
  | 'For Families & Loved Ones'
  | 'Daily Recovery Tools'
  | 'Faith & Hope'
  | 'Crisis & Safety';

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  'Start Here',
  'For Families & Loved Ones',
  'Daily Recovery Tools',
  'Faith & Hope',
  'Crisis & Safety',
];

export type LibraryResource = {
  slug: string;
  title: string;
  description: string;
  category: LibraryCategory;
  format: string; // e.g. "8-page guide (PDF)"
  file?: string; // filename in /public/library — absent = coming soon
};

export const LIBRARY: LibraryResource[] = [
  {
    slug: 'first-24-hours',
    title: 'The First 24 Hours',
    description:
      "You've decided something has to change. A calm, step-by-step guide for the first day — what to do, who to call, and how to get through tonight.",
    category: 'Start Here',
    format: 'Pocket guide (PDF)',
  },
  {
    slug: 'what-to-expect-in-treatment',
    title: 'What to Expect in Treatment',
    description:
      'Detox, residential, PHP, IOP, outpatient — plain-English explanations of the levels of care, what each one is for, and questions to ask.',
    category: 'Start Here',
    format: '10-page guide (PDF)',
  },
  {
    slug: 'paying-for-treatment',
    title: 'Paying for Treatment',
    description:
      'Insurance, Medicaid, scholarships, and sliding-scale options — how coverage actually works and how to ask without the runaround.',
    category: 'Start Here',
    format: 'Guide (PDF)',
  },
  {
    slug: 'letter-to-the-family',
    title: 'A Letter to the Family',
    description:
      'For the parent, spouse, or sibling carrying this too. What you can do, what you can let go of, and that you are not alone in it.',
    category: 'For Families & Loved Ones',
    format: 'Booklet (PDF)',
  },
  {
    slug: 'help-without-enabling',
    title: 'How to Help Without Enabling',
    description:
      'A gentle, evidence-informed approach (CRAFT) to supporting someone you love toward care — without confrontation, shame, or losing yourself.',
    category: 'For Families & Loved Ones',
    format: '12-page guide (PDF)',
  },
  {
    slug: 'daily-recovery-page',
    title: 'Your Daily Recovery Page',
    description:
      'A printable one-page daily check-in — mood, triggers, gratitude, and one next right step. Structure that helps recovery stick.',
    category: 'Daily Recovery Tools',
    format: 'Printable (PDF)',
  },
  {
    slug: 'surfing-triggers',
    title: 'Spotting & Surfing Triggers',
    description:
      'Cravings pass like waves. A simple toolkit for naming triggers, riding them out, and building a relapse-prevention plan that fits your life.',
    category: 'Daily Recovery Tools',
    format: 'Workbook (PDF)',
  },
  {
    slug: 'hope-when-its-dark',
    title: 'Hope When It’s Dark',
    description:
      'Short, honest encouragement for the hardest nights — that you are seen, that this is survivable, and that you are loved beyond what you feel right now.',
    category: 'Faith & Hope',
    format: 'Devotional (PDF)',
  },
  {
    slug: 'through-christ-7-day',
    title: 'Through Christ: A 7-Day Devotional for Early Recovery',
    description:
      'A week of short readings, scripture, and prayer for anyone leaning on faith in early recovery — grace over shame, one day at a time.',
    category: 'Faith & Hope',
    format: '7-day devotional (PDF)',
  },
  {
    slug: 'your-safety-plan',
    title: 'Your Safety Plan',
    description:
      'A fill-in-the-blank plan for the moments that scare you — warning signs, people to call, and the numbers that matter, all in one place.',
    category: 'Crisis & Safety',
    format: 'Printable (PDF)',
  },
];

export const libraryFileUrl = (r: LibraryResource): string | null =>
  r.file ? `/library/${r.file}` : null;
