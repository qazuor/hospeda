import { getCatalogKey, type PlanRole, type PlanVersionContentInput } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { PublicationContext } from '../../../src/services/plan-catalog/plan-publication.types';
import { validatePublication } from '../../../src/services/plan-catalog/plan-publication.validation';

const PLAN_ID = '00000000-0000-0000-0000-000000000001';
const TEST_KEYS = [
    'max_accommodations',
    'max_venues',
    'max_experiences',
    'save_favorites',
    'write_reviews',
    'read_reviews',
    'subscribe_to_plan',
    'recover_own_listing',
    'ai_search',
    'ai_chat',
    'max_favorites',
    'max_ai_search_per_month',
    'max_ai_chat_consumer_per_month',
    'view_basic_stats'
] as const;

function keyClassesFor(keys: readonly string[]): ReadonlyMap<string, string> {
    return new Map(
        keys.map((key) => {
            const definition = getCatalogKey({ key });
            if (!definition) throw new Error(`the catalog does not declare ${key}`);
            return [key, definition.keyClass];
        })
    );
}

function contextOf(input: {
    vertical: string;
    role: PlanRole;
    entitlements: PlanVersionContentInput['entitlements'];
    limits: PlanVersionContentInput['limits'];
}): PublicationContext {
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
        keyClasses: keyClassesFor(TEST_KEYS)
    };
}

const DO_ENTITLEMENTS: PlanVersionContentInput['entitlements'] = [
    { key: 'save_favorites' },
    { key: 'write_reviews' },
    { key: 'read_reviews' },
    { key: 'ai_search', planQuota: 10, trialQuota: 10 },
    { key: 'ai_chat', planQuota: 10, trialQuota: 10 },
    { key: 'subscribe_to_plan' },
    { key: 'recover_own_listing' }
];
const DO_LIMITS: PlanVersionContentInput['limits'] = [
    { key: 'max_favorites', value: 5 },
    { key: 'max_ai_search_per_month', value: 10 },
    { key: 'max_ai_chat_consumer_per_month', value: 10 }
];

describe('TEST:1626:9 — read_reviews is required only on the Tourist floor', () => {
    it('publishes the Tourist floor with the complete DO list and BASE keys', () => {
        const context = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: DO_ENTITLEMENTS,
            limits: DO_LIMITS
        });

        expect(() => validatePublication({ context })).not.toThrow();
    });

    it('rejects the same Tourist floor request when read_reviews is missing', () => {
        const context = contextOf({
            vertical: 'tourist',
            role: 'floor',
            entitlements: DO_ENTITLEMENTS.filter((entry) => entry.key !== 'read_reviews'),
            limits: DO_LIMITS
        });

        expect(() => validatePublication({ context })).toThrow(
            'el piso de Turista debe otorgar exactamente la lista cerrada: falta read_reviews'
        );
    });

    it('rejects read_reviews on an accommodation floor with both BASE keys', () => {
        const context = contextOf({
            vertical: 'accommodation',
            role: 'floor',
            entitlements: [
                { key: 'subscribe_to_plan' },
                { key: 'recover_own_listing' },
                { key: 'read_reviews' }
            ],
            limits: []
        });

        expect(() => validatePublication({ context })).toThrow('clave de más');
    });
});
