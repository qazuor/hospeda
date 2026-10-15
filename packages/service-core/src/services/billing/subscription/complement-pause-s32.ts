import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    eq,
    getDb,
    LIVE_SUBSCRIPTION_STATUSES,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
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
import { pauseEndForUserWide, selectComplementTargets } from './complement-selection.js';

const logger = createLogger('complement-pause-s32');
const inputSchema = z.strictObject({
    principalSubscriptionId: z.uuid(),
    trigger: z.enum(['PRINCIPAL_SUSPENDED', 'PRINCIPAL_LEFT_LIVE_ROWS'])
});

/** Why this S32 invocation is running. */
export type ComplementPauseTrigger = 'PRINCIPAL_SUSPENDED' | 'PRINCIPAL_LEFT_LIVE_ROWS';
/** Per-complement result of the provider pause and local write. */
export type ComplementPauseOutcome =
    | 'PAUSED'
    | 'NOT_APPLIED'
    | 'SKIPPED_NO_LINK'
    | 'LOST_RACE'
    | 'FAILED';
/** Summary of S32's independent per-complement outcomes. */
export interface PauseComplementsSummary {
    /** Results in the serial order in which the targets were processed. */
    readonly results: readonly {
        readonly complementSubscriptionId: string;
        readonly instanceId: string;
        readonly outcome: ComplementPauseOutcome;
        readonly markOutcome?: 'OPENED' | 'ACCUMULATED';
    }[];
}

/** Pauses eligible complements after the principal transition has committed. */
export async function pauseComplementsS32(
    input: { readonly principalSubscriptionId: string; readonly trigger: ComplementPauseTrigger },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly policy: ComplementPolicyPorts;
    }
): Promise<PauseComplementsSummary> {
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
        if (principal?.class !== 'PRINCIPAL' || !principal.userId || !principal.vertical)
            return null;
        const matches =
            value.trigger === 'PRINCIPAL_SUSPENDED'
                ? principal.status === 'SUSPENDED'
                : !(LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(principal.status);
        if (!matches) return null;
        const selected = await selectComplementTargets(
            {
                tx,
                principal: {
                    id: principal.id,
                    userId: principal.userId,
                    vertical: principal.vertical
                },
                rule: 'PAUSE',
                complementStatus: 'ACTIVE',
                onlyUserWide: value.trigger === 'PRINCIPAL_LEFT_LIVE_ROWS'
            },
            ports.policy
        );
        const ends = new Map<string, Date | null>();
        for (const target of selected.targets) {
            ends.set(
                target.complementSubscriptionId,
                value.trigger === 'PRINCIPAL_SUSPENDED' ||
                    target.scopeType === 'VERTICAL_SUBSCRIPTION' ||
                    target.scopeType === 'LISTING'
                    ? null
                    : await pauseEndForUserWide({
                          tx,
                          userId: principal.userId,
                          compatibleVerticals: target.compatibleVerticals,
                          exceptVertical: principal.vertical
                      })
            );
        }
        return { principal, targets: selected.targets, ends };
    });
    if (!selection) {
        logger.info(
            { principalSubscriptionId: value.principalSubscriptionId, trigger: value.trigger },
            'S32 trigger does not match principal state'
        );
        return { results: [] };
    }

    const results: PauseComplementsSummary['results'][number][] = [];
    for (const target of selection.targets) {
        if (!target.authorizationId || target.paymentMethod !== 'CARD') {
            logger.warn(
                {
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId
                },
                'Complement has no card provider link; S32 skipped'
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
                const acknowledgement = await ports.provider.pause({
                    authorizationId: target.authorizationId
                });
                confirmation = await confirmAuthorizationMutation({
                    provider: ports.provider,
                    acknowledgement,
                    sent: { status: 'paused' }
                });
                assertFreshForAct({ read: confirmation.read, act });
            } catch (error) {
                logger.error(
                    {
                        complementSubscriptionId: target.complementSubscriptionId,
                        instanceId: target.instanceId,
                        error
                    },
                    'S32 provider pause could not be confirmed'
                );
                const mark = await openReconciliationMark({
                    subject: {
                        kind: 'SUBSCRIPTION',
                        subscriptionId: target.complementSubscriptionId
                    },
                    reason: 'PAUSA_NO_APLICADA',
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
                    reason: 'PAUSA_NO_APLICADA',
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
            const outcome = await writeComplementPause({
                principalSubscriptionId: selection.principal.id,
                complementSubscriptionId: target.complementSubscriptionId,
                trigger: value.trigger,
                expectedEndAt: selection.ends.get(target.complementSubscriptionId) ?? null,
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
            } else
                results.push({
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    outcome
                });
        } catch (error) {
            logger.error(
                {
                    complementSubscriptionId: target.complementSubscriptionId,
                    instanceId: target.instanceId,
                    error
                },
                'S32 failed for complement'
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

/** Commits the complement pause only while the locked principal and complement still qualify. */
async function writeComplementPause(input: {
    readonly principalSubscriptionId: string;
    readonly complementSubscriptionId: string;
    readonly trigger: ComplementPauseTrigger;
    readonly expectedEndAt: Date | null;
    readonly now: Date;
}): Promise<'PAUSED' | 'LOST_RACE'> {
    return getDb().transaction(async (tx) => {
        const [principal] = await tx
            .select({ id: subscriptions.id, status: subscriptions.status })
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
        const principalMatches =
            principal &&
            (input.trigger === 'PRINCIPAL_SUSPENDED'
                ? principal.status === 'SUSPENDED'
                : !(LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(principal.status));
        if (
            !principalMatches ||
            !complement ||
            complement.class !== 'COMPLEMENTO' ||
            complement.status !== 'ACTIVE'
        )
            return 'LOST_RACE';
        const [updated] = await tx
            .update(subscriptions)
            .set({ status: 'PAUSED', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, input.complementSubscriptionId),
                    eq(subscriptions.status, 'ACTIVE')
                )
            )
            .returning({ id: subscriptions.id });
        if (!updated) return 'LOST_RACE';
        await tx.insert(subscriptionPauses).values({
            subscriptionId: input.complementSubscriptionId,
            reason: 'CUSTOMER_REQUEST',
            requestedMonths: null,
            startsAt: input.now,
            expectedEndAt: input.expectedEndAt
        });
        return 'PAUSED';
    });
}
