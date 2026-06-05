// Placeholder guide character for the /match sidebar — a friendly, non-clinical
// companion. To be replaced by the chosen Canva mascot illustration; kept as a
// lightweight inline SVG so the layout is complete in the meantime. Decorative.
export function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden role="img">
      {/* body */}
      <rect x="34" y="74" width="52" height="46" rx="22" fill="#3aa985" />
      {/* arms, raised in a warm "you've got this" */}
      <circle cx="26" cy="70" r="11" fill="#5dcaa5" />
      <circle cx="94" cy="70" r="11" fill="#5dcaa5" />
      {/* ClearBed dot-cluster emblem, centered on the shirt */}
      <circle cx="63" cy="96" r="7" fill="#5dcaa5" />
      <circle cx="54" cy="103" r="4.5" fill="#1f4a46" />
      <circle cx="53" cy="92" r="2.4" fill="#5dcaa5" />
      {/* head */}
      <circle cx="60" cy="46" r="30" fill="#5dcaa5" />
      {/* hair */}
      <path d="M32 40a28 28 0 0 1 56 0c0-6-10-12-28-12S32 34 32 40z" fill="#1f4a46" />
      {/* eyes */}
      <circle cx="50" cy="46" r="4.4" fill="#1f3b39" />
      <circle cx="70" cy="46" r="4.4" fill="#1f3b39" />
      <circle cx="51.4" cy="44.6" r="1.4" fill="#fff" />
      <circle cx="71.4" cy="44.6" r="1.4" fill="#fff" />
      {/* cheeks */}
      <circle cx="42" cy="54" r="4" fill="#f0a98a" opacity="0.7" />
      <circle cx="78" cy="54" r="4" fill="#f0a98a" opacity="0.7" />
      {/* smile */}
      <path d="M50 56c3 4 17 4 20 0" fill="none" stroke="#1f3b39" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
