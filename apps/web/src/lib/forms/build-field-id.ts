/**
 * @file build-field-id.ts
 * @description The single source of a form field's DOM `id` (HOS-385).
 *
 * Every field id in a migrated editor is produced here, and
 * `focusFirstInvalidField` resolves the id to focus by calling this same
 * function. That is the whole point: the render site and the focus site cannot
 * disagree, because neither of them writes an id.
 *
 * This replaces the per-editor `field-input-ids.ts` lookup tables introduced by
 * HOS-373, which existed only because the Zod key and the DOM id had drifted
 * apart and no rule bridged them. A wrong entry in those tables was a SILENT
 * failure — `focusFirstInvalidField` resolves ids with `document.getElementById`,
 * so a bad id returns `null` and the function simply does nothing.
 */

/** Parameters for {@link buildFieldId}. */
export interface BuildFieldIdParams {
    /** Editor-level namespace, e.g. `'acc'` or `'ce'`. */
    readonly prefix: string;
    /** The Zod field path, e.g. `'facebook'` or `'contactInfo.workEmail'`. */
    readonly name: string;
    /**
     * Disambiguator for a Zod field rendered as more than one control.
     *
     * `phone` is one Zod key but two inputs (a country combobox plus a number
     * input), and focus belongs on the number. Suffixes must NOT be passed
     * ad-hoc at each call site — declare them once per editor and read that
     * constant from both the render site and the focus site, or the two can
     * disagree and the silent no-op comes back.
     */
    readonly suffix?: string;
}

/**
 * Builds the DOM `id` for a form field from its Zod field path.
 *
 * Dots in a nested path are normalised to hyphens: an id containing `.` is
 * legal HTML but breaks `querySelector('#a.b')`, which reads the dot as a class
 * selector. `getElementById` would cope; test helpers and CSS would not.
 *
 * @param params - The namespace, Zod field path and optional sub-control suffix.
 * @returns The id to render, e.g. `'acc-facebook'`, `'ce-contactInfo-workEmail'`.
 * @example
 * buildFieldId({ prefix: 'acc', name: 'facebook' });                  // 'acc-facebook'
 * buildFieldId({ prefix: 'acc', name: 'phone', suffix: 'number' });   // 'acc-phone-number'
 * buildFieldId({ prefix: 'ce', name: 'contactInfo.workEmail' });      // 'ce-contactInfo-workEmail'
 */
export function buildFieldId({ prefix, name, suffix }: BuildFieldIdParams): string {
    const path = name.replaceAll('.', '-');
    const base = `${prefix}-${path}`;
    return suffix ? `${base}-${suffix}` : base;
}
