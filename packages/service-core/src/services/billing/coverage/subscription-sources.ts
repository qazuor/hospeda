/**
 * The `SUSCRIPCIÓN` source of billing's real `coverage()` (contract §2, §2.6;
 * AC:B4:1): one source per live PRINCIPAL subscription row of the
 * `(user, vertical)`, read from the `subscription` table.
 */
import type { CoverageArgs, CoverageSource } from '@repo/billing-verticals-contract';
import {
    and,
    type DrizzleClient,
    eq,
    getDb,
    inArray,
    notInArray,
    subscriptions,
    TITLE_EMITTING_STATUSES
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { BillingCoveragePorts } from './coverage-ports';

/**
 * Successor states that have NOT authorized: a predecessor pointed at by a
 * successor in one of these still emits (contract §2.6, "emite sólo la
 * sucesora"; HOS-1532 I-3).
 */
const UNAUTHORIZED_SUCCESSOR_STATUSES = ['PENDING_AUTHORIZATION', 'ABANDONED'] as const;

/** One emitting status (`TITLE_EMITTING_STATUSES` of `@repo/db`). */
type TitleEmittingStatus = (typeof TITLE_EMITTING_STATUSES)[number];

/** The columns of a subscription row this source reads. */
interface SubscriptionSourceRow {
    readonly id: string;
    readonly planVersionId: string | null;
    readonly status: string;
    readonly serviceEndsAt: Date | null;
    readonly createdAt: Date;
}

/** Fails on a row the schema should have made impossible; never emits an invented field. */
function inconsistentRow(args: { readonly subscriptionId: string; readonly why: string }): never {
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `Subscription ${args.subscriptionId} cannot be emitted as a coverage source: ${args.why}`,
        undefined,
        'COVERAGE_SUBSCRIPTION_ROW_INCONSISTENT'
    );
}

/** Narrows a status read from the row to one of the emitting statuses. */
function isTitleEmittingStatus(status: string): status is TitleEmittingStatus {
    return (TITLE_EMITTING_STATUSES as readonly string[]).includes(status);
}

/**
 * The `until` of a subscription source by its state (contract §2.6, the table
 * of the nine states): `NO_KNOWN_DATE` while it renews itself, the end of
 * service once a cancellation is scheduled. Never the end of the period.
 */
function untilOf(args: {
    readonly row: SubscriptionSourceRow;
    readonly status: TitleEmittingStatus;
}): Date | 'NO_KNOWN_DATE' {
    const { row, status } = args;
    switch (status) {
        case 'ACTIVE':
        case 'GRACE_PERIOD':
            return 'NO_KNOWN_DATE';
        case 'CANCEL_SCHEDULED':
            if (!row.serviceEndsAt) {
                return inconsistentRow({
                    subscriptionId: row.id,
                    why: 'CANCEL_SCHEDULED without service_ends_at'
                });
            }
            return row.serviceEndsAt;
        default: {
            const exhaustive: never = status;
            return exhaustive;
        }
    }
}

/**
 * Resolves the `SUBSCRIPTION` sources of one `(user, vertical)`.
 *
 * Emits one source per PRINCIPAL row in `ACTIVE`, `GRACE_PERIOD` or
 * `CANCEL_SCHEDULED` (contract §2.6), except a row whose successor (a row
 * pointing at it by `succeeds_id`) already authorized, and a scheduled
 * cancellation whose end of service is already past. `charged` is the
 * credited-payment ledger; `floor` is always `null` (it only exists on a GRANT).
 *
 * @param args.userId - The person
 * @param args.vertical - The vertical asked about
 * @param args.ports - Clock and payment ledger
 * @param args.tx - Optional transaction every read runs in
 * @returns `{ sources }`
 */
export async function resolveSubscriptionSources(args: {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
    readonly ports: Pick<BillingCoveragePorts, 'clock' | 'payments'>;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly sources: CoverageSource[] }> {
    const db = args.tx ?? getDb();
    const rows: SubscriptionSourceRow[] = await db
        .select({
            id: subscriptions.id,
            planVersionId: subscriptions.planVersionId,
            status: subscriptions.status,
            serviceEndsAt: subscriptions.serviceEndsAt,
            createdAt: subscriptions.createdAt
        })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.userId, args.userId),
                eq(subscriptions.vertical, args.vertical),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, [...TITLE_EMITTING_STATUSES])
            )
        );
    if (rows.length === 0) return { sources: [] };

    const authorizedSuccessors = await db
        .select({ predecessorId: subscriptions.succeedsId })
        .from(subscriptions)
        .where(
            and(
                inArray(
                    subscriptions.succeedsId,
                    rows.map((row) => row.id)
                ),
                notInArray(subscriptions.status, [...UNAUTHORIZED_SUCCESSOR_STATUSES])
            )
        );
    const succeeded = new Set(authorizedSuccessors.map((successor) => successor.predecessorId));
    const now = args.ports.clock.now().getTime();

    const sources: CoverageSource[] = [];
    for (const row of rows) {
        if (succeeded.has(row.id)) continue;
        if (!isTitleEmittingStatus(row.status)) continue;
        if (!row.planVersionId) {
            inconsistentRow({ subscriptionId: row.id, why: 'PRINCIPAL without plan_version_id' });
        }
        const until = untilOf({ row, status: row.status });
        if (until instanceof Date && until.getTime() <= now) continue;
        sources.push({
            type: 'SUBSCRIPTION',
            reference: { kind: 'PLAN_VERSION', planVersionId: row.planVersionId },
            scope: 'VERTICAL',
            target: null,
            since: row.createdAt,
            until,
            charged: await args.ports.payments.hasCreditedPayment({
                subscriptionId: row.id,
                tx: args.tx
            }),
            floor: null
        });
    }
    return { sources };
}
