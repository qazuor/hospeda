import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { conversationModel } from '../../src/models/conversation/conversation.model.ts';
import { conversations } from '../../src/schemas/conversation/conversations.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('ConversationModel.countCreatedSince (real query)', () => {
    it('counts recent live conversations only and is 0 for no accommodations', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const guestA = testData.user();
            const guestB = testData.user();
            const guestC = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values([owner, guestA, guestB, guestC]);
            await tx.insert(destinations).values(destination);
            const accommodation = await new AccommodationModel().create(
                {
                    name: `Counts fixture ${crypto.randomUUID()}`,
                    slug: `counts-${crypto.randomUUID()}`,
                    summary: 'summary',
                    description: 'description',
                    type: 'CABIN',
                    ownerId: owner.id,
                    destinationId: destination.id
                } as never,
                tx
            );
            const old = new Date('2020-01-01T00:00:00Z');
            const [recent, deleted] = await tx
                .insert(conversations)
                .values([
                    { accommodationId: accommodation.id, userId: guestA.id },
                    { accommodationId: accommodation.id, userId: guestB.id }
                ])
                .returning({ id: conversations.id });
            await tx
                .insert(conversations)
                .values({ accommodationId: accommodation.id, userId: guestC.id, createdAt: old });
            await tx
                .update(conversations)
                .set({ deletedAt: new Date() })
                .where(eq(conversations.id, deleted!.id));
            expect(recent).toBeDefined();

            const since = new Date('2025-01-01T00:00:00Z');

            expect(await conversationModel.countCreatedSince([accommodation.id], since, tx)).toBe(
                1
            );
            expect(await conversationModel.countCreatedSince([], since, tx)).toBe(0);
        });
    });
});
