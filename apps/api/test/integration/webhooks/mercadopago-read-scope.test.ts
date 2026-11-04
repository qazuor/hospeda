import {
    billingDeadlineVersions,
    desc,
    eq,
    getDb,
    payments,
    providerChargeSnapshots,
    subscriptions
} from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    createSubjects,
    postDelivery,
    retireSubjects,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const DAY = 86_400_000;
const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => retireSubjects(subjects, fixture.lifterId));
afterAll(async () => fixture.stop());

async function deliver(delivery: SignedDelivery) {
    subjects.deliveries.push(delivery);
    const response = await postDelivery(fixture.app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
}

async function activate() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(
        signedNotice({
            clock: fixture.clock,
            type: 'subscription_preapproval',
            id: created.authorizationId,
            version: '1'
        })
    );
    return created;
}

describe('HOS-1999 provider read scope', () => {
    /** Activates a credited subscription with `count` monthly charge records, the first one read by webhook. */
    async function seedMonthlyRecords(count: number) {
        const created = await activate();
        const chargeIds: string[] = [];
        for (let index = 0; index < count; index += 1) {
            const charge = await fixture.fake.charge({
                authorizationId: created.authorizationId,
                amount: { amountMinor: 100000, currency: 'ARS' },
                reference: `read-scope-${index}-${crypto.randomUUID()}`
            });
            chargeIds.push(charge.chargeId);
            if (index === 0) {
                fixture.clock.advance({ ms: 60 * 60 * 1000 });
                await deliver(
                    signedNotice({
                        clock: fixture.clock,
                        type: 'payment',
                        id: charge.chargeId,
                        version: '1'
                    })
                );
            }
            fixture.clock.advance({ ms: 31 * DAY });
        }
        return { created, chargeIds };
    }

    /** Inventory requests of one sweep: the authorization, its listing pages and charge reads. */
    async function sweepInventoryPaths(input: {
        readonly authorizationId: string;
        readonly chargeIds: readonly string[];
    }) {
        const before = fixture.server.requests().length;
        await fixture.runSweep();
        return fixture.server
            .requests()
            .slice(before)
            .map(({ path }) => path)
            .filter(
                (path) =>
                    path.includes(`preapproval_id=${input.authorizationId}`) ||
                    path === `/preapproval/${input.authorizationId}` ||
                    input.chargeIds.some((chargeId) => path === `/v1/payments/${chargeId}`)
            );
    }

    /** Publishes a newer deadline version so deadline 18 (the snapshot horizon) is shorter than the cadence. */
    async function useShortDeadline18() {
        const [latest] = await getDb()
            .select({
                version: billingDeadlineVersions.version,
                values: billingDeadlineVersions.values
            })
            .from(billingDeadlineVersions)
            .orderBy(desc(billingDeadlineVersions.version))
            .limit(1);
        if (!latest) throw new Error('fixture published no deadline version');
        await getDb()
            .insert(billingDeadlineVersions)
            .values({
                version: latest.version + 1,
                values: { ...latest.values, '18': { days: 20 } }
            });
        return latest.version + 1;
    }

    it('reads the first sweep at 14 requests: only the webhook-read charge has a closed snapshot (B3 write-through)', async () => {
        const { created, chargeIds } = await seedMonthlyRecords(12);
        const paths = await sweepInventoryPaths({
            authorizationId: created.authorizationId,
            chargeIds
        });
        // 14 = 1 authorization + 2 listing pages + 11 charge reads. Charge 0 is older than deadline 18
        // (180 days) and was recorded by the webhook, so it is served from its snapshot; the other
        // 11 have no snapshot yet. Without B3 this was 15; the baseline without memoization was 77.
        expect(paths).toHaveLength(14);
        expect(paths).not.toContain(`/v1/payments/${chargeIds[0]}`);
        expect(
            await getDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, created.subscriptionId))
        ).toHaveLength(1);
    });

    it('upserts the snapshot on a webhook read and rewrites a closed approved one on a refund notice (AC-11, AC-12)', async () => {
        const created = await activate();
        const charge = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'snapshot-refund'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '1'
            })
        );
        const [recorded] = await getDb()
            .select()
            .from(providerChargeSnapshots)
            .where(eq(providerChargeSnapshots.chargeId, charge.chargeId));
        expect(recorded).toMatchObject({ status: 'approved', refundedAmountMinor: 0 });
        // Deadline 18 passes: the snapshot is now closed, yet the next live read must rewrite it.
        fixture.clock.advance({ ms: 200 * DAY });
        await fixture.fake.refund({
            chargeId: charge.chargeId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: `refund-${crypto.randomUUID()}`
        });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '2'
            })
        );
        const [rewritten] = await getDb()
            .select()
            .from(providerChargeSnapshots)
            .where(eq(providerChargeSnapshots.chargeId, charge.chargeId));
        expect(rewritten?.refundedAmountMinor).toBe(100000);
        expect(rewritten?.observedAt.getTime()).toBeGreaterThan(
            recorded?.observedAt.getTime() ?? 0
        );
    });

    it('settles a grace row through a fresh nested act without a freshness error (AC-26)', async () => {
        const created = await activate();
        const prior = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'credited-prior'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: prior.chargeId,
                version: '1'
            })
        );
        fixture.clock.advance({ ms: 31 * DAY });
        const current = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'grace-current'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await fixture.fake.readCharge({ chargeId: current.chargeId });
        await getDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(fixture.clock.now().getTime() - 9 * DAY),
                graceEndsAt: new Date(fixture.clock.now().getTime() - 1)
            })
            .where(eq(subscriptions.id, created.subscriptionId));
        // A frozen clock stamps every read at the act's own instant, so a read memoized before
        // the nested act would still look fresh. Ticking 1 ms per `now()` makes the nested act
        // (recordChargeFact) start strictly after any earlier read, which is what AC-26 guards.
        const frozenNow = fixture.clock.now.bind(fixture.clock);
        let tick = 0;
        const ticking = vi
            .spyOn(fixture.clock, 'now')
            .mockImplementation(() => new Date(frozenNow().getTime() + ++tick));
        let result: Awaited<ReturnType<typeof fixture.runSweep>>;
        try {
            result = await fixture.runSweep();
        } finally {
            ticking.mockRestore();
        }
        expect(result.details?.failedSubscriptionIds).not.toContain(created.subscriptionId);
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
    });

    it('performs two live payment reads for two webhook notices of one charge', async () => {
        const created = await activate();
        const charge = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'webhook-live-read'
        });
        const before = fixture.server.requests().length;
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '1'
            })
        );
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '2'
            })
        );
        const liveReads = fixture.server
            .requests()
            .slice(before)
            .filter(({ path }) => path === `/v1/payments/${charge.chargeId}`);
        expect(liveReads).toHaveLength(2);
    });

    // Deadline versions are append-only, so the tests that publish a short deadline 18 run last.
    it('reads a steady-state 12-record row in at most 4 requests (AC-9, kills snapshots not consulted)', async () => {
        await useShortDeadline18();
        const { created, chargeIds } = await seedMonthlyRecords(12);
        const warm = await sweepInventoryPaths({
            authorizationId: created.authorizationId,
            chargeIds
        });
        expect(warm.length).toBeGreaterThan(4);
        const steady = await sweepInventoryPaths({
            authorizationId: created.authorizationId,
            chargeIds
        });
        // 4 = 1 authorization + 2 listing pages + 1 live read of the latest charge.
        expect(steady).toHaveLength(4);
        expect(steady.filter((path) => path.startsWith('/v1/payments/'))).toEqual([
            `/v1/payments/${chargeIds[chargeIds.length - 1]}`
        ]);
    });

    it('adds only the extra listing pages for 36 records (AC-10, kills snapshots not consulted for history)', async () => {
        await useShortDeadline18();
        const { created, chargeIds } = await seedMonthlyRecords(36);
        await sweepInventoryPaths({ authorizationId: created.authorizationId, chargeIds });
        const steady = await sweepInventoryPaths({
            authorizationId: created.authorizationId,
            chargeIds
        });
        const listingPages = steady.filter((path) => path.includes('preapproval_id='));
        expect(steady.filter((path) => path.startsWith('/v1/payments/'))).toHaveLength(1);
        expect(steady).toHaveLength(2 + listingPages.length);
        expect(listingPages.length).toBeGreaterThan(2);
    });
});
