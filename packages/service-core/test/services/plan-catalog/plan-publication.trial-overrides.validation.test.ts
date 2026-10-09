/**
 * TEST:V2:10 (a) — unit, without a database: the trial plan accepts only the
 * listing-count limit of its own vertical and stores no entitlement
 * (HOS-1655, piece V2.4a, AC:V2:7, AC-1).
 *
 * Covers:
 * - trial: accepts its vertical's listing-count limit
 * - trial: rejects a limit outside the closed override list
 * - trial: rejects any entitlement (stores effects)
 *
 * The Tourist floor DO exception and the other floors live in
 * `plan-publication.floor-exception.validation.test.ts`.
 */
import { getCatalogKey, type PlanRole, type PlanVersionContentInput } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PLAN_PUBLICATION_REJECTIONS } from '../../../src/services/plan-catalog/plan-publication.rejections';
import type { PublicationContext } from '../../../src/services/plan-catalog/plan-publication.types';
import { validatePublication } from '../../../src/services/plan-catalog/plan-publication.validation';

const PLAN_ID = '00000000-0000-0000-0000-000000000001';

/** All keys that appear in these tests, with their catalog class. */
const ALL_TEST_KEYS = [
    'max_accommodations',
    'max_gastronomies',
    'max_experiences',
    'max_favorites',
    'save_favorites'
];

/** Build a keyClasses map from the catalog for a subset of keys. */
function keyClassesFor(keys: readonly string[]): ReadonlyMap<string, string> {
    return new Map(
        keys.map((key) => {
            const definition = getCatalogKey({ key });
            if (!definition) throw new Error(`the catalog does not declare ${key}`);
            return [key, definition.keyClass];
        })
    );
}

/** A hand-built context; it touches no database. */
function contextOf(input: {
    vertical: string;
    role: PlanRole;
    entitlements: PlanVersionContentInput['entitlements'];
    limits: PlanVersionContentInput['limits'];
    keyClasses?: ReadonlyMap<string, string>;
}): PublicationContext {
    const keys = input.keyClasses ? new Map(input.keyClasses) : keyClassesFor(ALL_TEST_KEYS);
    return {
        planId: PLAN_ID,
        vertical: input.vertical,
        activationEvent: null,
        role: input.role,
        previous: null,
        catalog: [],
        content: {
            rank: 1,
            sellable: false,
            trialDays: 0,
            graceDays: 0,
            allowsPause: true,
            inheritsTouristVip: false,
            entitlements: input.entitlements,
            limits: input.limits
        },
        keyClasses: keys
    };
}

/* ------------------------------------------------------------------ */
/*  AC-1 · trial override list                                         */
/* ------------------------------------------------------------------ */

describe('TEST:V2:10 (a) trial accepts its vertical listing-count limit', () => {
    it('accommodation trial: max_accommodations passes', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'trial',
            entitlements: [],
            limits: [{ key: 'max_accommodations', value: 1 }]
        });

        expect(() => validatePublication({ context: ctx })).not.toThrow();
    });

    it('gastronomy trial: max_gastronomies passes', () => {
        const ctx = contextOf({
            vertical: 'gastronomy',
            role: 'trial',
            entitlements: [],
            limits: [{ key: 'max_gastronomies', value: 3 }]
        });

        expect(() => validatePublication({ context: ctx })).not.toThrow();
    });

    it('experience trial: max_experiences passes', () => {
        const ctx = contextOf({
            vertical: 'experience',
            role: 'trial',
            entitlements: [],
            limits: [{ key: 'max_experiences', value: 2 }]
        });

        expect(() => validatePublication({ context: ctx })).not.toThrow();
    });
});

describe('TEST:V2:10 (a) trial rejects a limit outside the override list', () => {
    it('accommodation trial: max_gastronomies (OTHER vertical) is rejected', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'trial',
            entitlements: [],
            limits: [{ key: 'max_gastronomies', value: 5 }]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.trialLimitOutsideOverrides
        );
    });

    it('trial: max_favorites (not a listing-count key) is rejected', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'trial',
            entitlements: [],
            limits: [{ key: 'max_favorites', value: 10 }]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.trialLimitOutsideOverrides
        );
    });

    it('tourist trial: any limit is rejected (no mapping)', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'trial',
            entitlements: [],
            limits: [{ key: 'max_favorites', value: 5 }]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.trialLimitOutsideOverrides
        );
    });
});

describe('TEST:V2:10 (a) trial rejects any entitlement', () => {
    it('trial: a COMMERCIAL entitlement is rejected', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'trial',
            entitlements: [{ key: 'save_favorites' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.trialStoresEffects
        );
    });
});
