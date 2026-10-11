import { randomUUID } from 'node:crypto';
import type { CoverageResponse, CoverageSource } from '@repo/billing-verticals-contract';
import { CoverageResponseSchema, coverageSourceClassOf } from '@repo/billing-verticals-contract';
import type { Pool } from 'pg';

const since = new Date('2026-10-10T12:00:00.000Z');

export function subscriptionSource({ charged }: { readonly charged: boolean }): CoverageSource {
    return {
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
        scope: 'VERTICAL',
        target: null,
        since,
        until: 'NO_KNOWN_DATE',
        charged,
        floor: null
    };
}

export function courtesySource(): CoverageSource {
    return {
        type: 'COURTESY',
        reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
        scope: 'VERTICAL',
        target: null,
        since,
        until: new Date('2027-10-10T12:00:00.000Z'),
        charged: null,
        floor: null
    };
}

export function grantSource(): CoverageSource {
    return {
        type: 'GRANT',
        reference: { kind: 'PLAN_VERSION', planVersionId: randomUUID() },
        scope: 'VERTICAL',
        target: null,
        since,
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: randomUUID()
    };
}

export function coverageOf(args: {
    readonly sources: readonly CoverageSource[];
}): CoverageResponse {
    const covered = args.sources.some(
        (source) => coverageSourceClassOf({ source }).sourceClass === 'TITLE'
    );
    return CoverageResponseSchema.parse({ covered, sources: args.sources });
}

export async function consumedTrialRowOf(args: {
    readonly pool: Pool;
    readonly userId: string;
    readonly vertical: string;
}): Promise<Record<string, unknown> | undefined> {
    const client = await args.pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM trial WHERE user_id = $1 AND vertical = $2',
            [args.userId, args.vertical]
        );
        return result.rows[0] as Record<string, unknown> | undefined;
    } finally {
        client.release();
    }
}

export async function waitForAdvisoryLockWaiter(args: {
    readonly pool: Pool;
    readonly retries?: number;
    readonly delayMs?: number;
}): Promise<void> {
    const retries = args.retries ?? 100;
    const delayMs = args.delayMs ?? 20;
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const client = await args.pool.connect();
        try {
            const result = await client.query(
                `SELECT EXISTS (
                    SELECT 1 FROM pg_locks
                    WHERE locktype = 'advisory'
                      AND NOT granted
                      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
                ) AS waiting`
            );
            if (result.rows[0]?.waiting === true) return;
        } finally {
            client.release();
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`No advisory lock waiter appeared after ${retries} attempts`);
}

import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import type { DrizzleClient } from '@repo/db';
import { trials } from '@repo/db';
import {
    PublicationStatusEnum,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    type Vertical,
    VerticalEnum
} from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { expect, it, vi } from 'vitest';
import type {
    PublicationAfterCommit,
    PublicationVertical
} from '../../../src/publication/publication-types';
import { publishListing } from '../../../src/publication/publish-listing';
import { consumeTrialOnFirstPayment } from '../../../src/trial/trial-first-payment';
import type { TrialAfterCommit } from '../../../src/trial/trial-machine-types';
import {
    publicationPseudonym,
    seedPublicationListing,
    seedPublicationOwner
} from './publication-fixtures';
import { createPublicationTestAdapter } from './publication-unit-of-work';
import { createTrialMachineAdapter } from './trial-machine-unit-of-work';

/** Registers the remaining TEST:V4:12 hash, tourist, atomicity and vertical cases. */
export function registerSupplementalTrialConsumeCases(args: {
    readonly db: DrizzleClient;
    readonly vertical: PublicationVertical;
    readonly clock: { readonly now: () => Date };
    readonly afterCommit: PublicationAfterCommit;
    readonly trialAfterCommit: TrialAfterCommit;
}): void {
    const pseudonym = () => publicationPseudonym();
    const setCoverage = (
        billing: BillingForVerticalsSimulator,
        userId: string,
        targetVertical: Vertical,
        charged: boolean
    ) =>
        billing.setCoverage({
            userId,
            vertical: targetVertical,
            response: coverageOf({ sources: [subscriptionSource({ charged })] })
        });
    const fixture = async (targetVertical: PublicationVertical = args.vertical) => {
        const owner = await seedPublicationOwner({ db: args.db });
        const listing = await seedPublicationListing({
            db: args.db,
            vertical: targetVertical,
            userId: owner.userId,
            destinationId: owner.destinationId
        });
        return { ...owner, listing };
    };
    const publish = (input: {
        readonly userId: string;
        readonly listingId: string;
        readonly adapter: ReturnType<typeof createPublicationTestAdapter>;
        readonly targetVertical?: PublicationVertical;
        readonly emailPseudonym?: string;
    }) => {
        const targetVertical = input.targetVertical ?? args.vertical;
        const event = VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[targetVertical];
        if (!event) throw new Error(`Activation event missing for ${targetVertical}`);
        return publishListing({
            ...input.adapter,
            afterCommit: args.afterCommit,
            clock: args.clock,
            userId: input.userId,
            vertical: targetVertical,
            listingId: input.listingId,
            event,
            emailPseudonym: input.emailPseudonym ?? pseudonym(),
            correlationId: randomUUID()
        });
    };
    const subjectRows = (userId: string) =>
        args.db.select().from(trials).where(eq(trials.userId, userId));
    const statusOf = async (
        listingId: string,
        targetVertical: PublicationVertical = args.vertical
    ) =>
        (
            await (
                await import('../../../../db/src/models/listing/listing-publication.model')
            ).listingPublicationModel.readListing({
                tx: args.db,
                vertical: targetVertical,
                listingId
            })
        )?.publicationStatus;

    it('TEST:V4:12 atomicity rolls back T6 and publication together when PB1 fails', async () => {
        const capped = await fixture();
        const cappedBilling = new BillingForVerticalsSimulator();
        setCoverage(cappedBilling, capped.userId, args.vertical, true);
        const cappedAdapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 0 },
            billing: cappedBilling
        });
        expect(
            await publish({
                userId: capped.userId,
                listingId: capped.listing.id,
                adapter: cappedAdapter
            })
        ).toEqual({ published: false, reason: 'LIMIT_REACHED' });
        expect(await subjectRows(capped.userId)).toHaveLength(0);
        expect(await statusOf(capped.listing.id)).toBe(PublicationStatusEnum.DRAFT);

        const subject = await fixture();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, subject.userId, args.vertical, true);
        const afterCommit = {
            emitCoverageChanged: vi.fn(async () => {}),
            invalidateUser: vi.fn(async () => {}),
            revalidate: vi.fn(async () => {})
        };
        const adapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 10 },
            billing,
            beforeSetPublicationStatus: async () => {
                throw new Error('forced publication failure');
            }
        });
        await expect(
            publishListing({
                ...adapter,
                afterCommit,
                clock: args.clock,
                userId: subject.userId,
                vertical: args.vertical,
                listingId: subject.listing.id,
                event: VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[args.vertical]!,
                emailPseudonym: pseudonym(),
                correlationId: randomUUID()
            })
        ).rejects.toThrow('forced publication failure');
        expect(await subjectRows(subject.userId)).toHaveLength(0);
        expect(await statusOf(subject.listing.id)).toBe(PublicationStatusEnum.DRAFT);
        expect(afterCommit.emitCoverageChanged).not.toHaveBeenCalled();
        expect(afterCommit.invalidateUser).not.toHaveBeenCalled();
    });

    it('TEST:V4:12 hash already consumed lets PB1 publish without a second row and denies T8', async () => {
        const emailPseudonym = pseudonym();
        const first = await fixture();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, first.userId, args.vertical, true);
        const firstAdapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        expect(
            await publish({
                userId: first.userId,
                listingId: first.listing.id,
                adapter: firstAdapter,
                emailPseudonym
            })
        ).toMatchObject({ trialConsumed: true });
        const second = await fixture();
        setCoverage(billing, second.userId, args.vertical, true);
        const secondAdapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        expect(
            await publish({
                userId: second.userId,
                listingId: second.listing.id,
                adapter: secondAdapter,
                emailPseudonym
            })
        ).toMatchObject({ published: true, trialConsumed: false });
        expect(await subjectRows(second.userId)).toHaveLength(0);
        expect(await statusOf(second.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
        const machine = createTrialMachineAdapter({ db: args.db, ceilingDays: () => 60 });
        expect(
            await consumeTrialOnFirstPayment({
                unitOfWork: machine.unitOfWork,
                billing,
                afterCommit: args.trialAfterCommit,
                event: {
                    userId: second.userId,
                    vertical: args.vertical,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                emailPseudonym
            })
        ).toEqual({ consumed: false, reason: 'EMAIL_PSEUDONYM_ALREADY_USED' });
    });

    it('TEST:V4:12 hash collision in the unique constraint lets both PB1 calls finish with one row', async () => {
        const emailPseudonym = pseudonym();
        const first = await fixture();
        const second = await fixture();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, first.userId, args.vertical, true);
        setCoverage(billing, second.userId, args.vertical, true);
        const firstAdapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const secondAdapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const results = await Promise.all([
            publish({
                userId: first.userId,
                listingId: first.listing.id,
                adapter: firstAdapter,
                emailPseudonym
            }),
            publish({
                userId: second.userId,
                listingId: second.listing.id,
                adapter: secondAdapter,
                emailPseudonym
            })
        ]);
        expect(results.every((result) => result.published)).toBe(true);
        const rows = await args.db
            .select()
            .from(trials)
            .where(eq(trials.emailPseudonym, emailPseudonym));
        expect(rows).toHaveLength(1);
        expect(await statusOf(first.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await statusOf(second.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V4:12 T8 cannot infer the TOURIST activation event from a missing registry', async () => {
        const { userId } = await seedPublicationOwner({ db: args.db });
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, userId, VerticalEnum.TOURIST, true);
        const machine = createTrialMachineAdapter({ db: args.db, ceilingDays: () => 60 });
        expect(
            await consumeTrialOnFirstPayment({
                unitOfWork: machine.unitOfWork,
                billing,
                afterCommit: args.trialAfterCommit,
                event: {
                    userId,
                    vertical: VerticalEnum.TOURIST,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                emailPseudonym: pseudonym()
            })
        ).toEqual({ consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' });
        expect(await subjectRows(userId)).toHaveLength(0);
    });

    it.each([
        VerticalEnum.GASTRONOMY,
        VerticalEnum.EXPERIENCE
    ])('TEST:V4:12 (c) T6 consumes a paid title for %s', async (targetVertical) => {
        const target = targetVertical as PublicationVertical;
        const subject = await fixture(target);
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, subject.userId, target, true);
        const adapter = createPublicationTestAdapter({
            db: args.db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const result = await publish({
            userId: subject.userId,
            listingId: subject.listing.id,
            adapter,
            targetVertical: target
        });
        expect(result).toMatchObject({ published: true, trialStarted: false, trialConsumed: true });
        const [row] = await subjectRows(subject.userId);
        expect(row?.status).toBe('TRIAL_CONVERTED');
        expect(await statusOf(subject.listing.id, target)).toBe(PublicationStatusEnum.PUBLISHED);
    });
}
