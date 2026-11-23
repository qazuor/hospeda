/** @file TEST:1757:5-6 owner index usage badge SSR wiring. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/comercio/index.astro'),
    'utf8'
);

describe('comercio index usage — TEST:1757:5-6', () => {
    it('TEST:1757:5 reads per-vertical effective sets and renders status badges without unsafe styling/logging', () => {
        expect(source).toContain('fetchListingEffectiveSets');
        expect(source).toContain('buildListingUsage');
        expect(source).not.toContain('getEntitlementsCached');
        expect(source).not.toContain('style=');
        expect(source).not.toContain('console.');
        // HOS-2484: the kit Alert (role="status" for the info/warning tones it
        // gets) with the shared, never-danger tone mapping.
        expect(source).toContain('<Alert');
        expect(source).toContain('tone={resolveUsageAlertTone({ threshold: usage.threshold })}');
    });

    it('TEST:1757:6 shows atLimit and gates the upgrade link below the badge threshold check', () => {
        expect(source).toContain('listing.owner.list.usage.atLimit');
        expect(source).toContain("threshold !== 'ok' && (");
        expect(source).toContain('listing.owner.list.usage.upgrade');
    });
});
