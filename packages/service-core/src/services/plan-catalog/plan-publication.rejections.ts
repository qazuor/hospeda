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
    // Trial accepts limits only from the closed override list (Coord-22).
    trialLimitOutsideOverrides:
        'el plan de trial sólo guarda como override la cantidad de fichas de su vertical',
    extraKey: 'clave de más',
    // DO exception for the Tourist floor: a required entitlement or limit is
    // missing from the request (touristFloorMissingExceptionKey).
    touristFloorMissingExceptionKey:
        'el piso de Turista debe otorgar exactamente la lista cerrada: falta [clave]',
    floorKeyMissing: 'clave de piso que falta',
    activationIff: 'activación fuera del si y sólo si',
    vipInheritance: 'herencia de VIP fuera de una versión vendible',
    duplicateRank: 'rank repetido entre las versiones vendibles y vigentes de la vertical',
    planWithoutCurrent: 'el plan no queda con exactamente una versión vigente',
    trialDaysFlip: 'los días de prueba de la vertical no pueden pasar de cero a más, ni al revés',
    graceNotShorter: 'la gracia debe ser menor que el ciclo más corto que la versión ofrece'
} as const;

/**
 * Closed list of trial overrides by vertical (Coord-22, DEC-TRIAL-001).
 * The trial plan stores exactly one limit row: the number of listings of that
 * vertical. Adding a vertical key is a recorded decision, not a config change.
 * `tourist` and `partner` have no listings, so they do not appear.
 */
export const TRIAL_OVERRIDE_LIMIT_KEY_BY_VERTICAL = {
    accommodation: 'max_accommodations',
    gastronomy: 'max_gastronomies',
    experience: 'max_experiences'
} as const;

/**
 * The two keys the floor version must grant (G-R3 half (b)).
 */
export const FLOOR_REQUIRED_KEYS = ['subscribe_to_plan', 'recover_own_listing'] as const;

/**
 * DO exception for the Tourist floor only. A single data object — no branches —
 * that replaces the (a) rule when `role === 'floor'` and `vertical === 'tourist'`.
 *
 * Entitlements without quotas (BASE keys with no commercial effect).
 * Entitlements with quotas (measured): H-2 — the catalog uses `ai_search` and
 * `ai_chat` as measured entitlement keys; their limit counterparts are
 * `max_ai_search_per_month` and `max_ai_chat_consumer_per_month` respectively.
 * The coordinator must confirm these mappings before V2.4b.
 * Limits (COMMERCIAL keys with fixed values).
 */
export const TOURIST_FLOOR_EXCEPTION = {
    entitlements: [
        { key: 'save_favorites' as const },
        { key: 'write_reviews' as const },
        { key: 'ai_search' as const, planQuota: 10, trialQuota: 10 },
        { key: 'ai_chat' as const, planQuota: 10, trialQuota: 10 }
    ],
    limits: [
        { key: 'max_favorites' as const, value: 5 },
        { key: 'max_ai_search_per_month' as const, value: 10 },
        { key: 'max_ai_chat_consumer_per_month' as const, value: 10 }
    ]
} as const;

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
