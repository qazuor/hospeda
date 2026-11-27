import { randomUUID } from 'node:crypto';
import {
    addonInstances,
    addonProducts,
    type DrizzleClient,
    domainEventModel,
    eq,
    getDb,
    idempotencyKeys,
    type SelectAddonInstance,
    type SelectAddonProduct
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import { assertAddonPurchasesOpen, platformAddonPurchasesFreeze } from './addon-purchases-freeze';
import { findIncludesAddonsAnchor } from './includes-addons-anchor';
import { decideOccupiedPagePurchase } from './occupied-page-purchase';
import {
    decideOccupiedRecurringPurchase,
    recurringCheckoutUrlOf
} from './occupied-recurring-purchase';
import {
    openOneTimePaymentPage,
    PAYMENT_PAGE_OPERATION,
    paymentPageCheckoutUrlOf,
    paymentPageKey,
    paymentPageRequestOf
} from './one-time-payment-page';
import { paymentPageTiming } from './one-time-payment-page-deadline';
import { authorizePendingComplement, insertPendingComplement } from './purchase-addon-complement';
import { resolvePurchaseTitle } from './purchase-addon-eligibility';
import type { PurchaseAddonPorts } from './purchase-addon-ports';
import {
    abandonRefusedComplement,
    isCreationRefusedBeforeExisting
} from './purchase-addon-rejection';
import { checkoutStartedFact } from './purchase-addon-started-fact';
import {
    PURCHASE_IDENTITY_BUSY_REASON,
    type PurchaseAddonInput,
    PurchaseAddonInputSchema,
    type PurchaseAddonResult
} from './purchase-addon-types';
import { type PurchaseIdentity, readIdentityOccupant } from './purchase-identity-occupant';

const logger = createLogger('addon-purchase');

function chargeKindOf(product: SelectAddonProduct): 'UNA_VEZ' | 'PERIODICO' {
    if (product.chargeKind === 'UNA_VEZ' || product.chargeKind === 'PERIODICO')
        return product.chargeKind;
    throw new Error('Unknown addon charge kind');
}

async function checkoutUrlOf(
    instance: SelectAddonInstance,
    tx?: DrizzleClient
): Promise<string | undefined> {
    if (!instance.complementSubscriptionId)
        return paymentPageCheckoutUrlOf({ instanceId: instance.id, tx });
    return recurringCheckoutUrlOf({ complementId: instance.complementSubscriptionId, tx });
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
    if (instance.status === 'ABANDONED')
        return { outcome: 'REFUSED', reason: 'ORDER_REQUEST_ABANDONED' };
    return {
        outcome: 'EXISTING',
        instanceId: instance.id,
        chargeKind: chargeKindOf(product),
        checkoutUrl: await checkoutUrlOf(instance)
    };
}

/**
 * HOS-2179 §5.1/§5.6: after A1 commits a page purchase, opens its page, or resumes one whose
 * creation answer was lost, and answers with the stored sanitized link. A replay whose page is
 * already open answers that page's link and creates nothing.
 */
async function withPaymentPage(
    result: PurchaseAddonResult,
    context: {
        readonly request: PurchaseAddonInput;
        readonly ports: PurchaseAddonPorts;
        readonly deadlines: Awaited<ReturnType<typeof getCurrentBillingDeadlines>> | undefined;
    }
): Promise<PurchaseAddonResult> {
    if (
        (result.outcome !== 'CREATED' && result.outcome !== 'EXISTING') ||
        result.chargeKind !== 'UNA_VEZ' ||
        result.checkoutUrl
    )
        return result;
    const page = await openOneTimePaymentPage(
        {
            instanceId: result.instanceId,
            returnUrl: context.request.returnUrl,
            ...(context.request.reason ? { reason: context.request.reason } : {})
        },
        {
            provider: context.ports.provider,
            clock: context.ports.clock,
            ...(context.deadlines ? { deadlines: context.deadlines } : {})
        }
    );
    if (page.outcome === 'NOT_APPLICABLE') {
        // HOS-2179 T-6: the purchase stopped waiting before its page could be opened. A
        // concurrent refusal released it (instance ABANDONED, HOS-2321), so the screen must mint
        // a new order id instead of replaying one that will never get a page. A purchase that
        // was activated meanwhile is not abandoned: answer it as is, without a link to pay again.
        const [current] = await getDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, result.instanceId))
            .limit(1);
        if (current?.status !== 'ACTIVE')
            return { outcome: 'REFUSED', reason: 'ORDER_REQUEST_ABANDONED' };
        return result;
    }
    return 'checkoutUrl' in page && page.checkoutUrl
        ? { ...result, checkoutUrl: page.checkoutUrl }
        : result;
}

/**
 * Answers the link of the same owner's page that still takes payments (HOS-2179 T-6 review),
 * resuming its creation when the answer was lost. When the purchase was activated between the
 * decision and the open, the request answers `ALREADY_ACTIVE`: it carries another order id, so
 * an `EXISTING` answer without a link would leave its screen reading a purchase that is not its
 * own.
 */
async function resumeOccupiedPage(
    occupant: SelectAddonInstance,
    context: Parameters<typeof withPaymentPage>[1]
): Promise<PurchaseAddonResult> {
    const resumed = await withPaymentPage(
        {
            outcome: 'EXISTING',
            instanceId: occupant.id,
            chargeKind: 'UNA_VEZ',
            checkoutUrl: await checkoutUrlOf(occupant)
        },
        context
    );
    if (resumed.outcome !== 'EXISTING' || resumed.checkoutUrl) return resumed;
    const [current] = await getDb()
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, occupant.id))
        .limit(1);
    return current?.status === 'ACTIVE'
        ? { outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' }
        : resumed;
}

/** How long a request that lost the identity waits for the purchase holding it to commit. */
const OCCUPANT_WAIT_MS = 2_000;
/** The pause between two reads of the identity while waiting. */
const OCCUPANT_POLL_MS = 50;

/**
 * HOS-2518: reads the purchase that holds the identity a request collided with, waiting a
 * bounded time when none is committed.
 *
 * The read can come back empty after a 23505 when two tabs retry the same expired page purchase:
 * the other tab released the old purchase (ABANDONED) after this one collided with it, and its
 * new purchase is not committed yet. That gap has two parts. First the other tab's release is
 * committed while its new insert has not started (it re-reads the product and the policy before
 * opening its transaction), and nothing is held there that this request could wait on. Then its
 * insert transaction is open and uncommitted. A lock on the identity would cover only the second
 * part unless it spanned the release and the insert, which are separate transactions shared with
 * A3. So this re-reads with a short pause until a committed purchase appears: it never writes,
 * and it answers the live purchase as soon as the other tab commits.
 *
 * It covers recurring (PERIODICO) purchases too: any identity conflict whose re-read comes back
 * empty (an occupant released or expired by another entry in between) waits here the same way.
 *
 * @param input.identity - The owner, product and target the request asked for
 * @returns The committed purchase that holds the identity
 * @throws ServiceError (`SERVICE_UNAVAILABLE`, reason `PURCHASE_IDENTITY_BUSY`) when no purchase
 *   holds the identity by the end of the wait: this request created nothing, so the owner can
 *   retry with the same order id
 */
async function awaitIdentityOccupant(input: {
    readonly identity: PurchaseIdentity;
}): Promise<SelectAddonInstance> {
    const deadline = Date.now() + OCCUPANT_WAIT_MS;
    for (;;) {
        const { occupant } = await readIdentityOccupant({ identity: input.identity });
        if (occupant) return occupant;
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, OCCUPANT_POLL_MS));
    }
    // Only the identity: the request passed in also carries the payer's declared email.
    const { ownerId, productId, targetId } = input.identity;
    logger.warn(
        { ownerId, productId, targetId },
        'HOS-2518: no purchase holds the identity after a purchase identity conflict'
    );
    throw new ServiceError(
        ServiceErrorCode.SERVICE_UNAVAILABLE,
        'Another purchase of this addon was changing; try again',
        undefined,
        PURCHASE_IDENTITY_BUSY_REASON
    );
}

/**
 * A1: buys one addon with a durable purchase identity and a provider call after commit.
 *
 * A one-time (`UNA_VEZ`) addon is always paid on a provider payment page (HOS-2179); the card
 * order path was retired by T-7.
 */
export async function purchaseAddon(
    input: PurchaseAddonInput,
    ports: PurchaseAddonPorts
): Promise<PurchaseAddonResult> {
    return purchaseAddonOnce(input, ports, { mayReleaseOccupant: true });
}

async function purchaseAddonOnce(
    input: PurchaseAddonInput,
    ports: PurchaseAddonPorts,
    options: { readonly mayReleaseOccupant: boolean }
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
    const pagePurchase = chargeKindOf(product) === 'UNA_VEZ';
    const deadlines =
        chargeKindOf(product) === 'PERIODICO' || pagePurchase
            ? await getCurrentBillingDeadlines()
            : undefined;
    // HOS-2179 §5.2: a page purchase cannot be created without PLAZO:21; refuse before writing.
    if (pagePurchase && deadlines) paymentPageTiming(deadlines);
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
            if (
                await findIncludesAddonsAnchor({
                    tx,
                    userId: request.ownerId,
                    vertical: title.vertical
                })
            )
                return { outcome: 'REFUSED', reason: 'FREE_UNDER_GRANT' };
            const [existing] = await tx
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.orderRequestId, request.orderRequestId))
                .limit(1);
            if (existing) {
                if (!sameIdentity(existing, request))
                    return { outcome: 'REFUSED', reason: 'ORDER_REQUEST_REUSED' };
                // HOS-2321: the order id is unique per instance, so an abandoned attempt can never
                // be retried under it. Tell the client to mint a new id instead of replaying a
                // checkout that no longer exists.
                if (existing.status === 'ABANDONED')
                    return { outcome: 'REFUSED', reason: 'ORDER_REQUEST_ABANDONED' };
                const checkoutUrl = await checkoutUrlOf(existing, tx);
                return {
                    outcome: 'EXISTING',
                    instanceId: existing.id,
                    chargeKind: chargeKindOf(product),
                    checkoutUrl
                };
            }
            await assertAddonPurchasesOpen({
                freeze: ports.addonPurchasesFreeze ?? platformAddonPurchasesFreeze
            });
            const [instance] = await tx
                .insert(addonInstances)
                .values({
                    ownerId: request.ownerId,
                    productId: product.id,
                    addonVersionId: product.versionId,
                    targetId: request.targetId,
                    orderRequestId: request.orderRequestId,
                    status: 'PENDING_AUTHORIZATION',
                    // The page expiry and the A3 window are measured from this instant on the
                    // same clock A3 reads, so it is written rather than left to the database.
                    ...(pagePurchase ? { createdAt: now } : {})
                })
                .returning({ id: addonInstances.id });
            if (!instance) throw new Error('Addon instance insert returned no row');
            if (pagePurchase) {
                await tx.insert(idempotencyKeys).values({
                    key: paymentPageKey(request.orderRequestId),
                    operation: PAYMENT_PAGE_OPERATION,
                    subjectId: instance.id,
                    request: paymentPageRequestOf(request)
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
                chargeKind: chargeKindOf(product),
                startedFact: checkoutStartedFact({
                    product,
                    policy,
                    instanceId: instance.id,
                    ownerId: request.ownerId,
                    titleVertical: title.vertical,
                    complementId: created?.complementId,
                    now
                })
            };
        });
        if (pagePurchase) return withPaymentPage(result, { request, ports, deadlines });
        if (result.outcome !== 'CREATED' || !created?.complementId || !created.idempotencyKey)
            return result;
        let authorization: Awaited<ReturnType<typeof authorizePendingComplement>>;
        try {
            authorization = await authorizePendingComplement(
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
        } catch (error) {
            // HOS-2321: a refusal proves nothing exists at the provider, so release the identity
            // instead of leaving a pending row that blocks the owner's retry for the whole window.
            if (isCreationRefusedBeforeExisting(error)) {
                try {
                    await abandonRefusedComplement({
                        instanceId: created.instanceId,
                        complementId: created.complementId,
                        idempotencyKey: created.idempotencyKey,
                        rateLimited: error.transient?.kind === 'RATE_LIMITED',
                        now: ports.clock.now()
                    });
                } catch (abandonError) {
                    // The provider refusal is the answer the owner needs; the sweep and the window
                    // expiry still resolve the pending pair, so a failed release must not mask it.
                    logger.error(
                        {
                            instanceId: created.instanceId,
                            complementId: created.complementId,
                            error:
                                abandonError instanceof Error
                                    ? abandonError.message
                                    : String(abandonError)
                        },
                        'HOS-2321: failed to abandon a provider-refused addon complement'
                    );
                }
            }
            throw error;
        }
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
            if (existing) {
                const resolved = await resolveExisting(existing, request, product);
                return pagePurchase
                    ? withPaymentPage(resolved, { request, ports, deadlines })
                    : resolved;
            }
        }
        if (cause.constraint === 'uq_addon_instance_purchase_identity') {
            const occupant = await awaitIdentityOccupant({ identity: request });
            if (occupant.status === 'PENDING_AUTHORIZATION' && pagePurchase && deadlines) {
                // HOS-2179 T-6 review: the owner came back from the page without paying and asks
                // again with a fresh order id. Answer a page to pay, never "confirming".
                const decision = await decideOccupiedPagePurchase({ occupant, deadlines }, ports);
                if (decision === 'RESUME')
                    return resumeOccupiedPage(occupant, { request, ports, deadlines });
                if (decision === 'ACTIVATED')
                    return { outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' };
                if (decision === 'RETRY' && options.mayReleaseOccupant)
                    return purchaseAddonOnce(input, ports, { mayReleaseOccupant: false });
            }
            // HOS-2668: a recurring purchase is decided like a plan signup; the retry after a
            // release never releases again, so the purchase is recreated at most once.
            if (
                occupant.status === 'PENDING_AUTHORIZATION' &&
                !pagePurchase &&
                options.mayReleaseOccupant
            ) {
                const decision = await decideOccupiedRecurringPurchase(
                    { occupant, payerEmail: request.payerEmail },
                    ports
                );
                if (decision.kind === 'REUSE')
                    return {
                        outcome: 'EXISTING',
                        instanceId: occupant.id,
                        chargeKind: chargeKindOf(product),
                        checkoutUrl: decision.checkoutUrl
                    };
                if (decision.kind === 'ACTIVATED')
                    return { outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' };
                if (decision.kind === 'RETRY')
                    return purchaseAddonOnce(input, ports, { mayReleaseOccupant: false });
            }
            if (occupant.status === 'PENDING_AUTHORIZATION')
                return {
                    outcome: 'PENDING_ELSEWHERE',
                    instanceId: occupant.id,
                    chargeKind: chargeKindOf(product)
                };
            if (occupant.status === 'ACTIVE' && occupant.complementSubscriptionId)
                return { outcome: 'REFUSED', reason: 'ALREADY_ACTIVE' };
        }
        throw error;
    }
}
