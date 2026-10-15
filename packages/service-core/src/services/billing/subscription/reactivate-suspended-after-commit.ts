import { createLogger } from '@repo/logger';
import { VerticalEnumSchema } from '@repo/schemas';
import type { CoverageNotices } from '../payment/payment-ports';
import type { CancelInheritedTouristVipSummary } from './cancel-inherited-tourist-vip.service';
import { cancelInheritedTouristVips } from './cancel-inherited-tourist-vip.service';
import type { ReactivateSuspendedPorts } from './reactivate-suspended.service';

const logger = createLogger('reactivate-suspended');

/**
 * Emits `ADDED` once the row's transaction committed (AC:B4:2, G5 `via: "notice"`):
 * the row emits a source again. A notice failure is logged and undoes nothing.
 */
export async function emitAddedAfterCommit(input: {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const vertical = VerticalEnumSchema.safeParse(input.vertical);
    if (!input.userId || !vertical.success) {
        logger.error(
            { subscriptionId: input.subscriptionId, vertical: input.vertical },
            'Reactivated subscription has no coverage subject to notify'
        );
        return;
    }
    try {
        await input.coverageNotices.emitCoverageChanged({
            userId: input.userId,
            vertical: vertical.data,
            sourceType: 'SUBSCRIPTION',
            change: 'ADDED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Coverage changed notice failed after reactivation commit'
        );
    }
}

/**
 * The mirror of S2's clause (AC:B7:31): once S7 committed, a plan that grants
 * Tourist VIP again cancels the user's paid Tourist VIP, our email first and no
 * refund. The clause rereads inheritance, the VIP rows and their authorizations
 * itself; nothing decided before S7's transaction is passed in. An unwired port
 * or a failure is logged and undoes nothing: `sweepInheritedTouristVips` retries.
 */
export async function cancelInheritedTouristVipAfterCommit(input: {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly ports: ReactivateSuspendedPorts;
}): Promise<CancelInheritedTouristVipSummary | undefined> {
    const { ports } = input;
    if (!input.userId || !ports.beforeCancelNotice || !ports.touristVipInheritance) {
        logger.warn(
            { subscriptionId: input.subscriptionId, userId: input.userId },
            'Tourist VIP clause not wired; the window-expiry sweep retries'
        );
        return undefined;
    }
    try {
        return await cancelInheritedTouristVips(
            { userId: input.userId },
            {
                provider: ports.provider,
                clock: ports.clock,
                beforeCancelNotice: ports.beforeCancelNotice,
                touristVipInheritance: ports.touristVipInheritance,
                coverageNotices: ports.coverageNotices
            }
        );
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Inherited Tourist VIP cancellation will be retried'
        );
        return undefined;
    }
}
