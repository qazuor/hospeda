import type { VenueModel } from '@repo/db';
import { ServiceErrorCode, VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { getVenuePublicFilterOptions } from '../../../src/services/venue/venue.public-filter-options.js';

describe('getVenuePublicFilterOptions', () => {
    it('passes the query through and sorts enum values and IDs', async () => {
        const model = {
            findPublicFilterOptions: vi.fn().mockResolvedValue({
                types: [VenueTypeEnum.BOLICHE, VenueTypeEnum.BAR],
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
        const result = await getVenuePublicFilterOptions({
            input: { businessLine: 'nightlife' },
            model: model as unknown as VenueModel
        });
        expect(model.findPublicFilterOptions).toHaveBeenCalledWith({ businessLine: 'nightlife' });
        expect(result.data?.types).toEqual([VenueTypeEnum.BAR, VenueTypeEnum.BOLICHE]);
        expect(result.data?.amenityIds).toEqual([
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222'
        ]);
        const generalModel = {
            findPublicFilterOptions: vi
                .fn()
                .mockResolvedValue({ types: [], amenityIds: [], featureIds: [] })
        };
        await getVenuePublicFilterOptions({
            input: {},
            model: generalModel as unknown as VenueModel
        });
        expect(generalModel.findPublicFilterOptions).toHaveBeenCalledWith({
            businessLine: undefined
        });
    });

    it('rejects invalid input without querying the model', async () => {
        const model = { findPublicFilterOptions: vi.fn() };
        const result = await getVenuePublicFilterOptions({
            input: { businessLine: 'x' },
            model: model as unknown as VenueModel
        });
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.findPublicFilterOptions).not.toHaveBeenCalled();
    });

    it('returns model failures as ServiceOutput errors', async () => {
        const failure = new Error('db unavailable');
        const model = { findPublicFilterOptions: vi.fn().mockRejectedValue(failure) };
        const result = await getVenuePublicFilterOptions({
            input: {},
            model: model as unknown as VenueModel
        });
        expect(result.error?.message).toBe('db unavailable');
    });
});
