import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    listSupportEdits,
    SUPPORT_EDITS_SHOWN
} from '../../../src/services/listing-publication/listing-support-edit.service';

const mocks = vi.hoisted(() => ({ findByEntity: vi.fn() }));
vi.mock('@repo/db', () => ({ domainEventModel: { findByEntity: mocks.findByEntity } }));
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

const LISTING = '33333333-3333-4333-8333-333333333333';

/** A domain-event row as `findByEntity` returns it (oldest first). */
function event(args: {
    readonly minute: number;
    readonly actorType: string;
    readonly eventType?: string;
    readonly fields: readonly string[];
}) {
    return {
        actorType: args.actorType,
        actorId: 'someone',
        eventType: args.eventType ?? 'listing.edited',
        reason: 'owner asked',
        occurredAt: new Date(Date.UTC(2026, 9, 12, 15, args.minute)),
        changes: args.fields.map((field) => ({ field }))
    };
}

describe('TEST:V8a:8 row 26 lists the support edits of a listing', () => {
    beforeEach(() => {
        mocks.findByEntity.mockReset();
    });

    it('returns only admin edits, newest first, with their parts and nothing else', async () => {
        // Arrange
        mocks.findByEntity.mockResolvedValue([
            event({
                minute: 1,
                actorType: 'admin',
                eventType: 'listing.created',
                fields: ['name']
            }),
            event({ minute: 2, actorType: 'owner', fields: ['description'] }),
            event({ minute: 3, actorType: 'admin', fields: ['media', 'description'] }),
            event({
                minute: 4,
                actorType: 'admin',
                eventType: 'listing.status_changed',
                fields: []
            })
        ]);

        // Act
        const result = await listSupportEdits({
            vertical: VerticalEnum.VENUE,
            listingId: LISTING
        });

        // Assert
        expect(mocks.findByEntity).toHaveBeenCalledWith({
            entityType: 'gastronomy',
            entityId: LISTING
        });
        expect(result).toEqual({
            items: [
                { occurredAt: '2026-10-12T15:03:00.000Z', parts: ['texts', 'photos'] },
                { occurredAt: '2026-10-12T15:01:00.000Z', parts: ['texts'] }
            ]
        });
    });

    it(`keeps only the ${SUPPORT_EDITS_SHOWN} most recent`, async () => {
        // Arrange
        mocks.findByEntity.mockResolvedValue(
            [1, 2, 3, 4, 5].map((minute) =>
                event({ minute, actorType: 'admin', fields: ['description'] })
            )
        );

        // Act
        const result = await listSupportEdits({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: LISTING
        });

        // Assert
        expect(result.items.map((item) => item.occurredAt)).toEqual([
            '2026-10-12T15:05:00.000Z',
            '2026-10-12T15:04:00.000Z',
            '2026-10-12T15:03:00.000Z'
        ]);
    });

    it('is empty when only the owner edited', async () => {
        // Arrange
        mocks.findByEntity.mockResolvedValue([
            event({ minute: 1, actorType: 'owner', fields: ['description'] })
        ]);

        // Act
        const result = await listSupportEdits({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: LISTING
        });

        // Assert
        expect(result).toEqual({ items: [] });
    });
});
