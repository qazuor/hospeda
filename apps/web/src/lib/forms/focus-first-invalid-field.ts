/**
 * @file focus-first-invalid-field.ts
 * @description Moves focus to the first invalid field after a failed submit
 * (HOS-373 phase 2), so a validation error in a distant section is not just a
 * generic toast with no hint of where to look.
 *
 * ## "First" means first on the page, not first in the schema
 *
 * The obvious implementation takes `zodError.issues[0]`. That is the first
 * issue in *schema declaration* order, which has no relationship to where the
 * field sits on screen — the accommodation schema declares `youtube` in the
 * same object as `name`, so a form with both invalid could send the user to the
 * bottom of a 12-section page while an error sits at the top.
 *
 * So this resolves every mapped invalid field to its element and picks the one
 * that comes first in document order. That is what "the first error" means to
 * the person looking at the form.
 *
 * ## Fields with no single input
 *
 * Some fields carry one aggregate error over a group (commerce `openingHours`
 * is 7 day checkboxes × N shift inputs). They are handled by rendering the
 * derived id on the group's first control — no special case here (HOS-373
 * OQ-3).
 *
 * ## Derivation, not a table (HOS-385)
 *
 * This used to take a `FieldInputIdMap`: a per-editor table mapping every Zod
 * key to a free-form id string, which existed only because the Zod key and the
 * DOM id had drifted apart with no rule bridging them. Any row could be wrong,
 * and a wrong row failed SILENTLY — `getElementById` returns `null` and this
 * function simply does nothing.
 *
 * Now it calls the same {@link buildFieldId} the render site calls, so the two
 * cannot disagree: there is no table left to be wrong. The one place derivation
 * does not fully determine the answer is a Zod key rendered as several controls
 * (`phone` → country combobox + number input), which is what `suffixes` carries
 * — declared ONCE per editor and read from both sites.
 */

import { buildFieldId } from '@/lib/forms/build-field-id';

/** Options accepted by {@link focusFirstInvalidField}. */
export interface FocusFirstInvalidFieldOptions {
    /** Dotted Zod paths that failed validation, in any order. */
    readonly fieldNames: ReadonlyArray<string>;
    /** The editor's id namespace, e.g. `'acc'` or `'ce'`. */
    readonly prefix: string;
    /**
     * The editor's shared sub-control suffix map, for the Zod keys rendered as
     * more than one control. MUST be the same constant the render site reads —
     * passing a suffix ad-hoc at either end is what would let them disagree.
     */
    readonly suffixes?: Readonly<Record<string, string>>;
}

/** Whether the user asked for reduced motion, so scrolling does not animate. */
function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

/**
 * Returns the element that appears first in document order.
 *
 * `compareDocumentPosition` returns a bitmask; `DOCUMENT_POSITION_FOLLOWING`
 * (4) means the argument comes after `this`, i.e. the current best is earlier.
 */
function earlierInDocument(a: HTMLElement, b: HTMLElement): HTMLElement {
    // eslint-disable-next-line no-bitwise -- the DOM API is a bitmask
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? a : b;
}

/**
 * Focuses the first invalid field present on the page.
 *
 * Silently does nothing when no invalid field resolves to an element in the
 * DOM — a field can be one the editor does not render at all, or live in a
 * collapsed/unrendered section. That silence is why each editor carries a
 * mounted test asserting every Zod key resolves to a focusable control
 * (HOS-385 AC-5): a missing element makes this a no-op with no error anywhere.
 *
 * @returns `true` when a field was focused, so callers (and tests) can tell the
 * difference between "focused" and "found nothing".
 */
export function focusFirstInvalidField({
    fieldNames,
    prefix,
    suffixes
}: FocusFirstInvalidFieldOptions): boolean {
    if (typeof document === 'undefined' || fieldNames.length === 0) {
        return false;
    }

    let best: HTMLElement | null = null;

    for (const fieldName of fieldNames) {
        const id = buildFieldId({ prefix, name: fieldName, suffix: suffixes?.[fieldName] });

        const element = document.getElementById(id);
        if (!(element instanceof HTMLElement)) continue;

        best = best === null ? element : earlierInDocument(best, element);
    }

    if (!best) {
        return false;
    }

    best.focus({ preventScroll: true });

    // Focus is the contract; scrolling is a nicety. `scrollIntoView` does not
    // exist in jsdom (and is not guaranteed everywhere), and this runs inside an
    // event handler — an exception here would surface as an unhandled rejection
    // and fail a test run whose assertions all passed.
    if (typeof best.scrollIntoView === 'function') {
        best.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'center'
        });
    }

    return true;
}
