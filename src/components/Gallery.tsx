'use client';

import { useState } from 'react';

/** Facility photo gallery with a full-screen lightbox (claimed/paid profiles). */
export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const shown = images.slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {shown.map((src, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            className={'relative block ' + (i === 0 ? 'col-span-2 row-span-2 sm:col-span-2 sm:row-span-2' : '')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className={'w-full object-cover ' + (i === 0 ? 'h-44 sm:h-full' : 'h-[5.5rem]')} />
            {i === shown.length - 1 && images.length > shown.length && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                +{images.length - shown.length} more
              </span>
            )}
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[open]}
            alt={alt}
            className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={() => setOpen(null)} className="absolute right-5 top-5 text-2xl text-white/90 hover:text-white">
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + images.length) % images.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl text-white/70 hover:text-white"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % images.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl text-white/70 hover:text-white"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
