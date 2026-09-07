/**
 * @file billing/price-on-request-audiences.test.ts
 * @description Unit tests for the one predicate deciding which audiences
 * publish no amount on the public web (HOS-1212).
 *
 * The bug this module exists to close was not a wrong value anywhere — it was
 * the SAME decision expressed three times in three vocabularies, one of which
 * (the plan index) never got written. So these tests assert the predicate's
 * value literally, and `pricing-page-content` / `audience-plans` assert that
 * their own surface reads it.
 */

import { describe, expect, it } from 'vitest';
import {
    isPriceOnRequestAudience,
    PRICE_ON_REQUEST_AUDIENCES,
    resolvePriceMode
} from '@/lib/billing/price-on-request-audiences';
import type { PricingAudience } from '@/lib/billing-i18n';

const ALL_AUDIENCES: readonly PricingAudience[] = [
    'owner',
    'tourist',
    'gastronomy',
    'experience',
    'partner'
] as const;

describe('PRICE_ON_REQUEST_AUDIENCES', () => {
    it('holds partner and nothing else', () => {
        // Spelled out rather than derived. An audience joining this set changes
        // what five public pages print, so it is a deliberate edit that has to
        // fail a test first — never something a refactor can widen quietly.
        expect([...PRICE_ON_REQUEST_AUDIENCES]).toEqual(['partner']);
    });
});

describe('isPriceOnRequestAudience', () => {
    it('withholds amounts for partner', () => {
        expect(isPriceOnRequestAudience({ audience: 'partner' })).toBe(true);
    });

    it('publishes amounts for the four commercial audiences', () => {
        for (const audience of ALL_AUDIENCES.filter((a) => a !== 'partner')) {
            expect(isPriceOnRequestAudience({ audience })).toBe(false);
        }
    });
});

describe('resolvePriceMode', () => {
    it('answers consult for partner', () => {
        expect(resolvePriceMode({ audience: 'partner' })).toBe('consult');
    });

    it('answers amount for everyone else', () => {
        for (const audience of ALL_AUDIENCES.filter((a) => a !== 'partner')) {
            expect(resolvePriceMode({ audience })).toBe('amount');
        }
    });

    it('answers for every audience the union defines', () => {
        // The mode is a required prop on all five pricing pages, so an audience
        // this function did not answer for would render `undefined` where the
        // grid expects a mode — and fall back to showing an amount.
        for (const audience of ALL_AUDIENCES) {
            expect(['amount', 'consult']).toContain(resolvePriceMode({ audience }));
        }
    });
});
