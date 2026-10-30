/**
 * The real `COURTESY` source of billing coverage (contract §2.6; AC:B9a:12).
 * It reads an open COURTESY pause and its non-deferred courtesy grant; a
 * CUSTOMER_REQUEST pause has already forfeited that courtesy.
 */
import type { CoverageArgs, CoverageSource } from '@repo/billing-verticals-contract';
import {
    and,
    courtesyGrants,
    eq,
    getDb,
    isNull,
    subscriptions,
    subscriptionPauses,
    type DrizzleClient
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import type { BillingCoveragePorts } from './coverage-ports';

interface CourtesyPauseRow {
    readonly subscriptionId: string;
    readonly planVersionId: string | null;
    readonly pauseReason: string;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly balanceMonths: number | null;
}

function inconsistentRow(args: { readonly subscriptionId: string; readonly why: string }): never {
    throw new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `Courtesy pause for subscription ${args.subscriptionId} cannot be emitted: ${args.why}`,
        undefined,
        'COVERAGE_COURTESY_ROW_INCONSISTENT'
    );
}

/**
 * Resolves non-deferred courtesy sources for one `(user, vertical)`.
 *
 * Only a principal in PAUSED with an open COURTESY pause and a future end
 * emits. Deferred grants and CUSTOMER_REQUEST pauses do not emit.
 *
 * @param args.userId - The person whose courtesy is read
 * @param args.vertical - The vertical asked about
 * @param args.ports - Clock used to exclude expired courtesy periods
 * @param args.tx - Optional transaction every read runs in
 * @returns `{ sources }`
 */
export async function resolveCourtesySources(args: {
    readonly userId: string;
    readonly vertical: CoverageArgs['vertical'];
    readonly ports: Pick<BillingCoveragePorts, 'clock'>;
    readonly tx?: DrizzleClient;
}): Promise<{ readonly sources: CoverageSource[] }> {
    const db = args.tx ?? getDb();
    const rows: CourtesyPauseRow[] = await db
        .select({
            subscriptionId: subscriptions.id,
            planVersionId: subscriptions.planVersionId,
            pauseReason: subscriptionPauses.reason,
            startsAt: courtesyGrants.startsAt,
            endsAt: courtesyGrants.endsAt,
            balanceMonths: courtesyGrants.balanceMonths
        })
        .from(subscriptions)
        .innerJoin(subscriptionPauses, eq(subscriptionPauses.subscriptionId, subscriptions.id))
        .leftJoin(courtesyGrants, eq(courtesyGrants.subscriptionId, subscriptions.id))
        .where(
            and(
                eq(subscriptions.userId, args.userId),
                eq(subscriptions.vertical, args.vertical),
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'PAUSED'),
                isNull(subscriptionPauses.actualEndAt)
            )
        );
    const now = args.ports.clock.now().getTime();
    const sources: CoverageSource[] = [];
    for (const row of rows) {
        if (row.pauseReason !== 'COURTESY') continue;
        if (row.startsAt === null || row.endsAt === null) {
            inconsistentRow({ subscriptionId: row.subscriptionId, why: 'missing courtesy grant' });
        }
        if (!row.planVersionId) {
            inconsistentRow({ subscriptionId: row.subscriptionId, why: 'missing plan_version_id' });
        }
        if (row.balanceMonths !== null) {
            inconsistentRow({
                subscriptionId: row.subscriptionId,
                why: 'open COURTESY pause has no non-deferred courtesy grant'
            });
        }
        if (row.endsAt.getTime() <= now) continue;
        sources.push({
            type: 'COURTESY',
            reference: { kind: 'PLAN_VERSION', planVersionId: row.planVersionId },
            scope: 'VERTICAL',
            target: null,
            since: row.startsAt,
            until: row.endsAt,
            charged: null,
            floor: null
        });
    }
    return { sources };
}
