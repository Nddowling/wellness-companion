// Cornerstone content for the resource hub (/guides). Evergreen, top-of-funnel,
// E-E-A-T-building articles. Clear Bed Recovery is a CONNECTOR, not a provider, so
// the copy is informational — it never gives medical advice and always points to
// professionals + crisis resources. Keep it accurate, plain, and non-clinical.

export type GuideSection = { heading: string; body: string[] };
export type Guide = {
  slug: string;
  title: string; // <title> + H1
  description: string; // meta description
  dek: string; // intro shown under the H1
  updated: string; // ISO date
  readMinutes: number;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: 'how-to-pay-for-addiction-treatment',
    title: 'How to Pay for Addiction Treatment: Insurance, Medicaid & Self-Pay',
    description:
      'A plain-English guide to paying for addiction and mental-health treatment — using private insurance, Medicaid/Medicare, employer plans, and self-pay — plus how to verify what your plan covers.',
    dek: 'Cost is the number-one reason people put off getting help. Here is how treatment actually gets paid for — and why it is often far more affordable than people expect.',
    updated: '2026-06-01',
    readMinutes: 6,
    sections: [
      {
        heading: 'Most plans cover treatment by law',
        body: [
          'Under the federal Mental Health Parity and Addiction Equity Act and the Affordable Care Act, most health plans must cover substance-use and mental-health treatment at the same level they cover other medical care. In practice, that means detox, residential, and outpatient care are commonly covered — sometimes at 100% after your deductible.',
          'What you actually pay depends on your specific plan: your deductible, copay or coinsurance, whether the program is in-network, and the level of care you need. The only way to know for sure is to verify your benefits — which a program’s admissions team will usually do for you, free, in a single phone call.',
        ],
      },
      {
        heading: 'Private & employer insurance',
        body: [
          'Commercial plans (Aetna, Blue Cross Blue Shield, Cigna, UnitedHealthcare, and others) typically cover medically necessary treatment. In-network programs cost you less; out-of-network may still be partially covered depending on your plan.',
          'Two things matter most: whether your coverage is active right now, and whether the program is in-network. When you use Clear Bed Recovery, we match you to programs based on the coverage you tell us about — and the program confirms the details directly with you.',
        ],
      },
      {
        heading: 'Medicaid & Medicare',
        body: [
          'Medicaid covers substance-use treatment in every state, though the specific services and the programs that accept it vary by state. Medicare covers inpatient and outpatient behavioral-health care for those who qualify.',
          'Not every program accepts Medicaid or Medicare, so it helps to filter for ones that do. Our directory lets you see which programs accept your payer type before you ever pick up the phone.',
        ],
      },
      {
        heading: 'Self-pay and sliding scale',
        body: [
          'If you are uninsured, many programs offer self-pay rates, payment plans, scholarships, or sliding-scale fees based on income. Publicly funded and nonprofit programs may offer low- or no-cost care.',
          'SAMHSA’s free national helpline (1-800-662-4357) can also point you to low-cost and state-funded options, 24/7.',
        ],
      },
      {
        heading: 'How to verify your benefits in one call',
        body: [
          'You do not need to decode your policy alone. Have your insurance card handy, then either call the program’s admissions line or let us connect you. They can run a verification of benefits and tell you, often within minutes, what your plan covers and what your out-of-pocket cost would be.',
          'Clear Bed Recovery connects you to treatment facilities; we do not provide treatment ourselves, and we never charge you to use the service.',
        ],
      },
    ],
  },
  {
    slug: 'levels-of-care-explained',
    title: 'Levels of Care Explained: Detox, Residential, PHP, IOP & Outpatient',
    description:
      'Detox, residential, partial hospitalization (PHP), intensive outpatient (IOP), and standard outpatient — what each level of addiction treatment means, who it fits, and how to know which to start with.',
    dek: 'Treatment is not one-size-fits-all. Understanding the levels of care helps you find the right starting point — and the right level often changes as you progress.',
    updated: '2026-06-01',
    readMinutes: 5,
    sections: [
      {
        heading: 'Medical detox',
        body: [
          'Detox is short-term, medically supervised care to manage withdrawal safely. For alcohol, benzodiazepines, and opioids, withdrawal can be dangerous, so detox is often the first step. It is stabilization, not the whole treatment — most people step down into residential or outpatient care afterward.',
        ],
      },
      {
        heading: 'Residential / inpatient',
        body: [
          'Residential treatment means living at the program, typically for a few weeks to a few months. It offers structure, 24/7 support, and distance from the triggers of daily life — a good fit for more severe situations or when home is not a stable place to recover.',
        ],
      },
      {
        heading: 'Partial hospitalization (PHP)',
        body: [
          'PHP is a “day program”: intensive treatment most of the day, several days a week, while you live at home or in sober housing. It bridges residential and outpatient — significant structure without an overnight stay.',
        ],
      },
      {
        heading: 'Intensive outpatient (IOP)',
        body: [
          'IOP usually means a few hours of group and individual therapy, three to five days a week, scheduled around work or school. It suits people with a stable living situation who need real support but not full-time care.',
        ],
      },
      {
        heading: 'Standard outpatient',
        body: [
          'Outpatient care is regular sessions — weekly or a few times a month — for ongoing recovery, often as a step-down after a higher level of care. It is the most flexible and the least disruptive to daily life.',
        ],
      },
      {
        heading: 'Which should you start with?',
        body: [
          'There is no wrong way to start. A good rule of thumb: the more severe or medically risky the situation, the higher the level of care. If you are unsure, our companion can listen for a few key things and suggest a fit in a couple of minutes — and a program’s clinical team makes the final recommendation.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-choose-a-treatment-program',
    title: 'How to Choose a Treatment Program: 7 Things That Actually Matter',
    description:
      'How to choose an addiction or mental-health treatment program — what to look for, the questions to ask, the red flags to avoid, and why licensing and accreditation matter.',
    dek: 'There are tens of thousands of programs. These are the things that actually separate a good fit from a costly mistake.',
    updated: '2026-06-01',
    readMinutes: 6,
    sections: [
      {
        heading: '1. Licensing & accreditation',
        body: [
          'Confirm the program is state-licensed and, ideally, accredited by The Joint Commission (JCAHO) or CARF. Legitimate marketing in this field is also LegitScript-certified. These are baseline trust signals — not optional extras.',
        ],
      },
      {
        heading: '2. The right level of care',
        body: [
          'A program is only a fit if it offers the level of care you actually need (detox, residential, PHP, IOP, or outpatient). Matching the level matters more than the brochure.',
        ],
      },
      {
        heading: '3. Real availability',
        body: [
          'A bed that is “available” on a stale directory may be full by the time you call. Look for current, confirmed availability — that is exactly why Clear Bed Recovery surfaces real-time bed status instead of static listings.',
        ],
      },
      {
        heading: '4. Coverage & cost up front',
        body: [
          'Ask whether they take your insurance, whether they are in-network, and what your out-of-pocket cost would be. A trustworthy program verifies your benefits and gives you a straight answer before you commit.',
        ],
      },
      {
        heading: '5. Specialization that fits you',
        body: [
          'Some programs specialize in co-occurring mental-health conditions, trauma, specific substances, or specific communities (veterans, LGBTQ+, adolescents, faith-based). A program built for your situation tends to serve you better.',
        ],
      },
      {
        heading: '6. Red flags to avoid',
        body: [
          'Be cautious of anyone who pressures you, offers to pay for your travel or treatment in exchange for choosing them, is vague about cost, or routes your call to a “helpline” that sells your information. Ethical programs talk to you directly and never pay for patients.',
        ],
      },
      {
        heading: '7. Questions to ask on the call',
        body: [
          'What level of care do you recommend for my situation? Are you licensed and accredited? Do you take my insurance, and what will I pay? When could I start? What does a typical day look like? How do you handle co-occurring mental-health needs? The answers tell you a lot.',
        ],
      },
    ],
  },
  {
    slug: 'helping-a-loved-one-get-treatment',
    title: 'Helping a Loved One Find Treatment: A Family Guide',
    description:
      'How to help a family member or friend find addiction or mental-health treatment — how to start the conversation, what to prepare, how to handle resistance, and where to get support for yourself.',
    dek: 'Watching someone you love struggle is hard. You cannot do the recovery for them — but you can make the path to help shorter and less overwhelming.',
    updated: '2026-06-01',
    readMinutes: 5,
    sections: [
      {
        heading: 'Lead with care, not ultimatums',
        body: [
          'Approach from concern, not control. Pick a calm moment, use “I” statements (“I’m worried about you” rather than “you need to fix this”), and listen. People are far more likely to accept help they were invited toward than help they were cornered into.',
        ],
      },
      {
        heading: 'Do the legwork ahead of time',
        body: [
          'Resistance often softens when the first step is easy. Having a few real, fitting options ready — programs that take their insurance, in their area, with current availability — removes the overwhelm. You can gather these in a couple of minutes through our directory or companion.',
        ],
      },
      {
        heading: 'Know the coverage basics',
        body: [
          'Find out what insurance they have and whether it is active. Most plans cover treatment, and a program’s admissions team can verify benefits quickly. Knowing this in advance prevents cost from becoming an excuse to delay.',
        ],
      },
      {
        heading: 'When there is immediate danger',
        body: [
          'If someone is in crisis — thinking about suicide, overdosing, or in immediate danger — this is not the moment for a directory. Call 911 for a medical emergency, or call or text 988 (the Suicide & Crisis Lifeline), available 24/7.',
        ],
      },
      {
        heading: 'Take care of yourself, too',
        body: [
          'Supporting someone through this is exhausting. Groups like Al-Anon and Nar-Anon, and family programs at many treatment centers, exist specifically for you. You will be more help to them if you are not running on empty.',
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
