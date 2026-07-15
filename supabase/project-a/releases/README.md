# Production migration ledger

The 2026-07-15 enhancement is deployed through the immutable combined SQL bundle
`20260715_clearbed_enhancement_release.sql`. Its SHA-256 is recorded alongside it.

The legacy numeric migration directory does not match the hosted Supabase timestamp
history. Do not use `supabase db push` for this project until that historical chain is
replaced with a verified baseline. This release is a controlled, forward-only
Supabase-managed migration; record the hosted timestamp below after application.

- Production project: `uxykrvungmfzmpzrvebh`
- Supabase migration name: `clearbed_enhancement_release_20260715`
- Hosted production version: `20260715204845`
- SHA-256: `415422a8e2db2c527bb8aae0c358112144d0c131a2f4d9f3223c9c0956360093`
