import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl, SITE_NAME } from '@/lib/seo';

const LAST_UPDATED = 'June 9, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE_NAME} collects, uses, protects, and shares your information — and the choices you have. We share your identity with a treatment program only with your explicit consent.`,
  alternates: { canonical: '/privacy' },
  openGraph: { title: `Privacy Policy | ${SITE_NAME}`, url: absoluteUrl('/privacy') },
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-800">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        <strong>Your privacy is the point.</strong> You can use {SITE_NAME} and see matching programs without an
        account and without giving your name. <strong>We share your identifying details with a treatment program
        only when you explicitly tell us to</strong> — and we keep a record of when you grant or decline that
        permission. You can always decline and still see your matches.
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>{SITE_NAME} is not a medical, clinical, or crisis service</strong>, and this is not emergency care.
        <strong> If you or someone else may be in danger, call 911, or call or text 988</strong> (Suicide &amp;
        Crisis Lifeline) right now.
      </div>

      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        This Privacy Policy explains what information {SITE_NAME} (&ldquo;we,&rdquo; &ldquo;us&rdquo;) collects
        through our website and services (the &ldquo;Service&rdquo;), how we use and protect it, when we share it,
        and the choices and rights you have. It works alongside our{' '}
        <Link href="/terms" className="text-teal-700 hover:underline">
          Terms of Service
        </Link>
        . By using the Service, you agree to the practices described here.
      </p>

      <Section n={1} title="Who we are">
        <p>
          {SITE_NAME} is a <strong>referral and directory service (a &ldquo;connector&rdquo;)</strong> that helps
          people seeking treatment (&ldquo;Seekers&rdquo;) find and reach addiction- and mental-health treatment
          programs (&ldquo;Providers&rdquo;). We are <strong>not a healthcare provider</strong>, and we do not
          deliver treatment, diagnosis, counseling, or crisis care.
        </p>
      </Section>

      <Section n={2} title="Information we collect">
        <p className="font-medium text-slate-700">Information you give us during intake.</p>
        <p>
          Our guided intake asks a few questions so we can match you with appropriate programs — typically the kind
          of care you&rsquo;re looking for, a rough location (such as the first part of a ZIP code), and how care
          would be paid for. You may also choose to share a coarse description of your concern. You decide how much
          to share.
        </p>
        <p className="font-medium text-slate-700">Contact details (only if you choose to connect).</p>
        <p>
          After you see your matches, you may optionally provide identifying and contact details — for example your
          name, date of birth, phone number, email, and insurance information — so that the programs you select can
          reach out to you. Providing this is entirely your choice.
        </p>
        <p className="font-medium text-slate-700">Conversation content.</p>
        <p>
          The messages you exchange with our intake assistant are processed to guide the conversation and build your
          referral summary. If you create an account, your conversation may be saved to your private history so you
          can return to it.
        </p>
        <p className="font-medium text-slate-700">Account information.</p>
        <p>
          If you create an account, we store your email and authentication credentials. Provider and team accounts
          also include facility and role information.
        </p>
        <p className="font-medium text-slate-700">Information collected automatically.</p>
        <p>
          Like most websites, we collect limited technical data such as your device and browser type, IP address,
          and basic usage information, and we use essential cookies to keep you signed in and to operate the Service.
        </p>
        <p className="font-medium text-slate-700">Information from other sources.</p>
        <p>
          Our directory of programs is built in part from public and licensed sources (including government
          treatment-locator data such as SAMHSA&rsquo;s findtreatment.gov) and from information Providers submit
          about themselves.
        </p>
      </Section>

      <Section n={3} title="How we use your information">
        <ul className="ml-5 list-disc space-y-1">
          <li>To match you with treatment programs that fit your needs, coverage, and location;</li>
          <li>To share your details with the specific programs you choose — only with your consent (see Section 5);</li>
          <li>To create and secure your account and save your conversation history if you ask us to;</li>
          <li>To send you transactional messages (for example, your matches, a sign-in link, or a reminder you opted into);</li>
          <li>To operate, maintain, secure, debug, and improve the Service;</li>
          <li>To comply with law and enforce our Terms.</li>
        </ul>
        <p>
          We do <strong>not</strong> use the matching process to favor any Provider based on whether they pay us.
          Matching is need-based. We do <strong>not</strong> sell your personal information, and we do not use your
          health information for advertising.
        </p>
      </Section>

      <Section n={4} title="Sensitive health information &amp; special protections">
        <p>
          Information that you are seeking, or have sought, substance-use or mental-health treatment is especially
          sensitive. Where it applies, we handle such information consistent with{' '}
          <strong>HIPAA and the federal confidentiality rules for substance-use records (42 CFR Part 2)</strong>,
          as well as applicable state law. A core consequence of those rules — and our design — is that the fact you
          contacted us, and any identifying details, are <strong>not disclosed to a treatment program without your
          explicit, recorded consent</strong>.
        </p>
        <p>
          Identifying records you provide to connect with care are held in a restricted, access-controlled
          environment separate from our general directory data, and are reachable only by authorized server-side
          processes — never exposed publicly.
        </p>
      </Section>

      <Section n={5} title="When we share information">
        <p className="font-medium text-slate-700">With treatment programs — only with your consent.</p>
        <p>
          We send your contact details and referral summary to a specific Provider <strong>only after you
          explicitly consent</strong> to share them with that Provider, so their intake team can reach out. We log
          each consent decision (granted or declined) with a timestamp. If you do not consent, we do not send your
          details, and you can still contact programs yourself.
        </p>
        <p className="font-medium text-slate-700">With service providers (subprocessors).</p>
        <p>
          We use trusted vendors to run the Service. They may process information only to provide services to us,
          under contract. These currently include:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Supabase</strong> — database, authentication, and storage;</li>
          <li><strong>Anthropic</strong> — the AI model that powers our guided intake assistant;</li>
          <li><strong>Resend</strong> — sending transactional email;</li>
          <li><strong>Stripe</strong> — processing Provider subscription payments (Seekers never pay);</li>
          <li><strong>Vercel</strong> — website hosting and delivery.</li>
        </ul>
        <p className="font-medium text-slate-700">For legal reasons and business transfers.</p>
        <p>
          We may disclose information if required by law or valid legal process, to protect rights and safety, or in
          connection with a merger, acquisition, or sale of assets — in which case we will seek to ensure your
          information remains subject to protections consistent with this Policy.
        </p>
        <p>We do not sell your personal information, and we do not share it for cross-context behavioral advertising.</p>
      </Section>

      <Section n={6} title="Your choices and rights">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Browse anonymously</strong> — explore the directory with no account or name; the guided match asks your name and email so a program can follow up;</li>
          <li><strong>Withdraw consent</strong> to share your details, or decline it in the first place;</li>
          <li><strong>Access, correct, or delete</strong> the personal information we hold about you;</li>
          <li><strong>Unsubscribe</strong> from optional emails at any time.</li>
        </ul>
        <p>
          Depending on where you live, you may have additional rights under laws such as the California Consumer
          Privacy Act or other state privacy laws — including rights to know, delete, correct, and not be
          discriminated against for exercising them. To make any request, contact us using Section 10. We will not
          require you to create an account to exercise these rights.
        </p>
      </Section>

      <Section n={7} title="Data retention">
        <p>
          We keep personal information only as long as needed for the purposes described here — to provide the
          Service, maintain your account and history, meet legal and recordkeeping obligations (including consent
          records), resolve disputes, and enforce our agreements — after which we delete or de-identify it. You can
          ask us to delete your information sooner, subject to limited legal exceptions.
        </p>
      </Section>

      <Section n={8} title="How we protect your information">
        <p>
          We use technical and organizational safeguards designed to protect your information, including encryption
          in transit, row-level access controls, role-based access, and a separated, access-restricted store for
          identifying records. No method of transmission or storage is completely secure, and we cannot guarantee
          absolute security; we work to protect your information and to respond promptly to any incident.
        </p>
      </Section>

      <Section n={9} title="Children&rsquo;s privacy">
        <p>
          The Service is intended for adults (18 and older) and is not directed to children. We do not knowingly
          collect personal information from anyone under 18. If you believe a minor has provided us information,
          contact us and we will take appropriate steps to remove it.
        </p>
      </Section>

      <Section n={10} title="Third-party links">
        <p>
          The Service links to Provider websites and other third-party resources. Their privacy practices are their
          own, and this Policy does not cover them. Please review the privacy policies of any site you visit.
        </p>
      </Section>

      <Section n={11} title="Changes to this Policy">
        <p>
          We may update this Policy from time to time. When we make material changes, we will update the
          &ldquo;Last updated&rdquo; date above and, where appropriate, provide additional notice. Your continued
          use of the Service after changes take effect means you accept the updated Policy.
        </p>
      </Section>

      <Section n={12} title="Contact us">
        <p>
          Questions, requests, or privacy concerns? Reach us at{' '}
          <a href="mailto:hello@clearbedrecovery.com" className="text-teal-700 hover:underline">
            hello@clearbedrecovery.com
          </a>
          .
        </p>
      </Section>

      <div className="mt-10 border-t border-slate-200 pt-6 text-sm">
        <Link href="/" className="text-teal-700 hover:underline">
          ← Back to {SITE_NAME}
        </Link>
      </div>
    </main>
  );
}
