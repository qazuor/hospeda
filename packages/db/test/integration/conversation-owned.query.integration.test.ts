import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { findOwnedConversationById } from '../../src/models/conversation/conversation-owned.query.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { conversations } from '../../src/schemas/conversation/conversations.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function seed(tx: DrizzleClient) {
    const owner = testData.user();
    const guest = testData.user();
    const destination = testData.destination();
    await tx.insert(users).values([owner, guest]);
    await tx.insert(destinations).values(destination);
    const accommodation = await new AccommodationModel().create(
        {
            name: `Owned fixture ${crypto.randomUUID()}`,
            slug: `owned-${crypto.randomUUID()}`,
            summary: 'summary',
            description: 'description',
            type: 'CABIN',
            ownerId: owner.id,
            destinationId: destination.id
        } as never,
        tx
    );
    const [conversation] = await tx
        .insert(conversations)
        .values({ accommodationId: accommodation.id, userId: guest.id })
        .returning({ id: conversations.id });
    return { owner, guest, accommodation, conversationId: conversation!.id };
}

describe('findOwnedConversationById (real query)', () => {
    it('returns the conversation for its owner', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, conversationId } = await seed(tx);

            const row = await findOwnedConversationById({
                db: tx,
                conversationId,
                ownerId: owner.id
            });

            expect(row?.id).toBe(conversationId);
        });
    });

    it('returns null for a different owner', async () => {
        await withTestTransaction(async (tx) => {
            const { guest, conversationId } = await seed(tx);

            const row = await findOwnedConversationById({
                db: tx,
                conversationId,
                ownerId: guest.id
            });

            expect(row).toBeNull();
        });
    });

    it('returns null when the conversation is soft-deleted', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, conversationId } = await seed(tx);
            await tx
                .update(conversations)
                .set({ deletedAt: new Date() })
                .where(eq(conversations.id, conversationId));

            const row = await findOwnedConversationById({
                db: tx,
                conversationId,
                ownerId: owner.id
            });

            expect(row).toBeNull();
        });
    });

    it('returns null when the accommodation is soft-deleted', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation, conversationId } = await seed(tx);
            await tx
                .update(accommodations)
                .set({ deletedAt: new Date() })
                .where(eq(accommodations.id, accommodation.id));

            const row = await findOwnedConversationById({
                db: tx,
                conversationId,
                ownerId: owner.id
            });

            expect(row).toBeNull();
        });
    });
});
