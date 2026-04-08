/**
 * service-hooks.test.ts
 *
 * Unit tests verifying that CRUD lifecycle hooks (_afterCreate, _afterUpdate,
 * _afterSoftDelete, _afterHardDelete, _afterRestore) call
 * `getRevalidationService()?.scheduleRevalidation()` with the correct entity type
 * and optional context fields (slug, category, tagSlugs, accommodationType, destinationSlug).
 *
 * Covers 4 representative services: accommodation, destination, event, tag.
 * The pattern is identical across all 8 services — exhaustive coverage of all 8
 * would be redundant.
 *
 * Key behaviours under test:
 *  1. `scheduleRevalidation` is called with the right `entityType` after create/update.
 *  2. `scheduleRevalidation` is called (without `entitySlug`) after soft/hard delete.
 *  3. `scheduleRevalidation` is called with correct context after restore.
 *  4. Optional context fields (slug, category, tagSlugs, etc.) are passed correctly.
 *  5. Optional chaining — if `getRevalidationService()` returns `undefined` no error is thrown.
 *  6. Fire-and-forget — the hook does NOT await the revalidation result (the service
 *     method resolves even when `scheduleRevalidation` is a no-op async function).
 */

import { EventModel, REntityTagModel, TagModel } from '@repo/db';
import type { AccommodationModel, DestinationModel } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accommodationHelpers from '../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../src/services/accommodation/accommodation.service';
import { DestinationService } from '../../src/services/destination/destination.service';
import { EventService } from '../../src/services/event/event.service';
import { TagService } from '../../src/services/tag/tag.service';
import {
    createMockAccommodation,
    createMockAccommodationCreateInput
} from '../factories/accommodationFactory';
import { createActor, createAdminActor } from '../factories/actorFactory';
import { createMockBaseModel } from '../factories/baseServiceFactory';
import { createMockDestination } from '../factories/destinationFactory';
import { createEventUpdateInput, createMockEvent } from '../factories/eventFactory';
import { TagFactoryBuilder } from '../factories/tagFactory';
import { createLoggerMock, createTypedModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';

// ---------------------------------------------------------------------------
// Mock the revalidation singleton.
// vi.mock is hoisted by Vitest before imports, but its factory must be
// self-contained (cannot reference outer-scope variables).
// We use vi.fn() inside the factory and expose a module-level reference via
// `getRevalidationService` which we cast and configure in each beforeEach.
// ---------------------------------------------------------------------------

vi.mock('../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(),
    initializeRevalidationService: vi.fn(),
    _resetRevalidationService: vi.fn()
}));

import { getRevalidationService } from '../../src/revalidation/revalidation-init.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const mockLogger = createLoggerMock();

/** A fresh scheduleRevalidation spy shared across tests in each describe block. */
let mockScheduleRevalidation: ReturnType<typeof vi.fn>;

/**
 * Resets all mock call counts between tests and configures `getRevalidationService`
 * to return a stub with a fresh `scheduleRevalidation` spy.
 */
function resetMocks(): void {
    vi.clearAllMocks();
    mockScheduleRevalidation = vi.fn();
    asMock(getRevalidationService).mockReturnValue({
        scheduleRevalidation: mockScheduleRevalidation
    });
}

// ===========================================================================
// AccommodationService
// ===========================================================================

describe('AccommodationService — revalidation hooks', () => {
    let service: AccommodationService;
    let model: ReturnType<typeof createMockBaseModel>;

    beforeEach(() => {
        resetMocks();
        vi.spyOn(accommodationHelpers, 'generateSlug').mockResolvedValue('mock-slug');
        model = createMockBaseModel();
        service = new AccommodationService({ logger: mockLogger }, model as AccommodationModel);
        // Prevent the internal DestinationService from calling the real DB
        // in _afterCreate and _afterSoftDelete.
        // @ts-expect-error: private field override for test isolation
        service.destinationService = {
            updateAccommodationsCount: vi.fn().mockResolvedValue(undefined)
        };
        // Prevent _destinationModel from calling the real DB in _resolveDestinationSlug.
        // @ts-expect-error: private field override for test isolation
        service._destinationModel = {
            findById: vi.fn().mockResolvedValue({ slug: 'mock-destination' })
        };
    });

    it('calls scheduleRevalidation with entityType "accommodation" after _afterCreate', async () => {
        const actor = createAdminActor();
        const mockAccommodation = createMockAccommodation({ slug: 'hotel-test' });
        const createInput = createMockAccommodationCreateInput({ slug: 'hotel-test' });
        asMock(model.create).mockResolvedValue(mockAccommodation);

        // createMockAccommodationCreateInput includes all required fields (destinationId, etc.)
        const result = await service.create(actor, createInput);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'accommodation' })
        );
    });

    it('passes slug and accommodationType to scheduleRevalidation after _afterCreate', async () => {
        const actor = createAdminActor();
        const mockAccommodation = createMockAccommodation({
            slug: 'hotel-test',
            type: 'HOTEL' as import('@repo/schemas').AccommodationTypeEnum
        });
        const createInput = createMockAccommodationCreateInput({ slug: 'hotel-test' });
        asMock(model.create).mockResolvedValue(mockAccommodation);

        await service.create(actor, createInput);

        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: 'accommodation',
                slug: 'hotel-test',
                accommodationType: 'hotel'
            })
        );
    });

    it('calls scheduleRevalidation with entityType "accommodation" after _afterUpdate', async () => {
        const actor = createAdminActor();
        const id = 'acc-update-id';
        const existing = createMockAccommodation({ id, slug: 'hotel-test', deletedAt: undefined });
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.update).mockResolvedValue({ ...existing, name: 'New Name' });

        const result = await service.update(actor, id, { name: 'New Name' });

        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'accommodation' })
        );
    });

    it('calls scheduleRevalidation with entityType "accommodation" after _afterSoftDelete', async () => {
        const actor = createAdminActor();
        const id = 'acc-softdelete-id';
        asMock(model.findById).mockResolvedValue(
            createMockAccommodation({ id, deletedAt: undefined })
        );
        asMock(model.softDelete).mockResolvedValue(1);

        const result = await service.softDelete(actor, id);

        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'accommodation' })
        );
    });

    it('calls scheduleRevalidation with entityType "accommodation" after restore', async () => {
        const actor = createActor({ permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY] });
        const id = 'acc-restore-id';
        const existing = createMockAccommodation({ id, slug: 'hotel-test', deletedAt: new Date() });
        // _beforeRestore calls findById to capture slug/type/destinationId
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.restore).mockResolvedValue(1);

        const result = await service.restore(actor, id);

        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'accommodation', slug: 'hotel-test' })
        );
    });

    it('does NOT throw when getRevalidationService() returns undefined (optional chaining)', async () => {
        // Arrange — simulate the service not yet initialized
        asMock(getRevalidationService).mockReturnValue(undefined);
        const actor = createAdminActor();
        const id = 'acc-no-revalidation-id';
        const existing = createMockAccommodation({ id, slug: 'hotel-test', deletedAt: undefined });
        const updated = { ...existing, name: 'Safe Update' };
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.update).mockResolvedValue(updated);

        // Act & Assert — must resolve without throwing
        const result = await service.update(actor, id, { name: 'Safe Update' });
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// DestinationService
// ===========================================================================

describe('DestinationService — revalidation hooks', () => {
    let service: DestinationService;
    let model: ReturnType<typeof createMockBaseModel>;

    beforeEach(() => {
        resetMocks();
        model = createMockBaseModel();
        service = new DestinationService({ logger: mockLogger }, model as DestinationModel);
    });

    it('calls scheduleRevalidation with entityType "destination" after _afterCreate', async () => {
        // Arrange
        const actor = createActor({
            permissions: [PermissionEnum.DESTINATION_CREATE]
        });
        const mockDestination = createMockDestination({ slug: 'test-city' });
        // _beforeCreate calls model.findById to resolve parent — null means no parent
        asMock(model.findById).mockResolvedValue(null);
        asMock(model.create).mockResolvedValue(mockDestination);

        // Act
        const result = await service.create(actor, {
            slug: 'test-city',
            name: 'Test City',
            summary: 'A test city',
            description: 'A test city for unit testing purposes.',
            visibility: mockDestination.visibility,
            lifecycleState: mockDestination.lifecycleState,
            moderationState: mockDestination.moderationState,
            isFeatured: false,
            destinationType: mockDestination.destinationType,
            averageRating: undefined,
            accommodationsCount: 0,
            location: mockDestination.location ?? {
                state: 'Buenos Aires',
                country: 'Argentina',
                zipCode: 'C1000',
                coordinates: { lat: '-34', long: '-58' }
            }
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'destination' })
        );
    });

    it('calls scheduleRevalidation with entityType "destination" after _afterUpdate', async () => {
        // Arrange
        const actor = createActor({
            permissions: [PermissionEnum.DESTINATION_UPDATE]
        });
        const id = 'dest-update-id';
        const existing = createMockDestination({ id, slug: 'test-city', deletedAt: undefined });
        const updated = { ...existing, name: 'Updated City' };
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.update).mockResolvedValue(updated);

        // Act
        const result = await service.update(actor, id, { name: 'Updated City' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'destination' })
        );
    });

    it('calls scheduleRevalidation with entityType "destination" after _afterSoftDelete', async () => {
        // Arrange
        const actor = createActor({
            permissions: [PermissionEnum.DESTINATION_DELETE]
        });
        const id = 'dest-softdelete-id';
        const existing = createMockDestination({ id, deletedAt: undefined });
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.softDelete).mockResolvedValue(1);

        // Act
        const result = await service.softDelete(actor, id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'destination' })
        );
    });

    it('calls scheduleRevalidation with entityType "destination" and slug after restore', async () => {
        // Arrange
        const actor = createActor({
            permissions: [PermissionEnum.DESTINATION_RESTORE]
        });
        const id = 'dest-restore-id';
        const existing = createMockDestination({ id, slug: 'test-city', deletedAt: new Date() });
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.restore).mockResolvedValue(1);

        // Act
        const result = await service.restore(actor, id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'destination', slug: 'test-city' })
        );
    });

    it('does NOT throw when getRevalidationService() returns undefined (optional chaining)', async () => {
        // Arrange
        asMock(getRevalidationService).mockReturnValue(undefined);
        const actor = createActor({
            permissions: [PermissionEnum.DESTINATION_UPDATE]
        });
        const id = 'dest-no-revalidation-id';
        const existing = createMockDestination({ id, slug: 'test-city', deletedAt: undefined });
        const updated = { ...existing, name: 'Safe Update' };
        asMock(model.findById).mockResolvedValue(existing);
        asMock(model.update).mockResolvedValue(updated);

        // Act & Assert
        const result = await service.update(actor, id, { name: 'Safe Update' });
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// EventService
// ===========================================================================

describe('EventService — revalidation hooks', () => {
    let service: EventService;
    let modelMock: EventModel;

    beforeEach(() => {
        resetMocks();
        // EventService takes the model via ctx.model (not as a second constructor arg)
        modelMock = createTypedModelMock(EventModel, [
            'create',
            'findById',
            'findOne',
            'update',
            'softDelete',
            'restore'
        ]);
        service = new EventService({ model: modelMock, logger: mockLogger });
    });

    it('calls scheduleRevalidation with entityType "event" after _afterCreate', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.EVENT_CREATE] });
        const mockEvent = createMockEvent({ slug: 'festival-test' });
        asMock(modelMock.findOne).mockResolvedValue(null); // slug uniqueness check in _beforeCreate
        asMock(modelMock.create).mockResolvedValue(mockEvent);

        // Act
        const result = await service.create(actor, {
            slug: mockEvent.slug,
            name: mockEvent.name,
            summary: mockEvent.summary ?? 'Test event',
            description: mockEvent.description ?? 'A test event description for validation',
            category: mockEvent.category,
            date: mockEvent.date,
            authorId: mockEvent.authorId,
            locationId: mockEvent.locationId,
            organizerId: mockEvent.organizerId,
            visibility: mockEvent.visibility,
            lifecycleState: mockEvent.lifecycleState,
            moderationState: mockEvent.moderationState,
            isFeatured: false
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'event' })
        );
    });

    it('calls scheduleRevalidation with entityType "event" after _afterUpdate', async () => {
        // Arrange — use createEventUpdateInput which includes category+date needed for slug regen
        const actor = createActor({ permissions: [PermissionEnum.EVENT_UPDATE] });
        const id = 'event-update-id';
        const existing = createMockEvent({ id, slug: 'festival-test', deletedAt: undefined });
        const updateInput = createEventUpdateInput();
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.update).mockResolvedValue({ ...existing, ...updateInput });
        // _beforeUpdate calls generateEventSlug which calls EventModel.prototype.findOne
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);

        // Act
        const result = await service.update(actor, id, updateInput);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'event' })
        );
    });

    it('calls scheduleRevalidation with entityType "event" after _afterSoftDelete', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.EVENT_DELETE] });
        const id = 'event-softdelete-id';
        const existing = createMockEvent({ id, deletedAt: undefined });
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.softDelete).mockResolvedValue(1);

        // Act
        const result = await service.softDelete(actor, id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'event' })
        );
    });

    it('passes category to scheduleRevalidation after _afterCreate', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.EVENT_CREATE] });
        const mockEvent = createMockEvent({
            slug: 'festival-test',
            category: 'FESTIVAL' as import('@repo/schemas').EventCategoryEnum
        });
        asMock(modelMock.findOne).mockResolvedValue(null);
        asMock(modelMock.create).mockResolvedValue(mockEvent);

        // Act
        const result = await service.create(actor, {
            slug: mockEvent.slug,
            name: mockEvent.name,
            summary: mockEvent.summary ?? 'Test event',
            description: mockEvent.description ?? 'A test event description for validation',
            category: mockEvent.category,
            date: mockEvent.date,
            authorId: mockEvent.authorId,
            locationId: mockEvent.locationId,
            organizerId: mockEvent.organizerId,
            visibility: mockEvent.visibility,
            lifecycleState: mockEvent.lifecycleState,
            moderationState: mockEvent.moderationState,
            isFeatured: false
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({
                entityType: 'event',
                slug: 'festival-test',
                category: 'festival'
            })
        );
    });

    it('calls scheduleRevalidation with entityType "event" and slug after restore', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.EVENT_RESTORE] });
        const id = 'event-restore-id';
        const existing = createMockEvent({ id, slug: 'festival-test', deletedAt: new Date() });
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.restore).mockResolvedValue(1);

        // Act
        const result = await service.restore(actor, id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'event', slug: 'festival-test' })
        );
    });

    it('does NOT throw when getRevalidationService() returns undefined (optional chaining)', async () => {
        // Arrange
        asMock(getRevalidationService).mockReturnValue(undefined);
        const actor = createActor({ permissions: [PermissionEnum.EVENT_UPDATE] });
        const id = 'event-no-revalidation-id';
        const existing = createMockEvent({ id, slug: 'festival-test', deletedAt: undefined });
        const updateInput = createEventUpdateInput();
        asMock(modelMock.findById).mockResolvedValue(existing);
        asMock(modelMock.update).mockResolvedValue({ ...existing, ...updateInput });
        vi.spyOn(EventModel.prototype, 'findOne').mockResolvedValue(null);

        // Act & Assert
        const result = await service.update(actor, id, updateInput);
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// TagService
// ===========================================================================

describe('TagService — revalidation hooks', () => {
    let service: TagService;
    let tagModelMock: TagModel;

    beforeEach(() => {
        resetMocks();
        tagModelMock = createTypedModelMock(TagModel, [
            'create',
            'findById',
            'findOne',
            'update',
            'softDelete',
            'hardDelete',
            'restore'
        ]);
        service = new TagService({ logger: mockLogger }, tagModelMock, new REntityTagModel());
    });

    it('calls scheduleRevalidation with entityType "tag" after _afterCreate', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.TAG_CREATE] });
        const mockTag = TagFactoryBuilder.create({ slug: 'test-tag', name: 'Test Tag' });
        asMock(tagModelMock.findOne).mockResolvedValue(null); // slug uniqueness check
        asMock(tagModelMock.create).mockResolvedValue(mockTag);

        // Act
        const result = await service.create(actor, {
            name: mockTag.name,
            slug: mockTag.slug,
            color: mockTag.color,
            lifecycleState: mockTag.lifecycleState
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'tag' })
        );
    });

    it('calls scheduleRevalidation with entityType "tag" after _afterUpdate', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
        const mockTag = TagFactoryBuilder.create({ slug: 'test-tag', deletedAt: undefined });
        const updated = { ...mockTag, name: 'Updated Tag' };
        asMock(tagModelMock.findById).mockResolvedValue(mockTag);
        asMock(tagModelMock.update).mockResolvedValue(updated);

        // Act
        const result = await service.update(actor, mockTag.id, { name: 'Updated Tag' });

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'tag' })
        );
    });

    it('calls scheduleRevalidation with entityType "tag" after _afterSoftDelete', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.TAG_DELETE] });
        const mockTag = TagFactoryBuilder.create({ deletedAt: undefined });
        asMock(tagModelMock.findById).mockResolvedValue(mockTag);
        asMock(tagModelMock.softDelete).mockResolvedValue(1);

        // Act
        const result = await service.softDelete(actor, mockTag.id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'tag' })
        );
    });

    it('calls scheduleRevalidation with entityType "tag" after _afterHardDelete (fire-and-forget)', async () => {
        // Arrange — explicitly tests the hard-delete path
        // TAG_HARD_DELETE does not exist; the service reuses TAG_DELETE for hard deletes.
        const actor = createActor({ permissions: [PermissionEnum.TAG_DELETE] });
        const mockTag = TagFactoryBuilder.create({ deletedAt: undefined });
        asMock(tagModelMock.findById).mockResolvedValue(mockTag);
        asMock(tagModelMock.hardDelete).mockResolvedValue(1);

        // Act
        const result = await service.hardDelete(actor, mockTag.id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'tag' })
        );
    });

    it('calls scheduleRevalidation with entityType "tag" after restore', async () => {
        // Arrange — TagService uses TAG_UPDATE permission for restore (no dedicated TAG_RESTORE)
        const actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
        const mockTag = TagFactoryBuilder.create({ deletedAt: new Date() });
        asMock(tagModelMock.findById).mockResolvedValue(mockTag);
        asMock(tagModelMock.restore).mockResolvedValue(1);

        // Act
        const result = await service.restore(actor, mockTag.id);

        // Assert
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'tag' })
        );
    });

    it('does NOT throw when getRevalidationService() returns undefined (optional chaining)', async () => {
        // Arrange
        asMock(getRevalidationService).mockReturnValue(undefined);
        const actor = createActor({ permissions: [PermissionEnum.TAG_UPDATE] });
        const mockTag = TagFactoryBuilder.create({ slug: 'test-tag', deletedAt: undefined });
        const updated = { ...mockTag, name: 'Safe Update' };
        asMock(tagModelMock.findById).mockResolvedValue(mockTag);
        asMock(tagModelMock.update).mockResolvedValue(updated);

        // Act & Assert
        const result = await service.update(actor, mockTag.id, { name: 'Safe Update' });
        expect(result.error).toBeUndefined();
        expect(mockScheduleRevalidation).not.toHaveBeenCalled();
    });
});
