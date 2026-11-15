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
                ]
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
        expect(outcome).toEqual({ ok: true, data: { listings: [] } });
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
