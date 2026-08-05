import { z } from 'zod';
import {
    HostTradeBenefitTypeEnum,
    hostTradeBenefitTypeRequiresValue
} from '../enums/host-trade-benefit-type.enum.js';
import { HostTradeBenefitTypeEnumSchema } from '../enums/host-trade-benefit-type.schema.js';

// ============================================================================
// Structured service-provider benefit (HOS-278 §6.4).
//
// Lives in `common/` rather than under either entity because BOTH the alliance
// lead (where the applicant first declares what they offer) and the host trade
// listing (where it is published) carry the same shape. Putting it under one of
// the two entities would force the other to import across entity boundaries.
// ============================================================================

/** Largest accepted percentage discount. A benefit cannot exceed the price. */
export const HOST_TRADE_BENEFIT_MAX_PERCENTAGE = 100;

/** Maximum length of the free-text fine print accompanying a benefit. */
export const HOST_TRADE_BENEFIT_TEXT_MAX = 500;

/**
 * Numeric magnitude of a benefit, interpreted by its type.
 *
 * A single integer column serves both numeric types: whole percent for
 * `PERCENTAGE`, centavos for `FIXED_AMOUNT` (the platform's money rule — never
 * a float). Which one it means is never guessed from the value; it is decided
 * by the companion type, and {@link refineHostTradeBenefit} is what keeps the
 * pair honest.
 */
export const HostTradeBenefitValueSchema = z
    .number()
    .int({ message: 'zodError.hostTrade.benefitValue.int' })
    .positive({ message: 'zodError.hostTrade.benefitValue.positive' });

/**
 * The three columns that make up a structured benefit.
 *
 * All optional/nullable at the field level: the cross-field rules that actually
 * constrain them cannot be expressed per-field, and live in
 * {@link refineHostTradeBenefit} instead. Never use this schema without
 * applying that refinement — on its own it accepts a `PERCENTAGE` with no
 * value, which is exactly the malformed benefit the structure exists to
 * prevent.
 */
export const HostTradeBenefitFieldsSchema = z.object({
    /** Closed benefit shape. */
    benefitType: HostTradeBenefitTypeEnumSchema.nullable().optional(),
    /** Magnitude, meaningful only for the numeric types. */
    benefitValue: HostTradeBenefitValueSchema.nullable().optional(),
    /** Fine print: conditions, exclusions, validity. */
    benefitText: z
        .string()
        .max(HOST_TRADE_BENEFIT_TEXT_MAX, { message: 'zodError.hostTrade.benefitText.max' })
        .nullable()
        .optional()
});

/** Inferred type for the structured benefit fields. */
export type HostTradeBenefitFields = z.infer<typeof HostTradeBenefitFieldsSchema>;

/** The subset of a payload {@link refineHostTradeBenefit} needs to inspect. */
interface BenefitShapeToRefine {
    readonly benefitType?: HostTradeBenefitTypeEnum | null;
    readonly benefitValue?: number | null;
}

/**
 * Cross-field rule binding a benefit's value to its type.
 *
 * Two directions, both enforced:
 *  - a numeric type (`PERCENTAGE`, `FIXED_AMOUNT`) REQUIRES a value — a "15% off"
 *    with no 15 is not a benefit, it is an empty promise rendered as a badge;
 *  - a non-numeric type (`TWO_FOR_ONE`, `SPECIAL_CONDITION`) REJECTS a value —
 *    otherwise a stale number survives a type change and the directory renders
 *    "2x1 — 15" to real users.
 *
 * `PERCENTAGE` additionally caps at {@link HOST_TRADE_BENEFIT_MAX_PERCENTAGE}.
 *
 * Applied via `.superRefine()` by every schema that carries the benefit fields,
 * so the invariant is written once and cannot drift between the lead form and
 * the published listing.
 *
 * @example
 * ```ts
 * const Schema = HostTradeBenefitFieldsSchema.superRefine(refineHostTradeBenefit);
 * ```
 */
export const refineHostTradeBenefit = (value: BenefitShapeToRefine, ctx: z.RefinementCtx): void => {
    const { benefitType, benefitValue } = value;

    // Nothing declared at all — a benefit is not always required at this layer
    // (an existing listing may predate the structured shape). The schemas that
    // DO require one enforce that separately, on `benefitType` itself.
    if (benefitType === null || benefitType === undefined) {
        if (benefitValue !== null && benefitValue !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['benefitValue'],
                message: 'zodError.hostTrade.benefitValue.requiresType'
            });
        }
        return;
    }

    if (hostTradeBenefitTypeRequiresValue(benefitType)) {
        if (benefitValue === null || benefitValue === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['benefitValue'],
                message: 'zodError.hostTrade.benefitValue.required'
            });
            return;
        }

        if (
            benefitType === HostTradeBenefitTypeEnum.PERCENTAGE &&
            benefitValue > HOST_TRADE_BENEFIT_MAX_PERCENTAGE
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['benefitValue'],
                message: 'zodError.hostTrade.benefitValue.percentageMax'
            });
        }
        return;
    }

    if (benefitValue !== null && benefitValue !== undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['benefitValue'],
            message: 'zodError.hostTrade.benefitValue.notAllowedForType'
        });
    }
};
