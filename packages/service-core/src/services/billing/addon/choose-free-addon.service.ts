import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    addonProducts,
    and,
    domainEventModel,
    eq,
    getDb,
    isNull,
    type SelectAddonInstance
} from '@repo/db';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import type { CoverageNotices } from '../payment/payment-ports';
import { emitAddonCoverageAdded } from './addon-instance-a2';
import {
    type ChooseFreeAddonInput,
    ChooseFreeAddonInputSchema,
    type ChooseFreeAddonResult
} from './choose-free-addon-types';
import { findIncludesAddonsAnchor } from './includes-addons-anchor';
import { resolvePurchaseTarget } from './purchase-addon-eligibility';
import type { PurchaseAddonPorts } from './purchase-addon-ports';

type FreePorts = Pick<PurchaseAddonPorts, 'clock' | 'addonPolicy' | 'listing'> & {
    readonly coverageNotices?: CoverageNotices;
};

function sameChoice(row: SelectAddonInstance, input: ChooseFreeAddonInput): boolean {
    return (
        row.ownerId === input.ownerId &&
        row.productId === input.productId &&
        row.targetId === input.targetId &&
        row.status === 'ACTIVE' &&
        row.titleAnchorId !== null &&
        row.complementSubscriptionId === null
    );
}

async function existingByIdentity(
    input: ChooseFreeAddonInput
): Promise<ChooseFreeAddonResult | null> {
    const [row] = await getDb()
        .select()
        .from(addonInstances)
        .where(
            and(
                eq(addonInstances.ownerId, input.ownerId),
                eq(addonInstances.productId, input.productId),
                input.targetId === null
                    ? isNull(addonInstances.targetId)
                    : eq(addonInstances.targetId, input.targetId),
                eq(addonInstances.status, 'ACTIVE'),
                isNull(addonInstances.complementSubscriptionId)
            )
        )
        .limit(1);
    return row && sameChoice(row, input)
        ? { outcome: 'EXISTING', instanceId: row.id, status: 'ACTIVE' }
        : null;
}

/** A1-bis: records the owner's free choice under a live includes-addons anchor. */
export async function chooseFreeAddon(
    input: ChooseFreeAddonInput,
    ports: FreePorts
): Promise<ChooseFreeAddonResult> {
    const request = ChooseFreeAddonInputSchema.parse(input);
    const [product] = await getDb()
        .select()
        .from(addonProducts)
        .where(eq(addonProducts.id, request.productId))
        .limit(1);
    if (!product) return { outcome: 'REFUSED', reason: 'PRODUCT_NOT_FOUND' };
    const policy = await ports.addonPolicy({ addonVersionId: product.versionId });
    if (request.expectedAddonVersionId !== product.versionId || policy.addonId !== product.addonId)
        return { outcome: 'REFUSED', reason: 'ADDON_VERSION_NOT_CURRENT' };
    const now = ports.clock.now();
    let createdCoverageVerticals: readonly string[] = [];
    try {
        const result = await getDb().transaction(async (tx): Promise<ChooseFreeAddonResult> => {
            const target = await resolvePurchaseTarget(
                {
                    tx,
                    ownerId: request.ownerId,
                    product,
                    scopeType: policy.scopeType,
                    targetId: request.targetId
                },
                ports
            );
            if ('reason' in target) return { outcome: 'REFUSED', reason: 'TARGET_NOT_FOUND' };
            const verticals =
                target.vertical === null ? product.compatibleVerticals : [target.vertical];
            let anchorId: string | undefined;
            for (const vertical of verticals) {
                const anchor = await findIncludesAddonsAnchor({
                    tx,
                    userId: request.ownerId,
                    vertical
                });
                if (anchor) {
                    anchorId = anchor.anchorId;
                    break;
                }
            }
            if (!anchorId) return { outcome: 'REFUSED', reason: 'NO_FREE_TITLE' };
            const [prior] = await tx
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, request.orderRequestId))
                .limit(1);
            if (prior)
                return sameChoice(prior, request)
                    ? { outcome: 'EXISTING', instanceId: prior.id, status: 'ACTIVE' }
                    : { outcome: 'REFUSED', reason: 'ORDER_REQUEST_REUSED' };
            const occupants = await tx
                .select()
                .from(addonInstances)
                .where(
                    and(
                        eq(addonInstances.ownerId, request.ownerId),
                        eq(addonInstances.productId, request.productId),
                        request.targetId === null
                            ? isNull(addonInstances.targetId)
                            : eq(addonInstances.targetId, request.targetId)
                    )
                );
            const free = occupants.find((row) => sameChoice(row, request));
            if (free) return { outcome: 'EXISTING', instanceId: free.id, status: 'ACTIVE' };
            if (occupants.some((row) => row.status === 'PENDING_AUTHORIZATION'))
                return { outcome: 'REFUSED', reason: 'PENDING_ELSEWHERE' };
            if (occupants.some((row) => row.status === 'ACTIVE'))
                return { outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' };
            const endsAt =
                policy.validity === 'FIXED_DAYS' && policy.validityDays
                    ? new Date(now.getTime() + policy.validityDays * 86_400_000)
                    : null;
            const [created] = await tx
                .insert(addonInstances)
                .values({
                    ownerId: request.ownerId,
                    productId: product.id,
                    addonVersionId: product.versionId,
                    targetId: request.targetId,
                    orderRequestId: request.orderRequestId,
                    titleAnchorId: anchorId,
                    status: 'ACTIVE',
                    startsAt: now,
                    endsAt
                })
                .returning({ id: addonInstances.id });
            if (!created) throw new Error('Free addon insert returned no row');
            await domainEventModel.insert({
                eventType: 'addon_instance.status_changed',
                entityType: 'addon_instance',
                entityId: created.id,
                actorType: 'owner',
                actorId: request.ownerId,
                correlationId: randomUUID(),
                changes: [{ field: 'status', old: null, new: 'ACTIVE' }],
                occurredAt: now,
                tx
            });
            createdCoverageVerticals =
                target.vertical === null ? product.compatibleVerticals : [target.vertical];
            return { outcome: 'CREATED', instanceId: created.id, status: 'ACTIVE' };
        });
        if (result.outcome === 'CREATED' && ports.coverageNotices) {
            await emitAddonCoverageAdded({
                activated: [
                    {
                        outcome: 'ACTIVATED',
                        instanceId: result.instanceId,
                        ownerId: request.ownerId,
                        coverageVerticals: createdCoverageVerticals
                    }
                ],
                coverageNotices: ports.coverageNotices
            });
        }
        return result;
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code === '23505' && cause.constraint === 'uq_addon_instance_free_choice') {
            const existing = await existingByIdentity(request);
            if (existing) return existing;
        }
        if (cause?.code === '23505' && cause.constraint === 'uq_addon_instance_order_request') {
            const [row] = await getDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, request.orderRequestId))
                .limit(1);
            if (row)
                return sameChoice(row, request)
                    ? { outcome: 'EXISTING', instanceId: row.id, status: 'ACTIVE' }
                    : { outcome: 'REFUSED', reason: 'ORDER_REQUEST_REUSED' };
        }
        throw error;
    }
}
