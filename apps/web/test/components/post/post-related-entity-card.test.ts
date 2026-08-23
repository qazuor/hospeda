/**
 * @file post-related-entity-card.test.ts
 * @description Source guard for `PostRelatedEntityCard.astro` after the
 * Cloudinary-proxy migration. Vitest cannot render `.astro`, so we pin the
 * relevant wiring against the source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/post/PostRelatedEntityCard.astro'),
    'utf8'
);

describe('PostRelatedEntityCard.astro', () => {
    it('checks whether the image is a real Cloudinary delivery URL', () => {
        expect(src).toContain('isCloudinaryDeliveryUrl(entity.image)');
    });

    it('uses Astro Image for Cloudinary and keeps img fallback for everything else', () => {
        expect(src).toContain('shouldProxyImage ? (');
        expect(src).toContain('<Image');
        expect(src).toContain('<img');
    });

    it('keeps the existing semantic label wiring intact', () => {
        expect(src).toContain('aria-label={`${typeLabel}: ${entity.name}`}');
        expect(src).toContain('alt={entity.name}');
    });
});
