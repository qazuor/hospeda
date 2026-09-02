/**
 * `productDomainForLimitKey` answers, or says it cannot (HOS-1078).
 *
 * ---
 * WHY THIS FILE EXISTS
 *
 * The mapping had NO test at all, and its failure mode was invisible by
 * construction: an unmapped `LimitKey` fell through an `?? ACCOMMODATION` to a
 * confident, wrong answer. Downstream that reads a plan that does not declare
 * the key, and the layer below resolves the absence to `-1` — unlimited —
 * without raising. The whole chain is silent, so nothing but a test of THIS
 * function can catch it.
 *
 * The exhaustiveness assertion below is not redundant with the `Record<LimitKey,
 * …>` type. The type stops a new key from being FORGOTTEN; this stops it from
 * being added with a copy-pasted `GASTRONOMY`, and it is the assertion that
 * fails loudly if somebody re-widens the map to `Partial<…>`.
 *
 * @module test/config/commerce-limits
 */

import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    productDomainForLimitKey
} from '../../src/config/commerce-limits.config.js';
import { LimitKey } from '../../src/types/plan.types.js';

describe('productDomainForLimitKey', () => {
    it('answers a domain for EVERY LimitKey — no key falls through', () => {
        // The property the old `?? ACCOMMODATION` faked: it made this pass for
        // keys nobody had mapped, which is exactly the state `max_accommodations`
        // itself was in.
        const unresolved = Object.values(LimitKey).filter(
            (key) => productDomainForLimitKey(key) === undefined
        );

        expect(unresolved).toEqual([]);
        // Non-vacuity: the enum is not empty, so the filter above actually ran.
        expect(Object.values(LimitKey).length).toBeGreaterThan(10);
    });

    it('maps each commerce vertical cap to its OWN domain', () => {
        expect(productDomainForLimitKey(LimitKey.MAX_GASTRONOMIES)).toBe(
            ProductDomainEnum.GASTRONOMY
        );
        expect(productDomainForLimitKey(LimitKey.MAX_EXPERIENCES)).toBe(
            ProductDomainEnum.EXPERIENCE
        );
    });

    it('maps the accommodation cap EXPLICITLY, not by default', () => {
        // `max_accommodations` used to be answered by the `??` — the same
        // mechanism that answered a typo. Now it is a row in the map, and the
        // two cases have different outcomes.
        expect(productDomainForLimitKey(LimitKey.MAX_ACCOMMODATIONS)).toBe(
            ProductDomainEnum.ACCOMMODATION
        );
        expect(productDomainForLimitKey('max_accommodationss')).toBeUndefined();
    });

    it.each([
        ['a near-miss typo', 'max_gastronomys'],
        ['a retired key', 'max_commerce_listings'],
        ['an empty string', ''],
        ['a plausible-looking invention', 'max_partners']
    ])('returns undefined for %s, never accommodation', (_label, key) => {
        const result = productDomainForLimitKey(key);

        expect(result).toBeUndefined();
        // Spelled out because `'accommodation'` is the specific wrong answer
        // this function used to give, and the one that costs money.
        expect(result).not.toBe(ProductDomainEnum.ACCOMMODATION);
    });

    it('assigns a commerce domain to the two commerce keys and to nothing else', () => {
        const commerceDomains = new Set<string>([
            ProductDomainEnum.GASTRONOMY,
            ProductDomainEnum.EXPERIENCE
        ]);
        const keysInACommerceDomain = Object.values(LimitKey).filter((key) => {
            const domain = productDomainForLimitKey(key);
            return domain !== undefined && commerceDomains.has(domain);
        });

        expect(new Set(keysInACommerceDomain)).toEqual(
            new Set(Object.values(LIMIT_KEY_BY_COMMERCE_VERTICAL))
        );
    });
});
