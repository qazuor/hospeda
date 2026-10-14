/**
 * Fixtures for TEST:B4:2 (HOS-1533, B4.2): a real coverage-changed notice
 * registry whose listener re-reads the REAL `coverage()` (contract §3: the
 * consumer asks again, it never believes the notice), plus the per-test
 * cleanup of the rows `paymentFixture()` commits.
 */
import type {
    Clock,
    CoverageChangedEvent,
    CoverageResponse,
    CoverageSource,
    VerticalsForBilling
} from '@repo/billing-verticals-contract';
import { users } from '@repo/db';
import { createBillingCoverage } from '../../../../src/services/billing/coverage/billing-coverage';
import { createCoverageNoticeRegistry } from '../../../../src/services/billing/coverage/coverage-notice-registry';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger';
import { getServiceTestDb, getServiceTestPool } from '../helpers';

/** What the consumer saw when the notice reached it. */
export interface ObservedNotice {
    readonly event: CoverageChangedEvent;
    readonly subscriptionSources: readonly CoverageSource[];
    readonly committedPaymentStatuses: readonly string[];
}

/**
 * A `ficha` (`listing`) double that fails visibly: no `LISTING` addon is
 * seeded here, so billing must never ask for one. Production composes the real
 * query of verticals (HOS-1483, AC:V6:26).
 */
const failingListingQuery: VerticalsForBilling['listing'] = async () => {
    throw new Error('ficha must not be called: no LISTING addon is seeded');
};

/** Billing's real `coverage()` with verticals' trial/BASE answering "nothing". */
export function realCoverage(clock: Clock) {
    return createBillingCoverage({
        ports: {
            clock,
            payments: creditedPaymentsFromLedger,
            addonPolicy: async () => {
                throw new Error('addonPolicy must not be called: no addon is seeded');
            },
            listing: failingListingQuery,
            trialAndBase: async (): Promise<CoverageResponse> => ({ covered: false, sources: [] })
        }
    });
}

/** Keeps only the SUBSCRIPTION sources of a coverage answer. */
export function subscriptionSources(response: CoverageResponse): CoverageSource[] {
    return response.sources.filter((source) => source.type === 'SUBSCRIPTION');
}

/**
 * A real registry with one consumer that re-reads the real coverage and, on
 * ANOTHER connection, the committed status of the subscription's payments.
 */
export function registryWithConsumer(input: {
    readonly clock: Clock;
    readonly subscriptionId: string;
}) {
    const registry = createCoverageNoticeRegistry();
    const coverage = realCoverage(input.clock);
    const observed: ObservedNotice[] = [];
    registry.onCoverageChanged(async (event) => {
        const answer = await coverage.coverage({ userId: event.userId, vertical: event.vertical });
        const committed = await getServiceTestPool().query<{ status: string }>(
            'SELECT status FROM payment WHERE subscription_id = $1 ORDER BY fact_at',
            [input.subscriptionId]
        );
        observed.push({
            event,
            subscriptionSources: subscriptionSources(answer),
            committedPaymentStatuses: committed.rows.map((row) => row.status)
        });
    });
    return { registry, observed, coverage };
}

/** The `email_outbox` templates of one recipient, oldest first. */
export async function outboxTemplatesOf(userId: string): Promise<string[]> {
    const rows = await getServiceTestPool().query<{ template: string }>(
        'SELECT template FROM email_outbox WHERE recipient_user_id = $1 ORDER BY created_at, id',
        [userId]
    );
    return rows.rows.map((row) => row.template);
}

/**
 * Deletes what one test committed, children first (I-8). `plan` and
 * `plan_version` stay: their immutability trigger forbids deleting them.
 */
export async function cleanUpCoverageNoticeRows(input: {
    readonly userIds: readonly string[];
    readonly promoCodeIds: readonly string[];
}): Promise<void> {
    if (input.userIds.length === 0) return;
    const client = await getServiceTestPool().connect();
    try {
        await client.query('BEGIN');
        const subs = await client.query<{ id: string }>(
            'SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])',
            [input.userIds]
        );
        const subscriptionIds = subs.rows.map((row) => row.id);
        await client.query('DELETE FROM covered_period WHERE subscription_id = ANY($1::uuid[])', [
            subscriptionIds
        ]);
        await client.query(
            'DELETE FROM receipt WHERE payment_id IN (SELECT id FROM payment WHERE subscription_id = ANY($1::uuid[]))',
            [subscriptionIds]
        );
        await client.query('DELETE FROM email_outbox WHERE recipient_user_id = ANY($1::uuid[])', [
            input.userIds
        ]);
        await client.query('DELETE FROM promo_redemption WHERE subscription_id = ANY($1::uuid[])', [
            subscriptionIds
        ]);
        await client.query('DELETE FROM promo_code WHERE id = ANY($1::uuid[])', [
            input.promoCodeIds
        ]);
        await client.query('DELETE FROM payment WHERE subscription_id = ANY($1::uuid[])', [
            subscriptionIds
        ]);
        await client.query('DELETE FROM provider_link WHERE subscription_id = ANY($1::uuid[])', [
            subscriptionIds
        ]);
        await client.query('DELETE FROM subscription WHERE id = ANY($1::uuid[])', [
            subscriptionIds
        ]);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * A plan choice for the census (corrida 2). The version is seeded
 * `sellable: false, current: false` (I-8): the sale check reads the
 * `planPolicy` port, so the census never adds a sellable plan.
 */
export async function seedCensusChoice(
    input: { readonly vertical?: 'accommodation' | 'tourist'; readonly userId?: string } = {}
): Promise<{
    readonly userId: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
}> {
    const vertical = input.vertical ?? 'accommodation';
    let userId = input.userId;
    if (!userId) {
        const [user] = await getServiceTestDb()
            .insert(users)
            .values({
                email: `coverage-census-${crypto.randomUUID()}@example.test`,
                displayName: 'Coverage census',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: users.id });
        userId = user?.id;
    }
    if (!userId) throw new Error('census user missing');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            [vertical, `coverage-census-${crypto.randomUUID()}`, 'Census plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('census plan missing');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip)
             VALUES ($1, $2, $3, false, false, 0, false, false) RETURNING id`,
            [planId, vertical, Math.floor(Math.random() * 1_000_000_000) + 1000]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('census plan version missing');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
             VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id`,
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('census billing option missing');
    return { userId, planVersionId, billingOptionId };
}

/**
 * Inserts one bare `PRINCIPAL` subscription row (no provider link), for the
 * rows the census needs in a given state: a Tourist VIP, a predecessor or a
 * live successor.
 */
export async function insertCensusSubscription(input: {
    readonly userId: string;
    readonly vertical: 'accommodation' | 'tourist';
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly status: string;
    readonly succeedsId?: string;
}): Promise<string> {
    const id = (
        await getServiceTestPool().query<{ id: string }>(
            `INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id, payment_method, status, class, succeeds_id, service_ends_at)
             VALUES ($1, $2, $3, $4, 'CARD', $5, 'PRINCIPAL', $6, $7)
             RETURNING id`,
            [
                input.userId,
                input.vertical,
                input.planVersionId,
                input.billingOptionId,
                input.status,
                input.succeedsId ?? null,
                input.status === 'CANCELLED' ? new Date() : null
            ]
        )
    ).rows[0]?.id;
    if (!id) throw new Error('census subscription missing');
    return id;
}

/** The committed status of one subscription, read on ANOTHER connection than the writer's. */
export async function committedSubscriptionStatus(subscriptionId: string): Promise<string | null> {
    const rows = await getServiceTestPool().query<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [subscriptionId]
    );
    return rows.rows[0]?.status ?? null;
}

/** One notice and what another connection saw committed when it arrived. */
export interface CensusObservation<T> {
    readonly event: CoverageChangedEvent;
    readonly committed: T;
}

/**
 * A `coverageNotices` port that records every notice and, at the moment it
 * receives it, runs `observe` on another connection: what it reads is what
 * was already committed when the notice left.
 */
export function recordingCoverageNotices<T>(observe: (event: CoverageChangedEvent) => Promise<T>) {
    const seen: CensusObservation<T>[] = [];
    const coverageNotices = {
        async emitCoverageChanged(event: CoverageChangedEvent) {
            seen.push({ event, committed: await observe(event) });
        }
    };
    return { coverageNotices, seen };
}
