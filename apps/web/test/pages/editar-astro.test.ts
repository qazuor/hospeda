/**
 * @file editar.astro.test.ts
 * @description Source assertion test for the accommodation edit SSR page.
 * Verifies key structural elements in the Astro source (can't render in Vitest).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/propiedades/[id]/editar.astro'),
    'utf8'
);

describe('editar.astro', () => {
    it('should be SSR (prerender = false)', () => {
        expect(src).toContain('prerender = false');
    });

    it('should use AccommodationEditor island with client:load', () => {
        expect(src).toContain('AccommodationEditor');
        expect(src).toContain('client:load');
    });

    it('should import transform functions', () => {
        expect(src).toContain('transformAccommodationEdit');
        expect(src).toContain('transformAmenityList');
        expect(src).toContain('transformDestinationList');
    });

    it('should fetch accommodation by ID from protected endpoint', () => {
        expect(src).toContain('/api/v1/protected/accommodations/${accommodationId}');
    });

    it('should redirect to propiedades list on 404/403', () => {
        expect(src).toContain('mi-cuenta/propiedades/');
    });

    it('should have auth guard', () => {
        expect(src).toContain('Astro.locals.user');
        expect(src).toContain('buildLoginRedirect');
    });
});
