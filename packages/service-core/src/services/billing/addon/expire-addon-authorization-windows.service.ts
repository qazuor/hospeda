import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    and,
    domainEventModel,
    eq,
    getDb,
    idempotencyKeys,
    isNotNull,
    lte,
    or,
    providerLinks,
    sql,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import type { CoverageNotices } from '../payment/payment-ports';
import { cancelOurAuthorization } from '../reconciliation/cancel-our-authorization';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service';
import { emitAddonFact, wholeSecondsBetween } from './addon-fact-emit';
import { applyA2Recurring, emitAddonCoverageAdded } from './addon-instance-a2';
import type { A5Ports } from './addon-instance-a5';
import { expireOneTimePageAddon } from './expire-addon-authorization-windows-one-time';
import { PAYMENT_PAGE_OPERATION } from './one-time-payment-page';
import { optionalPaymentPageTiming } from './one-time-payment-page-deadline';

const logger = createLogger('addon-authorization-window-expiry');
const limitSchema = z.number().int().positive();

/** Provider and local ports of the A3 expiry pass. */
export interface ExpireAddonAuthorizationWindowsPorts extends A5Ports {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly coverageNotices: CoverageNotices;
    readonly deadlines?: Awaited<ReturnType<typeof getCurrentBillingDeadlines>>;
    /** HOS-1883: where `addon_activated` and `addon_checkout_abandoned` go. */
    readonly billingFacts?: BillingFactSink;
}

/** Counts of one A3 expiry pass. */
export interface ExpireAddonAuthorizationWindowsSummary {
    readonly examined: number;
    readonly activated: number;
    readonly abandoned: number;
    readonly deferred: number;
    readonly noticePending: number;
    readonly failed: number;
}

/** Abandons the complement and its instance atomically, recording A3 for retry if linked. */
async function abandonRecurring(input: {
    readonly instanceId: string;
    readonly complementId: string;
    readonly hasProviderLink: boolean;
    readonly now: Date;
}): Promise<boolean> {
    return getDb().transaction(async (tx) => {
        const [complement] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, input.complementId))
            .limit(1)
            .for('update');
        const [instance] = await tx
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, input.instanceId))
            .limit(1)
            .for('update');
        if (
            complement?.class !== 'COMPLEMENTO' ||
            complement.status !== 'PENDING_AUTHORIZATION' ||
            instance?.status !== 'PENDING_AUTHORIZATION' ||
            instance.complementSubscriptionId !== complement.id
        )
            return false;
        const [updatedComplement] = await tx
            .update(subscriptions)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(subscriptions.id, complement.id),
                    eq(subscriptions.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: subscriptions.id });
        const [updatedInstance] = await tx
            .update(addonInstances)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(addonInstances.id, instance.id),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: addonInstances.id });
        if (!updatedComplement || !updatedInstance)
            throw new Error('A3 recurring state changed under lock');
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: instance.id,
            actorType: 'job',
            actorId: null,
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
            occurredAt: input.now,
            tx
        });
        if (input.hasProviderLink)
            await recordProviderCancellationDecided({
                subscriptionId: complement.id,
                transition: 'A3',
                decidedAt: input.now,
                actor: { type: 'job' },
                correlationId: randomUUID(),
                changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
                tx
            });
        return true;
    });
}

/** Expires pending addon purchases after a fresh provider read, isolating each row's failure. */
export async function expireAddonAuthorizationWindows(
    limit: number,
    ports: ExpireAddonAuthorizationWindowsPorts
): Promise<ExpireAddonAuthorizationWindowsSummary> {
    limitSchema.parse(limit);
    const now = ports.clock.now();
    const deadlines = ports.deadlines ?? (await getCurrentBillingDeadlines());
    // HOS-2179 §5.2: a page purchase waits until its page stopped taking payments plus a margin
    // (PLAZO:21). The page end is the expiry the instance stored at creation; only a purchase
    // whose creation answer was lost (no stored expiry) falls back to createdAt plus today's
    // page duration, which is the expiry a resume would send. The margin is today's: the margin
    // in force at creation is not recorded anywhere. Without PLAZO:21 no page purchase is
    // selected rather than a guessed one.
    const pageTiming = optionalPaymentPageTiming(deadlines);
    const pageWindowElapsed = pageTiming
        ? sql`coalesce(${addonInstances.paymentPageExpiresAt}, ${addonInstances.createdAt} + (${pageTiming.pageMs}::bigint * interval '1 millisecond')) + (${pageTiming.windowMarginMs}::bigint * interval '1 millisecond') <= ${now.toISOString()}::timestamptz`
        : null;
    const rows = await getDb()
        .select({
            instance: addonInstances,
            chargeKind: addonProducts.chargeKind,
            complement: subscriptions,
            link: providerLinks
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .leftJoin(subscriptions, eq(subscriptions.id, addonInstances.complementSubscriptionId))
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .leftJoin(
            idempotencyKeys,
            and(
                eq(idempotencyKeys.subjectId, addonInstances.id),
                eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
            )
        )
        .where(
            and(
                eq(addonInstances.status, 'PENDING_AUTHORIZATION'),
                or(
                    and(
                        eq(addonProducts.chargeKind, 'PERIODICO'),
                        lte(subscriptions.authorizationWindowEndsAt, now)
                    ),
                    pageWindowElapsed
                        ? and(
                              eq(addonProducts.chargeKind, 'UNA_VEZ'),
                              isNotNull(idempotencyKeys.key),
                              pageWindowElapsed
                          )
                        : undefined
                )
            )
        )
        .orderBy(addonInstances.createdAt, addonInstances.id)
        .limit(limit);
    let activated = 0,
        abandoned = 0,
        deferred = 0,
        noticePending = 0,
        failed = 0;
    for (const row of rows) {
        try {
            if (row.chargeKind === 'UNA_VEZ') {
                const outcome = await expireOneTimePageAddon(
                    { instanceId: row.instance.id },
                    ports
                );
                if (outcome === 'ACTIVATED') activated++;
                else if (outcome === 'ABANDONED') abandoned++;
                else deferred++;
                continue;
            }
            if (!row.complement) throw new Error('Recurring addon has no complement');
            const complementId = row.complement.id;
            let prior:
                | {
                      read: Awaited<ReturnType<PaymentProvider['readAuthorization']>>;
                      act: { kind: 'decision'; startedAt: Date };
                  }
                | undefined;
            if (row.link) {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readAuthorization({
                    authorizationId: row.link.providerId
                });
                const { snapshot } = assertFreshForAct({ read, act });
                prior = { read, act };
                if (snapshot.status === 'active') {
                    const result = await getDb().transaction((tx) =>
                        applyA2Recurring(
                            {
                                tx,
                                complementSubscriptionId: complementId,
                                now: ports.clock.now()
                            },
                            ports
                        )
                    );
                    if (result.outcome === 'ACTIVATED') {
                        await emitAddonCoverageAdded({
                            activated: [result],
                            coverageNotices: ports.coverageNotices,
                            fact: {
                                billingFacts: ports.billingFacts,
                                listing: ports.listing,
                                activatedAt: ports.clock.now()
                            }
                        });
                        activated++;
                    } else deferred++;
                    continue;
                }
            }
            const abandonedAt = ports.clock.now();
            const wrote = await abandonRecurring({
                instanceId: row.instance.id,
                complementId: row.complement.id,
                hasProviderLink: !!row.link,
                now: abandonedAt
            });
            if (!wrote) {
                deferred++;
                continue;
            }
            abandoned++;
            await emitAddonFact({
                billingFacts: ports.billingFacts,
                listing: ports.listing,
                source: { instanceId: row.instance.id },
                build: (anchored) => ({
                    kind: 'ADDON_CHECKOUT_ABANDONED',
                    ...anchored.subject,
                    actorKind: 'SYSTEM',
                    occurredAt: abandonedAt,
                    reason: 'WINDOW_EXPIRED',
                    secondsInPending: wholeSecondsBetween({
                        from: anchored.createdAt,
                        to: abandonedAt
                    })
                })
            });
            if (
                row.link &&
                prior &&
                assertFreshForAct({ read: prior.read, act: prior.act }).snapshot.status !==
                    'cancelled'
            ) {
                const result = await cancelOurAuthorization(
                    {
                        subscriptionId: row.complement.id,
                        userId: row.instance.ownerId,
                        authorizationId: row.link.providerId,
                        kind: 'ADDON_AUTHORIZATION_EXPIRED',
                        prior
                    },
                    {
                        provider: ports.provider,
                        clock: ports.clock,
                        beforeCancelNotice: ports.beforeCancelNotice
                    }
                );
                if (result.outcome === 'NOTICE_PENDING') noticePending++;
            }
        } catch (error) {
            failed++;
            logger.error(
                { instanceId: row.instance.id, error },
                'Addon authorization window expiry failed'
            );
        }
    }
    return { examined: rows.length, activated, abandoned, deferred, noticePending, failed };
}
