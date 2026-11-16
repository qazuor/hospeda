/**
 * HOS-2184 T-013 — `list_my_listings`: the caller's listings across the three
 * verticals, through the same service calls the protected "list own" routes
 * make. The services are spied on their prototypes (no whole-module mock) and
 * answer from one shared dataset holding two owners' rows, filtered the way
 * the real services scope (`ownerId = actor.id`).
 *
 * @module test/mcp/tools/listing/list-my-listings
 */

import { PublicationStatusEnum, ServiceErrorCode } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    ExperienceService,
    ServiceError,
    VenueService
} from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    LIST_MY_LISTINGS_PAGE_SIZE,
    listMyListingsTool
} from '../../../../src/mcp/tools/listing/list-my-listings';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { TOOL_UNEXPECTED_ERROR_MESSAGE } from '../../../../src/mcp/tools/tool-errors';

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const OTHER_ID = '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const EMPTY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const context = { channel: 'mcp' } as const;

const actorFor = (id: string, emailVerified = true): Actor =>
    ({ id, roles: ['HOST'], permissions: [], emailVerified }) as unknown as Actor;

interface Row {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly publicationStatus: PublicationStatusEnum;
}

const ACCOMMODATIONS: readonly Row[] = [
    {
        id: 'a1111111-1111-4111-8111-111111111111',
        ownerId: OWNER_ID,
        name: 'Cabañas del Río',
        publicationStatus: PublicationStatusEnum.PUBLISHED
    },
    {
        id: 'a2222222-2222-4222-8222-222222222222',
        ownerId: OTHER_ID,
        name: 'Hotel Ajeno',
        publicationStatus: PublicationStatusEnum.PUBLISHED
    }
];
const VENUES: readonly Row[] = [
    {
        id: 'b1111111-1111-4111-8111-111111111111',
        ownerId: OWNER_ID,
        name: 'La Parrilla',
        publicationStatus: PublicationStatusEnum.DRAFT
    },
    {
        id: 'b2222222-2222-4222-8222-222222222222',
        ownerId: OTHER_ID,
        name: 'Bar Ajeno',
        publicationStatus: PublicationStatusEnum.PUBLISHED
    }
];
const EXPERIENCES: readonly Row[] = [
    {
        id: 'c1111111-1111-4111-8111-111111111111',
        ownerId: OWNER_ID,
        name: 'Paseo en kayak',
        publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
    },
    {
        id: 'c2222222-2222-4222-8222-222222222222',
        ownerId: OTHER_ID,
        name: 'Excursión Ajena',
        publicationStatus: PublicationStatusEnum.PUBLISHED
    }
];

const ownedBy = (rows: readonly Row[], ownerId: unknown) =>
    rows.filter((row) => row.ownerId === ownerId);

type AccListResult = Awaited<ReturnType<AccommodationService['list']>>;
type VenueListOwnResult = Awaited<ReturnType<VenueService['listOwn']>>;
type ExpListOwnResult = Awaited<ReturnType<ExperienceService['listOwn']>>;

describe('list_my_listings', () => {
    let accList: ReturnType<typeof vi.spyOn>;
    let venueListOwn: ReturnType<typeof vi.spyOn>;
    let expListOwn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        accList = vi
            .spyOn(AccommodationService.prototype, 'list')
            .mockImplementation(async (_actor, params) => {
                const where = (params as { where?: { ownerId?: unknown } }).where;
                const items = ownedBy(ACCOMMODATIONS, where?.ownerId);
                return { data: { items, total: items.length } } as unknown as AccListResult;
            });
        venueListOwn = vi.spyOn(VenueService.prototype, 'listOwn').mockImplementation(
            async (actor) =>
                ({
                    data: { listings: ownedBy(VENUES, actor.id) }
                }) as unknown as VenueListOwnResult
        );
        expListOwn = vi.spyOn(ExperienceService.prototype, 'listOwn').mockImplementation(
            async (actor) =>
                ({
                    data: { listings: ownedBy(EXPERIENCES, actor.id) }
                }) as unknown as ExpListOwnResult
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('is a read-only tool available to unverified emails as READ_OWN', () => {
        // Assert
        expect(listMyListingsTool.name).toBe('list_my_listings');
        expect(listMyListingsTool.isWrite).toBe(false);
        expect(listMyListingsTool.emailUnverifiedOperation).toBe('READ_OWN');
    });

    it("returns only the actor's listings, in all three verticals", async () => {
        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome).toEqual({
            ok: true,
            data: {
                listings: [
                    {
                        id: 'a1111111-1111-4111-8111-111111111111',
                        vertical: 'accommodation',
                        name: 'Cabañas del Río',
                        publicationStatus: PublicationStatusEnum.PUBLISHED
                    },
                    {
                        id: 'b1111111-1111-4111-8111-111111111111',
                        vertical: 'venue',
                        name: 'La Parrilla',
                        publicationStatus: PublicationStatusEnum.DRAFT
                    },
                    {
                        id: 'c1111111-1111-4111-8111-111111111111',
                        vertical: 'experience',
                        name: 'Paseo en kayak',
                        publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                    }
                ],
                total: 3,
                hasMore: false
            }
        });
    });

    it('scopes every service call to the actor', async () => {
        // Arrange
        const actor = actorFor(OWNER_ID);

        // Act
        await runTool({ definition: listMyListingsTool, actor, input: {}, context });

        // Assert
        expect(accList).toHaveBeenCalledWith(actor, {
            page: 1,
            pageSize: LIST_MY_LISTINGS_PAGE_SIZE,
            where: { ownerId: OWNER_ID },
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
        expect(venueListOwn).toHaveBeenCalledWith(actor);
        expect(expListOwn).toHaveBeenCalledWith(actor);
    });

    it("excludes another user's listings", async () => {
        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OTHER_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(true);
        const names = outcome.ok ? outcome.data.listings.map((l) => l.name) : [];
        expect(names).toEqual(['Hotel Ajeno', 'Bar Ajeno', 'Excursión Ajena']);
        expect(names).not.toContain('Cabañas del Río');
    });

    it('returns an empty list for an account with no listings', async () => {
        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(EMPTY_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome).toEqual({ ok: true, data: { listings: [], total: 0, hasMore: false } });
    });

    it('serves an unverified email (READ_OWN is allowed)', async () => {
        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID, false),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(true);
    });

    it('rejects unexpected arguments', async () => {
        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: { ownerId: OTHER_ID },
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
        expect(outcome.ok ? undefined : outcome.failure.code).toBe(
            ServiceErrorCode.VALIDATION_ERROR
        );
        expect(accList).not.toHaveBeenCalled();
    });

    it('does not count when no vertical page is full', async () => {
        // Arrange
        const venueCount = vi.spyOn(VenueService.prototype, 'countOwn');
        const expCount = vi.spyOn(ExperienceService.prototype, 'countOwn');

        // Act
        await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert
        expect(venueCount).not.toHaveBeenCalled();
        expect(expCount).not.toHaveBeenCalled();
    });

    it('reports hasMore and the real total when the venue page is full', async () => {
        // Arrange
        const full = Array.from({ length: LIST_MY_LISTINGS_PAGE_SIZE }, (_, i) => ({
            id: `v-${i}`,
            ownerId: OWNER_ID,
            name: `Venue ${i}`,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        }));
        venueListOwn.mockResolvedValueOnce({
            data: { listings: full }
        } as unknown as VenueListOwnResult);
        vi.spyOn(VenueService.prototype, 'countOwn').mockResolvedValue({
            data: { count: 130 }
        } as never);

        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert: 1 accommodation + 100 venues + 1 experience of 132 owned
        expect(outcome.ok).toBe(true);
        const data = outcome.ok ? outcome.data : undefined;
        expect(data?.listings).toHaveLength(102);
        expect(data?.total).toBe(132);
        expect(data?.hasMore).toBe(true);
    });

    it('reports hasMore false when a full page is exactly everything', async () => {
        // Arrange
        const full = Array.from({ length: LIST_MY_LISTINGS_PAGE_SIZE }, (_, i) => ({
            id: `e-${i}`,
            ownerId: OWNER_ID,
            name: `Exp ${i}`,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        }));
        expListOwn.mockResolvedValueOnce({
            data: { listings: full }
        } as unknown as ExpListOwnResult);
        vi.spyOn(ExperienceService.prototype, 'countOwn').mockResolvedValue({
            data: { count: LIST_MY_LISTINGS_PAGE_SIZE }
        } as never);

        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok ? outcome.data.hasMore : undefined).toBe(false);
    });

    it('reports hasMore when accommodations exceed the page', async () => {
        // Arrange
        accList.mockResolvedValueOnce({
            data: { items: ownedBy(ACCOMMODATIONS, OWNER_ID), total: 140 }
        } as unknown as AccListResult);

        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok ? outcome.data.total : undefined).toBe(142);
        expect(outcome.ok ? outcome.data.hasMore : undefined).toBe(true);
    });

    it('fails the call when the count behind a full page fails', async () => {
        // Arrange
        venueListOwn.mockResolvedValueOnce({
            data: {
                listings: Array.from({ length: LIST_MY_LISTINGS_PAGE_SIZE }, (_, i) => ({
                    id: `v-${i}`,
                    name: 'x',
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                }))
            }
        } as unknown as VenueListOwnResult);
        vi.spyOn(VenueService.prototype, 'countOwn').mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'db down')
        } as never);

        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
    });

    it('fails the whole call when one vertical fails, instead of a partial list', async () => {
        // Arrange
        venueListOwn.mockResolvedValueOnce({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'db down')
        } as unknown as VenueListOwnResult);

        // Act
        const outcome = await runTool({
            definition: listMyListingsTool,
            actor: actorFor(OWNER_ID),
            input: {},
            context
        });

        // Assert
        expect(outcome.ok).toBe(false);
        expect(outcome.ok ? undefined : outcome.failure.message).toBe(
            TOOL_UNEXPECTED_ERROR_MESSAGE
        );
    });
});
