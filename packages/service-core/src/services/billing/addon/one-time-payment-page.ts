import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    addons,
    and,
    type DrizzleClient,
    domainEventModel,
    eq,
    getDb,
    idempotencyKeys,
    isNull
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    PaymentProviderError,
    sanitizeApprovalUrl
} from '@repo/payments';
import { z } from 'zod';
import { getCurrentBillingDeadlines } from '../deadlines/billing-deadlines.service';
import {
    rejectedCreationResult,
    throttledCreationResult
} from '../subscription/resolve-live-commitment';
import {
    type BillingDeadlinesRow,
    paymentPageExpiry,
    paymentPageTiming
} from './one-time-payment-page-deadline';

const logger = createLogger('one-time-payment-page');

/** The idempotency operation of a payment page creation (HOS-2179 §5.1). */
export const PAYMENT_PAGE_OPERATION = 'PAYMENT_PAGE_CREATE' as const;

/**
 * The creation key of a purchase's payment page, persisted by A1 in the same transaction as the
 * instance, before any provider call (DEC-CONC-001 📌2).
 *
 * @param orderRequestId - The purchase identifier the screen minted
 * @returns The key
 */
export function paymentPageKey(orderRequestId: string): string {
    return `page:${orderRequestId}`;
}

/**
 * The caller's part of a page creation body, stored on the key before any provider call so a
 * resume sends the same body whatever the resuming request carried (HOS-2179 §5.6).
 */
export const paymentPageRequestSchema = z.strictObject({
    returnUrl: z.url(),
    reason: z.string().min(1).optional()
});

/** The stored caller's part of a page creation body (HOS-2179 §5.6). */
export type PaymentPageRequest = z.infer<typeof paymentPageRequestSchema>;

/**
 * The body part to store with a new page creation key.
 *
 * @param input.returnUrl - Where the customer lands after the page
 * @param input.reason - Customer-facing text, if the caller set one
 * @returns The value for `idempotency_key.request`
 */
export function paymentPageRequestOf(input: {
    readonly returnUrl: string;
    readonly reason?: string | undefined;
}): PaymentPageRequest {
    return paymentPageRequestSchema.parse({
        returnUrl: input.returnUrl,
        ...(input.reason ? { reason: input.reason } : {})
    });
}

/** Ports of the payment page creation. */
export interface OpenOneTimePaymentPagePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    /** The deadline version; defaults to the one in force. */
    readonly deadlines?: BillingDeadlinesRow;
}

/** What one page creation attempt did. */
export type OpenOneTimePaymentPageResult =
    | { readonly outcome: 'OPENED' | 'ALREADY_OPEN'; readonly checkoutUrl?: string }
    | { readonly outcome: 'PAGE_WINDOW_ELAPSED' | 'NOT_APPLICABLE' };

const inputSchema = z.strictObject({
    instanceId: z.uuid(),
    returnUrl: z.url(),
    reason: z.string().min(1).optional()
});

const storedResultSchema = z.object({ checkoutUrl: z.string().min(1) });

/**
 * The sanitized link stored with a completed page creation key, if any.
 *
 * @param input.instanceId - The one-time instance
 * @param input.tx - Optional transaction to read in
 * @returns The link, or undefined when no completed key carries one
 */
export async function paymentPageCheckoutUrlOf(input: {
    readonly instanceId: string;
    readonly tx?: DrizzleClient;
}): Promise<string | undefined> {
    const [key] = await (input.tx ?? getDb())
        .select({ result: idempotencyKeys.result })
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.subjectId, input.instanceId),
                eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
            )
        )
        .limit(1);
    const parsed = storedResultSchema.safeParse(key?.result);
    return parsed.success ? parsed.data.checkoutUrl : undefined;
}

/** Whether a creation failure proves no page exists at the provider: a 4xx or a 429. */
function isPageCreationRefused(error: unknown): error is PaymentProviderError {
    return (
        error instanceof PaymentProviderError &&
        error.capability === 'charge' &&
        (error.code === 'REJECTED' || error.transient?.kind === 'RATE_LIMITED')
    );
}

/**
 * HOS-2321 for the page: a refused creation proves nothing exists, so the purchase is released
 * (instance `ABANDONED`, key completed with the refusal) instead of blocking the owner's retry.
 */
async function abandonRefusedPage(input: {
    readonly instanceId: string;
    readonly key: string;
    readonly rateLimited: boolean;
    readonly now: Date;
}): Promise<void> {
    await getDb().transaction(async (tx) => {
        const [instance] = await tx
            .update(addonInstances)
            .set({ status: 'ABANDONED', updatedAt: input.now })
            .where(
                and(
                    eq(addonInstances.id, input.instanceId),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION'),
                    isNull(addonInstances.paymentPageId)
                )
            )
            .returning({ id: addonInstances.id });
        if (!instance) return;
        await tx
            .update(idempotencyKeys)
            .set({
                result: input.rateLimited ? throttledCreationResult() : rejectedCreationResult(),
                completedAt: input.now
            })
            .where(and(eq(idempotencyKeys.key, input.key), isNull(idempotencyKeys.completedAt)));
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: input.instanceId,
            actorType: 'provider',
            actorId: null,
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
            occurredAt: input.now,
            tx
        });
    });
}

/**
 * Best effort: closes a page no purchase recorded and confirms it by a fresh re-read by id.
 * Never throws; a page left open carries our reference, so the reference search still finds
 * any payment on it (§5.10).
 */
async function closeUnrecordedPage(input: {
    readonly paymentPageId: string;
    readonly ports: OpenOneTimePaymentPagePorts;
}): Promise<void> {
    const { paymentPageId, ports } = input;
    try {
        await ports.provider.closeOneTimePayment({ paymentPageId });
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const read = await ports.provider.readOneTimePayment({ paymentPageId });
        const { snapshot, readAt } = assertFreshForAct({ read, act });
        if (snapshot.expiresAt === null || Date.parse(snapshot.expiresAt) > readAt.getTime())
            logger.warn({ paymentPageId }, 'Unrecorded payment page still open after close');
    } catch (error) {
        logger.warn(
            { paymentPageId, error: error instanceof Error ? error.message : String(error) },
            'Unrecorded payment page close failed'
        );
    }
}

/**
 * Opens the payment page of a pending one-time purchase (HOS-2179 §5.1), or resumes one whose
 * creation answer was lost (§5.6). It sends the key A1 persisted and an expiry derived from
 * the instance, so a repeat sends the same body; the provider may still open a second page
 * (EX-61 unmeasured), which is safe because nobody holds the lost one and both carry the same
 * reference. Creating a page moves no money. The instance records the page id and the expiry
 * the provider read back, the key records the sanitized link (GUARD:G10).
 *
 * @param input.instanceId - The pending one-time instance with a page creation key
 * @param input.returnUrl - Where the customer lands after the page
 * @param input.reason - Customer-facing text; defaults to the addon's name
 * @param ports - Provider, clock and optional deadline version
 * @returns What was done, with the sanitized link when there is one
 * @throws PaymentProviderError when the provider refuses (the purchase is released first) or
 *   does not answer (the purchase stays pending for a resume or A3)
 * @throws ApprovalUrlRejectedError when the provider's link is unsafe (the page is recorded first)
 */
export async function openOneTimePaymentPage(
    input: { readonly instanceId: string; readonly returnUrl: string; readonly reason?: string },
    ports: OpenOneTimePaymentPagePorts
): Promise<OpenOneTimePaymentPageResult> {
    const request = inputSchema.parse(input);
    const [found] = await getDb()
        .select({
            instance: addonInstances,
            product: addonProducts,
            addonName: addons.name,
            key: idempotencyKeys
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .innerJoin(addons, eq(addonProducts.addonId, addons.id))
        .innerJoin(
            idempotencyKeys,
            and(
                eq(idempotencyKeys.subjectId, addonInstances.id),
                eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
            )
        )
        .where(eq(addonInstances.id, request.instanceId))
        .limit(1);
    if (
        found?.product.chargeKind !== 'UNA_VEZ' ||
        found.instance.status !== 'PENDING_AUTHORIZATION' ||
        found.instance.orderRequestId === null
    )
        return { outcome: 'NOT_APPLICABLE' };
    if (found.key.completedAt !== null || found.instance.paymentPageId !== null)
        return {
            outcome: 'ALREADY_OPEN',
            checkoutUrl: await paymentPageCheckoutUrlOf({ instanceId: found.instance.id })
        };
    // A resume sends the body stored with the key, not this request's: the resuming screen may
    // carry another locale's return URL (§5.6). A key written before the column falls back.
    const stored = paymentPageRequestSchema.safeParse(found.key.request);
    if (found.key.request !== null && !stored.success)
        logger.warn(
            { instanceId: found.instance.id },
            'Stored page request is unreadable; using this one'
        );
    const body: PaymentPageRequest = stored.success ? stored.data : request;
    const timing = paymentPageTiming(ports.deadlines ?? (await getCurrentBillingDeadlines()));
    const expiresAt = paymentPageExpiry({ createdAt: found.instance.createdAt, timing });
    if (expiresAt.getTime() <= ports.clock.now().getTime())
        return { outcome: 'PAGE_WINDOW_ELAPSED' };

    let created: Awaited<ReturnType<PaymentProvider['requestOneTimePayment']>>;
    try {
        created = await ports.provider.requestOneTimePayment({
            reference: found.instance.orderRequestId,
            idempotencyKey: found.key.key,
            amount: { amountMinor: found.product.price, currency: found.product.currency },
            reason: body.reason ?? found.addonName,
            returnUrl: body.returnUrl,
            expiresAt: expiresAt.toISOString()
        });
    } catch (error) {
        if (isPageCreationRefused(error))
            await abandonRefusedPage({
                instanceId: found.instance.id,
                key: found.key.key,
                rateLimited: error.transient?.kind === 'RATE_LIMITED',
                now: ports.clock.now()
            });
        throw error;
    }

    let checkoutUrl: string | undefined;
    let unsafeLink: unknown;
    try {
        checkoutUrl = sanitizeApprovalUrl({ approvalUrl: created.approvalUrl }).url;
    } catch (error) {
        unsafeLink = error;
    }
    const recorded = await getDb().transaction(async (tx) => {
        const rows = await tx
            .update(addonInstances)
            .set({
                paymentPageId: created.paymentPageId,
                paymentPageExpiresAt: new Date(created.expiresAt),
                updatedAt: ports.clock.now()
            })
            .where(
                and(
                    eq(addonInstances.id, found.instance.id),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION'),
                    isNull(addonInstances.paymentPageId)
                )
            )
            .returning({ id: addonInstances.id });
        if (rows.length !== 1) return false;
        await tx
            .update(idempotencyKeys)
            .set({
                result: {
                    paymentPageId: created.paymentPageId,
                    expiresAt: created.expiresAt,
                    ...(checkoutUrl ? { checkoutUrl } : { applied: false })
                },
                completedAt: ports.clock.now()
            })
            .where(
                and(eq(idempotencyKeys.key, found.key.key), isNull(idempotencyKeys.completedAt))
            );
        return true;
    });
    if (!recorded) {
        // Not recorded: a concurrent resume recorded its page first, or the purchase stopped
        // waiting meanwhile (a concurrent refusal released it). Nobody holds the page we just
        // got, so it is closed rather than left open for a payment no purchase would claim
        // (§5.6, §5.7). A provider that deduplicated by key handed back the recorded page
        // itself, which must stay open.
        const [current] = await getDb()
            .select({
                status: addonInstances.status,
                paymentPageId: addonInstances.paymentPageId
            })
            .from(addonInstances)
            .where(eq(addonInstances.id, found.instance.id))
            .limit(1);
        if (current?.paymentPageId !== created.paymentPageId)
            await closeUnrecordedPage({ paymentPageId: created.paymentPageId, ports });
        logger.warn(
            {
                instanceId: found.instance.id,
                paymentPageId: created.paymentPageId,
                status: current?.status
            },
            'Payment page not recorded for this purchase'
        );
        if (current?.status !== 'PENDING_AUTHORIZATION') return { outcome: 'NOT_APPLICABLE' };
        return {
            outcome: 'ALREADY_OPEN',
            checkoutUrl: await paymentPageCheckoutUrlOf({ instanceId: found.instance.id })
        };
    }
    if (unsafeLink !== undefined) throw unsafeLink;
    return { outcome: 'OPENED', checkoutUrl };
}
