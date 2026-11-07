import {
    addonInstances,
    addonProducts,
    and,
    eq,
    getDb,
    inArray,
    type LiveRowUnderLiveGrantAnchor,
    type ReconciliationMarkReason,
    reconciliationZeroCallModel,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import { recordDivergence } from './reconciliation-divergence.js';
import { SweepLeaseLostError, SweepTimedOutError } from './sweep-control.js';
import type { AddonWithoutShutdownPorts } from './zero-call-ports.js';

const logger = createLogger('billing-reconciliation-sweep');
const CHECK = 'GRANT_FAN_OUT_INCOMPLETE' as const;
const REASON: ReconciliationMarkReason = 'FAN_OUT_DE_GRANT_INCOMPLETO';

/** Counts and isolated row failures from the third zero-call check. */
export interface GrantFanOutResult {
    readonly result: {
        readonly check: typeof CHECK;
        readonly examined: number;
        readonly marksOpened: number;
        readonly marksAccumulated: number;
        readonly resolved: number;
    };
    readonly failures: ReadonlyArray<{
        readonly check: typeof CHECK;
        readonly subjectId: string | null;
        readonly message: string;
    }>;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function hasS20Candidate(
    row: LiveRowUnderLiveGrantAnchor,
    orphanhood: AddonWithoutShutdownPorts
): Promise<boolean> {
    const db = getDb();
    const instances = await db
        .select({
            addonVersionId: addonInstances.addonVersionId,
            targetId: addonInstances.targetId,
            compatibleVerticals: addonProducts.compatibleVerticals
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(
            and(
                eq(addonInstances.ownerId, row.userId),
                eq(addonInstances.complementSubscriptionId, row.subscriptionId),
                inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE'])
            )
        )
        .orderBy(addonInstances.id);
    for (const instance of instances) {
        const { scopeType } = await orphanhood.addonPolicy({
            addonVersionId: instance.addonVersionId
        });
        let targetVertical: string | undefined;
        switch (scopeType) {
            case 'VERTICAL_SUBSCRIPTION': {
                if (instance.targetId === null) throw new Error('S20 vertical addon has no target');
                const [target] = await db
                    .select({ vertical: subscriptions.vertical })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, instance.targetId));
                if (!target) throw new Error('S20 vertical addon target is missing');
                if (target.vertical === null)
                    throw new Error('S20 vertical addon target has no vertical');
                targetVertical = target.vertical ?? undefined;
                break;
            }
            case 'LISTING': {
                if (instance.targetId === null) throw new Error('S20 listing addon has no target');
                const listing = await orphanhood.listing({ listingId: instance.targetId });
                targetVertical = listing.vertical;
                break;
            }
            case 'USER':
            case 'GLOBAL':
                break;
            default: {
                const exhaustive: never = scopeType;
                throw new Error(`Unknown S20 addon scope: ${exhaustive}`);
            }
        }
        if (
            row.anchoredVerticals.some(
                (vertical) =>
                    instance.compatibleVerticals.includes(vertical) &&
                    (targetVertical === undefined || targetVertical === vertical)
            )
        )
            return true;
    }
    return false;
}

/**
 * B/09 §3's third check detects incomplete S13/S20 fan-out as one check, with no race
 * exception. Its only outcome is a mark; a person resumes S13/S20 via
 * resumePermanentGrant, which this check never invokes. It cannot inspect provider state
 * or grants without anchors. Without the orphanhood port it skips the S20 half.
 *
 * @param input Correlation id and optional keyset page size.
 * @param ports Optional S20 readers, mark payment port, and sweep heartbeat.
 * @returns Counts and isolated row failures; no provider calls or cancellations.
 */
export async function runGrantFanOutCheck(
    input: { readonly correlationId: string; readonly pageSize?: number },
    ports: {
        readonly orphanhood?: AddonWithoutShutdownPorts;
        readonly markPayments?: ReconciliationMarkPayments;
        readonly heartbeat?: () => Promise<void>;
    }
): Promise<GrantFanOutResult> {
    const pageSize = input.pageSize ?? 100;
    const result = { check: CHECK, examined: 0, marksOpened: 0, marksAccumulated: 0, resolved: 0 };
    const failures: Array<GrantFanOutResult['failures'][number]> = [];
    if (!ports.orphanhood)
        logger.warn(
            { correlationId: input.correlationId },
            'Grant fan-out check skips S20 without orphanhood port'
        );
    let cursor: string | undefined;
    for (;;) {
        const page = await reconciliationZeroCallModel.listLiveRowsUnderLiveGrantAnchorsPage({
            afterSubscriptionId: cursor,
            limit: pageSize
        });
        for (const row of page) {
            result.examined++;
            try {
                const diverges =
                    row.class === 'PRINCIPAL' ||
                    (ports.orphanhood !== undefined &&
                        (await hasS20Candidate(row, ports.orphanhood)));
                if (!diverges) continue;
                const recorded = await recordDivergence(
                    {
                        subscriptionId: row.subscriptionId,
                        divergence: { reason: REASON },
                        correlationId: input.correlationId
                    },
                    ports.markPayments ? { markPayments: ports.markPayments } : {}
                );
                if (recorded.markOutcome === 'OPENED') result.marksOpened++;
                else result.marksAccumulated++;
            } catch (error) {
                if (error instanceof SweepLeaseLostError || error instanceof SweepTimedOutError)
                    throw error;
                failures.push({
                    check: CHECK,
                    subjectId: row.subscriptionId,
                    message: messageOf(error)
                });
            }
        }
        await ports.heartbeat?.();
        if (page.length < pageSize) break;
        cursor = page.at(-1)?.subscriptionId;
    }
    return { result, failures };
}
