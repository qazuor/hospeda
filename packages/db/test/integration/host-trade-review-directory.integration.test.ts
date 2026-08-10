/**
 * `HostTradeReviewModel.findAllWithAuthorAndReply` — the directory read
 * (HOS-376 T-036).
 *
 * WHY THIS IS AN INTEGRATION TEST AND NOT A MOCKED ONE. The property worth
 * proving is a JOIN predicate, and a mocked model cannot have one: an
 * unapproved reply must remove the ANSWER and leave the REVIEW standing.
 * Written as a `WHERE` instead of a join condition — the obvious and wrong way
 * — the same rule drops the review as well, silently hiding a complaint
 * because the provider's answer to it is still in the moderation queue. Both
 * versions type-check, both satisfy every unit test that asserts on the `where`
 * object, and only real SQL tells them apart.
 *
 * @module test/integration/host-trade-review-directory
 */

import { afterAll, describe, expect, it } from 'vitest';
import { HostTradeReviewModel } from '../../src/models/hostTrade/host-trade-review.model.ts';
import {
    destinations,
    hostTradeReviewReplies,
    hostTradeReviews,
    hostTrades,
    users
} from '../../src/schemas/index.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => {
    await closeTestPool();
});

const model = new HostTradeReviewModel();

type TestTx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

/** A host, a provider listing, and one APPROVED review by that host. */
async function seedReviewedListing(tx: TestTx, options: { hostDisplayName?: string } = {}) {
    const uid = crypto.randomUUID().slice(0, 8);

    const [host] = await tx
        .insert(users)
        .values(testData.user({ displayName: options.hostDisplayName ?? `Anfitrion ${uid}` }))
        .returning();
    if (!host) throw new Error('Failed to insert host');

    const [provider] = await tx
        .insert(users)
        .values(testData.user({ displayName: `Proveedor ${uid}` }))
        .returning();
    if (!provider) throw new Error('Failed to insert provider');

    const [destination] = await tx
        .insert(destinations)
        .values(testData.destination({ ownerId: provider.id }))
        .returning();
    if (!destination) throw new Error('Failed to insert destination');

    const [listing] = await tx
        .insert(hostTrades)
        .values({
            slug: `plomeria-${uid}`,
            name: `Plomeria ${uid}`,
            category: 'PLOMERIA',
            contact: '+54 9 3442 000000',
            benefit: '10% de descuento para anfitriones',
            destinationId: destination.id,
            ownerUserId: provider.id
        })
        .returning();
    if (!listing) throw new Error('Failed to insert host trade');

    const [review] = await tx
        .insert(hostTradeReviews)
        .values({
            hostTradeId: listing.id,
            hostUserId: host.id,
            overallRating: 5,
            respectedBenefit: true,
            content: 'Vino el mismo dia y respeto el descuento.',
            moderationState: 'APPROVED'
        })
        .returning();
    if (!review) throw new Error('Failed to insert review');

    return { host, provider, listing, review };
}

/** The filters the service forces for a directory read. */
const directoryWhere = (hostTradeId: string) => ({
    hostTradeId,
    moderationState: 'APPROVED',
    deletedAt: null
});

describe('HostTradeReviewModel.findAllWithAuthorAndReply', () => {
    it('returns an approved review with its approved reply', async () => {
        await withTestTransaction(async (tx) => {
            const { listing, review, provider } = await seedReviewedListing(tx);

            await tx.insert(hostTradeReviewReplies).values({
                reviewId: review.id,
                authorUserId: provider.id,
                content: 'Gracias por la confianza.',
                moderationState: 'APPROVED'
            });

            const { items, total } = await model.findAllWithAuthorAndReply(
                directoryWhere(listing.id),
                { page: 1, pageSize: 10 },
                tx
            );

            expect(items).toHaveLength(1);
            expect(total).toBe(1);
            expect(items[0]?.reply?.content).toBe('Gracias por la confianza.');
        });
    });

    /**
     * THE ONE THAT MATTERS. A reply awaiting moderation must not drag the
     * review it answers out of the directory with it — that would let a
     * provider bury a complaint simply by replying to it.
     */
    it('hides a pending reply and KEEPS the review it answers', async () => {
        await withTestTransaction(async (tx) => {
            const { listing, review, provider } = await seedReviewedListing(tx);

            await tx.insert(hostTradeReviewReplies).values({
                reviewId: review.id,
                authorUserId: provider.id,
                content: 'La senora de Alberdi 300 me hizo ir tres veces.',
                moderationState: 'PENDING'
            });

            const { items } = await model.findAllWithAuthorAndReply(
                directoryWhere(listing.id),
                { page: 1, pageSize: 10 },
                tx
            );

            expect(items).toHaveLength(1);
            expect(items[0]?.review.id).toBe(review.id);
            expect(items[0]?.reply).toBeNull();
        });
    });

    it('hides a rejected reply and keeps the review', async () => {
        await withTestTransaction(async (tx) => {
            const { listing, review, provider } = await seedReviewedListing(tx);

            await tx.insert(hostTradeReviewReplies).values({
                reviewId: review.id,
                authorUserId: provider.id,
                content: 'Texto que un moderador bajo.',
                moderationState: 'REJECTED'
            });

            const { items } = await model.findAllWithAuthorAndReply(
                directoryWhere(listing.id),
                { page: 1, pageSize: 10 },
                tx
            );

            expect(items).toHaveLength(1);
            expect(items[0]?.reply).toBeNull();
        });
    });

    it('hides a soft-deleted reply and keeps the review', async () => {
        await withTestTransaction(async (tx) => {
            const { listing, review, provider } = await seedReviewedListing(tx);

            await tx.insert(hostTradeReviewReplies).values({
                reviewId: review.id,
                authorUserId: provider.id,
                content: 'Respuesta borrada.',
                moderationState: 'APPROVED',
                deletedAt: new Date()
            });

            const { items } = await model.findAllWithAuthorAndReply(
                directoryWhere(listing.id),
                { page: 1, pageSize: 10 },
                tx
            );

            expect(items).toHaveLength(1);
            expect(items[0]?.reply).toBeNull();
        });
    });

    /**
     * The `where` is applied verbatim — which reviews are publishable is the
     * service's decision, not this method's. Proven by handing it the filters
     * the service forces and checking a PENDING review does not come back.
     */
    it('applies the caller’s filters verbatim, so a pending review is excluded', async () => {
        await withTestTransaction(async (tx) => {
            const { listing, host } = await seedReviewedListing(tx);

            const [otherHost] = await tx.insert(users).values(testData.user({})).returning();
            if (!otherHost) throw new Error('Failed to insert second host');

            await tx.insert(hostTradeReviews).values({
                hostTradeId: listing.id,
                hostUserId: otherHost.id,
                overallRating: 1,
                respectedBenefit: false,
                content: 'Texto que la moderacion automatica marco.',
                moderationState: 'PENDING'
            });

            const { items, total } = await model.findAllWithAuthorAndReply(
                directoryWhere(listing.id),
                { page: 1, pageSize: 10 },
                tx
            );

            expect(items).toHaveLength(1);
            expect(total).toBe(1);
            expect(items[0]?.review.hostUserId).toBe(host.id);
        });
    });

    it('joins the author so the directory can name who wrote it', async () => {
        await withTestTransaction(async (tx) => {
            const { listing } = await seedReviewedListing(tx, { hostDisplayName: 'Marta Gimenez' });

            const { items } = await model.findAllWithAuthorAndReply(
                directoryWhere(listing.id),
                { page: 1, pageSize: 10 },
                tx
            );

            expect(items[0]?.author?.displayName).toBe('Marta Gimenez');
        });
    });
});
