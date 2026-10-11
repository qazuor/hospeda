import { randomUUID } from 'node:crypto';
import type { CoverageChangedEvent, CoverageSource } from '@repo/billing-verticals-contract';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import type { DrizzleClient } from '@repo/db';
import { domainEvent, trials } from '@repo/db';
import {
    PublicationStatusEnum,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    type Vertical,
    type VerticalActivationEvent,
    VerticalEnum
} from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingPublicationModel } from '../../../db/src/models/listing/listing-publication.model';
import type {
    PublicationAfterCommit,
    PublicationVertical
} from '../../src/publication/publication-types';
import { publishListing } from '../../src/publication/publish-listing';
import { consumeTrialOnFirstPayment } from '../../src/trial/trial-first-payment';
import type { TrialAfterCommit } from '../../src/trial/trial-machine-types';
import {
    publicationPseudonym,
    seedPublicationListing,
    seedPublicationOwner
} from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';
import {
    consumedTrialRowOf,
    courtesySource,
    coverageOf,
    grantSource,
    subscriptionSource,
    waitForAdvisoryLockWaiter
} from './support/trial-consume-helpers';
import { createTrialMachineAdapter } from './support/trial-machine-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 12 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
beforeEach(() => vi.clearAllMocks());
const vertical = VerticalEnum.ACCOMMODATION;
function activationEventFor(targetVertical: PublicationVertical): VerticalActivationEvent {
    const event = VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[targetVertical];
    if (!event) throw new Error(`Activation event missing for ${targetVertical}`);
    return event;
}
const activationEvent = activationEventFor(vertical);
const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };
const pseudonym = () => publicationPseudonym();
const publicationAfterCommit: PublicationAfterCommit = {
    emitCoverageChanged: vi.fn(async () => {}),
    invalidateUser: vi.fn(async () => {}),
    revalidate: vi.fn(async () => {})
};
const trialEvents: CoverageChangedEvent[] = [];
const trialInvalidations: string[] = [];
let trialAfterCommit: TrialAfterCommit;

function resetTrialNotices() {
    trialEvents.length = 0;
    trialInvalidations.length = 0;
    trialAfterCommit = {
        async emitCoverageChanged(event) {
            const row = await consumedTrialRowOf({
                pool,
                userId: event.userId,
                vertical: event.vertical
            });
            expect(row?.status).toBe('TRIAL_CONVERTED');
            trialEvents.push(event);
        },
        async invalidateUser({ userId }) {
            trialInvalidations.push(userId);
        }
    };
}
resetTrialNotices();

function setCoverage(
    billing: BillingForVerticalsSimulator,
    userId: string,
    sources: readonly CoverageSource[],
    targetVertical: Vertical = vertical
) {
    billing.setCoverage({ userId, vertical: targetVertical, response: coverageOf({ sources }) });
}

async function ownerAndListing(args: { readonly vertical?: PublicationVertical }) {
    const owner = await seedPublicationOwner({ db });
    const listing = await seedPublicationListing({
        db,
        vertical: args.vertical ?? vertical,
        userId: owner.userId,
        destinationId: owner.destinationId
    });
    return { ...owner, listing };
}

async function subjectTrials(userId: string) {
    return db.select().from(trials).where(eq(trials.userId, userId));
}

async function publish(args: {
    readonly userId: string;
    readonly listingId: string;
    readonly adapter: ReturnType<typeof createPublicationTestAdapter>;
    readonly vertical?: PublicationVertical;
    readonly emailPseudonym?: string;
}) {
    return publishListing({
        ...args.adapter,
        afterCommit: publicationAfterCommit,
        clock,
        userId: args.userId,
        listingId: args.listingId,
        vertical: args.vertical ?? vertical,
        event: args.vertical === undefined ? activationEvent : activationEventFor(args.vertical),
        emailPseudonym: args.emailPseudonym ?? pseudonym(),
        correlationId: randomUUID()
    });
}

function paymentEvent(userId: string, targetVertical: Vertical = vertical): CoverageChangedEvent {
    return { userId, vertical: targetVertical, sourceType: 'SUBSCRIPTION', change: 'CHANGED' };
}

async function readListingStatus(
    listingId: string,
    targetVertical: PublicationVertical = vertical
) {
    return (
        await listingPublicationModel.readListing({ tx: db, vertical: targetVertical, listingId })
    )?.publicationStatus;
}

function expectConsumedShape(row: Record<string, unknown> | undefined, emailPseudonym: string) {
    expect(row).toMatchObject({
        status: 'TRIAL_CONVERTED',
        started_at: null,
        ends_at: null,
        trial_plan_id: null,
        floor_entitlements_version_id: null,
        floor_limits_version_id: null,
        floor_trial_plan_version_id: null,
        deadlines_version: null,
        email_pseudonym: emailPseudonym
    });
}

describe('TEST:V4:12 - T6 and T8 against Postgres', () => {
    it('TEST:V4:12 (a,b) leaves an unpaid subscription in PRE_TRIAL, then T8 consumes on first payment', async () => {
        resetTrialNotices();
        const fixture = await ownerAndListing({});
        const emailPseudonym = pseudonym();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: false })]);
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const result = await publish({
            userId: fixture.userId,
            listingId: fixture.listing.id,
            adapter,
            emailPseudonym
        });
        expect(result).toMatchObject({
            published: true,
            trialStarted: false,
            trialConsumed: false
        });
        expect(await subjectTrials(fixture.userId)).toHaveLength(0);
        expect(await readListingStatus(fixture.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
        const events = await db
            .select()
            .from(domainEvent)
            .where(eq(domainEvent.entityId, fixture.listing.id));
        expect(
            events.some(
                (row) => row.eventType === 'listing.status_changed' && row.actorType === 'owner'
            )
        ).toBe(true);
        expect(
            await listingPublicationModel.hasOwnerPublished({
                tx: db,
                vertical,
                userId: fixture.userId
            })
        ).toBe(true);

        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: true })]);
        const machine = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        const consumed = await consumeTrialOnFirstPayment({
            unitOfWork: machine.unitOfWork,
            billing,
            afterCommit: trialAfterCommit,
            event: paymentEvent(fixture.userId),
            emailPseudonym
        });
        expect(consumed).toMatchObject({ consumed: true, transition: 'T8' });
        const row = await consumedTrialRowOf({ pool, userId: fixture.userId, vertical });
        expectConsumedShape(row, emailPseudonym);
        expect(machine.stats.expiryCampaigns).toEqual([]);
        expect(machine.stats.recoveryCampaigns).toEqual([]);
        expect(machine.stats.cancellations).toEqual([]);
        expect(trialEvents).toEqual([
            { ...paymentEvent(fixture.userId), sourceType: 'TRIAL', change: 'REMOVED' }
        ]);
        expect(trialInvalidations).toEqual([fixture.userId]);
        expect(
            await consumeTrialOnFirstPayment({
                unitOfWork: machine.unitOfWork,
                billing,
                afterCommit: trialAfterCommit,
                event: paymentEvent(fixture.userId),
                emailPseudonym
            })
        ).toEqual({ consumed: false, reason: 'TRIAL_ROW_EXISTS' });
        expect(trialEvents).toHaveLength(1);

        const neverPublished = await seedPublicationOwner({ db });
        setCoverage(billing, neverPublished.userId, [subscriptionSource({ charged: true })]);
        expect(
            await consumeTrialOnFirstPayment({
                unitOfWork: machine.unitOfWork,
                billing,
                afterCommit: trialAfterCommit,
                event: paymentEvent(neverPublished.userId),
                emailPseudonym: pseudonym()
            })
        ).toEqual({ consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' });
        expect(await subjectTrials(neverPublished.userId)).toHaveLength(0);
        expect(trialEvents).toHaveLength(1);
    });

    it.each([
        ['subscription', () => subscriptionSource({ charged: true })],
        ['courtesy', courtesySource],
        ['grant', grantSource]
    ])('TEST:V4:12 (c) T6 consumes a converting %s during PB1', async (_name, makeSource) => {
        resetTrialNotices();
        const fixture = await ownerAndListing({});
        const emailPseudonym = pseudonym();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, [makeSource()]);
        let postCommitRow: Record<string, unknown> | undefined;
        const afterCommit: PublicationAfterCommit = {
            emitCoverageChanged: vi.fn(async (event) => {
                postCommitRow = await consumedTrialRowOf({
                    pool,
                    userId: event.userId,
                    vertical: event.vertical
                });
                expect(postCommitRow?.status).toBe('TRIAL_CONVERTED');
                expect(event).toMatchObject({ sourceType: 'TRIAL', change: 'REMOVED' });
                trialEvents.push(event);
            }),
            invalidateUser: vi.fn(async () => {}),
            revalidate: vi.fn(async () => {})
        };
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const result = await publishListing({
            ...adapter,
            afterCommit,
            clock,
            userId: fixture.userId,
            vertical,
            listingId: fixture.listing.id,
            event: activationEvent,
            emailPseudonym,
            correlationId: randomUUID()
        });
        expect(result).toMatchObject({ published: true, trialStarted: false, trialConsumed: true });
        expectConsumedShape(postCommitRow, emailPseudonym);
        expect(await readListingStatus(fixture.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await subjectTrials(fixture.userId)).toHaveLength(1);
        expect(trialEvents).toHaveLength(1);
        expect(afterCommit.emitCoverageChanged as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(
            1
        );
    });

    it('TEST:V4:12 (e) a suspended unpaid subscription emits no title, so T1 still starts', async () => {
        const fixture = await ownerAndListing({});
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, []);
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: false },
            limit: { value: 10 },
            billing
        });
        const result = await publish({
            userId: fixture.userId,
            listingId: fixture.listing.id,
            adapter
        });
        expect(result).toMatchObject({ published: true, trialStarted: true, trialConsumed: false });
        const [row] = await subjectTrials(fixture.userId);
        expect(row).toMatchObject({
            status: 'TRIAL_ACTIVE',
            startedAt: expect.any(Date),
            endsAt: expect.any(Date)
        });
        expect(row?.trialPlanId).toBeTruthy();
        expect(row?.floorEntitlementsVersionId).toBeTruthy();
        expect(row?.floorLimitsVersionId).toBeTruthy();
        expect(row?.floorTrialPlanVersionId).toBeTruthy();
        expect(await readListingStatus(fixture.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V4:12 (d1) T8 waits for PB1 and consumes after PB1 commits', async () => {
        resetTrialNotices();
        const fixture = await ownerAndListing({});
        const emailPseudonym = pseudonym();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: false })]);
        let release!: () => void;
        let entered!: () => void;
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        const reached = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const pubAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing,
            beforeSetPublicationStatus: async () => {
                entered();
                await held;
            }
        });
        const machine = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        const publication = publish({
            userId: fixture.userId,
            listingId: fixture.listing.id,
            adapter: pubAdapter,
            emailPseudonym
        });
        await reached;
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: true })]);
        const payment = consumeTrialOnFirstPayment({
            unitOfWork: machine.unitOfWork,
            billing,
            afterCommit: trialAfterCommit,
            event: paymentEvent(fixture.userId),
            emailPseudonym
        });
        await waitForAdvisoryLockWaiter({ pool });
        release();
        expect(await publication).toMatchObject({ published: true, trialConsumed: false });
        expect(await payment).toMatchObject({ consumed: true, transition: 'T8' });
        const rows = await subjectTrials(fixture.userId);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('TRIAL_CONVERTED');
        expect(await readListingStatus(fixture.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V4:12 (d2) PB1 waits for T8, then consumes after T8 observes no activation event', async () => {
        resetTrialNotices();
        const fixture = await ownerAndListing({});
        const emailPseudonym = pseudonym();
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: false })]);
        let release!: () => void;
        let entered!: () => void;
        const held = new Promise<void>((resolve) => {
            release = resolve;
        });
        const reached = new Promise<void>((resolve) => {
            entered = resolve;
        });
        const machine = createTrialMachineAdapter({
            db,
            ceilingDays: () => 60,
            onLocked: async () => {
                entered();
                await held;
            }
        });
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: true })]);
        const payment = consumeTrialOnFirstPayment({
            unitOfWork: machine.unitOfWork,
            billing,
            afterCommit: trialAfterCommit,
            event: paymentEvent(fixture.userId),
            emailPseudonym
        });
        await reached;
        const pubAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const publication = publish({
            userId: fixture.userId,
            listingId: fixture.listing.id,
            adapter: pubAdapter,
            emailPseudonym
        });
        await waitForAdvisoryLockWaiter({ pool });
        release();
        expect(await payment).toEqual({
            consumed: false,
            reason: 'ACTIVATION_EVENT_NOT_EXERCISED'
        });
        expect(await publication).toMatchObject({ published: true, trialConsumed: true });
        const rows = await subjectTrials(fixture.userId);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('TRIAL_CONVERTED');
        expect(await readListingStatus(fixture.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V4:12 atomicity rolls back T6 and publication together when PB1 fails', async () => {
        const fixture = await ownerAndListing({});
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: true })]);
        const afterCommit = {
            emitCoverageChanged: vi.fn(async () => {}),
            invalidateUser: vi.fn(async () => {}),
            revalidate: vi.fn(async () => {})
        };
        const adapter = createPublicationTestAdapter({
            db,
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
                clock,
                userId: fixture.userId,
                vertical,
                listingId: fixture.listing.id,
                event: activationEvent,
                emailPseudonym: pseudonym(),
                correlationId: randomUUID()
            })
        ).rejects.toThrow('forced publication failure');
        expect(await subjectTrials(fixture.userId)).toHaveLength(0);
        expect(await readListingStatus(fixture.listing.id)).toBe(PublicationStatusEnum.DRAFT);
        expect(afterCommit.emitCoverageChanged).not.toHaveBeenCalled();
        expect(afterCommit.invalidateUser).not.toHaveBeenCalled();
    });

    it('TEST:V4:12 hash already consumed lets PB1 publish without a second row and denies T8', async () => {
        const pseudonymA = pseudonym();
        const first = await ownerAndListing({});
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, first.userId, [subscriptionSource({ charged: true })]);
        const adapterA = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        expect(
            await publish({
                userId: first.userId,
                listingId: first.listing.id,
                adapter: adapterA,
                emailPseudonym: pseudonymA
            })
        ).toMatchObject({ trialConsumed: true });
        const second = await ownerAndListing({});
        setCoverage(billing, second.userId, [subscriptionSource({ charged: true })]);
        const adapterB = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        expect(
            await publish({
                userId: second.userId,
                listingId: second.listing.id,
                adapter: adapterB,
                emailPseudonym: pseudonymA
            })
        ).toMatchObject({ published: true, trialConsumed: false });
        expect(await subjectTrials(second.userId)).toHaveLength(0);
        expect(await readListingStatus(second.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
        const machine = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        expect(
            await consumeTrialOnFirstPayment({
                unitOfWork: machine.unitOfWork,
                billing,
                afterCommit: trialAfterCommit,
                event: paymentEvent(second.userId),
                emailPseudonym: pseudonymA
            })
        ).toEqual({ consumed: false, reason: 'EMAIL_PSEUDONYM_ALREADY_USED' });
    });

    it('TEST:V4:12 hash collision in the unique constraint lets both PB1 calls finish with one row', async () => {
        const sharedPseudonym = pseudonym();
        const first = await ownerAndListing({});
        const second = await ownerAndListing({});
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, first.userId, [subscriptionSource({ charged: true })]);
        setCoverage(billing, second.userId, [subscriptionSource({ charged: true })]);
        const firstAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const secondAdapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const results = await Promise.all([
            publish({
                userId: first.userId,
                listingId: first.listing.id,
                adapter: firstAdapter,
                emailPseudonym: sharedPseudonym
            }),
            publish({
                userId: second.userId,
                listingId: second.listing.id,
                adapter: secondAdapter,
                emailPseudonym: sharedPseudonym
            })
        ]);
        expect(results.every((result) => result.published)).toBe(true);
        const rows = await db
            .select()
            .from(trials)
            .where(eq(trials.emailPseudonym, sharedPseudonym));
        expect(rows).toHaveLength(1);
        expect(await readListingStatus(first.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
        expect(await readListingStatus(second.listing.id)).toBe(PublicationStatusEnum.PUBLISHED);
    });

    it('TEST:V4:12 T8 cannot infer the TOURIST activation event from a missing registry', async () => {
        const { userId } = await seedPublicationOwner({ db });
        const billing = new BillingForVerticalsSimulator();
        billing.setCoverage({
            userId,
            vertical: VerticalEnum.TOURIST,
            response: coverageOf({ sources: [subscriptionSource({ charged: true })] })
        });
        const machine = createTrialMachineAdapter({ db, ceilingDays: () => 60 });
        expect(
            await consumeTrialOnFirstPayment({
                unitOfWork: machine.unitOfWork,
                billing,
                afterCommit: trialAfterCommit,
                event: {
                    userId,
                    vertical: VerticalEnum.TOURIST,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                emailPseudonym: pseudonym()
            })
        ).toEqual({ consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' });
        expect(await subjectTrials(userId)).toHaveLength(0);
    });

    it.each([
        VerticalEnum.GASTRONOMY,
        VerticalEnum.EXPERIENCE
    ])('TEST:V4:12 (c) T6 consumes a paid title for %s', async (targetVertical) => {
        const target = targetVertical as PublicationVertical;
        const fixture = await ownerAndListing({ vertical: target });
        const billing = new BillingForVerticalsSimulator();
        setCoverage(billing, fixture.userId, [subscriptionSource({ charged: true })], target);
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 10 },
            billing
        });
        const result = await publish({
            userId: fixture.userId,
            listingId: fixture.listing.id,
            adapter,
            vertical: target
        });
        expect(result).toMatchObject({ published: true, trialStarted: false, trialConsumed: true });
        const [row] = await subjectTrials(fixture.userId);
        expect(row?.status).toBe('TRIAL_CONVERTED');
        expect(await readListingStatus(fixture.listing.id, target)).toBe(
            PublicationStatusEnum.PUBLISHED
        );
    });
});
