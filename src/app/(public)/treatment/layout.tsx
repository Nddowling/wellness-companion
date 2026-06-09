import SiteFooter from '@/components/SiteFooter';

// Adds the crawlable SEO footer to every treatment landing page (state, city,
// level, and city×level) without affecting the full-height /match view.
export default function TreatmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
