/**
 * TEST:V2:10 (a) — unit, without a database: trial override rules and the DO
 * exception for the Tourist floor (HOS-1655, piece V2.4a, AC:V2:7).
 *
 * Covers:
 * - trial: accepts its vertical's listing-count limit, rejects others
 * - trial: rejects any entitlement (stores effects)
 * - Tourist floor: accepts the exact DO list (+ required BASE keys)
 * - Tourist floor: rejects wrong value, wrong quota, extra commercial key
 * - Other floors: reject every DO list key
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
/*  Other floors: DO keys are rejected                                 */
/* ------------------------------------------------------------------ */

describe('TEST:V2:10 (a) pisos de otras verticales rechazan claves DO', () => {
    // Each test isolates ONE DO key so the others cannot mask the rejection.
    const baseFloorEntitlements = [{ key: 'subscribe_to_plan' }, { key: 'recover_own_listing' }];

    it('piso de accommodation: save_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'floor',
            entitlements: [...baseFloorEntitlements, { key: 'save_favorites' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de accommodation: write_reviews se rechaza', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'floor',
            entitlements: [...baseFloorEntitlements, { key: 'write_reviews' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de accommodation: ai_search medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'floor',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_search', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de accommodation: ai_chat medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'accommodation',
            role: 'floor',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de gastronomy: save_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'gastronomy',
            role: 'floor',
            entitlements: [...baseFloorEntitlements, { key: 'save_favorites' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de gastronomy: write_reviews se rechaza', () => {
        const ctx = contextOf({
            vertical: 'gastronomy',
            role: 'floor',
            entitlements: [...baseFloorEntitlements, { key: 'write_reviews' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de gastronomy: ai_search medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'gastronomy',
            role: 'floor',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_search', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de gastronomy: ai_chat medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'gastronomy',
            role: 'floor',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de experience: save_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'experience',
            role: 'floor',
            entitlements: [...baseFloorEntitlements, { key: 'save_favorites' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de experience: write_reviews se rechaza', () => {
        const ctx = contextOf({
            vertical: 'experience',
            role: 'floor',
            entitlements: [...baseFloorEntitlements, { key: 'write_reviews' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de experience: ai_search medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'experience',
            role: 'floor',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_search', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('piso de experience: ai_chat medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'experience',
            role: 'floor',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('pre_trial de Turista: save_favorites se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'pre_trial',
            entitlements: [...baseFloorEntitlements, { key: 'save_favorites' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('pre_trial de Turista: write_reviews se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'pre_trial',
            entitlements: [...baseFloorEntitlements, { key: 'write_reviews' }],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('pre_trial de Turista: ai_search medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'pre_trial',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_search', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });

    it('pre_trial de Turista: ai_chat medido se rechaza', () => {
        const ctx = contextOf({
            vertical: 'tourist',
            role: 'pre_trial',
            entitlements: [
                ...baseFloorEntitlements,
                { key: 'ai_chat', planQuota: 10, trialQuota: 10 }
            ],
            limits: []
        });

        expect(() => validatePublication({ context: ctx })).toThrow(
            PLAN_PUBLICATION_REJECTIONS.extraKey
        );
    });
});
