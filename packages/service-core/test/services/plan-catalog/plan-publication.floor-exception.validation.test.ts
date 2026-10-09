/**
 * TEST:V2:10 (a) — unit, without a database: the DO exception for the Tourist
 * floor and the (a) rule on every other floor and on `pre_trial`
 * (HOS-1655, piece V2.4a, AC:V2:7, AC-2, AC-3).
 *
 * Covers:
 * - Tourist floor: accepts the exact DO list (+ required BASE keys)
 * - Tourist floor: rejects missing keys, wrong value, wrong quota, extra key
 * - Every other floor and `pre_trial`: rejects each DO key, entitlement AND
 *   limit, in isolation so a permissive rule cannot hide behind another key
 *
 * The trial override cases live in
 * `plan-publication.trial-overrides.validation.test.ts`.
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
    'save_favorites',
    'write_reviews',
    'subscribe_to_plan',
    'recover_own_listing',
    'ai_search',
    'ai_chat',
    'max_favorites',
    'max_ai_search_per_month',
    'max_ai_chat_consumer_per_month',
    'view_basic_stats'
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
/*  DO exception · Tourist floor                                       */
/* ------------------------------------------------------------------ */

describe('TEST:V2:10 (a) Tourist floor accepts the DO list', () => {
    it('pasa con la lista DO + las dos keys BASE', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).not.toThrow();
    });
});

describe('TEST:V2:10 (a) Tourist floor rejects missing DO keys', () => {
    it('sin save_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            'el piso de Turista debe otorgar exactamente la lista cerrada: falta save_favorites'
        );
    });

    it('sin ai_chat se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            'el piso de Turista debe otorgar exactamente la lista cerrada: falta ai_chat'
        );
    });

    it('sin max_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            'el piso de Turista debe otorgar exactamente la lista cerrada: falta max_favorites'
        );
    });
});

describe('TEST:V2:10 (a) Tourist floor rejects deviations from the DO list', () => {
    it('otra clave comercial se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'view_basic_stats' },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('valor distinto en max_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 6 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('valor distinto en max_ai_search_per_month se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 11 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('valor distinto en max_ai_chat_consumer_per_month se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 9 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('cuota distinta en ai_search se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 11, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('cuota distinta en ai_chat se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 5 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('clave duplicada con valor distinto se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: [
                { key: 'save_favorites' },
                { key: 'save_favorites', planQuota: 5, trialQuota: 5 },
                { key: 'write_reviews' },
                { key: 'ai_search', planQuota: 10, trialQuota: 10 },
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' }
            ],
            limits: [
                { key: 'max_favorites', value: 5 },
                { key: 'max_ai_search_per_month', value: 10 },
                { key: 'max_ai_chat_consumer_per_month', value: 10 }
            ]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });
});

/* ------------------------------------------------------------------ */
/*  Other floors and pre_trial: each DO key is rejected on its own     */
/* ------------------------------------------------------------------ */

/** Each non-Tourist-floor context that must reject every DO key. */
const OTHER_FLOOR_CONTEXTS: { label: string; vertical: string; role: PlanRole }[] = [
    { label: 'piso de accommodation', vertical: 'accommodation', role: 'floor' },
    { label: 'piso de gastronomy', vertical: 'gastronomy', role: 'floor' },
    { label: 'piso de experience', vertical: 'experience', role: 'floor' },
    { label: 'pre_trial de Turista', vertical: 'tourist', role: 'pre_trial' }
];

/** The four DO entitlement keys, each in isolation. */
const DO_ENTITLEMENT_SAMPLES: PlanVersionContentInput['entitlements'] = [
    { key: 'save_favorites' },
    { key: 'write_reviews' },
    { key: 'ai_search', planQuota: 10, trialQuota: 10 },
    { key: 'ai_chat', planQuota: 10, trialQuota: 10 }
];

/** The three DO limit keys, each in isolation. */
const DO_LIMIT_SAMPLES: PlanVersionContentInput['limits'] = [
    { key: 'max_favorites', value: 5 },
    { key: 'max_ai_search_per_month', value: 10 },
    { key: 'max_ai_chat_consumer_per_month', value: 10 }
];

describe.each(OTHER_FLOOR_CONTEXTS)('TEST:V2:10 (a) $label rechaza cada clave DO aislada', ({
    vertical,
    role
}) => {
    // Both BASE keys are required by (b), so the only cause that can fire is
    // the (a) rule under test.
    const baseEntitlements: PlanVersionContentInput['entitlements'] = [
        { key: 'subscribe_to_plan' },
        { key: 'recover_own_listing' }
    ];

    it.each(DO_ENTITLEMENT_SAMPLES)('entitlement $key se rechaza', (entitlement) => {
        const ctx = contextOf({
            vertical,
            role,
            entitlements: [...baseEntitlements, entitlement],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it.each(DO_LIMIT_SAMPLES)('limit $key se rechaza', (limit) => {
        const ctx = contextOf({
            vertical,
            role,
            entitlements: baseEntitlements,
            limits: [limit]
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });
});
