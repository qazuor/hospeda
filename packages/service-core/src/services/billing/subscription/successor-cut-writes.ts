import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    type COURTESY_CLOSE_REASONS,
    courtesyGrants,
    type DrizzleClient,
    eq,
    inArray,
    isNotNull,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    manualPayments,
    providerLinks,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CancelledAddon } from '../addon/addon-instance-a5';
import { runOrphanhood } from '../addon/addon-instance-a5';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports';
import { recordCoverageLossIfUncovered } from '../coverage/coverage-loss';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';

const inputSchema = z.strictObject({ predecessorSubscriptionId: z.uuid() });
export type SuccessorState = 'PENDING_AUTHORIZATION' | 'ACTIVE';
export type SuccessorTargetState = 'ABANDONED' | 'CANCELLED';
export type SuccessorCutWrite =
    | { readonly outcome: 'NO_LIVE_SUCCESSOR' }
    | {
          readonly outcome: 'CUT';
          readonly successorId: string;
          readonly predecessorId: string;
          readonly from: SuccessorState;
          readonly to: SuccessorTargetState;
          readonly userId: string;
          readonly vertical: string;
          readonly paymentMethod: string;
          readonly authorizationId: string | null;
          readonly closedCourtesyMonths: number | null;
          readonly manualInstallmentClosed: boolean;
          readonly cancelledAddons: readonly CancelledAddon[];
          readonly cancellationDecided: boolean;
      };

/** Turns the successor off in the caller's transaction (TRANS:B:S31, AC:B8b:13). */
export async function writeSuccessorCutStatus(input: {
    readonly tx: DrizzleClient;
    readonly successorId: string;
    readonly from: SuccessorState;
    readonly to: SuccessorTargetState;
    readonly now: Date;
}): Promise<void> {
    const rows = await input.tx
        .update(subscriptions)
        .set({ status: input.to, updatedAt: input.now })
        .where(and(eq(subscriptions.id, input.successorId), eq(subscriptions.status, input.from)))
        .returning({ id: subscriptions.id });
    if (rows.length !== 1)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Successor changed during cut',
            undefined,
            'SUCCESSOR_CUT_LOST_RACE'
        );
}

/** Writes S31 in the caller's transaction (TRANS:B:S31, AC:B8b:13). */
export async function cutSuccessorWrites(
    input: {
        readonly predecessorSubscriptionId: string;
        readonly tx: DrizzleClient;
    },
    ports: {
        readonly clock: Clock;
        readonly orphanhood: AddonOrphanhoodPorts;
        readonly writeStatus?: typeof writeSuccessorCutStatus;
    }
): Promise<SuccessorCutWrite> {
    const { predecessorSubscriptionId } = inputSchema.parse({
        predecessorSubscriptionId: input.predecessorSubscriptionId
    });
    const [successor] = await input.tx
        .select({
            id: subscriptions.id,
            status: subscriptions.status,
            predecessorRef: subscriptions.succeedsId,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            paymentMethod: subscriptions.paymentMethod
        })
        .from(subscriptions)
        .where(
            and(
                eq(subscriptions.succeedsId, predecessorSubscriptionId),
                eq(subscriptions.class, 'PRINCIPAL'),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        )
        .limit(1)
        .for('update');
    if (!successor) return { outcome: 'NO_LIVE_SUCCESSOR' };
    const [providerLink] = await input.tx
        .select({ providerId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, successor.id))
        .limit(1);
    if (successor.status !== 'PENDING_AUTHORIZATION' && successor.status !== 'ACTIVE') {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Successor is in an unsupported live state',
            undefined,
            'SUCCESSOR_CUT_UNSUPPORTED_STATE'
        );
    }
    const from = successor.status;
    const to = from === 'PENDING_AUTHORIZATION' ? 'ABANDONED' : 'CANCELLED';
    const now = ports.clock.now();
    await (ports.writeStatus ?? writeSuccessorCutStatus)({
        tx: input.tx,
        successorId: successor.id,
        from,
        to,
        now
    });
    let manualInstallmentClosed = false;
    if (from === 'PENDING_AUTHORIZATION' && successor.paymentMethod === 'MANUAL') {
        const rows = await input.tx
            .update(manualPayments)
            .set({ status: 'DECLARED_UNPAID' })
            .where(
                and(
                    eq(manualPayments.subscriptionId, successor.id),
                    eq(manualPayments.status, 'AWAITING')
                )
            )
            .returning({ id: manualPayments.id });
        manualInstallmentClosed = rows.length > 0;
    }
    const predecessorRows = input.tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.succeededById, successor.id));
    const grants = await input.tx
        .update(courtesyGrants)
        .set({
            balanceClosedAt: now,
            closeReason:
                'CONTRACARGO_DE_LA_PREDECESORA' satisfies (typeof COURTESY_CLOSE_REASONS)[number]
        })
        .where(
            and(
                inArray(courtesyGrants.subscriptionId, predecessorRows),
                isNotNull(courtesyGrants.balanceMonths),
                isNull(courtesyGrants.balanceClosedAt)
            )
        )
        .returning({ balanceMonths: courtesyGrants.balanceMonths });
    const closedCourtesyMonths = grants.length
        ? grants.reduce((sum, row) => sum + (row.balanceMonths ?? 0), 0)
        : null;
    const cancellationDecided = successor.paymentMethod === 'CARD' && Boolean(providerLink);
    if (cancellationDecided)
        await recordProviderCancellationDecided({
            subscriptionId: successor.id,
            transition: 'S31',
            decidedAt: now,
            actor: { type: 'job' },
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: from, new: to }],
            tx: input.tx
        });
    const { cancelled } = await runOrphanhood(
        { tx: input.tx, subscriptionId: successor.id, now },
        ports.orphanhood
    );
    if (from === 'ACTIVE' && successor.userId && successor.vertical)
        await recordCoverageLossIfUncovered({
            tx: input.tx,
            userId: successor.userId,
            vertical: successor.vertical,
            lostAt: now,
            clock: ports.clock
        });
    return {
        outcome: 'CUT',
        successorId: successor.id,
        predecessorId: predecessorSubscriptionId,
        from,
        to,
        userId: successor.userId ?? '',
        vertical: successor.vertical ?? '',
        paymentMethod: successor.paymentMethod ?? '',
        authorizationId: providerLink?.providerId ?? null,
        closedCourtesyMonths,
        manualInstallmentClosed,
        cancelledAddons: cancelled,
        cancellationDecided
    };
}
