/**
 * A visibility-only PATCH of the WhatsApp setting still purges the public page
 * (HOS-2256).
 *
 * In "publico" mode the number is IN the edge-cached HTML, so changing the
 * setting must purge that page; otherwise a stale copy can keep a number the
 * owner just withdrew. Revalidation runs in the inherited `_afterUpdate` for
 * every successful update of a published venue, with no per-field filter, so
 * this pins that an update touching ONLY `whatsappVisibility` reaches it.
 *
 * @module test/services/venue/venue.whatsapp-revalidation
 */

import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockScheduleRevalidation } = vi.hoisted(() => ({
    mockScheduleRevalidation: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('../../../src/services/listing/listing-revalidation.js', () => ({
    scheduleListingRevalidation: mockScheduleRevalidation
}));
// HOS-1499: every listing write runs in a transaction and records the owner
// act; neither has a database here.
vi.mock('../../../src/utils/transaction', async () => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return { withServiceTransaction: vi.fn(doubles.fakeWithServiceTransaction) };
});
vi.mock('@repo/db', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        domainEventModel: doubles.domainEventModelDouble
    };
});

import type { QrCodeService } from '../../../src/services/qr-code/qr-code.service';
import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor } from '../../../src/types';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const VENUE_ID = getMockId('user', 'venue-wa-1');
const OWNER_ID = getMockId('user', 'owner-venue-wa-1');

const makeVenue = (overrides: Record<string, unknown> = {}) => ({
    id: VENUE_ID,
    name: 'La Parrilla del Sur',
    slug: 'la-parrilla-del-sur',
    type: 'PARRILLA',
    destinationId: getMockId('destination', 'dest-venue-wa-1'),
    ownerId: OWNER_ID,
    publicationStatus: PublicationStatusEnum.PUBLISHED,
    whatsappVisibility: 'PUBLIC',
    isFeatured: false,
    averageRating: 0,
    reviewsCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: OWNER_ID,
    updatedById: OWNER_ID,
    deletedAt: null,
    deletedById: null,
    ...overrides
});

type AnyService = any;

function buildService(input: {
    existing: Record<string, unknown>;
    updated: Record<string, unknown>;
}) {
    const model = {
        entityName: 'venue',
        findById: vi.fn().mockResolvedValue(input.existing),
        findByIds: vi.fn().mockResolvedValue([input.existing]),
        findOne: vi.fn().mockResolvedValue(null),
        findAll: vi.fn().mockResolvedValue({ items: [input.existing], total: 1 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        update: vi.fn().mockResolvedValue(input.updated),
        updateById: vi.fn().mockResolvedValue(input.updated),
        softDelete: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined),
        findWithRelations: vi.fn().mockResolvedValue(input.existing),
        findOneWithRelations: vi.fn().mockResolvedValue(input.existing),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
    const qr = {
        findLiveCodeForEntity: vi.fn().mockResolvedValue({ data: null, error: undefined }),
        setEntityTargetUrl: vi.fn()
    } as unknown as QrCodeService;
    const service: AnyService = new VenueService({ logger: createLoggerMock() }, undefined, qr);
    service.model = model;
    service._destinationModel = { findById: vi.fn().mockResolvedValue({ slug: 'destino-test' }) };
    return { service: service as VenueService, model };
}

const admin: Actor = {
    id: 'admin-uuid-1',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.VENUE_EDIT_ALL]
};

describe('VenueService - WhatsApp setting purges the public page (HOS-2256)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('schedules a revalidation when ONLY whatsappVisibility changes', async () => {
        const { service, model } = buildService({
            existing: makeVenue({ whatsappVisibility: 'PUBLIC' }),
            updated: makeVenue({ whatsappVisibility: 'LOGGED_IN_ONLY' })
        });

        const result = await service.update(admin, VENUE_ID, {
            whatsappVisibility: 'LOGGED_IN_ONLY'
        } as Parameters<typeof service.update>[2]);

        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalled();
        expect(mockScheduleRevalidation).toHaveBeenCalledOnce();
        expect(mockScheduleRevalidation.mock.calls[0]?.[0]).toMatchObject({
            entityType: 'venue',
            entity: expect.objectContaining({ id: VENUE_ID, whatsappVisibility: 'LOGGED_IN_ONLY' })
        });
    });
});
