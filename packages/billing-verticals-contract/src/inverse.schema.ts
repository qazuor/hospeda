/**
 * The inverse direction (what billing reads from verticals, contract §4.1):
 * five queries, one write, and the PURGED push (contract §3.1).
 */
import { z } from 'zod';
import {
    AddonIdSchema,
    AddonVersionIdSchema,
    ListingIdSchema,
    PlanVersionIdSchema,
    UserIdSchema,
    UserVerticalArgsSchema,
    VerticalSchema
} from './primitives.schema';

/** The argument of `planPolicy` (`políticaDePlan(versiónDePlan)`). */
export const PlanPolicyArgsSchema = z.strictObject({ planVersionId: PlanVersionIdSchema });

/** The argument of `planPolicy`. */
export type PlanPolicyArgs = z.infer<typeof PlanPolicyArgsSchema>;

/**
 * The response of `planPolicy`: exactly four fields (contract §4.1; no trial
 * days, no entitlements, no limits). `díasDeGrace` → `graceDays`;
 * `permitePausa` → `allowsPause`; `vigente` → `current`; `vendible` → `sellable`.
 */
export const PlanPolicyResponseSchema = z.strictObject({
    graceDays: z.int().nonnegative(),
    allowsPause: z.boolean(),
    current: z.boolean(),
    sellable: z.boolean()
});

/** The response of `planPolicy`. */
export type PlanPolicyResponse = z.infer<typeof PlanPolicyResponseSchema>;

/** The argument of `changeDirection` (`direcciónDeCambio(versiónOrigen, versiónDestino)`). */
export const ChangeDirectionArgsSchema = z.strictObject({
    fromPlanVersionId: PlanVersionIdSchema,
    toPlanVersionId: PlanVersionIdSchema
});

/** The argument of `changeDirection`. */
export type ChangeDirectionArgs = z.infer<typeof ChangeDirectionArgsSchema>;

/** The verdict of `changeDirection`: `SUBE` → `UP`, `BAJA` → `DOWN`. */
export const ChangeDirectionResponseSchema = z.strictObject({
    direction: z.enum(['UP', 'DOWN'])
});

/** The response of `changeDirection`. */
export type ChangeDirectionResponse = z.infer<typeof ChangeDirectionResponseSchema>;

/** The argument of `listingPurged` (`fichaPurgada(ficha)`) and of `listing` (`ficha(idDeFicha)`). */
export const ListingArgsSchema = z.strictObject({ listingId: ListingIdSchema });

/** The argument of `listingPurged` and `listing`. */
export type ListingArgs = z.infer<typeof ListingArgsSchema>;

/**
 * The response of `listingPurged`: yes when the listing is in PURGED or its
 * row does not exist, no in any other state (contract §4.1).
 */
export const ListingPurgedResponseSchema = z.strictObject({ purged: z.boolean() });

/** The response of `listingPurged`. */
export type ListingPurgedResponse = z.infer<typeof ListingPurgedResponseSchema>;

/**
 * The response of `listing` (contract §4.1): `vertical`; `dueño` → `ownerId`;
 * `admiteDestaque` → `acceptsFeature` (a yes or no, never the state).
 */
export const ListingResponseSchema = z.strictObject({
    vertical: VerticalSchema,
    ownerId: UserIdSchema,
    acceptsFeature: z.boolean()
});

/** The response of `listing`. */
export type ListingResponse = z.infer<typeof ListingResponseSchema>;

/** The argument of `addonPolicy` (`políticaDeAddon(versiónDeAddon)`). */
export const AddonPolicyArgsSchema = z.strictObject({ addonVersionId: AddonVersionIdSchema });

/** The argument of `addonPolicy`. */
export type AddonPolicyArgs = z.infer<typeof AddonPolicyArgsSchema>;

/**
 * The response of `addonPolicy` (contract §4.1): `addon` → `addonId`;
 * `vigencia` → `validity` (`DÍAS_FIJOS` → `FIXED_DAYS`,
 * `MIENTRAS_VIVA_LA_SUSCRIPCIÓN` → `WHILE_SUBSCRIPTION_ALIVE`, contract §2.6);
 * `díasDeVigencia` → `validityDays`, set exactly when the validity is fixed
 * days; `tipoDeScope` → `scopeType`, with the four native scope names
 * (contract §2.7: `VERTICAL_SUBSCRIPTION` is the native name).
 */
export const AddonPolicyResponseSchema = z
    .strictObject({
        addonId: AddonIdSchema,
        validity: z.enum(['FIXED_DAYS', 'WHILE_SUBSCRIPTION_ALIVE']),
        validityDays: z.int().positive().nullable(),
        scopeType: z.enum(['LISTING', 'VERTICAL_SUBSCRIPTION', 'USER', 'GLOBAL'])
    })
    .superRefine((policy, ctx) => {
        if ((policy.validity === 'FIXED_DAYS') !== (policy.validityDays !== null)) {
            ctx.addIssue({
                code: 'custom',
                path: ['validityDays'],
                message: 'validityDays is set exactly when validity is FIXED_DAYS'
            });
        }
    });

/** The response of `addonPolicy`. */
export type AddonPolicyResponse = z.infer<typeof AddonPolicyResponseSchema>;

/**
 * The argument of `extendTrial` (`extenderTrial(user, vertical, días,
 * claveDeCanje)`): `días` → `days`; `claveDeCanje` → `redemptionKey`, which
 * makes a retry idempotent.
 */
export const ExtendTrialArgsSchema = UserVerticalArgsSchema.extend({
    days: z.int().positive(),
    redemptionKey: z.string().min(1)
});

/** The argument of `extendTrial`. */
export type ExtendTrialArgs = z.infer<typeof ExtendTrialArgsSchema>;

/** The answer of `extendTrial`: `ACEPTADA` → `ACCEPTED`; `RECHAZADA(motivo)` → `REJECTED` with its `reason`. */
export const ExtendTrialResponseSchema = z.discriminatedUnion('outcome', [
    z.strictObject({ outcome: z.literal('ACCEPTED') }),
    z.strictObject({ outcome: z.literal('REJECTED'), reason: z.string().min(1) })
]);

/** The response of `extendTrial`. */
export type ExtendTrialResponse = z.infer<typeof ExtendTrialResponseSchema>;

/**
 * The PURGED push ("la ficha F llegó a PURGED", contract §3.1): only the
 * listing id. Emitted AFTER the commit of PB9 or PB12, never inside its
 * transaction, and not believed: billing re-reads `listingPurged`.
 */
export const ListingPurgedEventSchema = z.strictObject({ listingId: ListingIdSchema });

/** The PURGED push. */
export type ListingPurgedEvent = z.infer<typeof ListingPurgedEventSchema>;
