import Link from 'next/link';
import { cn } from './cn';

// Orientation signal: "you are here, and here's the path back." Every crumb
// except the current is a real link, so Back and middle-click work. Pair with
// breadcrumbJsonLd() to emit BreadcrumbList structured data for SEO.

export type Crumb = { label: string; href?: string };

export type BreadcrumbProps = {
  items: Crumb[];
  className?: string;
};

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('text-xs text-slate-500', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-teal-700 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'text-slate-700 font-medium')}>
                  {c.label}
                </span>
              )}
              {!last && <span aria-hidden className="text-slate-300">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** BreadcrumbList JSON-LD object for <JsonLd data={...} />. */
export function breadcrumbJsonLd(items: Crumb[], baseUrl = 'https://clearbedrecovery.com') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: c.href.startsWith('http') ? c.href : baseUrl + c.href } : {}),
    })),
  };
}
