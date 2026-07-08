# Insurance carrier logos

Drop each carrier's logo here as `{slug}.svg` (SVG preferred; `.png` also fine if you
also change the extension in `src/components/LogoCarousel.tsx`). The moment a file exists,
the "Centers by Accepted Insurance" carousel renders the real logo instead of the brand-mark
fallback — no code change needed.

Expected filenames (slug = the payer's slug in `src/lib/payers.ts`):

- medicaid.svg
- medicare.svg
- tricare.svg
- aetna.svg
- blue-cross-blue-shield.svg
- cigna.svg
- unitedhealthcare.svg
- humana.svg
- kaiser-permanente.svg
- anthem.svg
- optum.svg
- magellan.svg
- carelon.svg
- ambetter.svg
- molina.svg

Use official brand-kit / press-kit assets (or properly licensed sources). Avoid hotlinking
third-party logo URLs — self-host the files here so nothing breaks and there's no
hotlink/billing risk. Keep them roughly consistent in aspect ratio; the tile caps height at
~48px and width at ~75% and centers them.
