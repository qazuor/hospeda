import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    addonProducts,
    and,
    domainEventModel,
    eq,
    getDb,
    idempotencyKeys,
    isNotNull,
    isNull,
    or,
    type SelectAddonInstance,
    type SelectAddonProduct
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import { authorizePendingComplement, insertPendingComplement } from './purchase-addon-complement';
import { resolvePurchaseTitle } from './purchase-addon-eligibility';
import type { PurchaseAddonPorts } from './purchase-addon-ports';
import {
    type PurchaseAddonInput,
    PurchaseAddonInputSchema,
    type PurchaseAddonResult
} from './purchase-addon-types';

function chargeKindOf(product: SelectAddonProduct): 'UNA_VEZ' | 'PERIODICO' {
    if (product.chargeKind === 'UNA_VEZ' || product.chargeKind === 'PERIODICO')
        return product.chargeKind;
    throw new Error('Unknown addon charge kind');
}

async function checkoutUrlOf(instance: SelectAddonInstance): Promise<string | undefined> {
    if (!instance.complementSubscriptionId) return undefined;
    const [key] = await getDb()
        .select({ result: idempotencyKeys.result })
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.subjectId, instance.complementSubscriptionId),
                eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
            )
        )
        .limit(1);
    const value = key?.result;
    return value &&
        typeof value === 'object' &&
        'checkoutUrl' in value &&
        typeof value.checkoutUrl === 'string'
        ? value.checkoutUrl
        : undefined;
}

function sameIdentity(instance: SelectAddonInstance, input: PurchaseAddonInput): boolean {
    return (
        instance.ownerId === input.ownerId &&
        instance.productId === input.productId &&
        instance.targetId === input.targetId
    );
}

async function resolveExisting(
    instance: SelectAddonInstance,
    input: PurchaseAddonInput,
    product: SelectAddonProduct
): Promise<PurchaseAddonResult> {
    if (!sameIdentity(instance, input))
        return { outcome: 'REFUSED', reason: 'ORDER_REQUEST_REUSED' };
    return {
        outcome: 'EXISTING',
        instanceId: instance.id,
        chargeKind: chargeKindOf(product),
        checkoutUrl: await checkoutUrlOf(instance)
    };
}

/** A1: buys one addon with a durable purchase identity and a provider call after commit. */
export async function purchaseAddon(
    input: PurchaseAddonInput,
    ports: PurchaseAddonPorts
): Promise<PurchaseAddonResult> {
    const request = PurchaseAddonInputSchema.parse(input);
    const [product] = await getDb()
        .select()
        .from(addonProducts)
        .where(eq(addonProducts.id, request.productId))
        .limit(1);
    if (!product) return { outcome: 'REFUSED', reason: 'PRODUCT_NOT_FOUND' };
    const policy = await ports.addonPolicy({ addonVersionId: product.versionId });
    if (request.expectedAddonVersionId !== product.versionId || policy.addonId !== product.addonId)
        return { outcome: 'REFUSED', reason: 'ADDON_VERSION_NOT_CURRENT' };
    if ((policy.scopeType === 'USER' || policy.scopeType === 'GLOBAL') && request.targetId !== null)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Target must be null for person or global addons'
        );
    const now = ports.clock.now();
    const deadlines =
        chargeKindOf(product) === 'PERIODICO' ? await getCurrentBillingDeadlines() : undefined;
    let created:
        | {
              readonly instanceId: string;
              readonly complementId?: string;
              readonly idempotencyKey?: string;
          }
        | undefined;
    try {
        const result = await getDb().transaction(async (tx): Promise<PurchaseAddonResult> => {
            const title = await resolvePurchaseTitle(
                {
                    tx,
                    ownerId: request.ownerId,
                    product,
                    scopeType: policy.scopeType,
                    targetId: request.targetId
                },
                ports
            );
            if ('reason' in title) return { outcome: 'REFUSED', reason: title.reason };
            const [existing] = await tx
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, request.orderRequestId))
                .limit(1);
            if (existing) {
                if (!sameIdentity(existing, request))
                    return { outcome: 'REFUSED', reason: 'ORDER_REQUEST_REUSED' };
                const [key] = existing.complementSubscriptionId
                    ? await tx
                          .select({ result: idempotencyKeys.result })
                          .from(idempotencyKeys)
                          .where(
                              and(
                                  eq(idempotencyKeys.subjectId, existing.complementSubscriptionId),
                                  eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE')
                              )
                          )
                          .limit(1)
                    : [];
                const value = key?.result;
                const checkoutUrl =
                    value &&
                    typeof value === 'object' &&
                    'checkoutUrl' in value &&
                    typeof value.checkoutUrl === 'string'
                        ? value.checkoutUrl
                        : undefined;
                return {
                    outcome: 'EXISTING',
                    instanceId: existing.id,
                    chargeKind: chargeKindOf(product),
                    checkoutUrl
                };
            }
            const [instance] = await tx
                .insert(addonInstances)
                .values({
                    ownerId: request.ownerId,
                    productId: product.id,
                    addonVersionId: product.versionId,
                    targetId: request.targetId,
                    orderRequestId: request.orderRequestId,
                    status: 'PENDING_AUTHORIZATION'
                })
                .returning({ id: addonInstances.id });
            if (!instance) throw new Error('Addon instance insert returned no row');
            if (product.chargeKind === 'UNA_VEZ') {
                await tx.insert(idempotencyKeys).values({
                    key: `order:${request.orderRequestId}`,
                    operation: 'ORDER_CREATE',
                    subjectId: instance.id
                });
                created = { instanceId: instance.id };
            } else if (deadlines) {
                const complement = await insertPendingComplement({
                    tx,
                    ownerId: request.ownerId,
                    vertical: title.vertical,
                    product,
                    now,
                    deadlines,
                    payerEmail: request.payerEmail
                });
                await tx
                    .update(addonInstances)
                    .set({ complementSubscriptionId: complement.complementId })
                    .where(eq(addonInstances.id, instance.id));
                created = {
                    instanceId: instance.id,
                    complementId: complement.complementId,
                    idempotencyKey: complement.idempotencyKey
                };
            } else throw new Error('Missing addon authorization deadlines');
            await domainEventModel.insert({
                eventType: 'addon_instance.status_changed',
                entityType: 'addon_instance',
                entityId: instance.id,
                actorType: 'owner',
                actorId: request.ownerId,
                correlationId: randomUUID(),
                changes: [{ field: 'status', old: null, new: 'PENDING_AUTHORIZATION' }],
                occurredAt: now,
                tx
            });
            return {
                outcome: 'CREATED',
                instanceId: instance.id,
                chargeKind: chargeKindOf(product)
            };
        });
        if (result.outcome !== 'CREATED' || !created?.complementId || !created.idempotencyKey)
            return result;
        const authorization = await authorizePendingComplement(
            {
                complementId: created.complementId,
                idempotencyKey: created.idempotencyKey,
                product,
                payerEmail: request.payerEmail,
                returnUrl: request.returnUrl,
                reason: request.reason
            },
            { provider: ports.provider, clock: ports.clock }
        );
        return { ...result, checkoutUrl: authorization.checkoutUrl };
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code !== '23505') throw error;
        if (cause.constraint === 'uq_addon_instance_order_request') {
            const [existing] = await getDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, request.orderRequestId))
                .limit(1);
            if (existing) return resolveExisting(existing, request, product);
        }
        if (cause.constraint === 'uq_addon_instance_purchase_identity') {
            const [occupant] = await getDb()
                .select()
                .from(addonInstances)
                .where(
                    and(
                        eq(addonInstances.ownerId, request.ownerId),
                        eq(addonInstances.productId, request.productId),
                        request.targetId === null
                            ? isNull(addonInstances.targetId)
                            : eq(addonInstances.targetId, request.targetId),
                        or(
                            eq(addonInstances.status, 'PENDING_AUTHORIZATION'),
                            and(
                                eq(addonInstances.status, 'ACTIVE'),
                                isNotNull(addonInstances.complementSubscriptionId)
                            )
                        )
                    )
                )
                .limit(1);
            if (occupant?.status === 'PENDING_AUTHORIZATION')
                return {
                    outcome: 'PENDING_ELSEWHERE',
                    instanceId: occupant.id,
                    chargeKind: chargeKindOf(product)
                };
            if (occupant?.status === 'ACTIVE' && occupant.complementSubscriptionId)
                return { outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' };
        }
        throw error;
    }
}
