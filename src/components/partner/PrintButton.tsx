'use client';

export function PrintButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        'rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-teal-400 hover:text-teal-700 print:hidden ' +
        className
      }
    >
      Print this list
    </button>
  );
}
