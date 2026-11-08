import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addons,
    and,
    type DrizzleClient,
    eq,
    getDb,
    idempotencyKeys,
    providerLinks,
    type SelectAddonProduct,
    subscriptions
} from '@repo/db';
import {
    type AuthorizeInput,
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationCreation,
    type PaymentProvider,
    sanitizeApprovalUrl
} from '@repo/payments';
import { BILLING_CYCLE_MONTHS, type BillingCycle, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

/** Inserts the pending COMPLEMENTO and its provider creation key inside A1's transaction. */
export async function insertPendingComplement(input: {
    readonly tx: DrizzleClient;
    readonly ownerId: string;
    readonly vertical: string;
    readonly product: SelectAddonProduct;
    readonly now: Date;
    readonly deadlines: {
        readonly version: number;
        readonly values: { readonly '10': { readonly cardHours: number } };
    };
    readonly payerEmail?: string;
}): Promise<{ readonly complementId: string; readonly idempotencyKey: string }> {
    const [row] = await input.tx
        .insert(subscriptions)
        .values({
            userId: input.ownerId,
            vertical: input.vertical,
            paymentMethod: 'CARD',
            class: 'COMPLEMENTO',
            status: 'PENDING_AUTHORIZATION',
            declaredPayerEmail: input.payerEmail ?? null,
            authorizationWindowDeadlineVersion: input.deadlines.version,
            authorizationWindowEndsAt: new Date(
                input.now.getTime() + input.deadlines.values['10'].cardHours * 60 * 60 * 1000
            )
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Complement insert returned no row');
    const idempotencyKey = randomUUID();
    await input.tx.insert(idempotencyKeys).values({
        key: idempotencyKey,
        operation: 'PREAPPROVAL_CREATE',
        subjectId: row.id
    });
    return { complementId: row.id, idempotencyKey };
}

/** Calls the provider after commit and records a freshly confirmed preapproval. */
export async function authorizePendingComplement(
    input: {
        readonly complementId: string;
        readonly idempotencyKey: string;
        readonly product: SelectAddonProduct;
        readonly payerEmail?: string;
        readonly returnUrl: string;
        readonly reason?: string;
    },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<{ readonly checkoutUrl: string }> {
    const cycle = input.product.cycle as BillingCycle | null;
    if (!cycle || !BILLING_CYCLE_MONTHS[cycle])
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Unsupported addon billing cycle');
    const [addon] = await getDb()
        .select({ name: addons.name })
        .from(addons)
        .where(eq(addons.id, input.product.addonId))
        .limit(1);
    if (!addon)
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Addon catalog entry missing');
    const sent: AuthorizeInput = {
        reference: input.complementId,
        amount: { amountMinor: input.product.price, currency: input.product.currency },
        cadence: { everyMonths: BILLING_CYCLE_MONTHS[cycle] },
        reason: input.reason ?? addon.name,
        returnUrl: input.returnUrl,
        payerEmail: input.payerEmail
    };
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const created = await ports.provider.authorize(sent);
    const confirmation = await confirmAuthorizationCreation({
        provider: ports.provider,
        authorizationId: created.authorizationId,
        sent
    });
    assertFreshForAct({ read: confirmation.read, act });
    const checkoutUrl =
        confirmation.outcome === 'applied' ? sanitizeApprovalUrl(created).url : undefined;
    await getDb().transaction(async (tx) => {
        await tx.insert(providerLinks).values({
            subscriptionId: input.complementId,
            provider: 'MERCADO_PAGO',
            providerId: created.authorizationId
        });
        const completed = await tx
            .update(idempotencyKeys)
            .set({
                result: checkoutUrl
                    ? { authorizationId: created.authorizationId, applied: true, checkoutUrl }
                    : {
                          authorizationId: created.authorizationId,
                          applied: false,
                          fields:
                              confirmation.outcome === 'notApplied'
                                  ? confirmation.unapplied.map(({ field }) => field)
                                  : []
                      },
                completedAt: ports.clock.now()
            })
            .where(
                and(
                    eq(idempotencyKeys.key, input.idempotencyKey),
                    eq(idempotencyKeys.operation, 'PREAPPROVAL_CREATE'),
                    eq(idempotencyKeys.subjectId, input.complementId)
                )
            )
            .returning({ key: idempotencyKeys.key });
        if (completed.length !== 1)
            throw new Error('Expected one matching complement creation key');
    });
    if (!checkoutUrl)
        throw new ServiceError(
            ServiceErrorCode.PROVIDER_ERROR,
            'Created addon authorization differs from requested fields',
            undefined,
            'CREATION_NOT_APPLIED'
        );
    return { checkoutUrl };
}
