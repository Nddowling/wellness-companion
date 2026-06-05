import SiteMenu from '@/components/SiteMenu';
import { getRoles, isProviderSide } from '@/lib/auth';

// Public (seeker-facing) pages share a floating hamburger menu for whole-site
// navigation. It's fixed-position, so it doesn't disturb the full-height /match view.
// The menu is role-aware: provider-side users see no seeker AI/match links.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const roles = await getRoles();
  const providerSide = isProviderSide(roles);
  // Non-seeker signed-in users get a dashboard shortcut; seekers already have "My matches".
  const dashboardHref = roles.user && !roles.isSeeker ? '/home' : null;
  return (
    <>
      <SiteMenu providerSide={providerSide} dashboardHref={dashboardHref} />
      {children}
    </>
  );
}
