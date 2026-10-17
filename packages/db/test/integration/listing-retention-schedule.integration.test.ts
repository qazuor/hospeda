import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { listingRetentionScheduleModel } from '../../src/models/listing/listing-retention-schedule.model.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

const verticals: readonly ListingVertical[] = ['accommodation', 'gastronomy', 'experience'];
const event = async (
    tx: DrizzleClient,
    vertical: ListingVertical,
    args: {
        readonly entityId: string;
        readonly entityType?: string;
        readonly actorType?: 'owner' | 'admin' | 'job';
        readonly eventType:
            | 'listing.created'
            | 'listing.edited'
            | 'listing.status_changed'
            | 'listing.fix_request_closed';
        readonly occurredAt: Date;
    }
) =>
    domainEventModel.insert({
        eventType: args.eventType,
        entityType: args.entityType ?? vertical,
        entityId: args.entityId,
        actorType: args.actorType ?? 'owner',
        actorId: randomUUID(),
        correlationId: randomUUID(),
        occurredAt: args.occurredAt,
        tx
    });

afterAll(async () => closeTestPool());

describe.each(verticals)('TEST:V9b:9 AC:V9b:9 owner act register reader: %s', (vertical) => {
    it('selects the latest owner create/edit event for exactly this vertical and listing', async () => {
        await withTestTransaction(async (tx) => {
            const read = (listingId: string) =>
                listingRetentionScheduleModel.readLastOwnerActAt({ tx, vertical, listingId });
            const record = (args: Parameters<typeof event>[2]) => event(tx, vertical, args);
            const emptyId = randomUUID();
            expect(await read(emptyId)).toBeNull();

            const beforeMergeId = randomUUID();
            const beforeMergeAt = new Date('2026-01-15T00:00:00.000Z');
            await record({
                entityId: beforeMergeId,
                eventType: 'listing.edited',
                occurredAt: beforeMergeAt
            });
            expect(await read(beforeMergeId)).toEqual(beforeMergeAt);

            const id = randomUUID();
            const firstAt = new Date('2026-02-01T00:00:00.000Z');
            const latestAt = new Date('2026-03-01T00:00:00.000Z');
            await record({ entityId: id, eventType: 'listing.created', occurredAt: firstAt });
            await record({ entityId: id, eventType: 'listing.edited', occurredAt: latestAt });
            await record({
                entityId: id,
                actorType: 'admin',
                eventType: 'listing.edited',
                occurredAt: new Date('2026-04-01T00:00:00.000Z')
            });
            await record({
                entityId: id,
                eventType: 'listing.status_changed',
                occurredAt: new Date('2026-05-01T00:00:00.000Z')
            });
            await record({
                entityId: id,
                actorType: 'job',
                eventType: 'listing.status_changed',
                occurredAt: new Date('2026-06-01T00:00:00.000Z')
            });
            await record({
                entityId: id,
                eventType: 'listing.fix_request_closed',
                occurredAt: new Date('2026-07-01T00:00:00.000Z')
            });
            await record({
                entityId: randomUUID(),
                eventType: 'listing.edited',
                occurredAt: new Date('2026-08-01T00:00:00.000Z')
            });
            const otherVertical = verticals.find((candidate) => candidate !== vertical)!;
            await record({
                entityId: id,
                entityType: otherVertical,
                eventType: 'listing.edited',
                occurredAt: new Date('2026-09-01T00:00:00.000Z')
            });
            expect(await read(id)).toEqual(latestAt);

            const createdId = randomUUID();
            await record({
                entityId: createdId,
                eventType: 'listing.created',
                occurredAt: firstAt
            });
            expect(await read(createdId)).toEqual(firstAt);
        });
    });
});
