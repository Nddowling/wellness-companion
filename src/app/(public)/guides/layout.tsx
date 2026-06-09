import SiteFooter from '@/components/SiteFooter';

// Adds the crawlable SEO footer to the guides index and every guide article.
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
