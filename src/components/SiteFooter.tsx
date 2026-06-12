import Link from 'next/link';

import { SITE_NAME } from '@/lib/seo';
import { LEVELS_OF_CARE, LEVEL_LABELS } from '@/lib/constants';

// Site-wide footer. Crawlable internal links to the directory hubs (which in turn
// link every state/city/level/insurance landing page), plus the crisis + "not a
// provider" trust signals Google expects on YMYL healthcare pages.
export default function SiteFooter() {
  const year = 2026;
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <nav aria-label="Find care">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Find care</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/programs" className="hover:text-teal-700 hover:underline">Browse all programs</Link></li>
              <li><Link href="/match" className="hover:text-teal-700 hover:underline">Get matched</Link></li>
              <li><Link href="/treatment" className="hover:text-teal-700 hover:underline">Treatment by state</Link></li>
              <li><Link href="/insurance" className="hover:text-teal-700 hover:underline">Treatment by insurance</Link></li>
              <li><Link href="/guides" className="hover:text-teal-700 hover:underline">Guides &amp; resources</Link></li>
              <li><Link href="/resources" className="hover:text-teal-700 hover:underline">Recovery books &amp; tools</Link></li>
            </ul>
          </nav>

          <nav aria-label="Levels of care">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Levels of care</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {LEVELS_OF_CARE.map((l) => (
                <li key={l}>
                  <Link href={`/programs?level=${l}`} className="hover:text-teal-700 hover:underline">
                    {LEVEL_LABELS[l]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/about" className="hover:text-teal-700 hover:underline">About &amp; how we vet</Link></li>
              <li><Link href="/how-we-make-money" className="hover:text-teal-700 hover:underline">How we make money</Link></li>
              <li><Link href="/data" className="hover:text-teal-700 hover:underline">Treatment access data</Link></li>
              <li><a href="mailto:nick.dowling@clearbedrecovery.com" className="hover:text-teal-700 hover:underline">Contact us</a></li>
              <li><Link href="/terms" className="hover:text-teal-700 hover:underline">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-teal-700 hover:underline">Privacy Policy</Link></li>
            </ul>
            {/* Clearly labeled so seekers read these as not-for-them */}
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">For treatment providers</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><Link href="/for-providers" className="hover:text-teal-700 hover:underline">List your facility</Link></li>
              <li><Link href="/pricing" className="hover:text-teal-700 hover:underline">Provider pricing</Link></li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">In a crisis?</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li><a href="tel:988" className="hover:text-teal-700 hover:underline">988 — Suicide &amp; Crisis Lifeline</a></li>
              <li><a href="tel:18007154225" className="hover:text-teal-700 hover:underline">GA Crisis &amp; Access Line 1-800-715-4225</a></li>
              <li><a href="tel:18006624357" className="hover:text-teal-700 hover:underline">SAMHSA 1-800-662-4357</a></li>
              <li><a href="tel:911" className="hover:text-teal-700 hover:underline">911 — Emergencies</a></li>
            </ul>
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-xs leading-relaxed text-slate-500">
          {SITE_NAME} is a directory that connects people to addiction and mental-health treatment facilities. We are
          not a treatment provider and do not give medical advice. If you or someone you know is in immediate danger,
          call 911 or the 988 Suicide &amp; Crisis Lifeline.
        </p>
        <p className="mt-4 text-xs text-slate-400">© {year} {SITE_NAME}. All rights reserved.</p>
      </div>
    </footer>
  );
}
