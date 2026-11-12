import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { orderRestorationCandidates } from '../../src/publication/publication-order';
import { publishListing } from '../../src/publication/publish-listing';
import {
    at,
    clock,
    emailPseudonym,
    event,
    listingId,
    makeHarness,
    userId,
    vertical
} from './support';

function input(harness: ReturnType<typeof makeHarness>, actorId?: string) {
    return {
        ...harness,
        clock,
        userId,
        ...(actorId ? { actorId } : {}),
        vertical,
        listingId,
        event,
        emailPseudonym,
        correlationId: listingId
    };
}

describe('HOS-2001 PB1 only lets the owner publish, so the owner event is always the owner', () => {
    it('an actor other than the owner is refused NOT_OWNER and writes nothing', async () => {
        // Arrange
        const harness = makeHarness();

        // Act
        const result = await publishListing(input(harness, 'admin-actor'));

        // Assert
        expect(result).toEqual({ published: false, reason: 'NOT_OWNER' });
        expect(harness.statusWrites).toEqual([]);
        expect(harness.statusEvents).toEqual([]);
        expect(harness.getStatus()).toBe(PublicationStatusEnum.DRAFT);
    });

    it('the owner as actor publishes and the event records the owner', async () => {
        // Arrange
        const harness = makeHarness();

        // Act
        const result = await publishListing(input(harness, userId));

        // Assert
        expect(result).toMatchObject({ published: true });
        expect(harness.statusEvents).toHaveLength(1);
        expect(harness.statusEvents[0]).toMatchObject({ actorType: 'owner', actorId: userId });
    });

    it("no actorId keeps today's behaviour", async () => {
        // Arrange
        const harness = makeHarness();

        // Act
        const result = await publishListing(input(harness));

        // Assert
        expect(result).toMatchObject({ published: true });
        expect(harness.statusEvents[0]).toMatchObject({ actorType: 'owner', actorId: userId });
    });

    it('a refused foreign actor does not change the restoration order', async () => {
        // Arrange
        const first = { id: 'listing-a', createdAt: at, publishedAt: new Date(at.getTime() + 1) };
        const second = { id: 'listing-b', createdAt: at, publishedAt: new Date(at.getTime() + 2) };
        const entries = [first, second];
        const before = orderRestorationCandidates({ entries });
        const harness = makeHarness({ status: PublicationStatusEnum.DRAFT });

        // Act
        const result = await publishListing(input(harness, 'foreign-actor'));
        const after = orderRestorationCandidates({ entries });

        // Assert
        expect(result).toEqual({ published: false, reason: 'NOT_OWNER' });
        expect(after).toEqual(before);
        expect(harness.statusEvents).toEqual([]);
    });
});
