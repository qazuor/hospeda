/**
 * Unit tests for SocialPublicDataService — the tightly-scoped public-data
 * aggregation service consumed by the Custom GPT for social-draft enrichment.
 *
 * All DB interactions are mocked — no real Postgres calls. Only the
 * AccommodationModel and DestinationModel surfaces used by this service are
 * exercised.
 *
 * Covers:
 *   - Happy path: accommodations + destinations mapped to SocialPublicDataItem
 *     shape and merged, ordered by recency (most recent first).
 *   - Free-text `query` narrows results via safeIlike additional conditions
 *     forwarded to both models.
 *   - Empty result set from both models is handled gracefully — `{ items: [] }`,
 *     no error.
 *
 * HOS-66 T-022 (G-10).
 */

import { describe, expect, it } from 'vitest';
import {
    type GetPublicDataInput,
    SocialPublicDataService
} from '../../../src/services/social/social-public-data.service';
import { createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Row fixtures
// ---------------------------------------------------------------------------

const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000101';
const DESTINATION_ID = '00000000-0000-4000-8000-000000000102';

function buildAccommodationRow(overrides: Record<string, unknown> = {}) {
    return {
        id: ACCOMMODATION_ID,
        name: 'Cabaña del Río',
        slug: 'cabana-del-rio',
        summary: 'Una cabaña frente al río Uruguay.',
        media: { featuredImage: { url: 'https://cdn.example.com/cabana.jpg' } },
        createdAt: new Date('2026-06-01T00:00:00Z'),
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        deletedAt: null,
        ...overrides
    };
}

function buildDestinationRow(overrides: Record<string, unknown> = {}) {
    return {
        id: DESTINATION_ID,
        name: 'Concepción del Uruguay',
        slug: 'concepcion-del-uruguay',
        summary: 'Ciudad histórica del Litoral entrerriano.',
        media: { featuredImage: { url: 'https://cdn.example.com/cdu.jpg' } },
        createdAt: new Date('2026-05-01T00:00:00Z'),
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        deletedAt: null,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

interface BuildServiceOptions {
    accommodationModel?: ReturnType<typeof createModelMock>;
    destinationModel?: ReturnType<typeof createModelMock>;
}

function buildService(opts: BuildServiceOptions = {}) {
    const accommodationModel =
        opts.accommodationModel ??
        (() => {
            const m = createModelMock();
            m.findAll.mockResolvedValue({ items: [buildAccommodationRow()], total: 1 });
            return m;
        })();

    const destinationModel =
        opts.destinationModel ??
        (() => {
            const m = createModelMock();
            m.findAll.mockResolvedValue({ items: [buildDestinationRow()], total: 1 });
            return m;
        })();

    const service = new SocialPublicDataService(
        accommodationModel as never,
        destinationModel as never
    );

    return { service, accommodationModel, destinationModel };
}

// ---------------------------------------------------------------------------
// Tests — getPublicData
// ---------------------------------------------------------------------------

describe('SocialPublicDataService.getPublicData', () => {
    describe('happy path', () => {
        it('should return accommodations and destinations shaped per SocialPublicDataItemSchema', async () => {
            // Arrange
            const { service } = buildService();

            // Act
            const result = await service.getPublicData();

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toHaveLength(2);

            const accommodationItem = result.data?.items.find(
                (i) => i.entityType === 'ACCOMMODATION'
            );
            expect(accommodationItem).toEqual({
                entityType: 'ACCOMMODATION',
                id: ACCOMMODATION_ID,
                title: 'Cabaña del Río',
                slug: 'cabana-del-rio',
                summary: 'Una cabaña frente al río Uruguay.',
                imageUrl: 'https://cdn.example.com/cabana.jpg'
            });

            const destinationItem = result.data?.items.find((i) => i.entityType === 'DESTINATION');
            expect(destinationItem).toEqual({
                entityType: 'DESTINATION',
                id: DESTINATION_ID,
                title: 'Concepción del Uruguay',
                slug: 'concepcion-del-uruguay',
                summary: 'Ciudad histórica del Litoral entrerriano.',
                imageUrl: 'https://cdn.example.com/cdu.jpg'
            });
        });

        it('should order merged items by recency (most recent first) across both entity types', async () => {
            // Arrange — destination is newer than accommodation this time
            const accommodationModel = createModelMock();
            accommodationModel.findAll.mockResolvedValue({
                items: [buildAccommodationRow({ createdAt: new Date('2026-01-01T00:00:00Z') })],
                total: 1
            });
            const destinationModel = createModelMock();
            destinationModel.findAll.mockResolvedValue({
                items: [buildDestinationRow({ createdAt: new Date('2026-06-15T00:00:00Z') })],
                total: 1
            });
            const { service } = buildService({ accommodationModel, destinationModel });

            // Act
            const result = await service.getPublicData();

            // Assert
            expect(result.data?.items.map((i) => i.entityType)).toEqual([
                'DESTINATION',
                'ACCOMMODATION'
            ]);
        });

        it('should map a null/missing media or summary to null (never throws)', async () => {
            // Arrange
            const accommodationModel = createModelMock();
            accommodationModel.findAll.mockResolvedValue({
                items: [buildAccommodationRow({ media: null, summary: null })],
                total: 1
            });
            const destinationModel = createModelMock();
            destinationModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ accommodationModel, destinationModel });

            // Act
            const result = await service.getPublicData();

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data?.items).toEqual([
                {
                    entityType: 'ACCOMMODATION',
                    id: ACCOMMODATION_ID,
                    title: 'Cabaña del Río',
                    slug: 'cabana-del-rio',
                    summary: null,
                    imageUrl: null
                }
            ]);
        });
    });

    describe('free-text query narrowing', () => {
        it('should forward an additional safeIlike condition to both models when query is provided', async () => {
            // Arrange
            const { service, accommodationModel, destinationModel } = buildService();
            const input: GetPublicDataInput = { query: 'río' };

            // Act
            await service.getPublicData(input);

            // Assert — third positional arg is the additionalConditions array
            const accommodationCall = accommodationModel.findAll.mock.calls[0];
            const destinationCall = destinationModel.findAll.mock.calls[0];
            expect(accommodationCall?.[2]).toBeDefined();
            expect(accommodationCall?.[2]).toHaveLength(1);
            expect(destinationCall?.[2]).toBeDefined();
            expect(destinationCall?.[2]).toHaveLength(1);
        });

        it('should NOT forward additional conditions when query is omitted', async () => {
            // Arrange
            const { service, accommodationModel, destinationModel } = buildService();

            // Act
            await service.getPublicData();

            // Assert
            const accommodationCall = accommodationModel.findAll.mock.calls[0];
            const destinationCall = destinationModel.findAll.mock.calls[0];
            expect(accommodationCall?.[2]).toBeUndefined();
            expect(destinationCall?.[2]).toBeUndefined();
        });

        it('should trim whitespace-only query to no-op (treated as omitted)', async () => {
            // Arrange
            const { service, accommodationModel } = buildService();

            // Act
            await service.getPublicData({ query: '   ' });

            // Assert
            const accommodationCall = accommodationModel.findAll.mock.calls[0];
            expect(accommodationCall?.[2]).toBeUndefined();
        });
    });

    describe('empty result set', () => {
        it('should return { items: [] } with no error when both models find nothing', async () => {
            // Arrange
            const accommodationModel = createModelMock();
            accommodationModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const destinationModel = createModelMock();
            destinationModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ accommodationModel, destinationModel });

            // Act
            const result = await service.getPublicData();

            // Assert
            expect(result.error).toBeUndefined();
            expect(result.data).toEqual({ items: [] });
        });
    });

    describe('error handling', () => {
        it('should return INTERNAL_ERROR when a model query throws unexpectedly', async () => {
            // Arrange
            const accommodationModel = createModelMock();
            accommodationModel.findAll.mockRejectedValue(new Error('db connection lost'));
            const destinationModel = createModelMock();
            destinationModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const { service } = buildService({ accommodationModel, destinationModel });

            // Act
            const result = await service.getPublicData();

            // Assert
            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('bounded limit', () => {
        it('should pass the clamped default pageSize (20) to both models when no limit is given', async () => {
            // Arrange
            const { service, accommodationModel, destinationModel } = buildService();

            // Act
            await service.getPublicData();

            // Assert
            expect(accommodationModel.findAll.mock.calls[0]?.[1]?.pageSize).toBe(20);
            expect(destinationModel.findAll.mock.calls[0]?.[1]?.pageSize).toBe(20);
        });

        it('should clamp an oversized caller-provided limit to the hard ceiling', async () => {
            // Arrange
            const { service, accommodationModel } = buildService();

            // Act
            await service.getPublicData({ limit: 9999 });

            // Assert
            const pageSize = accommodationModel.findAll.mock.calls[0]?.[1]?.pageSize as number;
            expect(pageSize).toBeLessThanOrEqual(50);
        });
    });
});
