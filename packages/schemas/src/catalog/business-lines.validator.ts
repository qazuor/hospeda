import { BUSINESS_LINE_RULES, BUSINESS_LINES } from './business-lines.js';
import type { BusinessLineValue, ListingVertical, UpdateInputOf } from './listing-catalog.types.js';

/** Stable reason codes returned when a listing's selected business lines fail validation. */
export const BUSINESS_LINE_VALIDATION_REASONS = {
    EMPTY: 'EMPTY',
    DUPLICATE: 'DUPLICATE',
    NOT_IN_VERTICAL: 'NOT_IN_VERTICAL',
    NOT_ALLOWED_FOR_TYPE: 'NOT_ALLOWED_FOR_TYPE',
    MAX_EXCEEDED: 'MAX_EXCEEDED',
    EXCLUDED_PAIR: 'EXCLUDED_PAIR'
} as const;
/** A reason code from {@link BUSINESS_LINE_VALIDATION_REASONS}. */
export type BusinessLineValidationReason =
    (typeof BUSINESS_LINE_VALIDATION_REASONS)[keyof typeof BUSINESS_LINE_VALIDATION_REASONS];
/** Result of validating a business line selection. */
export type BusinessLineValidationResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: BusinessLineValidationReason };

/** Rule shape used to validate or resolve options for one listing vertical. */
export type AnyRules = {
    readonly vertical: ListingVertical;
    readonly maxPerListing?: number;
    readonly excludes?: readonly (readonly [string, string])[];
    readonly typeRules: Readonly<Record<string, { readonly allowed: readonly string[] }>>;
};
/** Input accepted by {@link validateBusinessLines}. */
export type ValidateBusinessLinesInput<V extends ListingVertical> = {
    readonly vertical: V;
    readonly type: string;
    readonly businessLines: readonly string[];
    readonly rules?: AnyRules;
};

/**
 * Sorts a listing's selected business lines into their canonical catalog order.
 * @param input - Listing vertical and selected business line values.
 * @returns A new array containing the values in catalog order.
 */
export function normalizeBusinessLines<V extends ListingVertical>({
    vertical,
    businessLines
}: {
    readonly vertical: V;
    readonly businessLines: readonly BusinessLineValue<V>[];
}): BusinessLineValue<V>[] {
    const order = BUSINESS_LINES[vertical].map((line) => line.value);
    return [...businessLines].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * Validates a business line selection against vertical and type-specific rules.
 * @param input - Vertical, listing type, selected values, and optional rule override.
 * @returns Whether the selection is valid, with a reason when it is not.
 */
export function validateBusinessLines<V extends ListingVertical>({
    vertical,
    type,
    businessLines,
    rules = BUSINESS_LINE_RULES[vertical] as unknown as AnyRules
}: ValidateBusinessLinesInput<V>): BusinessLineValidationResult {
    if (businessLines.length === 0) return { ok: false, reason: 'EMPTY' };
    if (new Set(businessLines).size !== businessLines.length)
        return { ok: false, reason: 'DUPLICATE' };
    const catalog = BUSINESS_LINES[vertical].map((line) => line.value as string);
    if (businessLines.some((line) => !catalog.includes(line)))
        return { ok: false, reason: 'NOT_IN_VERTICAL' };
    const allowed = rules.typeRules[type as keyof typeof rules.typeRules]?.allowed as
        | readonly string[]
        | undefined;
    if (!allowed || businessLines.some((line) => !allowed.includes(line)))
        return { ok: false, reason: 'NOT_ALLOWED_FOR_TYPE' };
    if (rules.maxPerListing !== undefined && businessLines.length > rules.maxPerListing)
        return { ok: false, reason: 'MAX_EXCEEDED' };
    if (
        rules.excludes?.some(
            ([left, right]) => businessLines.includes(left) && businessLines.includes(right)
        )
    )
        return { ok: false, reason: 'EXCLUDED_PAIR' };
    return { ok: true };
}

/**
 * Resolves every catalog option with its current selectable state and reason.
 *
 * `removable` answers a different question from `selectable`: not "may this
 * line be picked?", but "may it be unpicked without leaving an invalid
 * selection?". The owner editor blocks unchecking the last line, and any line
 * whose removal would violate a catalog rule, instead of silently dropping a
 * business line (which hides the sections it owns). The answer comes from
 * {@link validateBusinessLines} over the selection minus that option, so the
 * web never compares business-line values itself (G-FAC-03).
 *
 * @param input - Vertical, listing type, current selection, and optional rule override.
 * @returns Catalog options marked selectable/removable or paired with blocking reasons.
 */
export function resolveBusinessLineOptions<V extends ListingVertical>({
    vertical,
    type,
    selected,
    rules = BUSINESS_LINE_RULES[vertical] as unknown as AnyRules
}: {
    readonly vertical: V;
    readonly type: string;
    readonly selected: readonly string[];
    readonly rules?: AnyRules;
}): {
    readonly value: BusinessLineValue<V>;
    readonly selectable: boolean;
    readonly selected: boolean;
    readonly removable: boolean;
    readonly reason?: BusinessLineValidationReason;
    readonly removeReason?: BusinessLineValidationReason;
}[] {
    const typeRule = rules.typeRules[type as keyof typeof rules.typeRules];
    return BUSINESS_LINES[vertical].map(({ value }) => {
        let reason: BusinessLineValidationReason | undefined;
        if (!typeRule || !(typeRule.allowed as readonly string[]).includes(value))
            reason = 'NOT_ALLOWED_FOR_TYPE';
        else if (
            rules.maxPerListing !== undefined &&
            selected.length >= rules.maxPerListing &&
            !selected.includes(value)
        )
            reason = 'MAX_EXCEEDED';
        else if (
            rules.excludes?.some(
                ([left, right]) =>
                    (value === left && selected.includes(right)) ||
                    (value === right && selected.includes(left))
            )
        )
            reason = 'EXCLUDED_PAIR';

        const without = selected.filter((entry) => entry !== value);
        const removal = validateBusinessLines({ vertical, type, businessLines: without, rules });

        return {
            value: value as BusinessLineValue<V>,
            selectable: reason === undefined,
            selected: selected.includes(value),
            removable: removal.ok,
            ...(reason ? { reason } : {}),
            ...(removal.ok ? {} : { removeReason: removal.reason })
        };
    });
}

/**
 * Resolves the defaults a listing type brings to the create form.
 *
 * The owner editor must not read the catalog rules directly (G-FAC-03): it asks
 * this helper for the preselected business lines and the suggested field
 * values, and renders both as ordinary, editable form state.
 *
 * @param input - Listing vertical and the selected listing type.
 * @param input.vertical - Vertical whose catalog is being resolved.
 * @param input.type - Listing type; an unknown type yields empty defaults.
 * @returns The type's preselected business lines and suggested field values.
 */
export function resolveBusinessLineDefaults<V extends ListingVertical>({
    vertical,
    type
}: {
    readonly vertical: V;
    readonly type: string;
}): {
    readonly preselect: readonly BusinessLineValue<V>[];
    readonly fieldDefaults: Partial<UpdateInputOf<V>>;
} {
    const rules = BUSINESS_LINE_RULES[vertical] as unknown as {
        readonly typeRules: Readonly<
            Record<
                string,
                {
                    readonly preselect: readonly BusinessLineValue<V>[];
                    readonly fieldDefaults?: Partial<UpdateInputOf<V>>;
                }
            >
        >;
    };
    const typeRule = rules.typeRules[type];

    if (!typeRule) return { preselect: [], fieldDefaults: {} };

    return {
        preselect: [...typeRule.preselect],
        fieldDefaults: typeRule.fieldDefaults ?? {}
    };
}
