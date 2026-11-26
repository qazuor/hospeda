/**
 * Venue on-save AI translation (HOS-2658, AC-1/AC-2, spec §8.6).
 *
 * `BaseListingService` fires ONE billed translate call after a write: every
 * non-empty Spanish source on create, only the changed ones on update, and
 * nothing when no source changed or the translation service is not set up.
 *
 * @module test/services/venue/translation-on-save
 */

import { PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('../../../src/services/listing/listing-revalidation.js', () => ({
    scheduleListingRevalidation: vi.fn().mockResolvedValue(undefined)
}));
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
import {
    _resetTranslationService,
    initializeTranslationService
} from '../../../src/translation/translation-init';
import type { Actor } from '../../../src/types';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';

const VENUE_ID = getMockId('user', 'venue-tr-1');
const OWNER_ID = getMockId('user', 'owner-venue-tr-1');

const makeVenue = (overrides: Record<string, unknown> = {}) => ({
    id: VENUE_ID,
    name: 'La Parrilla del Sur',
    summary: 'Asado a la leña',
    description: 'Parrilla frente al río',
    richDescription: null,
    slug: 'la-parrilla-del-sur',
    type: 'PARRILLA',
    destinationId: getMockId('destination', 'dest-venue-tr-1'),
    ownerId: OWNER_ID,
    publicationStatus: PublicationStatusEnum.DRAFT,
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

// biome-ignore lint/suspicious/noExplicitAny: test seam over protected members
type AnyService = any;

function buildService(input: {
    existing: Record<string, unknown>;
    updated: Record<string, unknown>;
}): { service: AnyService } {
    const model = {
        entityName: 'venue',
        findById: vi.fn().mockResolvedValue(input.existing),
        findOne: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(input.updated),
        updateById: vi.fn().mockResolvedValue(input.updated)
    };
    const qr = {
        findLiveCodeForEntity: vi.fn().mockResolvedValue({ data: null, error: undefined }),
        setEntityTargetUrl: vi.fn()
    } as unknown as QrCodeService;
    const service: AnyService = new VenueService({ logger: createLoggerMock() }, undefined, qr);
    service.model = model;
    service._destinationModel = { findById: vi.fn().mockResolvedValue({ slug: 'destino-test' }) };
    return { service };
}

const admin: Actor = {
    id: 'admin-uuid-tr',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.VENUE_EDIT_ALL]
};

describe('VenueService — on-save translation (HOS-2658)', () => {
    let translateMock: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        translateMock = vi.fn().mockResolvedValue(undefined);
        initializeTranslationService({ translate: translateMock });
    });

    afterEach(() => {
        _resetTranslationService();
    });

    it('update: fires once with only the changed source and the owner billing', async () => {
        // Arrange
        const before = makeVenue();
        const after = makeVenue({ description: 'Parrilla y vinos frente al río' });
        const { service } = buildService({ existing: before, updated: after });

        // Act
        const result = await service.update(admin, VENUE_ID, {
            description: 'Parrilla y vinos frente al río'
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(translateMock).toHaveBeenCalledTimes(1);
        expect(translateMock).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: VENUE_ID,
            fields: { description: 'Parrilla y vinos frente al río' },
            billing: { vertical: 'venue', ownerId: OWNER_ID }
        });
    });

    it('update: fires nothing when no Spanish source changed', async () => {
        // Arrange
        const before = makeVenue();
        const { service } = buildService({
            existing: before,
            updated: makeVenue({ type: 'BAR' })
        });

        // Act
        const result = await service.update(admin, VENUE_ID, { name: 'La Parrilla del Sur' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(translateMock).not.toHaveBeenCalled();
    });

    it('create: fires once with every non-empty source and the owner billing', async () => {
        // Arrange
        const created = makeVenue({ richDescription: '## Menú' });
        const { service } = buildService({ existing: created, updated: created });

        // Act
        await service._afterCreate(created, admin, { hookState: {} });

        // Assert
        expect(translateMock).toHaveBeenCalledTimes(1);
        expect(translateMock).toHaveBeenCalledWith({
            entityType: 'venue',
            entityId: VENUE_ID,
            fields: {
                name: 'La Parrilla del Sur',
                summary: 'Asado a la leña',
                description: 'Parrilla frente al río',
                richDescription: '## Menú'
            },
            billing: { vertical: 'venue', ownerId: OWNER_ID }
        });
    });

    it('does not throw when the translation service is not initialized', async () => {
        // Arrange
        _resetTranslationService();
        const before = makeVenue();
        const { service } = buildService({
            existing: before,
            updated: makeVenue({ name: 'Otro nombre' })
        });

        // Act
        const result = await service.update(admin, VENUE_ID, { name: 'Otro nombre' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(translateMock).not.toHaveBeenCalled();
    });

    it('swallows a rejected translate call (fire-and-forget)', async () => {
        // Arrange
        translateMock.mockRejectedValue(new Error('provider down'));
        const { service } = buildService({
            existing: makeVenue(),
            updated: makeVenue({ summary: 'Nuevo resumen' })
        });

        // Act
        const result = await service.update(admin, VENUE_ID, { summary: 'Nuevo resumen' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(translateMock).toHaveBeenCalledTimes(1);
    });
});
