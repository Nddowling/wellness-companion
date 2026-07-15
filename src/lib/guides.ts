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
      'A plain-English guide to paying for addiction treatment — using private insurance, Medicaid/Medicare, employer plans, and self-pay — plus questions to ask about benefits and cost.',
    dek: 'Cost and coverage uncertainty can delay a call for help. Here is a practical way to ask about insurance, public benefits, and self-pay without assuming what a plan will cover.',
    updated: '2026-07-15',
    readMinutes: 6,
    sections: [
      {
        heading: 'Start with your specific plan',
        body: [
          'Many health plans include substance-use or mental-health benefits, but parity rules do not make every plan, service, or program covered. Medical-necessity criteria, authorization, exclusions, network, and the requested level of care all matter.',
          'Ask both the insurer and program about your deductible, copay or coinsurance, network status, authorization, exclusions, and estimated member cost. A benefits check is useful but is not a guarantee that a claim will be paid.',
        ],
      },
      {
        heading: 'Private & employer insurance',
        body: [
          'Commercial plans from Aetna, Blue Cross Blue Shield, Cigna, UnitedHealthcare, and others may include treatment benefits. In-network and out-of-network rules vary, and a directory listing does not prove either status.',
          'Clear Bed Recovery narrows results using a reported payment category and, when supplied, a named carrier. The program and insurer must still confirm participation, eligibility, authorization, benefits, and estimated cost.',
        ],
      },
      {
        heading: 'Medicaid & Medicare',
        body: [
          'Medicaid and Medicare may cover eligible substance-use services, but the covered services, networks, authorization rules, eligibility, and member costs vary by program and plan.',
          'The directory can show which programs list Medicaid or Medicare as a payment option. Treat that as a question to verify, not proof of participation or coverage.',
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
        heading: 'Questions to ask when verifying benefits',
        body: [
          'You do not need to decode your policy alone. You can contact the program’s admissions line and your insurer to ask about eligibility, network, authorization, exclusions, deductible, coinsurance, and an estimated member cost.',
          'A program or insurer may provide a benefits estimate, but timing varies and the estimate is not a promise of admission, coverage, final cost, or claim payment.',
          'Clear Bed Recovery connects you to treatment facilities; we do not provide treatment ourselves, and we never charge you to use the service.',
        ],
      },
    ],
  },
  {
    slug: 'levels-of-care-explained',
    title: 'Levels of Care Explained: Detox, Residential, PHP, IOP & Outpatient',
    description:
      'Detox, residential, partial hospitalization (PHP), intensive outpatient (IOP), and standard outpatient — what each directory label generally means and who determines placement.',
    dek: 'These labels can help you understand program listings. They cannot determine placement; a qualified provider or clinician must assess the appropriate level of care.',
    updated: '2026-07-15',
    readMinutes: 5,
    sections: [
      {
        heading: 'Medical detox',
        body: [
          'Detox is short-term care in which qualified professionals evaluate and manage withdrawal. Whether detox is appropriate, and what should follow it, must be determined by a qualified provider or clinician.',
          'Alcohol and benzodiazepine withdrawal can be dangerous. If withdrawal may involve immediate medical danger, call 911 or seek emergency care now rather than waiting for a directory response. Clear Bed cannot assess withdrawal or give medical instructions.',
        ],
      },
      {
        heading: 'Residential / inpatient',
        body: [
          'Residential treatment generally means living at the program with around-the-clock staffing and a structured schedule. Program length and services vary. A qualified provider or clinician must determine whether this level is appropriate.',
        ],
      },
      {
        heading: 'Partial hospitalization (PHP)',
        body: [
          'PHP is generally a structured day program delivered for multiple hours on scheduled days without an overnight stay. Schedules, housing expectations, and admission criteria vary by program.',
        ],
      },
      {
        heading: 'Intensive outpatient (IOP)',
        body: [
          'IOP generally provides scheduled services for multiple hours on several days each week without an overnight stay. The clinical team determines whether that structure is appropriate for a particular person.',
        ],
      },
      {
        heading: 'Standard outpatient',
        body: [
          'Standard outpatient generally means scheduled visits while the person continues living at home. Frequency, services, and whether it is used before or after another level vary by person and program.',
        ],
      },
      {
        heading: 'Which should you start with?',
        body: [
          'A directory questionnaire cannot safely determine placement from severity or withdrawal risk. Clear Bed can filter listings by the level you select, but a qualified provider or clinician must assess the appropriate level of care and admission.',
          'If there may be immediate danger, including dangerous alcohol or benzodiazepine withdrawal, call 911 or seek emergency care now. Do not wait for a directory match.',
        ],
      },
    ],
  },
  {
    slug: 'how-to-choose-a-treatment-program',
    title: 'How to Choose a Treatment Program: 7 Things That Actually Matter',
    description:
      'How to compare addiction-treatment programs — what to verify, questions to ask, warning signs to notice, and why licensing and accreditation matter.',
    dek: 'Directory records are a starting point. These questions can help you compare programs while leaving clinical placement to qualified professionals.',
    updated: '2026-07-15',
    readMinutes: 6,
    sections: [
      {
        heading: '1. Licensing & accreditation',
        body: [
          'Ask the program for its current state license and verify it with the relevant state agency. CARF or Joint Commission accreditation can be an additional trust signal, but it is distinct from licensure. A marketing certification such as LegitScript is not proof of clinical quality.',
        ],
      },
      {
        heading: '2. Clinical level-of-care assessment',
        body: [
          'A directory can show whether a program lists detox, residential, PHP, IOP, or outpatient services. It cannot determine which level is appropriate for you. Ask a qualified provider or clinician to assess placement and confirm that the program can deliver the recommended service.',
        ],
      },
      {
        heading: '3. Real availability',
        body: [
          'A reported opening can change before you call. Look at when availability was last updated, and confirm directly with admissions. Clear Bed hides exact counts after seven days instead of presenting stale numbers as live.',
        ],
      },
      {
        heading: '4. Coverage & cost up front',
        body: [
          'Ask whether the program participates in your network, whether authorization is required, and for an estimated member cost. Confirm with both the program and insurer. A benefits check or estimate is not a guarantee of coverage, final cost, or claim payment.',
        ],
      },
      {
        heading: '5. Documented services relevant to your request',
        body: [
          'Some addiction-treatment programs document co-occurring mental-health services, trauma-informed approaches, substance-specific services, or work with particular communities. Confirm the current services directly and ask the clinical team whether the program can address the request.',
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
      'How to help a family member or friend research addiction treatment — how to start the conversation, what to prepare, what to verify, and where to find support.',
    dek: 'Watching someone you love struggle is hard. You cannot do the recovery for them — but you can make the path to help shorter and less overwhelming.',
    updated: '2026-07-15',
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
          'A first step can feel easier when the choices are concrete. Build a short list by region, listed care level, and reported payment options, then verify coverage and availability and ask each program’s qualified team to assess level of care and admission.',
        ],
      },
      {
        heading: 'Know the coverage basics',
        body: [
          'If the person agrees, identify the payer type and whether coverage is active. Many plans may include substance-use benefits, but network, eligibility, authorization, exclusions, and member cost vary. A program and insurer can check benefits, but timing varies and the result is not a guarantee of payment.',
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
