/**
 * HOS-2327 — `update_listing_amenities`: the published input schema, refusal links, the audit and the pure set rules.
 *
 * Covers C-2 (flat schema), C-3 (audit), the AC-C4 link rule and `computeNextIds` / `findInvalidCatalogId`.
 *
 * Same harness as the other `update-listing-amenities` files: listing access
 * runs for real over mocked ports; services are spied on their prototypes.
 *
 * @module test/mcp/tools/listing/update-listing-amenities.input
 */

import { VerticalEnum } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildToolListEntry, handleMcpToolCall } from '../../../../src/lib/mcp/bind-tool';
import { buildMcpAuthInfo } from '../../../../src/lib/mcp/caller';
import type { CatalogRow } from '../../../../src/mcp/tools/listing/catalog-reader';
import {
    computeNextIds,
    findInvalidCatalogId,
    MAX_IDS_PER_CALL,
    updateListingAmenitiesTool
} from '../../../../src/mcp/tools/listing/update-listing-amenities';
import { clearSlidingWindowStore } from '../../../../src/middlewares/rate-limit';
import { env, validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    failureOf,
    givenCapability,
    givenCatalog,
    givenFacts,
    givenRelations,
    givenRow,
    KITCHEN_1,
    KITCHEN_2,
    KITCHEN_3,
    LISTING_ID,
    mocks,
    OTHER_ID,
    OWNER_ID,
    PARKING_1,
    SITE_URL,
    uuid,
    VIEW_1,
    writeSpy
} from './update-listing-amenities.harness';

vi.mock('../../../../src/utils/listing-access/ports', async () => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return {
        getListingAccessPorts: () => ({
            loadFacts: mocks.loadFacts,
            billing: { coverage: mocks.coverage },
            effectiveSet: mocks.effectiveSet,
            preTrialDraftLimits: mocks.preTrialDraftLimits
        })
    };
});

vi.mock('../../../../src/middlewares/cache', async (importOriginal) => {
    const { mocks } = await import('./update-listing-amenities.harness');
    const actual = await importOriginal<typeof import('../../../../src/middlewares/cache')>();
    return { ...actual, invalidateCacheByPathPrefix: mocks.invalidateCache };
});

vi.mock('../../../../src/lib/mcp/record-tool-call', async () => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return { recordMcpToolCall: mocks.record };
});

vi.mock('../../../../src/utils/accommodation-catalog-relations', async () => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return {
        fetchProtectedAmenities: mocks.accAmenities,
        fetchProtectedFeatures: mocks.accFeatures
    };
});

vi.mock('../../../../src/utils/listing-catalog-relations', async (importOriginal) => {
    const { mocks } = await import('./update-listing-amenities.harness');
    return {
        ...(await importOriginal<
            typeof import('../../../../src/utils/listing-catalog-relations')
        >()),
        fetchVenueAmenities: mocks.venueAmenities,
        fetchVenueFeatures: mocks.venueFeatures,
        fetchExperienceAmenities: mocks.expAmenities,
        fetchExperienceFeatures: mocks.expFeatures
    };
});

describe('update_listing_amenities', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.coverage.mockResolvedValue({ covered: true, sources: [{ type: 'BASE' }] });
        mocks.preTrialDraftLimits.mockResolvedValue(new Map());
        mocks.expAmenities.mockResolvedValue([]);
        mocks.expFeatures.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('input (C-2)', () => {
        const base = { vertical: VerticalEnum.ACCOMMODATION, id: LISTING_ID };

        it('rejects a call that adds and removes nothing', async () => {
            // Arrange
            const write = writeSpy(VerticalEnum.ACCOMMODATION);

            // Act
            const failure = await failureOf({ ...base, kind: 'amenity', category: 'KITCHEN' });

            // Assert
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain('indicá al menos un id');
            expect(write).not.toHaveBeenCalled();
            expect(mocks.loadFacts).not.toHaveBeenCalled();
        });

        it('rejects empty add and remove lists the same way', async () => {
            const failure = await failureOf({
                ...base,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [],
                remove: []
            });
            expect(failure.message).toContain('indicá al menos un id');
        });

        it('rejects an id that is both added and removed, naming it', async () => {
            const failure = await failureOf({
                ...base,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1],
                remove: [KITCHEN_1]
            });
            expect(failure.message).toContain(KITCHEN_1);
        });

        it('rejects a category that is not of the given kind', async () => {
            const failure = await failureOf({
                ...base,
                kind: 'feature',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });
            expect(failure.code).toBe('VALIDATION_ERROR');
            expect(failure.message).toContain('KITCHEN');
        });

        it('rejects a non-uuid id, an unknown category and too many ids', async () => {
            expect(
                (await failureOf({ ...base, kind: 'amenity', category: 'KITCHEN', add: ['x'] }))
                    .code
            ).toBe('VALIDATION_ERROR');
            expect(
                (await failureOf({ ...base, kind: 'amenity', category: 'NOPE', add: [KITCHEN_1] }))
                    .code
            ).toBe('VALIDATION_ERROR');
            const many = Array.from({ length: MAX_IDS_PER_CALL + 1 }, (_, i) => uuid('b', i % 10));
            expect(
                (await failureOf({ ...base, kind: 'amenity', category: 'KITCHEN', add: many })).code
            ).toBe('VALIDATION_ERROR');
        });

        it('rejects fields it does not know (strict)', async () => {
            const failure = await failureOf({
                ...base,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1],
                amenityIds: [KITCHEN_1]
            });
            expect(failure.code).toBe('VALIDATION_ERROR');
        });

        it('publishes one flat object schema MCP clients accept', () => {
            // Arrange
            const entry = buildToolListEntry({ definition: updateListingAmenitiesTool });

            // Assert
            const schema = entry.inputSchema as Record<string, unknown>;
            expect(schema.type).toBe('object');
            expect(schema).not.toHaveProperty('oneOf');
            expect(schema).not.toHaveProperty('anyOf');
            expect(schema).not.toHaveProperty('allOf');
            expect(schema.additionalProperties).toBe(false);
            expect(schema.required).toEqual(['vertical', 'id', 'kind', 'category']);
            expect(entry.annotations).toMatchObject({
                readOnlyHint: false,
                idempotentHint: true,
                destructiveHint: false
            });
        });

        it('points amenity edits here from its own description', () => {
            expect(updateListingAmenitiesTool.description).toContain('get_listing_amenities');
            expect(updateListingAmenitiesTool.description).toContain('update_listing_basic');
        });
    });

    describe('refusal link and audit', () => {
        const actor = actorFor(OWNER_ID);
        const ctx = {
            http: {
                authInfo: buildMcpAuthInfo({
                    token: 'tok',
                    actor,
                    mcpAuth: {
                        userId: OWNER_ID,
                        clientId: 'https://chatgpt.com/oauth/client',
                        clientName: 'ChatGPT',
                        scopes: ['openid']
                    },
                    resourceUrl: 'https://api.test/mcp'
                })
            }
        };
        const call = (input: Record<string, unknown>) =>
            handleMcpToolCall({ definition: updateListingAmenitiesTool, input, ctx });
        let originalSiteUrl: string;

        beforeEach(() => {
            clearSlidingWindowStore();
            originalSiteUrl = env.HOSPEDA_SITE_URL;
            env.HOSPEDA_SITE_URL = SITE_URL;
            givenFacts(VerticalEnum.ACCOMMODATION);
            givenCapability(VerticalEnum.ACCOMMODATION, true);
            givenRow(VerticalEnum.ACCOMMODATION);
            givenCatalog();
        });

        afterEach(() => {
            env.HOSPEDA_SITE_URL = originalSiteUrl;
        });

        it('links a refused id to the services section of the listing editor', async () => {
            // Arrange
            writeSpy(VerticalEnum.ACCOMMODATION);
            givenRelations({
                vertical: VerticalEnum.ACCOMMODATION,
                before: { amenities: [], features: [] }
            });

            // Act
            const result = await call({
                vertical: 'accommodation',
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [PARKING_1]
            });

            // Assert
            expect(result.isError).toBe(true);
            expect(result.structuredContent).toMatchObject({
                action: {
                    url: `${SITE_URL}/es/mi-cuenta/propiedades/${LISTING_ID}/editar/servicios/`
                }
            });
        });

        it('links a foreign listing to the owner list only, never to its editor (AC-C4)', async () => {
            // Arrange
            givenFacts(VerticalEnum.ACCOMMODATION, OTHER_ID);
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: { id: LISTING_ID, ownerId: OTHER_ID, name: 'Ajena', slug: 'a' }
            } as never);

            // Act
            const result = await call({
                vertical: 'accommodation',
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1]
            });

            // Assert
            expect(result.structuredContent).toMatchObject({
                action: { url: `${SITE_URL}/es/mi-cuenta/propiedades/` }
            });
            expect(JSON.stringify(result)).not.toContain(LISTING_ID);
        });

        it('records a success with the listing target and counts, never the ids (C-3)', async () => {
            // Arrange
            writeSpy(VerticalEnum.ACCOMMODATION);
            givenRelations({
                vertical: VerticalEnum.ACCOMMODATION,
                before: { amenities: [], features: [] }
            });

            // Act
            await call({
                vertical: 'accommodation',
                id: LISTING_ID,
                kind: 'amenity',
                category: 'KITCHEN',
                add: [KITCHEN_1, KITCHEN_2],
                remove: [KITCHEN_3]
            });

            // Assert
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    tool: 'update_listing_amenities',
                    outcome: 'success',
                    target: { type: 'accommodation', id: LISTING_ID },
                    details: { kind: 'amenity', category: 'KITCHEN', added: 2, removed: 1 }
                })
            );
            expect(JSON.stringify(mocks.record.mock.calls)).not.toContain(KITCHEN_1);
        });

        it('records a foreign listing as denied, with its target', async () => {
            // Arrange
            givenFacts(VerticalEnum.ACCOMMODATION, OTHER_ID);
            vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
                data: { id: LISTING_ID, ownerId: OTHER_ID, name: 'Ajena', slug: 'a' }
            } as never);

            // Act
            await call({
                vertical: 'accommodation',
                id: LISTING_ID,
                kind: 'feature',
                category: 'VIEW',
                add: [VIEW_1]
            });

            // Assert
            expect(mocks.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    outcome: 'denied',
                    errorCode: 'NOT_FOUND',
                    target: { type: 'accommodation', id: LISTING_ID }
                })
            );
        });
    });
});

describe('computeNextIds', () => {
    it('removes, adds and carries every other id over untouched', () => {
        expect(
            computeNextIds({
                current: ['k1', 'k2', 'p1', 'v1'],
                add: ['k3'],
                remove: ['k1']
            })
        ).toEqual(['k2', 'p1', 'v1', 'k3']);
    });

    it('does not duplicate an id that is already there and ignores removing one that is not', () => {
        expect(
            computeNextIds({ current: ['k1'], add: ['k1', 'k2', 'k2'], remove: ['zz'] })
        ).toEqual(['k1', 'k2']);
    });

    it('can empty the set', () => {
        expect(computeNextIds({ current: ['a'], add: [], remove: ['a'] })).toEqual([]);
    });
});

describe('findInvalidCatalogId', () => {
    const rows: CatalogRow[] = [
        { id: 'k1', slug: 'oven', category: 'KITCHEN' },
        { id: 'p1', slug: 'parking', category: 'PARKING' }
    ];
    const base = {
        rows,
        kind: 'amenity',
        category: 'KITCHEN',
        vertical: VerticalEnum.VENUE
    } as const;

    it('accepts ids that are rows of the category', () => {
        expect(findInvalidCatalogId({ ...base, add: ['k1'], remove: [] })).toBeUndefined();
    });

    it('names an id missing from the vertical catalog and the field it came in', () => {
        expect(findInvalidCatalogId({ ...base, add: [], remove: ['zz'] })).toMatchObject({
            field: 'remove',
            message: expect.stringContaining('zz')
        });
    });

    it('names an id of another category and says which', () => {
        const invalid = findInvalidCatalogId({ ...base, add: ['p1'], remove: [] });
        expect(invalid?.field).toBe('add');
        expect(invalid?.message).toContain('p1');
        expect(invalid?.message).toContain('Estacionamiento');
    });
});
