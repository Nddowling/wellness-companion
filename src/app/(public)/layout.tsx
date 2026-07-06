import SiteMenu from '@/components/SiteMenu';
import PublicChrome from '@/components/PublicChrome';

// Public (seeker-facing) pages share a floating hamburger menu for whole-site
// navigation. SiteMenu resolves the viewer's role CLIENT-side (via /api/me/menu), so
// this layout reads no cookies and every public page stays statically/ISR cacheable —
// the crawl + speed foundation for the whole directory.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteMenu />
      <PublicChrome>{children}</PublicChrome>
    </>
  );
}
