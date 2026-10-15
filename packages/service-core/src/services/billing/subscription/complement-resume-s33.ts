import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, isNull, subscriptionPauses, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    type AuthorizationMutationConfirmation,
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationMutation,
    type PaymentProvider
} from '@repo/payments';
import { z } from 'zod';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service.js';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { selectComplementTargets } from './complement-selection.js';

const logger = createLogger('complement-resume-s33');
const inputSchema = z.strictObject({
    principalSubscriptionId: z.uuid(),
    trigger: z.literal('PRINCIPAL_ACTIVE')
});

/** Reason S33 is running. */
export type ComplementResumeTrigger = 'PRINCIPAL_ACTIVE';
/** Provider and local outcome for one selected complement. */
export type ComplementResumeOutcome =
    | 'REACTIVATED'
    | 'NOT_APPLIED'
    | 'SKIPPED_NO_LINK'
    | 'LOST_RACE'
    | 'FAILED';
/** Ordered results from one S33 execution. */
export interface ResumeComplementsSummary {
    /** One result per selected complement. */
    readonly results: readonly {
        readonly complementSubscriptionId: string;
        readonly instanceId: string;
        readonly outcome: ComplementResumeOutcome;
        readonly markOutcome?: 'OPENED' | 'ACCUMULATED';
    }[];
}

/** Resumes paused complements after their principal has committed its return to ACTIVE. */
export async function resumeComplementsS33(
    input: { readonly principalSubscriptionId: string; readonly trigger: ComplementResumeTrigger },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly policy: ComplementPolicyPorts;
    }
): Promise<ResumeComplementsSummary> {
    const value = inputSchema.parse(input);
    const selection = await getDb().transaction(async (tx) => {
        const [principal] = await tx
            .select({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical,
                class: subscriptions.class,
                status: subscriptions.status
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, value.principalSubscriptionId))
            .limit(1);
        if (
            principal?.class !== 'PRINCIPAL' ||
            !principal.userId ||
            !principal.vertical ||
            principal.status !== 'ACTIVE'
        )
            return null;
        const selected = await selectComplementTargets(
            {
                tx,
                principal: {
                    id: principal.id,
                    userId: principal.userId,
                    vertical: principal.vertical
                },
                rule: 'RESUME',
                complementStatus: 'PAUSED'
            },
            ports.policy
        );
        return { principal, targets: selected.targets };
    });
    if (!selection) {
        logger.info(
            { principalSubscriptionId: value.principalSubscriptionId, trigger: value.trigger },
            'S33 principal is not ACTIVE'
        );
        return { results: [] };
    }

    const results: ResumeComplementsSummary['results'][number][] = [];
    for (const target of selection.targets) {
        if (!target.authorizationId || target.paymentMethod !== 'CARD') {
            logger.warn(
                {
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId
                },
                'Complement has no card provider link; S33 skipped'
            );
            results.push({
                complementSubscriptionId: target.complementSubscriptionId,
                instanceId: target.instanceId,
                outcome: 'SKIPPED_NO_LINK'
            });
            continue;
        }
        try {
            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
            actStartInstant({ act });
            let confirmation: AuthorizationMutationConfirmation;
            try {
                const acknowledgement = await ports.provider.resume({
                    authorizationId: target.authorizationId
                });
                confirmation = await confirmAuthorizationMutation({
                    provider: ports.provider,
                    acknowledgement,
                    sent: { status: 'active' }
                });
                assertFreshForAct({ read: confirmation.read, act });
            } catch (error) {
                logger.error(
                    { complementSubscriptionId: target.complementSubscriptionId, error },
                    'S33 provider resume could not be confirmed'
                );
                const mark = await openReconciliationMark({
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: target.complementSubscriptionId
                    },
                    reason: 'REANUDACION_NO_APLICADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID()
                });
                results.push({
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    outcome: 'NOT_APPLIED',
                    markOutcome: mark.outcome
                });
                continue;
            }
            if (confirmation.outcome === 'notApplied') {
                const mark = await openReconciliationMark({
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: target.complementSubscriptionId
                    },
                    reason: 'REANUDACION_NO_APLICADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID()
                });
                results.push({
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    outcome: 'NOT_APPLIED',
                    markOutcome: mark.outcome
                });
                continue;
            }
            const outcome = await writeComplementResume({
                principalSubscriptionId: selection.principal.id,
                complementSubscriptionId: target.complementSubscriptionId,
                now: ports.clock.now()
            });
            if (outcome === 'LOST_RACE') {
                const mark = await openReconciliationMark({
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: target.complementSubscriptionId
                    },
                    reason: 'TRANSICION_NO_DECLARADA',
                    actor: { type: 'job' },
                    correlationId: crypto.randomUUID()
                });
                results.push({
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    outcome,
                    markOutcome: mark.outcome
                });
            } else {
                results.push({
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    outcome
                });
            }
        } catch (error) {
            logger.error(
                {
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    error
                },
                'S33 failed for complement'
            );
            results.push({
                complementSubscriptionId: target.complementSubscriptionId,
                instanceId: target.instanceId,
                outcome: 'FAILED'
            });
        }
    }
    return { results };
}

/** Writes ACTIVE and closes an open pause only while both locked rows still qualify. */
async function writeComplementResume(input: {
    readonly principalSubscriptionId: string;
    readonly complementSubscriptionId: string;
    readonly now: Date;
}): Promise<'REACTIVATED' | 'LOST_RACE'> {
    return getDb().transaction(async (tx) => {
        const [principal] = await tx
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.principalSubscriptionId))
            .for('update')
            .limit(1);
        const [complement] = await tx
            .select({
                id: subscriptions.id,
                status: subscriptions.status,
                class: subscriptions.class
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.complementSubscriptionId))
            .for('update')
            .limit(1);
        if (
            principal?.status !== 'ACTIVE' ||
            complement?.class !== 'COMPLEMENTO' ||
            complement.status !== 'PAUSED'
        )
            return 'LOST_RACE';
        const [updated] = await tx
            .update(subscriptions)
            .set({ status: 'ACTIVE', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.complementSubscriptionId),
                    eq(subscriptions.status, 'PAUSED')
                )
            )
            .returning({ id: subscriptions.id });
        if (!updated) return 'LOST_RACE';
        const [pause] = await tx
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, input.complementSubscriptionId),
                    isNull(subscriptionPauses.actualEndAt)
                )
            )
            .limit(1);
        if (!pause) {
            logger.warn(
                { complementSubscriptionId: input.complementSubscriptionId },
                'S33 resumed a PAUSED complement without an open pause'
            );
            return 'REACTIVATED';
        }
        await tx
            .update(subscriptionPauses)
            .set({ actualEndAt: input.now })
            .where(eq(subscriptionPauses.id, pause.id));
        return 'REACTIVATED';
    });
}
