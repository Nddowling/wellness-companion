import type { Metadata } from 'next';
import Link from 'next/link';

import { absoluteUrl, SITE_NAME } from '@/lib/seo';

const LAST_UPDATED = 'July 15, 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${SITE_NAME} collects, uses, protects, and shares information — including non-contact match routing and optional name, email, and phone consent.`,
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
        <strong>Your privacy is the point.</strong> You can use {SITE_NAME} without an account, name, phone, or email.
        To show results, we route a limited, non-contact summary to the programs selected and displayed by the
        matcher before asking for contact permission. <strong>We make your name, email, and phone available only when you
        explicitly tell us to</strong> — and we record when you grant or decline that permission. You can decline and
        still see your results.
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
          people seeking treatment (&ldquo;Seekers&rdquo;) find and reach addiction-treatment programs, including some
          that list co-occurring mental-health services (&ldquo;Providers&rdquo;). We are <strong>not a healthcare provider</strong>, and we do not
          deliver treatment, diagnosis, counseling, or crisis care.
        </p>
      </Section>

      <Section n={2} title="Information we collect">
        <p className="font-medium text-slate-700">Information you give us during intake.</p>
        <p>
          Our guided flow asks a few questions so we can narrow addiction-treatment directory options: a directory
          level, a rough location (stored as the first three ZIP digits), payer type, and a coarse scope. The scope
          lets us distinguish substance-use or documented co-occurring requests from standalone mental-health
          requests that are outside this directory. We do not ask which substance, symptoms, diagnoses, or whether
          insurance is active. If you voluntarily name a supported commercial insurer, we may use that carrier name
          transiently to require an exact program listing, but we do not save it with the match or route it to programs.
        </p>
        <p className="font-medium text-slate-700">Contact details (only if you choose to connect).</p>
        <p>
          After you see your matches, we ask permission first. You may choose whether the displayed programs may
          contact you, whether we may email one copy of your matches, both, or neither. Only if you make an affirmative
          connection or email choice do we ask for your name and email. If you ask the displayed programs to contact you, we also
          ask for your phone number so their intake teams have complete follow-up details. We do not ask for your home
          address, date of birth, policy number, member number, group number, subscriber details, or clinical narrative.
        </p>
        <p className="font-medium text-slate-700">Guided-form content.</p>
        <p>
          The directory form processes only the limited choices described above. It does not ask for or save a free-text
          intake conversation or transcript.
        </p>
        <p className="font-medium text-slate-700">Account information.</p>
        <p>
          If you create an account, we store your email, account and authentication identifiers, full name if
          provided, and account role. Provider and team accounts also include their facility association.
        </p>
        <p className="font-medium text-slate-700">Partner shortlists.</p>
        <p>
          A professional Partner account may save program identifiers and create a shortlist with a
          system-generated, non-identifying label. The shortlist does not accept a client name, introduction,
          clinical note, or per-program free-text note. If the Partner turns on sharing, we store a high-entropy
          access token until sharing is disabled.
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
          <li>To narrow addiction-treatment directory options by listed care level, payment information, and region;</li>
          <li>To route a limited, non-contact match summary to the programs selected and displayed by the matcher;</li>
          <li>To make your name, email, and phone available to those displayed programs only when you consent (see Section 5);</li>
          <li>To create and secure your account;</li>
          <li>To send a transactional message you requested (for example, one email containing your matches);</li>
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
          sensitive. Clear Bed Recovery is a directory and connector, not a treatment provider, and whether a
          particular privacy law applies depends on the parties and circumstances. We design the Service around
          strict consent, data minimization, and applicable consumer-health privacy requirements. Your identifying
          contact details are <strong>not disclosed to a treatment program without your explicit, recorded consent</strong>.
        </p>
        <p>
          Treatment providers may have separate duties under HIPAA, 42 CFR Part 2, and state law. We do not make a
          legal determination about those duties for you or the provider. Questions about a provider&apos;s handling of
          treatment records should be directed to that provider or qualified counsel.
        </p>
        <p>
          Consented contact details are kept in restricted, access-controlled tables that are logically separated
          from public directory data and reachable only through authorized server-side processes. It is never exposed
          through public database access.
        </p>
      </Section>

      <Section n={5} title="When we share information">
        <p className="font-medium text-slate-700">How matching works — no direct identifiers by default.</p>
        <p>
          To produce your results, we create a <strong>limited, non-contact summary</strong>: your{' '}
          <strong>ZIP3 region</strong> (for example, &ldquo;787&rdquo;), <strong>directory level</strong>,{' '}
          <strong>payer type</strong>, and <strong>coarse scope</strong>. We route that summary to the programs selected
          and displayed by the matcher <strong>before</strong> we ask whether you want to share contact details.
          It has no name, contact details, date of birth, street address, member ID, exact carrier, or clinical
          narrative. Because combinations of otherwise limited facts can still carry privacy risk, we
          restrict access and do not describe this summary as anonymous. Contact consent applies to your name, email,
          and phone, as described next; it does not apply retroactively to this non-contact routing.
        </p>
        <p className="font-medium text-slate-700">With treatment programs — your contact details, only with your consent.</p>
        <p>
          We make your <strong>name, email, and phone available only to the programs displayed in that match, and only
          after you explicitly consent</strong>, so their intake teams can reach out. We do not send a home address,
          chat transcript, insurance identifiers, or a clinical intake record. That consent is limited to connecting
          you with care. You may ask us
          to revoke future in-app access, although a recipient cannot unlearn information it already viewed. Permission
          for us to email a copy of your matches is a separate choice. We log each consent decision (granted or
          declined) with a timestamp. If you decline, we store no contact record and you can still contact programs
          yourself.
        </p>
        <p className="font-medium text-slate-700">Partner-created shortlist links.</p>
        <p>
          A shared shortlist contains public program-directory information under a generic label; it does not contain
          a client identity or Partner-entered client note. Anyone who has the active, unguessable link can view or
          print it. The Partner can disable sharing, which invalidates that link.
        </p>
        <p className="font-medium text-slate-700">With service providers (subprocessors).</p>
        <p>
          We use trusted vendors to run the Service. They may process information only to provide services to us,
          under contract. These currently include:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Supabase</strong> — database, authentication, and storage;</li>
          <li><strong>Google Workspace or Resend</strong> — sending transactional email, depending on configuration;</li>
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
          <li>
            <strong>Use the directory without an account, name, phone, or email</strong> — we still process the
            limited match summary and the technical data described in Section 2;
          </li>
          <li><strong>Withdraw consent</strong> to share your details, or decline it in the first place;</li>
          <li><strong>Access, correct, delete, or receive a copy</strong> (portability) of the personal information we hold about you;</li>
          <li><strong>Opt out of any sale or targeted advertising</strong> — though we do not sell your personal information or use your health information for targeted advertising;</li>
          <li><strong>Appeal</strong> a decision we make about a privacy request;</li>
          <li><strong>Unsubscribe</strong> from optional emails at any time.</li>
        </ul>
        <p>
          Depending on where you live, you may have additional rights under laws such as the California Consumer
          Privacy Act, other state comprehensive privacy laws, or <strong>consumer-health-data laws</strong> (such as
          Washington&rsquo;s My Health My Data Act) — including rights to know, access, correct, delete, port, and opt
          out, to <strong>withdraw consent for the collection or sharing of your health data</strong>, and not to be
          discriminated against for exercising them. To make any request, contact us using the Contact section below.
          We will not require you to create an account to exercise these rights.
        </p>
      </Section>

      <Section n={7} title="Data retention">
        <p>
          We keep personal information only as long as needed to provide the requested connection, maintain an account
          you separately created, meet legal and recordkeeping obligations (including consent records), resolve
          disputes, and enforce our agreements. We do not keep raw guided-intake transcripts. After the applicable
          period, we delete or de-identify information. You can ask us to delete it sooner, subject to limited legal
          exceptions.
        </p>
      </Section>

      <Section n={8} title="How we protect your information">
        <p>
          We use technical and organizational safeguards designed to protect your information, including encryption
          in transit, row-level access controls, role-based access, and access-restricted tables for consented contact
          records. No method of transmission or storage is completely secure, and we cannot guarantee
          absolute security; we work to protect your information and to respond promptly to any incident.
        </p>
      </Section>

      <Section n={9} title="Data breach notification">
        <p>
          If we discover a breach of unsecured personal or health information, we will notify affected individuals
          <strong> without unreasonable delay</strong>, and we will notify regulators as required by law. Where
          applicable, this includes the U.S. Federal Trade Commission under the{' '}
          <strong>Health Breach Notification Rule</strong>, and state authorities under laws such as Georgia&rsquo;s
          breach-notification law (O.C.G.A. §§ 10-1-910 et seq.). Our notice will describe what happened, the types of
          information involved, any third parties that acquired it, and steps you can take to protect yourself.
        </p>
      </Section>

      <Section n={10} title="Children&rsquo;s privacy">
        <p>
          The Service is intended for adults (18 and older) and is not directed to children. We do not knowingly
          collect personal information from anyone under 18. If you believe a minor has provided us information,
          contact us and we will take appropriate steps to remove it.
        </p>
      </Section>

      <Section n={11} title="Third-party links">
        <p>
          The Service links to Provider websites and other third-party resources. Their privacy practices are their
          own, and this Policy does not cover them. Please review the privacy policies of any site you visit.
        </p>
      </Section>

      <Section n={12} title="Changes to this Policy">
        <p>
          We may update this Policy from time to time. When we make material changes, we will update the
          &ldquo;Last updated&rdquo; date above and, where appropriate, provide additional notice. Your continued
          use of the Service after changes take effect means you accept the updated Policy.
        </p>
      </Section>

      <Section n={13} title="Contact us">
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
