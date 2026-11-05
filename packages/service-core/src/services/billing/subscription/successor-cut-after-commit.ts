import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { emitAddonCoverageRemoved } from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import type { CoverageNotices } from '../payment/payment-ports';
import { writeSuccessorCutStatus } from './successor-cut-writes';
import type { SuccessorCutResult } from './successor-cutter';
import { createSuccessorCutter } from './successor-cutter';

const logger = createLogger('successor-cut-after-commit');
const runInputSchema = z.strictObject({ predecessorSubscriptionId: z.uuid() });
/** Runs the predecessor write and S31 in one transaction, then emits after commit (AC:B8b:13). */
export async function runWithSuccessorCut<T>(input: {
    readonly db: DrizzleClient;
    readonly work: (tx: DrizzleClient) => Promise<T>;
    readonly predecessorSubscriptionId: string;
    readonly ports: {
        readonly clock: Clock;
        readonly orphanhood: AddonOrphanhoodPorts;
        readonly coverageNotices?: CoverageNotices;
    };
}): Promise<{ readonly value: T; readonly cut: SuccessorCutResult }> {
    const parsed = runInputSchema.parse({
        predecessorSubscriptionId: input.predecessorSubscriptionId
    });
    const cutter = createSuccessorCutter({
        clock: input.ports.clock,
        orphanhood: input.ports.orphanhood,
        writeStatus: (write) => writeSuccessorCutStatus(write)
    });
    const committed = await input.db.transaction(async (tx) => {
        const value = await input.work(tx);
        const cut = await cutter.cutSuccessor({
            predecessorSubscriptionId: parsed.predecessorSubscriptionId,
            tx
        });
        return { value, cut };
    });
    await completeSuccessorCut(committed.cut, { coverageNotices: input.ports.coverageNotices });
    return committed;
}

/** Emits coverage notices after the caller commits; failures never undo S31 (AC:B8b:13). */
export async function completeSuccessorCut(
    cut: SuccessorCutResult,
    ports: { readonly coverageNotices?: CoverageNotices }
): Promise<void> {
    if (cut.outcome !== 'CUT') return;
    const notices = ports.coverageNotices;
    if (!notices) return;
    if (cut.from === 'ACTIVE') {
        const vertical = VerticalEnumSchema.safeParse(cut.vertical);
        if (vertical.success) {
            try {
                await notices.emitCoverageChanged({
                    userId: cut.userId,
                    vertical: vertical.data,
                    sourceType: 'SUBSCRIPTION',
                    change: 'REMOVED'
                });
            } catch (error) {
                logger.error(
                    { successorId: cut.successorId, error },
                    'Successor coverage notice failed after S31 commit'
                );
            }
        }
    }
    try {
        if (cut.cancelledAddons.length > 0)
            await emitAddonCoverageRemoved({
                cancelled: cut.cancelledAddons,
                coverageNotices: notices
            });
    } catch (error) {
        logger.error(
            { successorId: cut.successorId, error },
            'Addon coverage notice failed after S31 commit'
        );
    }
}
