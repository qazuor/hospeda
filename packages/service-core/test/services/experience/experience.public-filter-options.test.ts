import type { ExperienceModel } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { getExperiencePublicFilterOptions } from '../../../src/services/experience/experience.public-filter-options.js';

describe('getExperiencePublicFilterOptions', () => {
    it('returns the ids held by published experiences, sorted', async () => {
        const model = {
            findPublicFilterOptions: vi.fn().mockResolvedValue({
                amenityIds: [
                    '22222222-2222-4222-8222-222222222222',
                    '11111111-1111-4111-8111-111111111111'
                ],
                featureIds: [
                    '44444444-4444-4444-8444-444444444444',
                    '33333333-3333-4333-8333-333333333333'
                ]
            })
        };
        const result = await getExperiencePublicFilterOptions({
            input: {},
            model: model as unknown as ExperienceModel
        });
        expect(model.findPublicFilterOptions).toHaveBeenCalledTimes(1);
        expect(result.data?.amenityIds).toEqual([
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222'
        ]);
        expect(result.data?.featureIds).toEqual([
            '33333333-3333-4333-8333-333333333333',
            '44444444-4444-4444-8444-444444444444'
        ]);
    });

    it('rejects unknown params without querying the model', async () => {
        const model = { findPublicFilterOptions: vi.fn() };
        const result = await getExperiencePublicFilterOptions({
            input: { businessLine: 'food' },
            model: model as unknown as ExperienceModel
        });
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.findPublicFilterOptions).not.toHaveBeenCalled();
    });

    it('returns model failures as ServiceOutput errors', async () => {
        const model = {
            findPublicFilterOptions: vi.fn().mockRejectedValue(new Error('db unavailable'))
        };
        const result = await getExperiencePublicFilterOptions({
            input: {},
            model: model as unknown as ExperienceModel
        });
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toBe('db unavailable');
    });
});
