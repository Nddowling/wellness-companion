import SiteFooter from '@/components/SiteFooter';

// Adds the crawlable SEO footer to every insurance landing page (payer and
// payer×state).
export default function InsuranceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
