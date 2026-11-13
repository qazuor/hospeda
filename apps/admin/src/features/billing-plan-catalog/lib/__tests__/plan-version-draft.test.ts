import type { AdminCatalogPlanVersion } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { toContent, toDraft } from '../plan-version-draft';

const CURRENT: AdminCatalogPlanVersion = {
    versionId: 'version-id',
    rank: 2,
    sellable: true,
    trialDays: 14,
    graceDays: 3,
    allowsPause: true,
    inheritsTouristVip: false,
    cycles: ['monthly', 'annual'],
    entitlements: [
        { key: 'publish_accommodations' },
        { key: 'ai_search', planQuota: 100, trialQuota: 5 }
    ],
    limits: [{ key: 'max_accommodations', value: 10 }]
} as const;

describe('plan version draft mapping', () => {
    it('round trips current values and quota fields', () => {
        const draft = toDraft({ currentVersion: CURRENT });
        expect(draft.cycles).toEqual(['monthly', 'annual']);
        expect(toContent({ draft })).toEqual({
            rank: 2,
            sellable: true,
            trialDays: 14,
            graceDays: 3,
            allowsPause: true,
            inheritsTouristVip: false,
            cycles: ['monthly', 'annual'],
            entitlements: [
                { key: 'publish_accommodations' },
                { key: 'ai_search', planQuota: 100, trialQuota: 5 }
            ],
            limits: [{ key: 'max_accommodations', value: 10 }]
        });
    });

    it('uses the base values when no current version exists', () => {
        expect(toDraft({ currentVersion: null })).toEqual({
            rank: '0',
            sellable: false,
            trialDays: '0',
            graceDays: '0',
            allowsPause: false,
            inheritsTouristVip: false,
            cycles: [],
            entitlements: [],
            limits: []
        });
    });

    it('drops keyless rows and omits blank quotas', () => {
        const draft = toDraft({ currentVersion: null });
        expect(
            toContent({
                draft: {
                    ...draft,
                    entitlements: [
                        { rowId: 'e1', key: '', planQuota: '4', trialQuota: '' },
                        {
                            rowId: 'e2',
                            key: 'publish_accommodations',
                            planQuota: '',
                            trialQuota: ''
                        }
                    ],
                    limits: [{ rowId: 'l1', key: '', value: '' }]
                }
            })
        ).toMatchObject({
            entitlements: [{ key: 'publish_accommodations' }],
            limits: []
        });
    });
});
