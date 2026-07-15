'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Dialog } from '@/components/ui';

/** Facility photo gallery with a full-screen lightbox (claimed or legacy paid profiles). */
export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null || images.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setOpen((current) => current === null ? null : (current - 1 + images.length) % images.length);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setOpen((current) => current === null ? null : (current + 1) % images.length);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [images.length, open]);

  if (images.length === 0) return null;
  const shown = images.slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {shown.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1} of ${images.length} for ${alt}`}
            className={
              'relative block overflow-hidden ' +
              // Explicit height (= two 5.5rem tiles + the gap) so the fill image
              // always has a sized box — h-full has nothing to resolve against.
              (i === 0 ? 'col-span-2 row-span-2 h-[11.25rem]' : 'h-[5.5rem]')
            }
          >
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover"
              priority={i === 0}
            />
            {i === shown.length - 1 && images.length > shown.length && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                +{images.length - shown.length} more
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={`Photo gallery for ${alt}`}
        placement="center"
        className="!max-h-[96vh] !max-w-[96vw]"
      >
        {open !== null && (
          <div className="relative flex min-h-64 items-center justify-center bg-black p-4">
            <div className="relative h-[calc(96vh-6rem)] w-[90vw]">
              <Image
                src={images[open]}
                alt={`${alt}, photo ${open + 1} of ${images.length}`}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            <p role="status" aria-live="polite" className="sr-only">
              Photo {open + 1} of {images.length}
            </p>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => setOpen((open - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-4xl text-white/90 hover:bg-black/80 hover:text-white"
                >
                  <span aria-hidden>‹</span>
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => setOpen((open + 1) % images.length)}
                  className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-4xl text-white/90 hover:bg-black/80 hover:text-white"
                >
                  <span aria-hidden>›</span>
                </button>
              </>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
