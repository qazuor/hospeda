/** @file TEST:1729:6 SSR wiring keeps the business index fail-closed and per-vertical. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/comercio/index.astro'),
    'utf8'
);

describe('comercio index publish affordance — TEST:1729:6', () => {
    it('reads the canonical destination resolver and passes its per-card result', () => {
        expect(source).toContain('resolveListingPublishAffordances({ listings, cookieHeader })');
        expect(source).toMatch(
            /const affordance =\s*publishAffordances\.get\(listing\.vertical\) \?\? UNKNOWN_PUBLISH_AFFORDANCE;/
        );
        expect(source).toContain('publishAffordance={affordance}');
        expect(source).toContain('<OwnerListingCard listing={listing}');
        const card = readFileSync(
            resolve(__dirname, '../../src/components/account/OwnerListingCard.astro'),
            'utf8'
        );
        expect(card).toContain(
            'resolveOwnerListingPrimaryAction({ listing, affordance: publishAffordance })'
        );
        expect(source).toContain('UNKNOWN_PUBLISH_AFFORDANCE');
        expect(source).not.toContain('canPublish = true');
    });
});
