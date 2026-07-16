# Production migration ledger

The legacy numeric migration directory does not match the hosted Supabase timestamp
history. Do not use `supabase db push` for this project until that historical chain is
replaced with a verified baseline. Production changes use controlled, immutable,
forward-only SQL bundles with their SHA-256 values recorded alongside them.

Production project: `uxykrvungmfzmpzrvebh`

## 2026-07-16 — consented connector contact identity

- Release: `20260716_retain_connector_contact_identity.sql`
- Supabase migration name: `retain_connector_contact_identity_20260715`
- Hosted production version: `20260716001537`
- SHA-256: `9a5499b0d71628352067646287b65fe5992f6ac699edec068b1aac591bd08754`

## 2026-07-15 — Clear Bed enhancement

- Release: `20260715_clearbed_enhancement_release.sql`
- Supabase migration name: `clearbed_enhancement_release_20260715`
- Hosted production version: `20260715204845`
- SHA-256: `415422a8e2db2c527bb8aae0c358112144d0c131a2f4d9f3223c9c0956360093`
