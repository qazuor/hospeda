/**
 * HOS-2331 — `buildAccommodationPublishReadinessInput`: the one mapping from a
 * stored accommodation and its media rows to the facts the publish
 * requirements judge. `readPublishCompleteness` and the owner summary's batch
 * evaluator both use it, so they cannot disagree.
 */

import type { Accommodation, AccommodationMedia } from '@repo/schemas';
import { resolveMissingPublishRequirements } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { buildAccommodationPublishReadinessInput } from '../../../src/services/accommodation/accommodation.publish-readiness';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** A media row; featured and approved unless overridden. */
function mediaRow(overrides: Partial<AccommodationMedia> = {}): AccommodationMedia {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        accommodationId: ID,
        url: 'https://cdn.example.com/featured.jpg',
        moderationState: 'APPROVED',
        state: 'visible',
        isFeatured: true,
        sortOrder: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    } as unknown as AccommodationMedia;
}

/** A stored accommodation with every requirement answered. */
function accommodation(overrides: Record<string, unknown> = {}): Accommodation {
    return {
        id: ID,
        description: 'Una casa amplia frente al río.',
        extraInfo: { capacity: 4, bedrooms: 2, bathrooms: 0 },
        policies: { minNights: 0 },
        videos: null,
        ...overrides
    } as unknown as Accommodation;
}

describe('buildAccommodationPublishReadinessInput', () => {
    it('maps the stored fields, keeping 0 as a real answer', () => {
        // Act
        const facts = buildAccommodationPublishReadinessInput({
            accommodation: accommodation(),
            mediaRows: [mediaRow()]
        });

        // Assert
        expect(facts).toEqual({
            description: 'Una casa amplia frente al río.',
            capacity: 4,
            minNights: 0,
            bedrooms: 2,
            bathrooms: 0,
            hasMainImage: true
        });
        expect(resolveMissingPublishRequirements({ input: facts })).toEqual([]);
    });

    it('reads the minimum stay from the house rules (HOS-2060)', () => {
        // Act
        const facts = buildAccommodationPublishReadinessInput({
            accommodation: accommodation({ policies: null, extraInfo: null }),
            mediaRows: []
        });

        // Assert
        expect(facts.minNights).toBeUndefined();
        expect(facts.capacity).toBeUndefined();
        expect(resolveMissingPublishRequirements({ input: facts })).toEqual([
            'capacity',
            'minNights',
            'bedrooms',
            'bathrooms',
            'mainImage'
        ]);
    });

    it('counts only an approved featured photo as the main image', () => {
        // Act
        const pending = buildAccommodationPublishReadinessInput({
            accommodation: accommodation(),
            mediaRows: [mediaRow({ moderationState: 'PENDING' } as Partial<AccommodationMedia>)]
        });
        const notFeatured = buildAccommodationPublishReadinessInput({
            accommodation: accommodation(),
            mediaRows: [mediaRow({ isFeatured: false })]
        });

        // Assert
        expect(pending.hasMainImage).toBe(false);
        expect(notFeatured.hasMainImage).toBe(false);
    });
});

describe('AccommodationService.readPublishCompleteness (regression, HOS-2331 refactor)', () => {
    /** A service whose media model answers `rows` for the accommodation. */
    function serviceWith(rows: readonly AccommodationMedia[]) {
        const findByAccommodations = vi.fn().mockResolvedValue(new Map([[ID, [...rows]]]));
        const service = new AccommodationService(
            {} as ServiceConfig,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { findByAccommodations } as never
        );
        return { service, findByAccommodations };
    }

    it('reads the media of that one accommodation and reports it complete', async () => {
        // Arrange
        const { service, findByAccommodations } = serviceWith([mediaRow()]);

        // Act
        const result = await service.readPublishCompleteness({ accommodation: accommodation() });

        // Assert
        expect(findByAccommodations).toHaveBeenCalledWith({ accommodationIds: [ID] });
        expect(result).toEqual({ complete: true, missing: [] });
    });

    it('reports the missing photo and capacity through the shared mapping', async () => {
        // Arrange
        const { service } = serviceWith([]);

        // Act
        const result = await service.readPublishCompleteness({
            accommodation: accommodation({ extraInfo: { bedrooms: 1, bathrooms: 1 } })
        });

        // Assert
        expect(result).toEqual({ complete: false, missing: ['capacity', 'mainImage'] });
    });
});
