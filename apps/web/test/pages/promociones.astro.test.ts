/**
 * @file promociones.astro.test.ts
 * @description HOS-2589 D-2 / AC-21: the public promotions page is a session-blind
 * shell; the list is the per-reader island.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/promociones/index.astro'),
    'utf8'
);

describe('promociones/index.astro (HOS-2589)', () => {
    it('mounts the listing island', () => {
        expect(source).toContain('<PromotionsListing client:load');
    });

    it('is edge-cacheable and reads no promotion on the server', () => {
        expect(source).toContain('cacheable: true');
        expect(source).not.toMatch(/ownerPromotion|owner-promotions|fetch\(/);
        expect(source).not.toContain('Astro.locals.user');
    });
});
