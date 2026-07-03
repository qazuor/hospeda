/**
 * Pure syntactic validation for the `dispatch_cron_cadence` `social_settings`
 * value consumed by the publish-dispatch cron job (HOS-64 / SPEC-297a G-2).
 *
 * No DB/IO — callers resolve the raw stored string via `SocialSettingModel`
 * and pass it through {@link resolveDispatchCronCadence}, which validates the
 * 5-field cron shape and falls back to the hard-coded default schedule on
 * anything missing or malformed. This protects cron registration (T-013)
 * from an operator-entered value (e.g. a typo'd expression) breaking the
 * dispatch loop at startup.
 */

/** `social_settings` key for the publish-dispatch cron cadence. */
export const DISPATCH_CRON_CADENCE_KEY = 'dispatch_cron_cadence';

/** Cadence used when the setting is missing or fails validation. */
export const DEFAULT_DISPATCH_CRON_CADENCE = '*/5 * * * *';

/**
 * Matches a single standard cron field: a wildcard, a wildcard with a step,
 * a number, a range, or a range with a step, or a comma-separated list of
 * any of those. Digits only — this is a syntactic check (shape of the
 * expression), not a semantic one (e.g. it does not reject `99` in the
 * minute field).
 */
const CRON_FIELD_PATTERN = /^(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?)(,(\*(\/\d+)?|\d+(-\d+)?(\/\d+)?))*$/;

/**
 * Checks whether a string is a syntactically valid 5-field cron expression
 * (minute hour day-of-month month day-of-week).
 *
 * @param expression - The candidate cron expression.
 * @returns `true` if it has exactly 5 whitespace-separated fields that each
 * match the cron field shape.
 */
export function isValidCronExpression(expression: string): boolean {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) {
        return false;
    }
    return fields.every((field) => CRON_FIELD_PATTERN.test(field));
}

/** Input for {@link resolveDispatchCronCadence}. */
export interface ResolveDispatchCronCadenceInput {
    /** Raw stored `social_settings.value`, or `undefined`/`null` if the row is missing. */
    rawValue: string | null | undefined;
}

/**
 * Resolves the dispatch cron cadence from a raw `social_settings` value,
 * falling back to {@link DEFAULT_DISPATCH_CRON_CADENCE} when missing or not
 * a syntactically valid 5-field cron expression.
 *
 * @param input - The raw setting value.
 * @returns A syntactically valid cron expression.
 */
export function resolveDispatchCronCadence(input: ResolveDispatchCronCadenceInput): string {
    const { rawValue } = input;

    if (rawValue === null || rawValue === undefined || rawValue.trim() === '') {
        return DEFAULT_DISPATCH_CRON_CADENCE;
    }

    const trimmed = rawValue.trim();
    return isValidCronExpression(trimmed) ? trimmed : DEFAULT_DISPATCH_CRON_CADENCE;
}
