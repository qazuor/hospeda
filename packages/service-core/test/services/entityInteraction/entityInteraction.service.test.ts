import type { EntityInteractionModel, VenueEventModel, VenueModel } from '@repo/db';
import { EntityInteractionKindEnum, EntityTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type CaptureInteractionInput,
    EntityInteractionService
} from '../../../src/services/entityInteraction/entityInteraction.service';

const VENUE_ID = '550e8400-e29b-41d4-a716-446655440000';
const EVENT_ID = '660e8400-e29b-41d4-a716-446655440000';
const OWNER_ID = '770e8400-e29b-41d4-a716-446655440000';

const publishedVenue = {
    id: VENUE_ID,
    ownerId: OWNER_ID,
    publicationStatus: 'PUBLISHED',
    deletedAt: null
};

describe('EntityInteractionService.capture', () => {
    const insertInteraction = vi.fn();
    const findVenue = vi.fn();
    const findEvent = vi.fn();
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
    let service: EntityInteractionService;

    const input: CaptureInteractionInput = {
        entityType: EntityTypeEnum.VENUE,
        entityId: VENUE_ID,
        kind: EntityInteractionKindEnum.PHONE_CLICK,
        visitorHash: 'hash',
        actorUserId: null
    };

    beforeEach(() => {
        vi.clearAllMocks();
        insertInteraction.mockResolvedValue({ id: 'row' });
        findVenue.mockResolvedValue(publishedVenue);
        findEvent.mockResolvedValue({ id: EVENT_ID });
        service = new EntityInteractionService({
            logger: logger as never,
            model: { insertInteraction } as unknown as EntityInteractionModel,
            venueModel: { findOne: findVenue } as unknown as VenueModel,
            eventModel: { findOne: findEvent } as unknown as VenueEventModel
        });
    });

    it('inserts a row for a published venue (AC-1)', async () => {
        const result = await service.capture(input);

        expect(result).toEqual({ recorded: true });
        expect(insertInteraction).toHaveBeenCalledWith({
            entityType: 'VENUE',
            entityId: VENUE_ID,
            kind: 'PHONE_CLICK',
            eventId: undefined,
            visitorHash: 'hash'
        });
    });

    it('stores the event id of a ticket click when the event belongs to the venue (AC-4)', async () => {
        const result = await service.capture({
            ...input,
            kind: EntityInteractionKindEnum.TICKET_CLICK,
            eventId: EVENT_ID
        });

        expect(result).toEqual({ recorded: true });
        expect(findEvent).toHaveBeenCalledWith({ id: EVENT_ID, venueId: VENUE_ID });
        expect(insertInteraction).toHaveBeenCalledWith(
            expect.objectContaining({ eventId: EVENT_ID })
        );
    });

    it('drops an event of another venue without inserting (AC-4)', async () => {
        findEvent.mockResolvedValue(null);

        const result = await service.capture({
            ...input,
            kind: EntityInteractionKindEnum.TICKET_CLICK,
            eventId: EVENT_ID
        });

        expect(result).toEqual({ recorded: false, reason: 'EVENT_NOT_OF_LISTING' });
        expect(insertInteraction).not.toHaveBeenCalled();
    });

    it.each([
        ['does not exist', null, 'LISTING_NOT_FOUND'],
        ['is soft deleted', { ...publishedVenue, deletedAt: new Date() }, 'LISTING_NOT_FOUND'],
        ['is a draft', { ...publishedVenue, publicationStatus: 'DRAFT' }, 'LISTING_NOT_PUBLISHED']
    ])('drops the interaction when the venue %s (AC-7)', async (_n, venue, reason) => {
        findVenue.mockResolvedValue(venue);

        const result = await service.capture(input);

        expect(result).toEqual({ recorded: false, reason });
        expect(insertInteraction).not.toHaveBeenCalled();
    });

    it("drops the owner's own interaction (AC-8)", async () => {
        const result = await service.capture({ ...input, actorUserId: OWNER_ID });

        expect(result).toEqual({ recorded: false, reason: 'OWNER_INTERACTION' });
        expect(insertInteraction).not.toHaveBeenCalled();
    });

    it('counts a logged-in visitor who is not the owner', async () => {
        const result = await service.capture({ ...input, actorUserId: 'someone-else' });

        expect(result).toEqual({ recorded: true });
    });

    it('returns a typed DB_ERROR, logs without the visitor hash, and never throws (AC-9)', async () => {
        insertInteraction.mockRejectedValue(new Error('db down'));

        const result = await service.capture(input);

        expect(result).toEqual({ recorded: false, reason: 'DB_ERROR' });
        expect(logger.error).toHaveBeenCalledOnce();
        expect(JSON.stringify(logger.error.mock.calls)).not.toContain('hash"');
    });
});
