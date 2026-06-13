/**
 * Utility for computing the diff of translatable text fields between two
 * entity snapshots (SPEC-212, AC-5).
 *
 * Used by entity services in their `_afterUpdate` hooks to determine which
 * fields actually changed so that only changed fields are re-translated.
 *
 * @module diff-translatable-fields
 */

/**
 * Computes the set of translatable fields whose value changed between a
 * previously-captured snapshot and the current entity state.
 *
 * A field is included in the result when ALL of the following are true:
 *  - `fieldName` is listed in `fieldNames`
 *  - `current[fieldName]` is a non-empty string (falsy values are skipped,
 *    same guard used in `_afterCreate` hooks)
 *  - `current[fieldName]` differs from `previous[fieldName]` (strict equality;
 *    `undefined` previous value means the field is treated as new)
 *
 * @param previous - Snapshot of field values captured before the update.
 *   Values for fields not yet present in hookState will be `undefined`.
 * @param current - Field values from the updated entity.
 * @param fieldNames - The ordered list of field names to check. Determines
 *   which keys are eligible for translation.
 * @returns A `Record<string, string>` containing only the changed fields
 *   (keys are field names, values are the new non-empty strings). Returns
 *   an empty object when nothing changed.
 */
export function diffTranslatableFields({
    previous,
    current,
    fieldNames
}: {
    previous: Readonly<Record<string, string | undefined>>;
    current: Readonly<Record<string, string | null | undefined>>;
    fieldNames: readonly string[];
}): Record<string, string> {
    const changed: Record<string, string> = {};
    for (const field of fieldNames) {
        const newValue = current[field];
        if (!newValue) continue; // skip empty / null / undefined
        if (newValue !== previous[field]) {
            changed[field] = newValue;
        }
    }
    return changed;
}
