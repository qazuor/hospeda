import type { BillingCycle } from '@repo/schemas';

/**
 * The message of each rejection of AC:V2:7. Each cause has its OWN message —
 * never one message for several causes. The four halves of G-R3 keep the exact
 * wording the spec fixes (V2.md:507-520).
 */
export const PLAN_PUBLICATION_REJECTIONS = {
    sellableNonSellableRole:
        'un plan no vendible por construcción no puede publicar una versión vendible',
    // Own message, NOT G-R3(a): a trial plan's effects are derived, never
    // stored (V2.md:412-416,457-462). G-R3(a) covers only pre_trial and floor.
    trialStoresEffects: 'los limits y entitlements del plan de trial no se guardan: se derivan',
    extraKey: 'clave de más',
    floorKeyMissing: 'clave de piso que falta',
    activationIff: 'activación fuera del si y sólo si',
    vipInheritance: 'herencia de VIP fuera de una versión vendible',
    duplicateRank: 'rank repetido entre las versiones vendibles y vigentes de la vertical',
    planWithoutCurrent: 'el plan no queda con exactamente una versión vigente',
    trialDaysFlip: 'los días de prueba de la vertical no pueden pasar de cero a más, ni al revés',
    graceNotShorter: 'la gracia debe ser menor que el ciclo más corto que la versión ofrece'
} as const;

/** The two keys the floor version must grant (G-R3 half (b)). */
export const FLOOR_REQUIRED_KEYS = ['subscribe_to_plan', 'recover_own_listing'] as const;

/**
 * The minimum length in days of each cycle. Cause (h) compares the grace
 * against the shortest cycle the version offers: a grace that is not strictly
 * shorter would outlive the cycle it is meant to bridge.
 */
export const CYCLE_MINIMUM_DAYS: Readonly<Record<BillingCycle, number>> = {
    monthly: 28,
    quarterly: 89,
    semiannual: 181,
    annual: 365
};

/** The confirmation message ACC:18 fixes. */
export const CONFIRMATION_MESSAGE =
    'Publicar no mueve a los clientes anclados: cambian por un aumento o por la acción 17.';
