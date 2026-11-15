import {
    and,
    billingOptions,
    courtesyGrants,
    eq,
    inArray,
    isNull,
    payments,
    providerLinks,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { createPaymentReconciliationMarkPayments } from '../../../../src/services/billing/payment/payment-ledger.js';
import { getServiceTestDb } from '../helpers.js';
import { adjustablePauseHarness } from './pause-fixtures.js';
import { closeNow, seedCloseCase } from './succession-close-fixtures.js';

/** A committed S18-shaped succession fixture for S9's service-level transaction. */
export async function seedReissueCourtesyCase(
    input: { readonly manual?: boolean; readonly status?: string } = {}
) {
    const db = getServiceTestDb();
    const ids = await db.transaction(async (tx) => {
        const seeded = await seedCloseCase(tx, {
            courtesy: true,
            successorStatus: (input.status as 'ACTIVE' | 'PENDING_AUTHORIZATION') ?? 'ACTIVE'
        });
        await tx
            .update(courtesyGrants)
            .set({ balanceMonths: 3 })
            .where(eq(courtesyGrants.id, seeded.grantId!));
        if (input.manual)
            await tx
                .update(subscriptions)
                .set({ paymentMethod: 'MANUAL' })
                .where(eq(subscriptions.id, seeded.successor.id));
        return seeded;
    });
    const harness = adjustablePauseHarness();
    harness.clock.set({ at: closeNow });
    let authorizationId: string | null = null;
    if (!input.manual && (input.status ?? 'ACTIVE') === 'ACTIVE') {
        const authorization = await harness.fake.authorize({
            reference: `s9-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'courtesy pause',
            returnUrl: 'https://example.test/return',
            payerEmail: `s9-${crypto.randomUUID()}@example.test`
        });
        await harness.fake.approve({ authorizationId: authorization.authorizationId });
        authorizationId = authorization.authorizationId;
        await db.insert(providerLinks).values({
            subscriptionId: ids.successor.id,
            provider: 'fake',
            providerId: authorizationId
        });
    }
    return {
        ids,
        harness,
        authorizationId,
        provider: harness.provider,
        clock: harness.clock,
        markPayments: createPaymentReconciliationMarkPayments(harness.clock)
    };
}

/** Deletes exactly the committed rows created by {@link seedReissueCourtesyCase}. */
export async function retireReissueCourtesyCase(input: {
    readonly ids: Awaited<ReturnType<typeof seedCloseCase>>;
}) {
    const db = getServiceTestDb();
    const subIds = [input.ids.successor.id, input.ids.predecessor.id];
    const marks = await db
        .select({ id: reconciliationMarks.id })
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, input.ids.successor.id),
                isNull(reconciliationMarks.liftedAt)
            )
        );
    if (marks.length)
        await db.delete(reconciliationMarkPayments).where(
            inArray(
                reconciliationMarkPayments.markId,
                marks.map((mark) => mark.id)
            )
        );
    await db
        .delete(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, input.ids.successor.id));
    await db
        .delete(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, input.ids.predecessor.id));
    // domain_event is append-only; each event references only this retired fixture id.
    await db.delete(payments).where(eq(payments.subscriptionId, input.ids.successor.id));
    await db
        .delete(subscriptionPauses)
        .where(
            inArray(subscriptionPauses.subscriptionId, [
                input.ids.successor.id,
                input.ids.predecessor.id
            ])
        );
    await db.delete(courtesyGrants).where(inArray(courtesyGrants.subscriptionId, subIds));
    await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, input.ids.successor.id));
    await db
        .update(subscriptions)
        .set({ succeededById: null })
        .where(eq(subscriptions.id, input.ids.predecessor.id));
    await db.delete(subscriptions).where(eq(subscriptions.id, subIds[0]!));
    await db.delete(subscriptions).where(eq(subscriptions.id, subIds[1]!));
    // Catalog versions are immutable by trigger; keep their non-live fixture rows.
    await db
        .delete(billingOptions)
        .where(eq(billingOptions.planVersionId, input.ids.successor.planVersionId!));
    await db.delete(users).where(eq(users.id, input.ids.userId));
}

/** The fake provider type used by the integration service invocation. */
export type ReissueFakeProvider = PaymentProvider;

/** Returns the provider fake with one asynchronous hook after its pause write. */
export function pauseProviderWithHook(input: {
    readonly provider: PaymentProvider;
    readonly afterPause: () => Promise<void>;
}): PaymentProvider {
    return new Proxy(input.provider, {
        get(target, property, receiver) {
            if (property === 'pause')
                return async ({ authorizationId }: { readonly authorizationId: string }) => {
                    const acknowledgement = await target.pause({ authorizationId });
                    await input.afterPause();
                    return acknowledgement;
                };
            const method = Reflect.get(target, property, receiver);
            return typeof method === 'function' ? method.bind(target) : method;
        }
    });
}

/** Closes the seeded deferred balance using S31's production catalog reason. */
export async function closeReissueCourtesyBalance(input: {
    readonly grantId: string;
    readonly closedAt: Date;
}): Promise<void> {
    await getServiceTestDb()
        .update(courtesyGrants)
        .set({
            balanceClosedAt: input.closedAt,
            closeReason: 'CONTRACARGO_DE_LA_PREDECESORA'
        })
        .where(eq(courtesyGrants.id, input.grantId));
}
