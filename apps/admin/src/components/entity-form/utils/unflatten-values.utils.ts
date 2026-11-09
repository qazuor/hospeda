/**
 * Resolves a dot-notated path from a nested object.
 *
 * @example
 * getNestedValue({ location: { country: 'AR' } }, 'location.country') // => 'AR'
 * getNestedValue({ name: 'Test' }, 'name') // => 'Test'
 * getNestedValue({}, 'location.country') // => undefined
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    // biome-ignore lint/suspicious/noExplicitAny: Traversing unknown nested structure
    let current: any = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[part];
    }

    return current;
}

/**
 * Prepares entity data as flat form values matching field IDs from section configs.
 *
 * Entity data from the API has nested objects (e.g., `{ location: { country: 'AR' } }`),
 * but form fields use dot-notation IDs (e.g., `location.country`).
 * This function creates a flat values object where each key matches a field ID,
 * resolving nested values via dot-notation paths.
 *
 * Non-dot-notated fields are copied directly from the entity.
 * All other top-level entity properties are also preserved.
 *
 * @example
 * const entity = { name: 'Test', location: { country: 'AR', state: 'ER' } };
 * const fieldIds = ['name', 'location.country', 'location.state'];
 * prepareFormValues(entity, fieldIds)
 * // => { name: 'Test', 'location.country': 'AR', 'location.state': 'ER', location: { country: 'AR', state: 'ER' } }
 */
export function prepareFormValues(
    entity: Record<string, unknown>,
    fieldIds: readonly string[]
): Record<string, unknown> {
    // Start with all entity values (preserves non-field properties like id, timestamps, etc.)
    const result: Record<string, unknown> = { ...entity };

    // For each field ID that uses dot-notation, resolve the value from the nested object
    for (const fieldId of fieldIds) {
        if (fieldId.includes('.')) {
            const value = getNestedValue(entity, fieldId);
            if (value !== undefined) {
                result[fieldId] = value;
            }
        }
    }

    return result;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date);

/**
 * Converts flat dot-notated keys into nested objects.
 *
 * Form fields use dot-notation for nested properties (e.g., 'location.country'),
 * but APIs expect nested objects (e.g., { location: { country: 'AR' } }).
 *
 * Two rules keep it safe on the live edit-form state (HOS-2060):
 * - **It never mutates its input.** Every object on a written path is copied
 *   before it is written. The edit form passes TanStack Form's own `values`
 *   here (submit-time validation), and writing into them in place silently
 *   rewrote the form state.
 * - **A nested value wins over a flat dotted key for the same path.** On the
 *   edit form `prepareFormValues` seeds a flat literal key next to the nested
 *   object, and TanStack Form only ever writes the nested one, so the flat key
 *   is a stale copy of the stored value. The flat key is used only when the
 *   nested path is `undefined` (the create form, which keeps flat keys only).
 *   This is the same "nested first, flat fallback" rule the inputs render by
 *   (`EntityFormSection.readValue`).
 *
 * @example
 * unflattenValues({ 'location.country': 'AR', 'location.state': 'ER', name: 'Test' })
 * // => { location: { country: 'AR', state: 'ER' }, name: 'Test' }
 */
export function unflattenValues(values: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
        if (!key.includes('.')) result[key] = value;
    }

    for (const [key, value] of Object.entries(values)) {
        if (!key.includes('.')) continue;
        if (getNestedValue(values, key) !== undefined) continue;

        const parts = key.split('.');
        let current: Record<string, unknown> = result;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i] as string;
            const next = current[part];
            const copy: Record<string, unknown> = isPlainObject(next) ? { ...next } : {};
            current[part] = copy;
            current = copy;
        }

        current[parts[parts.length - 1] as string] = value;
    }

    return result;
}
