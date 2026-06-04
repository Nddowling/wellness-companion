import SiteMenu from '@/components/SiteMenu';

// Public (seeker-facing) pages share a floating hamburger menu for whole-site
// navigation. It's fixed-position, so it doesn't disturb the full-height /match view.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteMenu />
      {children}
    </>
  );
}
