import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
    eq,
    getDb,
    gt,
    inArray,
    isNotNull,
    permanentGrants,
    permanentGrantVerticals,
    type ReconciliationMarkReason
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { isAddonInstanceOrphaned } from '../../addon/addon-orphanhood.js';
import type { AddonOrphanhoodPorts } from '../../addon/addon-orphanhood-ports.js';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port.js';
import { recordDivergence } from './reconciliation-divergence.js';

const logger = createLogger('billing-reconciliation-sweep');
const CHECK = 'ADDON_LIVE_ON_DEAD_TARGET' as const;
const REASON: ReconciliationMarkReason = 'ADDON_SIN_APAGAR';

/** The counts and per-instance failures produced by the fourth zero-call check. */
export interface AddonWithoutShutdownResult {
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

/**
 * Scans live addon instances and opens ADDON_SIN_APAGAR when A5's orphanhood predicate or a
 * revoked title anchor says they should have been shut down. This check makes zero provider
 * calls and never cancels an instance; its only outcome is a reconciliation mark.
 */
export async function runAddonWithoutShutdownCheck(
    input: { readonly correlationId: string; readonly pageSize?: number },
    ports: {
        readonly orphanhood: AddonOrphanhoodPorts;
        readonly markPayments?: ReconciliationMarkPayments;
    }
): Promise<AddonWithoutShutdownResult> {
    const pageSize = input.pageSize ?? 100;
    const result = { check: CHECK, examined: 0, marksOpened: 0, marksAccumulated: 0, resolved: 0 };
    const failures: Array<AddonWithoutShutdownResult['failures'][number]> = [];
    const db = getDb();
    let cursor: string | undefined;
    for (;;) {
        const query = db
            .select({ id: addonInstances.id })
            .from(addonInstances)
            .where(
                and(
                    inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE']),
                    ...(cursor ? [gt(addonInstances.id, cursor)] : [])
                )
            )
            .orderBy(addonInstances.id)
            .limit(pageSize);
        const page = await query;
        for (const { id } of page) {
            result.examined++;
            try {
                const decision = await db.transaction(
                    async (tx) => {
                        // HOS-1547 (AC:B5:36): the fichaPurgada half runs A6 first, before this verdict
                        const verdict = await verdictOf(tx, id, ports.orphanhood);
                        const [instance] = await tx
                            .select({
                                complementSubscriptionId: addonInstances.complementSubscriptionId
                            })
                            .from(addonInstances)
                            .where(eq(addonInstances.id, id))
                            .limit(1);
                        return {
                            verdict,
                            complementSubscriptionId: instance?.complementSubscriptionId
                        };
                    },
                    { accessMode: 'read only' }
                );
                const { verdict, complementSubscriptionId } = decision;
                if (verdict === 'LIVE') continue;
                if (!complementSubscriptionId) {
                    logger.warn(
                        { instanceId: id },
                        'Live orphaned addon has no complement subscription to mark'
                    );
                    continue;
                }
                const recorded = await recordDivergence(
                    {
                        subscriptionId: complementSubscriptionId,
                        divergence: {
                            reason: REASON,
                            detail: [
                                { field: 'addon_instance.id', new: id },
                                { field: 'verdict', new: verdict }
                            ]
                        },
                        correlationId: input.correlationId
                    },
                    ports.markPayments ? { markPayments: ports.markPayments } : {}
                );
                if (recorded.markOutcome === 'OPENED') result.marksOpened++;
                else result.marksAccumulated++;
            } catch (error) {
                failures.push({
                    check: CHECK,
                    subjectId: id,
                    message: error instanceof Error ? error.message : String(error)
                });
            }
        }
        if (page.length < pageSize) break;
        cursor = page.at(-1)?.id;
    }
    return { result, failures };
}

async function verdictOf(
    tx: DrizzleClient,
    instanceId: string,
    orphanhood: AddonOrphanhoodPorts
): Promise<'LIVE' | 'DEAD_TARGET' | 'REVOKED_ANCHOR'> {
    const [row] = await tx
        .select({
            id: addonInstances.id,
            ownerId: addonInstances.ownerId,
            targetId: addonInstances.targetId,
            status: addonInstances.status,
            addonVersionId: addonInstances.addonVersionId,
            compatibleVerticals: addonProducts.compatibleVerticals,
            titleAnchorId: addonInstances.titleAnchorId
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .where(eq(addonInstances.id, instanceId))
        .limit(1);
    if (!row) throw new Error(`Addon instance ${instanceId} disappeared during sweep`);
    const { scopeType } = await orphanhood.addonPolicy({ addonVersionId: row.addonVersionId });
    const orphaned = await isAddonInstanceOrphaned(
        {
            tx,
            instance: {
                id: row.id,
                ownerId: row.ownerId,
                targetId: row.targetId,
                compatibleVerticals: row.compatibleVerticals
            },
            scopeType
        },
        orphanhood
    );
    if (orphaned) return 'DEAD_TARGET';
    if (row.titleAnchorId) {
        const [grant] = await tx
            .select({ revokedAt: permanentGrants.revokedAt })
            .from(permanentGrantVerticals)
            .innerJoin(
                permanentGrants,
                eq(permanentGrants.id, permanentGrantVerticals.permanentGrantId)
            )
            .where(
                and(
                    eq(permanentGrantVerticals.id, row.titleAnchorId),
                    isNotNull(permanentGrants.revokedAt)
                )
            )
            .limit(1);
        if (grant) return 'REVOKED_ANCHOR';
    }
    return 'LIVE';
}
