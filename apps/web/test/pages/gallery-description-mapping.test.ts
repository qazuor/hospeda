/**
 * @file gallery-description-mapping.test.ts
 * @description Source-read guard (HOS-2125): every detail page that feeds the
 * ImageGallery island must carry the photo `description` into the island's
 * `GalleryImage`, otherwise the lightbox silently drops it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string => readFileSync(resolve(__dirname, '../../src', rel), 'utf8');

describe('gallery description reaches the ImageGallery island', () => {
    it('accommodation detail maps item.description', () => {
        expect(read('pages/[lang]/alojamientos/[slug].astro')).toContain(
            'description: item.description'
        );
    });

    it('comer-y-salir detail maps g.description', () => {
        expect(read('pages/[lang]/comer-y-salir/[slug].astro')).toContain(
            'description: g.description'
        );
    });

    it('experiencias detail maps entry.description (via buildExperienceGalleryImages, HOS-2579)', () => {
        expect(read('pages/[lang]/experiencias/[slug].astro')).toContain(
            'buildExperienceGalleryImages'
        );
        expect(read('lib/experience/experience-gallery-images.ts')).toContain(
            'description: entry.description'
        );
    });

    it('GalleryImage declares description', () => {
        expect(read('components/ImageGallery.client.tsx')).toMatch(
            /readonly description\?: string;/
        );
    });
});
