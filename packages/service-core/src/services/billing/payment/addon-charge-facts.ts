/**
 * The add-on branches of the charge facts (HOS-1883 §4.2, §5.2): `addon_charge_succeeded` for a
 * credited one-time payment or COMPLEMENTO charge, and `addon_charge_declined` for a rejected
 * COMPLEMENTO charge. The charge's own values are captured by the caller from the row it wrote;
 * the add-on identity is read after commit. Both never throw (P-9).
 */
import { type AddonFactListing, emitAddonFact } from '../addon/addon-fact-emit';
import type { BillingFactSink } from '../facts/billing-fact-sink';

/** One add-on charge the credit committed, captured inside its transaction. */
export interface CreditedAddonCharge {
    /** The one-time instance, or the COMPLEMENTO the recurring instance hangs from. */
    readonly source:
        | { readonly instanceId: string }
        | { readonly complementSubscriptionId: string };
    readonly paymentId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly occurredAt: Date;
    /** Present only for a COMPLEMENTO charge (T-1): no credited payment on that row yet. */
    readonly isFirstCharge?: boolean;
    /** Present only for a COMPLEMENTO charge, where promos are evaluated. */
    readonly promoApplied?: boolean;
}

/**
 * Emits `addon_charge_succeeded` after the credit committed.
 *
 * @param input.charge - The committed add-on charge
 * @param input.billingFacts - The sink
 * @param input.listing - Optional listing reader for a `LISTING` one-time instance's vertical
 */
export async function emitAddonChargeCredited(input: {
    readonly charge: CreditedAddonCharge;
    readonly billingFacts: BillingFactSink | undefined;
    readonly listing?: AddonFactListing;
}): Promise<void> {
    const { charge } = input;
    if (charge.currency !== 'ARS') return;
    await emitAddonFact({
        billingFacts: input.billingFacts,
        listing: input.listing,
        source: charge.source,
        build: (anchored) => ({
            kind: 'ADDON_CHARGE_CREDITED',
            ...anchored.subject,
            actorKind: 'SYSTEM',
            occurredAt: charge.occurredAt,
            paymentId: charge.paymentId,
            amountMinor: charge.amountMinor,
            currency: 'ARS',
            ...(charge.isFirstCharge === undefined ? {} : { isFirstCharge: charge.isFirstCharge }),
            ...(anchored.cycle ? { cycle: anchored.cycle } : {}),
            ...(charge.promoApplied === undefined ? {} : { promoApplied: charge.promoApplied })
        })
    });
}

/**
 * Emits `addon_charge_declined` for a rejected COMPLEMENTO charge. The row keeps its state: a
 * COMPLEMENTO never enters grace (§1.2), so the event has no `next_state` (T-8).
 *
 * @param input.complementSubscriptionId - The COMPLEMENTO the charge belongs to
 * @param input.billingFacts - The sink
 */
export async function emitAddonChargeRejected(input: {
    readonly complementSubscriptionId: string;
    readonly paymentId: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly occurredAt: Date;
    readonly isFirstCharge: boolean;
    readonly hasRetryWindow: boolean;
    readonly billingFacts: BillingFactSink | undefined;
}): Promise<void> {
    if (input.currency !== 'ARS') return;
    await emitAddonFact({
        billingFacts: input.billingFacts,
        source: { complementSubscriptionId: input.complementSubscriptionId },
        build: (anchored) => ({
            kind: 'ADDON_CHARGE_REJECTED',
            ...anchored.subject,
            actorKind: 'SYSTEM',
            occurredAt: input.occurredAt,
            paymentId: input.paymentId,
            amountMinor: input.amountMinor,
            currency: 'ARS',
            isFirstCharge: input.isFirstCharge,
            hasRetryWindow: input.hasRetryWindow
        })
    });
}
