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

## Sourcing notes / gotchas

- **Use the NATIONAL logo, never a state licensee.** Blue Cross Blue Shield in particular
  has per-state variants whose wordmark reads "of Florida", "of Georgia", etc. The correct
  file here is the **Blue Cross Blue Shield Association** (national) mark.
- **Watch the region.** The first Cigna logo sourced was the Taiwanese entity (康健人壽,
  Chinese characters). Verify the logo is the US brand.
- **Watch for baked-in padding.** Some logos ship a padded canvas (medicare.svg arrived as a
  135x22 wordmark centered in a 200x200 square = 11% fill), which renders microscopically
  inside a fixed-height tile. Run `node scripts/crop-logo-svgs.mjs` to report fill %, and
  `--write` to crop the viewBox to the real ink bounds.
- **PNG backgrounds** should be transparent, not white — a white box shows against the tile.
- Preview everything at real tile size with `node scripts/preview-logos.mjs` (writes
  logo-preview.png) before shipping.
- No logo file yet for: carelon, ambetter, self-pay — these degrade to the brand monogram
  + name automatically, so the row is never broken.
