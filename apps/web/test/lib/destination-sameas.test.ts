/**
 * @file destination-sameas.test.ts
 * @description Unit tests for the curated destination → external entity map.
 * Ensures every entry is a non-empty array of absolute https URLs and that the
 * lookup helper resolves known slugs and gracefully returns undefined otherwise.
 */

import { describe, expect, it } from 'vitest';
import { DESTINATION_SAMEAS, getDestinationSameAs } from '../../src/lib/destination-sameas';

describe('DESTINATION_SAMEAS', () => {
    it('is a non-empty record', () => {
        expect(Object.keys(DESTINATION_SAMEAS).length).toBeGreaterThan(0);
    });

    it('every value is a non-empty array of absolute https URLs', () => {
        for (const [slug, urls] of Object.entries(DESTINATION_SAMEAS)) {
            expect(Array.isArray(urls), `${slug} should map to an array`).toBe(true);
            expect(urls.length, `${slug} should have at least one URL`).toBeGreaterThan(0);
            for (const url of urls) {
                expect(url.startsWith('https://'), `${slug} URL "${url}" must be https`).toBe(true);
            }
        }
    });

    it('keys are lowercase kebab-case slugs (no spaces / uppercase)', () => {
        for (const slug of Object.keys(DESTINATION_SAMEAS)) {
            expect(slug).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('includes the main Entre Ríos tourist destinations', () => {
        expect(DESTINATION_SAMEAS['concepcion-del-uruguay']).toBeDefined();
        expect(DESTINATION_SAMEAS.colon).toBeDefined();
        expect(DESTINATION_SAMEAS.gualeguaychu).toBeDefined();
    });
});

describe('getDestinationSameAs', () => {
    it('returns the URL array for a known slug', () => {
        const result = getDestinationSameAs({ slug: 'colon' });
        expect(result).toEqual(DESTINATION_SAMEAS.colon);
    });

    it('returns undefined for an unknown slug', () => {
        expect(getDestinationSameAs({ slug: 'no-such-destination' })).toBeUndefined();
    });

    it('returns undefined for an empty slug', () => {
        expect(getDestinationSameAs({ slug: '' })).toBeUndefined();
    });
});
