import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { listingPublicationModel, trials } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../src/publication/archive-inactive-listing';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { runDailyCoverageReconciler } from '../../src/publication/coverage-reconciler';
import { reactivateListing } from '../../src/publication/reactivate-listing';
import { seedPublicationListing, seedPublicationOwner } from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';
import { createReconcilerTestPorts } from './support/reconciler-test-ports';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
const at = new Date('2026-10-11T12:00:00.000Z');
const clock = { now: () => new Date(at) };
const vertical = VerticalEnum.ACCOMMODATION;
const table = 'accommodations';
const afterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};

afterAll(async () => pool.end());

async function setStatus(listingId: string, status: PublicationStatusEnum, inactiveSince: Date) {
    await db.execute(
        sql`UPDATE accommodations SET publication_status = ${status}, inactive_since = ${inactiveSince}, deadlines_version = 1 WHERE id = ${listingId}`
    );
}

async function archive(args: {
    userId: string;
    listingId: string;
    status: PublicationStatusEnum;
    start: Date;
}) {
    await setStatus(args.listingId, args.status, args.start);
    const adapter = createPublicationTestAdapter({
        db,
        covered: { value: false },
        limit: { value: 3 }
    });
    return archiveInactiveListing({
        ...adapter,
        afterCommit,
        clock,
        vertical,
        listingId: args.listingId,
        ownerId: args.userId,
        correlationId: randomUUID()
    });
}

async function statusOf(listingId: string) {
    const result = await db.execute(
        sql`SELECT publication_status, inactive_since, deletion_announced_at FROM ${sql.identifier(table)} WHERE id = ${listingId}`
    );
    const row = result.rows[0];
    return row
        ? {
              publication_status: String(row.publication_status),
              inactive_since: new Date(String(row.inactive_since)),
              deletion_announced_at: row.deletion_announced_at
                  ? new Date(String(row.deletion_announced_at))
                  : null
          }
        : undefined;
}

describe('TEST:V6:10 PB8 and PB7 integration', () => {
    it('TEST:V6:10 PB8 returns PB4 and PB5 archives to DRAFT with owner events and no revalidation', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const pb4 = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const pb5 = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        const pb4Result = await archive({
            userId,
            listingId: pb4.id,
            status: PublicationStatusEnum.PUBLISHED,
            start: new Date(at.getTime() - 100 * 86_400_000)
        });
        const pb5Result = await archive({
            userId,
            listingId: pb5.id,
            status: PublicationStatusEnum.DRAFT,
            start: new Date('2026-05-01T00:00:00Z')
        });
        expect(pb4Result).toMatchObject({ archived: true, transition: 'PB4' });
        expect(pb5Result).toMatchObject({ archived: true, transition: 'PB5' });
        afterCommit.revalidate.mockClear();
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 0 }
        });
        for (const listing of [pb4, pb5]) {
            expect(
                await reactivateListing({
                    ...adapter,
                    afterCommit,
                    clock,
                    userId,
                    vertical,
                    listingId: listing.id,
                    correlationId: randomUUID()
                })
            ).toEqual({ reactivated: true });
            expect(await statusOf(listing.id)).toMatchObject({
                publication_status: 'DRAFT',
                inactive_since: at
            });
            const events = await db.execute(
                sql`SELECT changes->0->>'old' AS old, changes->0->>'new' AS new, actor_type FROM domain_event WHERE entity_type = 'accommodation' AND entity_id = ${listing.id} AND changes @> '[{"field":"publicationStatus","old":"ARCHIVED","new":"DRAFT"}]'::jsonb`
            );
            expect(events.rows[0]).toMatchObject({
                old: 'ARCHIVED',
                new: 'DRAFT',
                actor_type: 'owner'
            });
        }
        expect(afterCommit.revalidate).not.toHaveBeenCalled();
    });

    it('TEST:V6:10 PB7 returns only public-origin archives and does not start a trial', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const pb4 = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const pb5 = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.DRAFT
        });
        await listingPublicationModel.insertStatusChangedEvent({
            tx: db,
            vertical,
            listingId: pb4.id,
            from: PublicationStatusEnum.DRAFT,
            to: PublicationStatusEnum.PUBLISHED,
            actorType: 'owner',
            actorId: userId,
            correlationId: randomUUID(),
            occurredAt: new Date('2026-01-01T00:00:00Z')
        });
        expect(
            (
                await archive({
                    userId,
                    listingId: pb4.id,
                    status: PublicationStatusEnum.PUBLISHED,
                    start: new Date(at.getTime() - 100 * 86_400_000)
                })
            ).archived
        ).toBe(true);
        expect(
            (
                await archive({
                    userId,
                    listingId: pb5.id,
                    status: PublicationStatusEnum.DRAFT,
                    start: new Date('2026-05-01T00:00:00Z')
                })
            ).archived
        ).toBe(true);
        const trialsBefore = await db.select().from(trials).where(eq(trials.userId, userId));
        const activatedBefore = await listingPublicationModel.hasOwnerPublished({
            tx: db,
            vertical,
            userId
        });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 2 }
        });
        const result = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(result.restoredFromArchived).toEqual([pb4.id]);
        expect(await statusOf(pb4.id)).toMatchObject({
            publication_status: 'PUBLISHED',
            inactive_since: at
        });
        expect((await statusOf(pb5.id))?.publication_status).toBe('ARCHIVED');
        const event = await db.execute(
            sql`SELECT changes->0->>'old' AS old, changes->0->>'new' AS new, actor_type FROM domain_event WHERE entity_type = 'accommodation' AND entity_id = ${pb4.id} AND changes @> '[{"field":"publicationStatus","old":"ARCHIVED","new":"PUBLISHED"}]'::jsonb`
        );
        expect(event.rows[0]).toMatchObject({
            old: 'ARCHIVED',
            new: 'PUBLISHED',
            actor_type: 'job'
        });
        expect(await db.select().from(trials).where(eq(trials.userId, userId))).toEqual(
            trialsBefore
        );
        expect(await listingPublicationModel.hasOwnerPublished({ tx: db, vertical, userId })).toBe(
            activatedBefore
        );
    });

    it('TEST:V6:10 queues UBB and PB7 together by publication instant without origin priority', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const billingDown = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        const archived = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        await listingPublicationModel.insertStatusChangedEvent({
            tx: db,
            vertical,
            listingId: billingDown.id,
            from: PublicationStatusEnum.DRAFT,
            to: PublicationStatusEnum.PUBLISHED,
            actorType: 'owner',
            actorId: userId,
            correlationId: randomUUID(),
            occurredAt: new Date('2026-01-01T00:00:00Z')
        });
        await listingPublicationModel.insertStatusChangedEvent({
            tx: db,
            vertical,
            listingId: archived.id,
            from: PublicationStatusEnum.DRAFT,
            to: PublicationStatusEnum.PUBLISHED,
            actorType: 'owner',
            actorId: userId,
            correlationId: randomUUID(),
            occurredAt: new Date('2026-02-01T00:00:00Z')
        });
        expect(
            (
                await archive({
                    userId,
                    listingId: archived.id,
                    status: PublicationStatusEnum.PUBLISHED,
                    start: new Date(at.getTime() - 100 * 86_400_000)
                })
            ).archived
        ).toBe(true);
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        const result = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(result.restored).toEqual([billingDown.id]);
        expect(result.restoredFromArchived).toEqual([]);
        expect((await statusOf(archived.id))?.publication_status).toBe('ARCHIVED');
        expect((await statusOf(billingDown.id))?.publication_status).toBe('PUBLISHED');
    });

    it('TEST:V6:10 daily reconciliation runs for public-origin archives and skips PB5-only archives', async () => {
        const first = await seedPublicationOwner({ db });
        const returnable = await seedPublicationListing({
            db,
            vertical,
            ...first,
            status: PublicationStatusEnum.PUBLISHED
        });
        await archive({
            userId: first.userId,
            listingId: returnable.id,
            status: PublicationStatusEnum.PUBLISHED,
            start: new Date(at.getTime() - 100 * 86_400_000)
        });
        const draftOwner = await seedPublicationOwner({ db });
        const draftOnly = await seedPublicationListing({
            db,
            vertical,
            ...draftOwner,
            status: PublicationStatusEnum.ARCHIVED
        });
        await archive({
            userId: draftOwner.userId,
            listingId: draftOnly.id,
            status: PublicationStatusEnum.DRAFT,
            start: new Date('2026-05-01T00:00:00Z')
        });
        const ports = createReconcilerTestPorts({
            db,
            coveredByUser: new Map([
                [first.userId, true],
                [draftOwner.userId, true]
            ]),
            limitByUser: new Map([
                [first.userId, 2],
                [draftOwner.userId, 2]
            ])
        });
        const result = await runDailyCoverageReconciler({ ports });
        expect(result.ran).toBe(1);
        expect((await statusOf(returnable.id))?.publication_status).toBe('PUBLISHED');
        expect((await statusOf(draftOnly.id))?.publication_status).toBe('ARCHIVED');
    });
});
