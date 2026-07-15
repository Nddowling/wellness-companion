import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl, SITE_NAME } from '@/lib/seo';

const LAST_UPDATED = 'July 15, 2026';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms governing your use of ${SITE_NAME}, a recovery-care referral and directory service.`,
  alternates: { canonical: '/terms' },
  openGraph: { title: `Terms of Service | ${SITE_NAME}`, url: absoluteUrl('/terms') },
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

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>{SITE_NAME} is not a medical, clinical, or crisis service.</strong> We help connect people with
        treatment programs — we do not provide treatment, diagnosis, or emergency care. <strong>If you are in
        danger or experiencing a crisis, call 911, or call or text 988</strong> (Suicide &amp; Crisis Lifeline)
        right now.
      </div>

      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the {SITE_NAME} website,
        applications, and services (together, the &ldquo;Service&rdquo;). By creating an account, acknowledging
        these Terms, or otherwise using the Service, you agree to be bound by them. If you do not agree, please do
        not use the Service.
      </p>

      <Section n={1} title="What the Service is — and isn't">
        <p>
          {SITE_NAME} is a <strong>referral and directory service (a &ldquo;connector&rdquo;)</strong>. We help
          people seeking care (&ldquo;Seekers&rdquo;) find and reach addiction-treatment programs
          (&ldquo;Providers&rdquo;), including some that document co-occurring mental-health services, and we give
          Providers tools to keep their listings and availability current. We do not list or match standalone
          mental-health providers.
        </p>
        <p>
          We are <strong>not a healthcare provider</strong>. We do not provide medical advice, diagnosis,
          treatment, counseling, therapy, or crisis intervention, and nothing on the Service is a substitute for
          professional care. Conversations with our guided intake assistant are a limited way to narrow directory
          options — not clinical care or a placement assessment. No provider-patient relationship is created by using
          the Service.
        </p>
      </Section>

      <Section n={2} title="Not for emergencies">
        <p>
          The Service is not for emergencies. If you or someone else may be in danger, call <strong>911</strong>.
          If you are in crisis or having thoughts of suicide, call or text <strong>988</strong> (the Suicide &amp;
          Crisis Lifeline), available 24/7.
        </p>
      </Section>

      <Section n={3} title="Eligibility">
        <p>
          You must be at least 18 years old to create an account and use the Service on your own behalf. If you
          are using the Service to help someone else find care, you represent that you are authorized to do so.
        </p>
      </Section>

      <Section n={4} title="Your information and consent">
        <p>
          To produce results, we ask for a few limited details during intake. We create a non-contact summary containing
          your ZIP3 region, directory level, payer type, and coarse scope, and route it to the programs
          selected and displayed by the matcher <strong>before</strong> asking for contact permission. That summary does
          not include your name, phone number, email, date of birth, street address, member ID, exact carrier, or a
          clinical narrative. A supported commercial carrier you volunteer may narrow results
          transiently, but is not saved with the match or routed to programs.
          <strong> We only make your phone number or email available to a displayed program when you explicitly consent
          to it</strong>, and we record when you grant or decline that consent. You can decline and still see results.
          Your contact consent is <strong>specific to the programs displayed in that match</strong>, is limited to the
          requested connection, and may be revoked for future in-app access by contacting us. Treatment providers may
          have separate duties under HIPAA, 42 CFR Part 2, and state law. Whether a law applies depends on the parties
          and circumstances; the Service does not provide legal advice or determine those duties for you or a Provider.
        </p>
        <p>
          <strong>Communications.</strong> Providing a contact method does not itself authorize Clear Bed Recovery to
          contact you. After matches are shown, you choose separately whether the displayed programs may use one
          contact method to reach you and whether Clear Bed Recovery may email one copy of those matches. A phone
          number shared with programs does not authorize marketing calls or texts from us. We do not add matcher
          contacts to promotional lists, and either permission is optional and not a condition of seeing matches.
        </p>
        <p>
          Our handling of your information is further described in our Privacy Policy. By using the Service, you
          consent to that handling.
        </p>
        <p>
          <strong>Partner shortlists.</strong> Partner workspaces use system-generated, non-identifying shortlist
          labels and public program information. They do not provide fields for a client name, narrative, or clinical
          note. Anyone with an active share link can view or print that directory list; disabling sharing invalidates
          the link. Do not attempt to encode personal or health information into Service fields or URLs.
        </p>
      </Section>

      <Section n={5} title="No guarantee of availability or outcomes">
        <p>
          Listings, bed availability, insurance acceptance, and other Provider details are supplied by Providers
          or third-party sources and may change without notice. We do not guarantee that any program has an open
          bed, will accept you or your coverage, will admit you, or will achieve any particular outcome.{' '}
          <strong>Always confirm details directly with the program.</strong>
        </p>
      </Section>

      <Section n={6} title="Terms for Providers">
        <p>
          If you manage a Provider listing, you agree that the information you publish is accurate and that you are
          authorized to publish it. You are responsible for keeping availability and contact details current and
          for handling any Seeker information you receive in compliance with applicable law.
        </p>
        <p>
          Paid plans add only the in-app analytics and lead-status workflow described on our pricing page. The
          complete claimed public profile and consented contact access remain free. <strong>Fees are flat subscription
          fees</strong> and are never based on the volume or value of referrals, patients, or admissions. This model
          is designed around ethical-directory and anti-kickback constraints, but Providers remain responsible for
          obtaining qualified legal advice about their own arrangements.
          Matching and routing of Seekers is need-based and is never influenced by a Provider&rsquo;s plan or
          payment.
        </p>
      </Section>

      <Section n={7} title="Acceptable use">
        <p>You agree not to use the Service to:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>break the law or infringe anyone&rsquo;s rights;</li>
          <li>post false, misleading, or harmful content, or impersonate others;</li>
          <li>misuse, scrape, or attempt to gain unauthorized access to the Service or others&rsquo; data;</li>
          <li>use another person&rsquo;s health information without authorization.</li>
        </ul>
      </Section>

      <Section n={8} title="Intellectual property">
        <p>
          The Service, including its content, design, and trademarks, is owned by {SITE_NAME} or its licensors and
          is protected by law. We grant you a limited, revocable, non-exclusive license to use the Service for its
          intended purpose. Content you submit remains yours, but you grant us a license to use it to operate and
          improve the Service.
        </p>
      </Section>

      <Section n={9} title="Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
          kind, whether express or implied, including fitness for a particular purpose, accuracy, and
          non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that any
          information is complete or current.
        </p>
      </Section>

      <Section n={10} title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, {SITE_NAME} and its affiliates will not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or for any loss arising from your use
          of (or inability to use) the Service, your interactions with any Provider, or any care you do or do not
          receive. Our total liability for any claim relating to the Service will not exceed the greater of the
          amount you paid us in the 12 months before the claim or one hundred U.S. dollars ($100).
        </p>
      </Section>

      <Section n={11} title="Indemnification">
        <p>
          You agree to indemnify and hold harmless {SITE_NAME} from claims and expenses arising out of your use of
          the Service, your content, or your violation of these Terms or applicable law.
        </p>
      </Section>

      <Section n={12} title="Changes to the Service or these Terms">
        <p>
          We may update the Service or these Terms from time to time. When we make material changes, we will update
          the &ldquo;Last updated&rdquo; date above and, where appropriate, provide additional notice. Your
          continued use of the Service after changes take effect means you accept the updated Terms.
        </p>
      </Section>

      <Section n={13} title="Governing law">
        <p>
          These Terms are governed by the laws of the State of Georgia, without regard to its conflict-of-laws
          rules. You agree to the exclusive jurisdiction of the state and federal courts located in Georgia for
          any dispute that is not subject to arbitration or small-claims resolution.
        </p>
      </Section>

      <Section n={14} title="Contact">
        <p>
          Questions about these Terms? Reach us at{' '}
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
