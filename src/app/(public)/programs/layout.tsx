import SiteFooter from '@/components/SiteFooter';

// Adds the crawlable SEO footer to the programs directory and every facility
// profile page — the largest set of indexable pages on the site.
export default function ProgramsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
