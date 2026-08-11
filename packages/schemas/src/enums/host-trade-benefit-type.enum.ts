/**
 * Host Trade Benefit Type Enum
 *
 * Closed set of benefit shapes a service provider can offer to hosts
 * (HOS-278 §6.4). The benefit is the provider's consideration for being listed
 * in the directory, so it is captured structurally — a type plus an optional
 * value — rather than as free text.
 *
 * Free text alone would make the benefit impossible to render as a badge,
 * filter the directory by, or measure afterwards. The prose that inevitably
 * accompanies an offer (its conditions, exclusions, validity) lives separately
 * in the `benefit` field, which becomes the fine print.
 *
 * The companion value column is interpreted BY this type:
 *
 * | type                | value                          |
 * |---------------------|--------------------------------|
 * | `PERCENTAGE`        | whole percent (e.g. `15` = 15%)|
 * | `FIXED_AMOUNT`      | centavos (platform money rule) |
 * | `TWO_FOR_ONE`       | unused — must be null          |
 * | `SPECIAL_CONDITION` | unused — must be null          |
 */
export enum HostTradeBenefitTypeEnum {
    /** A percentage discount off the provider's normal price. */
    PERCENTAGE = 'PERCENTAGE',
    /** A flat discount expressed in centavos. */
    FIXED_AMOUNT = 'FIXED_AMOUNT',
    /** Two-for-one style offer. Carries no numeric value. */
    TWO_FOR_ONE = 'TWO_FOR_ONE',
    /** Anything that is not a discount (priority response, free callout, ...). */
    SPECIAL_CONDITION = 'SPECIAL_CONDITION'
}

/**
 * Benefit types that carry a numeric value in the companion value column.
 *
 * Exported so validation, persistence, and UI all branch on ONE list instead of
 * each re-deciding which types are numeric — the kind of duplicated knowledge
 * that drifts silently when a fifth benefit type is added.
 */
export const HOST_TRADE_BENEFIT_TYPES_WITH_VALUE = [
    HostTradeBenefitTypeEnum.PERCENTAGE,
    HostTradeBenefitTypeEnum.FIXED_AMOUNT
] as const;

/** Narrowing helper for {@link HOST_TRADE_BENEFIT_TYPES_WITH_VALUE}. */
export const hostTradeBenefitTypeRequiresValue = (
    type: HostTradeBenefitTypeEnum
): type is (typeof HOST_TRADE_BENEFIT_TYPES_WITH_VALUE)[number] =>
    (HOST_TRADE_BENEFIT_TYPES_WITH_VALUE as readonly HostTradeBenefitTypeEnum[]).includes(type);
