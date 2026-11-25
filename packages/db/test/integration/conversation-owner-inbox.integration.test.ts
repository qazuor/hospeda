import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { conversationModel } from '../../src/models/conversation/conversation.model.ts';
import { conversations } from '../../src/schemas/conversation/conversations.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

describe('ConversationModel owner inbox (HOS-2615)', () => {
    it('hides PENDING_VERIFICATION rows from items, total and counters, and sorts NULLS LAST', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const guests = [testData.user(), testData.user(), testData.user(), testData.user()];
            const destination = testData.destination();
            await tx.insert(users).values([owner, ...guests]);
            await tx.insert(destinations).values(destination);
            const accommodation = await new AccommodationModel().create(
                {
                    name: `Inbox fixture ${crypto.randomUUID()}`,
                    slug: `inbox-${crypto.randomUUID()}`,
                    summary: 'summary',
                    description: 'description',
                    type: 'CABIN',
                    ownerId: owner.id,
                    destinationId: destination.id
                } as never,
                tx
            );
            const accId = accommodation.id;
            const [older, noDate, unverified, newer] = await tx
                .insert(conversations)
                .values([
                    {
                        accommodationId: accId,
                        userId: guests[0]!.id,
                        status: 'OPEN',
                        lastActivityAt: new Date('2026-01-01T00:00:00Z')
                    },
                    {
                        accommodationId: accId,
                        userId: guests[1]!.id,
                        status: 'OPEN',
                        lastActivityAt: null
                    },
                    {
                        accommodationId: accId,
                        userId: guests[2]!.id,
                        status: 'PENDING_VERIFICATION',
                        lastActivityAt: new Date('2026-06-01T00:00:00Z')
                    },
                    {
                        accommodationId: accId,
                        userId: guests[3]!.id,
                        status: 'PENDING_OWNER',
                        lastActivityAt: new Date('2026-03-01T00:00:00Z')
                    }
                ])
                .returning({ id: conversations.id });

            const page = await conversationModel.listByAccommodationIds(
                [accId],
                { page: 1, pageSize: 20 },
                tx
            );

            expect(page.total).toBe(3);
            expect(page.items.map((c) => c.id)).toEqual([newer!.id, older!.id, noDate!.id]);
            expect(page.items.map((c) => c.id)).not.toContain(unverified!.id);

            const since = new Date('2020-01-01T00:00:00Z');
            expect(await conversationModel.countCreatedSince([accId], since, tx)).toBe(3);

            // Verification flips the row to PENDING_OWNER: it now shows up.
            await tx
                .update(conversations)
                .set({ status: 'PENDING_OWNER' })
                .where(eq(conversations.id, unverified!.id));
            const after = await conversationModel.listByAccommodationIds(
                [accId],
                { page: 1, pageSize: 20 },
                tx
            );
            expect(after.total).toBe(4);
            expect(after.items[0]!.id).toBe(unverified!.id);
        });
    });
});
