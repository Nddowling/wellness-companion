import Link from 'next/link';

// Reusable Free→paid upgrade CTA. Three shapes:
//   banner — full-width nudge at the top of a Free user's page
//   card   — replaces a locked feature section (📷 Photos, website, etc.)
//   inline — a small pill to sit beside a heading
type Variant = 'banner' | 'card' | 'inline';

export function UpgradePrompt({
  title,
  body,
  cta = 'Upgrade →',
  href,
  facilityId,
  variant = 'card',
}: {
  title?: string;
  body?: string;
  cta?: string;
  href?: string;
  facilityId?: string;
  variant?: Variant;
}) {
  const billingHref = href ?? (facilityId ? `/pricing?facility=${encodeURIComponent(facilityId)}` : '/pricing');
  if (variant === 'inline') {
    return (
      <Link
        href={billingHref}
        className="inline-flex shrink-0 items-center rounded-full bg-terracotta px-3 py-1 text-xs font-semibold text-white transition hover:bg-terracotta-dark"
      >
        {cta}
      </Link>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          {body && <p className="mt-0.5 text-xs text-slate-600">{body}</p>}
        </div>
        <Link
          href={billingHref}
          className="shrink-0 rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-terracotta-dark"
        >
          {cta}
        </Link>
      </div>
    );
  }

  // card (default) — locked feature placeholder
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
      <p className="text-sm font-medium text-slate-700">🔒 {title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{body}</p>}
      <Link
        href={billingHref}
        className="mt-3 inline-block rounded-md bg-terracotta px-4 py-2 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
      >
        {cta}
      </Link>
    </div>
  );
}
