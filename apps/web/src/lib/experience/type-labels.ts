/**
 * @file experience/type-labels.ts
 * @description Single source for the experience listing-type label (HOS-822).
 *
 * The owner form and the public listing page name the SAME `ExperienceTypeEnum`
 * value, and until this module they read it from two different i18n blocks: the
 * public pages read `experience.type.<TYPE>` and the owner form read a private
 * duplicate of it under `listing.owner.editor.typeOption`. Two hand-maintained
 * lists of the same labels do not stay in agreement, and they drifted in
 * several places across the three locales.
 *
 * The duplicate block is gone and both surfaces resolve through here, so an
 * owner picking a category always sees the exact words the public page will
 * print.
 *
 * @module lib/experience/type-labels
 */

/**
 * Translator function shape (matches `createTranslations().t`).
 *
 * Declared structurally rather than imported so this module stays usable from
 * both React islands and `.astro` frontmatter.
 */
type Translate = (key: string, fallback?: string) => string;

/**
 * i18n key prefix that holds the PUBLIC label for each experience listing type.
 *
 * This is the exact namespace the public cards and detail headers read; the
 * constant exists so a caller cannot pick the wrong one by hand.
 */
const TYPE_LABEL_KEY_PREFIX = 'experience.type';

/**
 * Builds the i18n key that names a experience listing type.
 *
 * Exported for the static guard that pins the owner form to the public
 * namespace: asserting on the key is what makes the "one source" property
 * checkable, since a wrong-but-present key would still render a plausible
 * label.
 *
 * @param params.type - The enum value (e.g. `'KAYAK_RENTAL'`).
 * @returns The fully-qualified translation key.
 *
 * @example
 * ```ts
 * buildExperienceTypeLabelKey({ type: 'KAYAK_RENTAL' });
 * // => 'experience.type.KAYAK_RENTAL'
 * ```
 */
export function buildExperienceTypeLabelKey({ type }: { readonly type: string }): string {
    return `${TYPE_LABEL_KEY_PREFIX}.${type}`;
}

/**
 * Resolves the display label for a experience listing type, from the same key the
 * public page uses.
 *
 * @param params.t - Active locale translator.
 * @param params.type - The enum value (e.g. `'KAYAK_RENTAL'`).
 * @returns The localized label, degrading to the raw enum value when the key is
 *   missing, the same fallback convention every other type-label call site in
 *   the web app uses.
 *
 * @example
 * ```ts
 * resolveExperienceTypeLabel({ t, type: 'KAYAK_RENTAL' });
 * // => 'Alquiler de kayak'  (identical to what the listing page prints)
 * ```
 */
export function resolveExperienceTypeLabel({
    t,
    type
}: {
    readonly t: Translate;
    readonly type: string;
}): string {
    return t(buildExperienceTypeLabelKey({ type }), type);
}
