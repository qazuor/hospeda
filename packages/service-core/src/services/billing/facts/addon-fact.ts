import type { VerticalEnum } from '@repo/schemas';

/** Who caused an add-on transition (HOS-1883 §4.3). */
export type AddonFactActorKind = 'USER' | 'ADMIN' | 'SYSTEM';

/** The cycle of a recurring (`PERIODICO`) add-on product (`ADDON_CYCLES`). */
export type AddonFactCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

/**
 * The path through which a paid, live add-on ended before its natural end (HOS-1883 §4.2).
 * `GRANT_REVOKED` is never emitted today: a revocation ends only free instances, which owe no
 * fact (AC-7). The owner kept it in the enum on purpose. `PROVIDER_CANCELLED` is a COMPLEMENTO
 * cancelled at the provider and mirrored by the notice path (payer or provider: it cannot tell).
 */
export type AddonEndPath =
    | 'OWNER_WITHDREW'
    | 'SERVICE_END'
    | 'ORPHANED'
    | 'GRANT_REVOKED'
    | 'LISTING_PURGED'
    | 'PROVIDER_CANCELLED';

/**
 * Why a pending add-on purchase died (HOS-1883 §4.2). `ORDER_DECLINED` is absent on purpose: the
 * one-time order path it described was retired by HOS-2179, and a declined payment-page attempt
 * leaves the purchase waiting, so no transition writes it.
 */
export type AddonAbandonReason = 'WINDOW_EXPIRED' | 'OWNER_WITHDREW' | 'CLOSED_BY_SYSTEM';

/**
 * The identity of the add-on instance a fact is about. `distinct_id` is the owner (`userId`).
 * `vertical` is present only when derivable (P-4'); `subscriptionId` is the COMPLEMENTO of a
 * recurring add-on.
 */
export interface AddonFactSubject {
    readonly userId: string;
    readonly addonInstanceId: string;
    readonly addonId: string;
    readonly addonVersionId: string;
    readonly addonProductId: string;
    readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
    readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly vertical?: VerticalEnum;
    readonly subscriptionId?: string;
}

type Common = AddonFactSubject & {
    readonly actorKind: AddonFactActorKind;
    readonly occurredAt: Date;
};

/** A committed add-on transition that can be forwarded to analytics (HOS-1883 §5.1). */
export type AddonFact =
    | (Common & {
          readonly kind: 'ADDON_CHECKOUT_STARTED';
          readonly amountMinor: number;
          readonly currency: 'ARS';
          readonly cycle?: AddonFactCycle;
      })
    | (Common & {
          readonly kind: 'ADDON_CHECKOUT_ABANDONED';
          readonly reason: AddonAbandonReason;
          readonly secondsInPending?: number;
      })
    | (Common & {
          readonly kind: 'ADDON_ACTIVATED';
          readonly amountMinor: number;
          readonly currency: 'ARS';
          readonly cycle?: AddonFactCycle;
          readonly secondsInPending?: number;
      })
    | (Common & {
          readonly kind: 'ADDON_CHARGE_CREDITED';
          readonly paymentId: string;
          readonly amountMinor: number;
          readonly currency: 'ARS';
          readonly isFirstCharge?: boolean;
          readonly cycle?: AddonFactCycle;
          readonly promoApplied?: boolean;
      })
    | (Common & {
          readonly kind: 'ADDON_CHARGE_REJECTED';
          readonly paymentId: string;
          readonly amountMinor: number;
          readonly currency: 'ARS';
          readonly isFirstCharge: boolean;
          readonly hasRetryWindow?: boolean;
      })
    | (Common & {
          readonly kind: 'ADDON_CANCELLED';
          readonly path: AddonEndPath;
          readonly wasScheduled: boolean;
          readonly lifetimeDays?: number;
      })
    | (Common & {
          readonly kind: 'ADDON_GRANTED_FREE';
          readonly source: 'S20_CONVERSION' | 'FREE_CHOICE';
          readonly previousAmountMinor?: number;
          readonly previousCycle?: AddonFactCycle;
          readonly previousSubscriptionId?: string;
      });

/** Every add-on fact kind, in catalog order. */
export const ADDON_FACT_KINDS = [
    'ADDON_CHECKOUT_STARTED',
    'ADDON_CHECKOUT_ABANDONED',
    'ADDON_ACTIVATED',
    'ADDON_CHARGE_CREDITED',
    'ADDON_CHARGE_REJECTED',
    'ADDON_CANCELLED',
    'ADDON_GRANTED_FREE'
] as const satisfies readonly AddonFact['kind'][];

/**
 * Whether a fact is an add-on fact.
 *
 * @param fact - Any fact carrying a `kind`
 * @returns True for the `ADDON_*` kinds
 */
export function isAddonFact<T extends { readonly kind: string }>(
    fact: T | AddonFact
): fact is AddonFact {
    return (ADDON_FACT_KINDS as readonly string[]).includes(fact.kind);
}
