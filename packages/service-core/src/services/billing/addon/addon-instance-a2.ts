import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
    domainEventModel,
    eq,
    sql,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import type { CoverageNotices } from '../payment/payment-ports';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import { type AddonFactListing, emitAddonFact, wholeSecondsBetween } from './addon-fact-emit';
import type { A5Ports } from './addon-instance-a5';

const logger = createLogger('addon-instance-a2');
const inputSchema = z.object({
    tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined),
    complementSubscriptionId: z.uuid(),
    now: z.date(),
    nextChargeAt: z.date().nullable().optional()
});

/** An instance activated by A2 and the verticals whose coverage changed. */
export interface ActivatedAddon {
    readonly outcome: 'ACTIVATED';
    readonly instanceId: string;
    readonly ownerId: string;
    readonly coverageVerticals: readonly string[];
}

/** Activates a pending recurring complement and its addon in the caller's transaction. */
export async function applyA2Recurring(
    input: {
        readonly tx: DrizzleClient;
        readonly complementSubscriptionId: string;
        readonly now: Date;
        /** HOS-2223: the provider's next payment date from the authorizing re-read. */
        readonly nextChargeAt?: Date | null;
    },
    ports: A5Ports
): Promise<ActivatedAddon | { readonly outcome: 'NOT_APPLICABLE' }> {
    inputSchema.parse(input);
    const { tx, now } = input;
    const [complement] = await tx
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.complementSubscriptionId))
        .limit(1)
        .for('update');
    if (complement?.class !== 'COMPLEMENTO' || complement.status !== 'PENDING_AUTHORIZATION')
        return { outcome: 'NOT_APPLICABLE' };
    const [instance] = await tx
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.complementSubscriptionId, complement.id))
        .limit(1)
        .for('update');
    if (instance?.status !== 'PENDING_AUTHORIZATION') return { outcome: 'NOT_APPLICABLE' };
    const [product] = await tx
        .select({ chargeKind: addonProducts.chargeKind })
        .from(addonProducts)
        .where(eq(addonProducts.id, instance.productId))
        .limit(1);
    if (product?.chargeKind !== 'PERIODICO')
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Complement does not belong to a recurring addon'
        );
    const coverageVerticals = await coverageVerticalsOf({
        tx,
        scopeType: (await ports.addonPolicy({ addonVersionId: instance.addonVersionId })).scopeType,
        targetId: instance.targetId,
        compatibleVerticals: await compatibleVerticalsOf({ tx, productId: instance.productId }),
        ports
    });
    const [updatedComplement] = await tx
        .update(subscriptions)
        .set({
            status: 'ACTIVE',
            updatedAt: now,
            // HOS-2223: GREATEST keeps a later date P1 may already have written.
            ...(input.nextChargeAt
                ? {
                      nextChargeAt: sql`greatest(${subscriptions.nextChargeAt}, ${input.nextChargeAt.toISOString()}::timestamptz)`
                  }
                : {})
        })
        .where(
            and(
                eq(subscriptions.id, complement.id),
                eq(subscriptions.status, 'PENDING_AUTHORIZATION')
            )
        )
        .returning({ id: subscriptions.id });
    const [updatedInstance] = await tx
        .update(addonInstances)
        .set({ status: 'ACTIVE', startsAt: now, endsAt: null, updatedAt: now })
        .where(
            and(
                eq(addonInstances.id, instance.id),
                eq(addonInstances.status, 'PENDING_AUTHORIZATION')
            )
        )
        .returning({ id: addonInstances.id });
    if (!updatedComplement || !updatedInstance)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'A2 recurring state changed under lock'
        );
    await domainEventModel.insert({
        eventType: 'addon_instance.status_changed',
        entityType: 'addon_instance',
        entityId: instance.id,
        actorType: 'provider',
        actorId: null,
        correlationId: randomUUID(),
        changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ACTIVE' }],
        occurredAt: now,
        tx
    });
    return {
        outcome: 'ACTIVATED',
        instanceId: instance.id,
        ownerId: instance.ownerId,
        coverageVerticals
    };
}

/**
 * Whether an activation is a PAID one that emits `addon_activated` (HOS-1883 §5.2). It is a
 * required parameter so that every caller states it (T-5): the A2 callers pass the sink, the
 * free choice (A1-bis) passes `NOT_A_PAID_ACTIVATION` (its event is `addon_granted_free`).
 */
export type AddonActivationFact =
    | { readonly billingFacts: BillingFactSink | undefined; readonly listing?: AddonFactListing }
    | 'NOT_A_PAID_ACTIVATION';

/**
 * Emits `addon_activated` once per instance after a paid activation committed, outside the
 * per-vertical coverage dedupe. Never throws.
 */
async function emitAddonActivatedFacts(input: {
    readonly activated: readonly ActivatedAddon[];
    readonly fact: AddonActivationFact;
}): Promise<void> {
    if (input.fact === 'NOT_A_PAID_ACTIVATION') return;
    const { billingFacts, listing } = input.fact;
    for (const addon of input.activated)
        await emitAddonFact({
            billingFacts,
            listing,
            source: { instanceId: addon.instanceId },
            build: (anchored) => {
                const occurredAt = anchored.startsAt ?? new Date();
                return {
                    kind: 'ADDON_ACTIVATED',
                    ...anchored.subject,
                    actorKind: 'SYSTEM',
                    occurredAt,
                    amountMinor: anchored.amountMinor,
                    currency: anchored.currency,
                    ...(anchored.cycle ? { cycle: anchored.cycle } : {}),
                    secondsInPending: wholeSecondsBetween({
                        from: anchored.createdAt,
                        to: occurredAt
                    })
                };
            }
        });
}

/**
 * Emits one post-commit ADDED notice per owner and vertical, logging delivery failures, and the
 * `addon_activated` fact of a paid activation.
 *
 * @param input.activated - What A2 (or A1-bis) activated
 * @param input.coverageNotices - The coverage notice port
 * @param input.fact - The fact sink of a paid activation, or `NOT_A_PAID_ACTIVATION`
 */
export async function emitAddonCoverageAdded(input: {
    readonly activated: readonly ActivatedAddon[];
    readonly coverageNotices: CoverageNotices;
    readonly fact: AddonActivationFact;
}): Promise<void> {
    await emitAddonActivatedFacts({ activated: input.activated, fact: input.fact });
    const seen = new Set<string>();
    for (const addon of input.activated)
        for (const raw of addon.coverageVerticals) {
            const key = `${addon.ownerId}|${raw}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const vertical = VerticalEnumSchema.safeParse(raw);
            if (!vertical.success) {
                logger.error(
                    { instanceId: addon.instanceId, vertical: raw },
                    'Activated addon has invalid coverage vertical'
                );
                continue;
            }
            try {
                await input.coverageNotices.emitCoverageChanged({
                    userId: addon.ownerId,
                    vertical: vertical.data,
                    sourceType: 'ADDON',
                    change: 'ADDED'
                });
            } catch (error) {
                logger.error(
                    { instanceId: addon.instanceId, vertical: raw, error },
                    'Coverage notice failed after A2 commit'
                );
            }
        }
}
