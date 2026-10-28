import { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    monthlyCount: 0
}));

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: state.effectiveSet })
}));
vi.mock('@repo/ai-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/ai-core')>()),
    getMonthlyCallCount: vi.fn(async () => state.monthlyCount),
    recordAiUsage: vi.fn(async () => undefined)
}));

import { getMonthlyCallCount, recordAiUsage } from '@repo/ai-core';
import {
    AI_ENTITLEMENT_KEY_BY_FEATURE,
    AI_LIMIT_KEY_BY_FEATURE,
    enforceAiQuota,
    evaluateAiQuota
} from '../../src/utils/listing-access/ai-quota-gate';

const OWNER_WITH_KEY = 'owner-with-key';
const OWNER_WITHOUT_KEY = 'owner-without-key';
const ALL_KEYS = [
    'ai_text_improve',
    'ai_translate',
    'ai_search',
    'ai_chat',
    'ai_accommodation_import',
    'manage_venue_menu',
    'manage_experience_directions'
];

function effectiveSetFor(userId: string, vertical: VerticalEnum) {
    const grants = userId === OWNER_WITH_KEY ? ALL_KEYS : [];
    const limits: Record<string, number> = {
        max_ai_text_improve_per_month: 50,
        max_ai_translate_per_month: 200,
        max_ai_search_per_month: 10,
        max_ai_chat_per_month: 50,
        max_ai_chat_venue_per_month: 0,
        max_ai_chat_experience_per_month: 0,
        max_ai_chat_consumer_per_month: userId === OWNER_WITH_KEY ? 200 : 10,
        max_ai_accommodation_import_per_month: 10
    };
    return rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical,
        hasLiveNonTrialTitle: true,
        inheritsTouristVip: false,
        entries: [
            ...grants.map((key) => ({ key, value: 1, strategy: 'MAX' as const })),
            ...Object.entries(limits).map(([key, value]) => ({
                key,
                value,
                strategy: 'MAX' as const
            }))
        ]
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    state.monthlyCount = 0;
    state.effectiveSet.mockImplementation(async ({ userId, vertical }) =>
        effectiveSetFor(userId, vertical)
    );
});

describe('TEST:V5:32 AI gates', () => {
    it.each([
        [
            'text-improve',
            'text_improve',
            'ai_text_improve',
            'max_ai_text_improve_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        [
            'translate',
            'translate',
            'ai_translate',
            'max_ai_translate_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        ['search-chat', 'search', undefined, 'max_ai_search_per_month', VerticalEnum.TOURIST],
        [
            'chat accommodation owner',
            'chat',
            'ai_chat',
            'max_ai_chat_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        [
            'import-from-url',
            'accommodation_import',
            'ai_accommodation_import',
            'max_ai_accommodation_import_per_month',
            VerticalEnum.ACCOMMODATION
        ]
    ] as const)('%s uses the effective key and quota', async (_route, feature, entitlementKey, limitKey, vertical) => {
        expect(AI_LIMIT_KEY_BY_FEATURE[feature]).toBe(limitKey);
        if (entitlementKey) expect(AI_ENTITLEMENT_KEY_BY_FEATURE[feature]).toBe(entitlementKey);
        await expect(
            evaluateAiQuota({
                userId: OWNER_WITH_KEY,
                vertical,
                feature,
                ...(entitlementKey ? { entitlementKey } : {}),
                limitKey
            })
        ).resolves.toEqual({ allowed: true });
        expect(getMonthlyCallCount).toHaveBeenCalledWith(
            expect.objectContaining({ userId: OWNER_WITH_KEY, feature, now: expect.any(Date) })
        );
    });

    it.each([
        [
            'text-improve',
            'text_improve',
            'ai_text_improve',
            'max_ai_text_improve_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        [
            'translate',
            'translate',
            'ai_translate',
            'max_ai_translate_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        ['chat owner', 'chat', 'ai_chat', 'max_ai_chat_per_month', VerticalEnum.ACCOMMODATION],
        [
            'import-from-url',
            'accommodation_import',
            'ai_accommodation_import',
            'max_ai_accommodation_import_per_month',
            VerticalEnum.ACCOMMODATION
        ]
    ] as const)('%s rejects an owner without its entitlement', async (_route, feature, entitlementKey, limitKey, vertical) => {
        await expect(
            evaluateAiQuota({
                userId: OWNER_WITHOUT_KEY,
                vertical,
                feature,
                entitlementKey,
                limitKey
            })
        ).resolves.toMatchObject({ allowed: false, reason: 'entitlement', key: entitlementKey });
        expect(getMonthlyCallCount).not.toHaveBeenCalled();
    });

    it.each([
        [
            'text-improve',
            'text_improve',
            'ai_text_improve',
            'max_ai_text_improve_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        [
            'translate',
            'translate',
            'ai_translate',
            'max_ai_translate_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        ['search-chat', 'search', undefined, 'max_ai_search_per_month', VerticalEnum.TOURIST],
        [
            'chat accommodation owner',
            'chat',
            'ai_chat',
            'max_ai_chat_per_month',
            VerticalEnum.ACCOMMODATION
        ],
        [
            'chat gastronomy owner',
            'chat_venue',
            'ai_chat',
            'max_ai_chat_venue_per_month',
            VerticalEnum.VENUE
        ],
        [
            'chat experience owner',
            'chat_experience',
            'ai_chat',
            'max_ai_chat_experience_per_month',
            VerticalEnum.EXPERIENCE
        ],
        [
            'import-from-url',
            'accommodation_import',
            'ai_accommodation_import',
            'max_ai_accommodation_import_per_month',
            VerticalEnum.ACCOMMODATION
        ]
    ] as const)('%s meters and rejects an exhausted quota', async (_route, feature, entitlementKey, limitKey, vertical) => {
        const max = feature === 'chat_venue' || feature === 'chat_experience' ? 0 : 10;
        state.monthlyCount = max;
        state.effectiveSet.mockImplementation(async ({ userId, vertical: effectiveVertical }) => {
            const set = effectiveSetFor(userId, effectiveVertical);
            return {
                ...set,
                limits: { get: ({ key }: { key: string }) => (key === limitKey ? max : undefined) }
            };
        });
        await expect(
            enforceAiQuota({
                userId: OWNER_WITH_KEY,
                vertical,
                feature,
                ...(entitlementKey ? { entitlementKey } : {}),
                limitKey
            })
        ).rejects.toMatchObject({
            code: 'LIMIT_REACHED',
            details: { limitKey, currentCount: max, maxAllowed: max }
        });
        expect(recordAiUsage).toHaveBeenCalledWith(
            expect.objectContaining({ userId: OWNER_WITH_KEY, feature, status: 'quota_exceeded' })
        );
    });

    it('TEST:V5:32 chat owner rejection keeps the vertical owner copy', async () => {
        await expect(
            enforceAiQuota({
                userId: OWNER_WITHOUT_KEY,
                vertical: VerticalEnum.VENUE,
                feature: 'chat_venue',
                entitlementKey: 'ai_chat',
                limitKey: 'max_ai_chat_venue_per_month',
                entitlementMessage: 'venue.aiChat.unavailable'
            })
        ).rejects.toMatchObject({
            code: 'ENTITLEMENT_REQUIRED',
            message: 'venue.aiChat.unavailable',
            details: { entitlementKey: 'ai_chat' }
        });
        expect(getMonthlyCallCount).not.toHaveBeenCalled();
    });

    it('TEST:V5:32 chat checks the consumer quota on TOURIST after the owner side', async () => {
        state.monthlyCount = 10;
        await expect(
            enforceAiQuota({
                userId: OWNER_WITHOUT_KEY,
                vertical: VerticalEnum.TOURIST,
                feature: 'chat',
                limitKey: 'max_ai_chat_consumer_per_month',
                limitMessage: 'accommodations.aiChat.consumerLimitReached'
            })
        ).rejects.toMatchObject({
            code: 'LIMIT_REACHED',
            message: 'accommodations.aiChat.consumerLimitReached',
            details: { limitKey: 'max_ai_chat_consumer_per_month', maxAllowed: 10 }
        });
        expect(recordAiUsage).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: OWNER_WITHOUT_KEY,
                feature: 'chat',
                status: 'quota_exceeded'
            })
        );
    });

    it('TEST:V5:32 reports absent limits as zero and meters before quota rejection', async () => {
        state.monthlyCount = 0;
        state.effectiveSet.mockImplementation(async ({ userId, vertical }) => {
            const set = effectiveSetFor(userId, vertical);
            return { ...set, limits: { get: () => undefined } };
        });
        await expect(
            enforceAiQuota({
                userId: OWNER_WITH_KEY,
                vertical: VerticalEnum.ACCOMMODATION,
                feature: 'text_improve',
                entitlementKey: 'ai_text_improve',
                limitKey: 'max_ai_text_improve_per_month'
            })
        ).rejects.toMatchObject({
            code: 'LIMIT_REACHED',
            details: { limitKey: 'max_ai_text_improve_per_month', maxAllowed: 0 }
        });
        expect(recordAiUsage).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'quota_exceeded' })
        );
    });
});
