import SiteMenu from '@/components/SiteMenu';
import { getRoles, homePathFor, profileType } from '@/lib/auth';

// Public (seeker-facing) pages share a floating hamburger menu for whole-site
// navigation. It's fixed-position, so it doesn't disturb the full-height /match view.
// The menu is built from the viewer's canonical profile so each lane sees only its own.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const roles = await getRoles();
  const profile = profileType(roles);
  // Facility/admin get a dashboard shortcut; seekers already have "My care" inline;
  // a roleless signed-in user is sent to onboarding.
  const dashboardHref =
    profile === 'facility' || profile === 'admin'
      ? homePathFor(roles)
      : profile === 'none' && roles.user
        ? '/get-started'
        : null;
  return (
    <>
      <SiteMenu profile={profile} dashboardHref={dashboardHref} />
      {children}
    </>
  );
}
