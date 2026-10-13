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
    CoverageSource
} from '@repo/billing-verticals-contract';
import { createBillingCoverage } from '../../../../src/services/billing/coverage/billing-coverage';
import { createCoverageNoticeRegistry } from '../../../../src/services/billing/coverage/coverage-notice-registry';
import { unregisteredListingQuery } from '../../../../src/services/billing/coverage/coverage-ports';
import { creditedPaymentsFromLedger } from '../../../../src/services/billing/payment/payment-ledger';
import { getServiceTestPool } from '../helpers';

/** What the consumer saw when the notice reached it. */
export interface ObservedNotice {
    readonly event: CoverageChangedEvent;
    readonly subscriptionSources: readonly CoverageSource[];
    readonly committedPaymentStatuses: readonly string[];
}

/** Billing's real `coverage()` with verticals' trial/BASE answering "nothing". */
export function realCoverage(clock: Clock) {
    return createBillingCoverage({
        ports: {
            clock,
            payments: creditedPaymentsFromLedger,
            addonPolicy: async () => {
                throw new Error('addonPolicy must not be called: no addon is seeded');
            },
            listing: unregisteredListingQuery.listing,
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
