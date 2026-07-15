import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  detectImageMedia,
  detectVideoMedia,
  storageObjectPathFromPublicUrl,
} from '../../src/lib/media/validation';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
const ascii = (value: string) => [...value].map((character) => character.charCodeAt(0));

function isoBaseMedia(majorBrand: string, compatibleBrand: string): Blob {
  return new Blob([
    new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      ...ascii('ftyp'),
      ...ascii(majorBrand),
      0x00, 0x00, 0x00, 0x00,
      ...ascii(compatibleBrand),
    ]),
  ]);
}

test('MEDIA-SIGNATURE-1 · image type and extension come from bytes, not client metadata', async () => {
  const disguisedHtml = new Blob(['<script>alert(1)</script>'], { type: 'image/png' });
  expect(await detectImageMedia(disguisedHtml)).toBeNull();

  const pngWithHostileMetadata = new Blob([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], { type: 'text/html' });
  expect(await detectImageMedia(pngWithHostileMetadata)).toEqual({
    extension: 'png',
    mimeType: 'image/png',
  });

  expect(await detectImageMedia(isoBaseMedia('avif', 'mif1'))).toEqual({
    extension: 'avif',
    mimeType: 'image/avif',
  });
});

test('MEDIA-SIGNATURE-2 · supported video containers are detected and AVIF is rejected', async () => {
  expect(await detectVideoMedia(isoBaseMedia('isom', 'mp42'))).toEqual({
    extension: 'mp4',
    mimeType: 'video/mp4',
  });
  expect(await detectVideoMedia(isoBaseMedia('qt  ', 'qt  '))).toEqual({
    extension: 'mov',
    mimeType: 'video/quicktime',
  });
  expect(await detectVideoMedia(new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])]))).toEqual({
    extension: 'webm',
    mimeType: 'video/webm',
  });
  expect(await detectVideoMedia(isoBaseMedia('avif', 'mif1'))).toBeNull();
});

test('MEDIA-PATH-1 · public URLs can only resolve to the authorized project, bucket, and owner', () => {
  const projectUrl = 'https://project.supabase.co';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const path = `${ownerId}/asset.jpg`;

  expect(storageObjectPathFromPublicUrl(
    `${projectUrl}/storage/v1/object/public/facility-photos/${path}`,
    'facility-photos',
    ownerId,
    projectUrl,
  )).toBe(path);

  for (const hostile of [
    `https://evil.example/storage/v1/object/public/facility-photos/${path}`,
    `${projectUrl}/storage/v1/object/public/rep-photos/${path}`,
    `${projectUrl}/storage/v1/object/public/facility-photos/22222222-2222-4222-8222-222222222222/asset.jpg`,
    `${projectUrl}/storage/v1/object/public/facility-photos/${ownerId}/%2E%2E/asset.jpg`,
  ]) {
    expect(storageObjectPathFromPublicUrl(hostile, 'facility-photos', ownerId, projectUrl), hostile).toBeNull();
  }
});

test('MEDIA-CONSISTENCY-1 · gallery writes serialize and every failed upload has cleanup', () => {
  const facilityActions = read('src/app/(app)/facility/actions.ts');
  const repActions = read('src/app/(app)/rep/actions.ts');
  const migration = read('supabase/project-a/migrations/39_harden_media_storage.sql');

  expect(facilityActions).toContain(".rpc('append_facility_media_url'");
  expect(facilityActions).toContain(".rpc('remove_facility_media_url'");
  expect(facilityActions).toContain('rejectAndCleanUpload(');
  expect(facilityActions).toContain('FACILITY_VIDEO_MAX_BYTES = 25_000_000');
  expect(facilityActions).not.toContain('200_000_000');
  expect(facilityActions).not.toContain("file.name.split('.')");
  expect(repActions).toContain(".rpc('swap_rep_profile_photo'");
  expect(repActions).toContain('.remove([uploadedPath])');
  expect(repActions).not.toContain('IMAGE_MIME_TO_EXTENSION[file.type]');

  expect(migration).toContain('for update;');
  expect(migration).toContain('cardinality(images) <= 10');
  expect(migration).toContain('cardinality(videos) <= 5');
  expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp', 'image/avif']");
  expect(migration).toContain("'facility-videos', 'facility-videos', true, 25000000");
  expect(migration).toContain('from public, anon, authenticated');
});
