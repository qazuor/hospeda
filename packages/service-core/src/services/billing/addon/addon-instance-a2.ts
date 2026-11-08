import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    addonProducts,
    and,
    type DrizzleClient,
    domainEventModel,
    eq,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CoverageNotices } from '../payment/payment-ports';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import type { A5Ports } from './addon-instance-a5';

const logger = createLogger('addon-instance-a2');
const inputSchema = z.object({
    tx: z.custom<DrizzleClient>((value) => value !== null && value !== undefined),
    complementSubscriptionId: z.uuid(),
    now: z.date()
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
        .set({ status: 'ACTIVE', updatedAt: now })
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

/** Emits one post-commit ADDED notice per owner and vertical, logging delivery failures. */
export async function emitAddonCoverageAdded(input: {
    readonly activated: readonly ActivatedAddon[];
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
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
