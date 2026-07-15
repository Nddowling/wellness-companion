-- An approved ownership claim is the only self-service path that establishes an
-- owner. Historical approvals were mistakenly linked as staff, which meant any
-- staff member could later use the service-role invite action to elevate another
-- owner. Repair the historical role assignment before owner-only invites ship.

-- Public claim submissions did not always persist the auth user created during
-- approval. Link only an exact normalized claimant email on an approved, known
-- facility claim; auth.users.email is unique in the hosted Auth schema.
update public.facility_claims as claim
set user_id = auth_user.id
from auth.users as auth_user
where claim.status = 'approved'
  and claim.facility_id is not null
  and claim.user_id is null
  and claim.claimant_email is not null
  and lower(trim(auth_user.email)) = lower(trim(claim.claimant_email));

update public.facility_members as member
set role = 'owner'
from public.facility_claims as claim
where claim.status = 'approved'
  and claim.facility_id = member.facility_id
  and claim.user_id = member.user_id
  and member.role <> 'owner';
