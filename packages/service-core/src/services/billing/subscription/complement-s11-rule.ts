import type { Clock } from '@repo/billing-verticals-contract';
import { and, type DrizzleClient, eq, inArray, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import {
    type CancelOurAuthorizationOutcome,
    cancelOurAuthorization
} from '../reconciliation/cancel-our-authorization.js';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { selectComplementTargets } from './complement-selection.js';
import type { BeforeCancelNotice } from './start-subscription.service.js';
import {
    type CancellationSeenAnnotator,
    noCancellationSeenAnnotation,
    recordAuthorizationSeenAlive,
    recordCancellationSeen
} from './subscription-billing-ports.js';

const logger = createLogger('complement-s11-rule');
const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined),
    principalSubscriptionId: z.uuid(),
    now: z.date()
});
const providerInputSchema = z.strictObject({
    decided: z.array(
        z.strictObject({
            subscriptionId: z.uuid(),
            userId: z.uuid(),
            authorizationId: z.string().min(1)
        })
    )
});

/** A complement cancellation decision for the after-commit provider half. */
export interface DecidedComplementCancellation {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly authorizationId: string;
}

/** Outcomes of one best-effort provider call for a decided complement cancellation. */
export type DecidedComplementCancellationCall =
    | { readonly subscriptionId: string; readonly cancelCall: 'SENT' }
    | { readonly subscriptionId: string; readonly cancelCall: 'NOT_NEEDED' }
    | { readonly subscriptionId: string; readonly cancelCall: 'NOTICE_PENDING' }
    | { readonly subscriptionId: string; readonly cancelCall: 'FAILED' };

const CALL_BY_OUTCOME: Readonly<
    Record<CancelOurAuthorizationOutcome, DecidedComplementCancellationCall['cancelCall']>
> = {
    ALREADY_CANCELLED: 'NOT_NEEDED',
    NOTICE_PENDING: 'NOTICE_PENDING',
    CALL_FAILED: 'FAILED',
    CONFIRMED: 'SENT',
    SENT_UNCONFIRMED: 'SENT'
};

/** Writes one complement row to CANCEL_SCHEDULED while its active state is locked. */
async function writeComplementCancelScheduled(input: {
    readonly tx: DrizzleClient;
    readonly complementSubscriptionId: string;
    readonly serviceEndsAt: Date;
    readonly now: Date;
}): Promise<boolean> {
    const [row] = await input.tx
        .select({ id: subscriptions.id, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.complementSubscriptionId))
        .for('update')
        .limit(1);
    if (!row || row.status !== 'ACTIVE') return false;
    const [updated] = await input.tx
        .update(subscriptions)
        .set({
            status: 'CANCEL_SCHEDULED',
            serviceEndsAt: input.serviceEndsAt,
            updatedAt: input.now
        })
        .where(and(eq(subscriptions.id, row.id), eq(subscriptions.status, 'ACTIVE')))
        .returning({ id: subscriptions.id });
    return Boolean(updated);
}

/**
 * Applies the local half of the S11 complement rule inside the caller's transaction.
 * The principal must already be CANCEL_SCHEDULED and have its service end written.
 * @param input - The transaction, transitioned principal id, and transition instant
 * @param ports - Complement policy readers
 * @returns Provider cancellation decisions to execute after commit
 * @throws If the principal is not in the required post-update state or database reads fail
 */
export async function cancelComplementsByS11Rule(
    input: {
        readonly tx: DrizzleClient;
        readonly principalSubscriptionId: string;
        readonly now: Date;
    },
    ports: ComplementPolicyPorts
): Promise<{ readonly decided: readonly DecidedComplementCancellation[] }> {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) throw new Error(`Invalid S11 complement input: ${parsed.error.message}`);
    const { tx, principalSubscriptionId, now } = parsed.data;
    const [principal] = await tx
        .select({
            id: subscriptions.id,
            userId: subscriptions.userId,
            vertical: subscriptions.vertical,
            class: subscriptions.class,
            status: subscriptions.status,
            serviceEndsAt: subscriptions.serviceEndsAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, principalSubscriptionId))
        .for('update')
        .limit(1);
    if (
        !principal ||
        principal.class !== 'PRINCIPAL' ||
        principal.status !== 'CANCEL_SCHEDULED' ||
        !principal.serviceEndsAt ||
        !principal.userId ||
        !principal.vertical
    )
        throw new Error(
            `S11 requires a CANCEL_SCHEDULED principal with service end: ${principalSubscriptionId}`
        );

    const selection = await selectComplementTargets(
        {
            tx,
            principal: { id: principal.id, userId: principal.userId, vertical: principal.vertical },
            rule: 'CANCEL',
            complementStatus: 'ACTIVE'
        },
        ports
    );
    const decided: DecidedComplementCancellation[] = [];
    for (const target of selection.targets) {
        let serviceEndsAt = principal.serviceEndsAt;
        if (target.scopeType === 'USER' || target.scopeType === 'GLOBAL') {
            const compatible = [...new Set([...target.compatibleVerticals, principal.vertical])];
            const anchors = await tx
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.userId, principal.userId),
                        eq(subscriptions.class, 'PRINCIPAL'),
                        eq(subscriptions.status, 'CANCEL_SCHEDULED'),
                        inArray(subscriptions.vertical, compatible)
                    )
                );
            const latest = anchors.reduce<Date>(
                (end, row) =>
                    row.serviceEndsAt && row.serviceEndsAt > end ? row.serviceEndsAt : end,
                principal.serviceEndsAt
            );
            serviceEndsAt = latest;
        }
        const written = await writeComplementCancelScheduled({
            tx,
            complementSubscriptionId: target.complementSubscriptionId,
            serviceEndsAt,
            now
        });
        if (!written || target.paymentMethod !== 'CARD' || !target.authorizationId) continue;
        await recordProviderCancellationDecided({
            subscriptionId: target.complementSubscriptionId,
            transition: 'S11',
            decidedAt: now,
            actor: { type: 'job' },
            correlationId: crypto.randomUUID(),
            changes: [{ field: 'status', old: 'ACTIVE', new: 'CANCEL_SCHEDULED' }],
            tx
        });
        decided.push({
            subscriptionId: target.complementSubscriptionId,
            userId: target.ownerId,
            authorizationId: target.authorizationId
        });
    }
    return { decided };
}

/**
 * Cancels the provider authorizations for S11 decisions after the deciding transaction commits.
 * Each row is isolated: failures are logged and left to the live cancellation retry sweep.
 * @param input - Local decisions returned by {@link cancelComplementsByS11Rule}
 * @param ports - Provider, clock, before-cancel notice, and optional observation annotator
 * @returns One best-effort outcome for each decision
 */
export async function cancelDecidedComplementsAtProvider(
    input: { readonly decided: readonly DecidedComplementCancellation[] },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly beforeCancelNotice: BeforeCancelNotice;
        readonly cancellationSeen?: CancellationSeenAnnotator;
    }
): Promise<{ readonly results: readonly DecidedComplementCancellationCall[] }> {
    const parsed = providerInputSchema.safeParse(input);
    if (!parsed.success) {
        logger.error({ error: parsed.error }, 'Invalid S11 provider cancellation input');
        return { results: [] };
    }
    const results: DecidedComplementCancellationCall[] = [];
    const annotator = ports.cancellationSeen ?? noCancellationSeenAnnotation;
    for (const target of parsed.data.decided) {
        try {
            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
            actStartInstant({ act });
            const read = await ports.provider.readAuthorization({
                authorizationId: target.authorizationId
            });
            const { snapshot, readAt } = assertFreshForAct({ read, act });
            if (snapshot.status === 'cancelled')
                await recordCancellationSeen({
                    annotator,
                    subscriptionId: target.subscriptionId,
                    seenAt: readAt
                });
            else
                await recordAuthorizationSeenAlive({
                    annotator,
                    subscriptionId: target.subscriptionId,
                    seenAt: readAt
                });
            const { outcome } = await cancelOurAuthorization(
                { ...target, kind: 'SCHEDULED_CANCELLATION', prior: { read, act } },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    beforeCancelNotice: ports.beforeCancelNotice
                }
            );
            if (outcome === 'CONFIRMED')
                await recordCancellationSeen({
                    annotator,
                    subscriptionId: target.subscriptionId,
                    seenAt: ports.clock.now()
                });
            results.push({
                subscriptionId: target.subscriptionId,
                cancelCall: CALL_BY_OUTCOME[outcome]
            });
        } catch (error) {
            logger.error(
                { subscriptionId: target.subscriptionId, error },
                'S11 provider cancellation failed; the live sweep will retry'
            );
            results.push({ subscriptionId: target.subscriptionId, cancelCall: 'FAILED' });
        }
    }
    return { results };
}
