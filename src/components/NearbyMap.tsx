'use client';

import { useEffect, useRef } from 'react';

import type { NearbyFacility } from '@/lib/matching/nearby';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadMaps(key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('maps load failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** Interactive Google map of nearby facilities; click a pin to view its listing. */
export function NearbyMap({ origin, facilities }: { origin: { lat: number; lng: number }; facilities: NearbyFacility[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !ref.current) return;
    let cancelled = false;

    loadMaps(key)
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const g = window.google.maps;
        const map = new g.Map(ref.current, {
          center: origin,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        new g.Marker({
          position: origin,
          map,
          title: 'Your area',
          icon: { path: g.SymbolPath.CIRCLE, scale: 7, fillColor: '#0f766e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        });
        const info = new g.InfoWindow();
        const bounds = new g.LatLngBounds();
        bounds.extend(origin);
        for (const f of facilities) {
          const pos = { lat: f.latitude, lng: f.longitude };
          bounds.extend(pos);
          const m = new g.Marker({ position: pos, map, title: f.name });
          m.addListener('click', () => {
            const loc = [f.city, f.state].filter(Boolean).join(', ');
            info.setContent(
              `<div style="font:14px system-ui,sans-serif;max-width:210px;line-height:1.35">` +
                `<strong>${esc(f.name)}</strong><br>` +
                `<span style="color:#64748b">${f.miles.toFixed(1)} mi · ${esc(loc)}</span><br>` +
                `<a href="/programs/${f.id}" style="color:#0f766e;font-weight:600;text-decoration:none">View listing →</a>` +
                `</div>`
            );
            info.open(map, m);
          });
        }
        if (facilities.length) map.fitBounds(bounds, 48);
      })
      .catch(() => {
        /* map failed to load — the list still works */
      });

    return () => {
      cancelled = true;
    };
  }, [origin, facilities]);

  return <div ref={ref} className="h-full min-h-[22rem] w-full bg-slate-100" />;
}
