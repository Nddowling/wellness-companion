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

/**
 * Interactive map that plots whatever published facilities fall inside the visible
 * frame (capped at ~20, closest-to-origin first). Re-queries on every pan/zoom and
 * reports the in-view set back via onBoundsFacilities so a sibling list can stay in sync.
 */
export function NearbyMap({
  origin,
  initial,
  onBoundsFacilities,
}: {
  origin: { lat: number; lng: number };
  initial: NearbyFacility[];
  onBoundsFacilities?: (f: NearbyFacility[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onBoundsFacilities);
  cbRef.current = onBoundsFacilities;
  const originRef = useRef(origin);
  originRef.current = origin;
  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || !ref.current) return;
    let cancelled = false;
    let fetchToken = 0;
    const markers: unknown[] = [];

    loadMaps(key)
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const g = window.google.maps;
        const map = new g.Map(ref.current, {
          center: originRef.current,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        new g.Marker({
          position: originRef.current,
          map,
          title: 'Your area',
          icon: { path: g.SymbolPath.CIRCLE, scale: 7, fillColor: '#0f766e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
        });
        const info = new g.InfoWindow();

        const plot = (facs: NearbyFacility[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const m of markers as any[]) m.setMap(null);
          markers.length = 0;
          for (const f of facs) {
            const m = new g.Marker({ position: { lat: f.latitude, lng: f.longitude }, map, title: f.name });
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
            markers.push(m);
          }
        };

        // Initial paint + frame to the server-provided nearest set.
        plot(initial);
        if (initial.length) {
          const b = new g.LatLngBounds();
          b.extend(originRef.current);
          for (const f of initial) b.extend({ lat: f.latitude, lng: f.longitude });
          map.fitBounds(b, 48);
        }

        // On every settle (pan/zoom, and once on load), re-query the visible frame.
        const refetch = async () => {
          const bounds = map.getBounds();
          if (!bounds) return;
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const o = originRef.current;
          const token = ++fetchToken;
          const qs = new URLSearchParams({
            minLat: String(sw.lat()),
            minLng: String(sw.lng()),
            maxLat: String(ne.lat()),
            maxLng: String(ne.lng()),
            oLat: String(o.lat),
            oLng: String(o.lng),
            limit: '20',
          });
          try {
            const res = await fetch(`/api/facilities/in-bounds?${qs.toString()}`, { cache: 'no-store' });
            const j = (await res.json()) as { facilities?: NearbyFacility[] };
            if (cancelled || token !== fetchToken) return;
            const facs = j.facilities ?? [];
            plot(facs);
            cbRef.current?.(facs);
          } catch {
            /* keep the current pins */
          }
        };

        map.addListener('idle', refetch);
      })
      .catch(() => {
        /* map failed to load — the list still works */
      });

    return () => {
      cancelled = true;
    };
    // origin + callback are read through refs; `initial` is stable per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  if (!hasKey) {
    return (
      <div className="flex h-full min-h-[22rem] w-full items-center justify-center bg-slate-100 p-6 text-center text-sm text-slate-400">
        Map is being set up. The full list of nearby programs is alongside.
      </div>
    );
  }
  return <div ref={ref} className="h-full min-h-[22rem] w-full bg-slate-100" />;
}
