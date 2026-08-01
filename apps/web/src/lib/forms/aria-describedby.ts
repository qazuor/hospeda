/**
 * @file aria-describedby.ts
 * @description Builder for the `aria-describedby` attribute of a form field
 * described by more than one element (a validation error, a prefill notice, a
 * hint) where each of them may or may not be rendered at the time.
 *
 * Extracted from `commerce-lead-fields.ts` (HOS-295) when the alliance lead form
 * needed the same combination. Pure function — no React, no DOM.
 */

/**
 * Joins the element ids that describe a field into one `aria-describedby`
 * value, dropping the ones that are not currently rendered.
 *
 * Returning `undefined` rather than `''` matters: an empty `aria-describedby`
 * still counts as present and points a screen reader at nothing.
 *
 * @param params.ids - Candidate ids; `null` entries are dropped
 * @returns The space-separated id list, or undefined when nothing describes it
 */
export function buildDescribedBy({
    ids
}: {
    readonly ids: ReadonlyArray<string | null>;
}): string | undefined {
    const present = ids.filter((id): id is string => Boolean(id));
    return present.length > 0 ? present.join(' ') : undefined;
}
