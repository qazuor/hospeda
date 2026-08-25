/**
 * @file commerce-type-labels.ts
 * @description Single source for the listing-type label of a commerce vertical
 * (HOS-822).
 *
 * The owner form and the public listing page name the SAME `GastronomyTypeEnum`
 * / `ExperienceTypeEnum` value, and until this module they read it from two
 * different i18n blocks:
 *
 * - the public pages/cards read `gastronomy.types.<TYPE>` and
 *   `experience.type.<TYPE>` (`GastronomyCard`, `GastronomyDetailHeader`,
 *   `ExperienceCard`, `ExperienceHero`, and both index pages);
 * - the owner form read `commerce.owner.editor.typeOption.<TYPE>`, a private
 *   23-key duplicate of those two blocks.
 *
 * Two hand-maintained lists of the same 23 labels do not stay in agreement, and
 * they did not: at the time this was written they had drifted in TEN places
 * across the three locales — `KAYAK_RENTAL` ("Alquiler de kayaks" in the form vs
 * "Alquiler de kayak" on the listing, the divergence the issue reported),
 * `QUAD_RENTAL`, `TOUR_GUIDE`, plus `PARRILLA`/`ROTISERIA` in `en` and five
 * more in `pt`.
 *
 * Equalizing the strings would have fixed the ten and left the mechanism that
 * produced them intact. Instead the duplicate block is gone and both surfaces
 * resolve through here, so an owner picking a category always sees the exact
 * words the public page will print.
 *
 * @module lib/commerce-type-labels
 */

import type { CommerceVertical } from '@/lib/commerce/owner-listings';

/**
 * Translator function shape (matches `createTranslations().t`).
 *
 * Declared structurally rather than imported so this module stays usable from
 * both React islands and `.astro` frontmatter.
 */
type Translate = (key: string, fallback?: string) => string;

/**
 * i18n key prefix that holds the PUBLIC label for each vertical's listing type.
 *
 * These are the exact namespaces the public cards and detail headers read; the
 * mapping exists so a caller cannot pick the wrong one by hand.
 */
const TYPE_LABEL_KEY_PREFIX: Readonly<Record<CommerceVertical, string>> = {
    gastronomy: 'gastronomy.types',
    experience: 'experience.type'
};

/**
 * Builds the i18n key that names a listing type for a given vertical.
 *
 * Exported for the static guard that pins the owner form to the public
 * namespace — asserting on the key is what makes the "one source" property
 * checkable, since a wrong-but-present key would still render a plausible
 * label.
 *
 * @param params.vertical - The commerce vertical the listing belongs to.
 * @param params.type - The enum value (e.g. `'KAYAK_RENTAL'`).
 * @returns The fully-qualified translation key.
 *
 * @example
 * ```ts
 * buildCommerceTypeLabelKey({ vertical: 'experience', type: 'KAYAK_RENTAL' });
 * // => 'experience.type.KAYAK_RENTAL'
 * ```
 */
export function buildCommerceTypeLabelKey({
    vertical,
    type
}: {
    readonly vertical: CommerceVertical;
    readonly type: string;
}): string {
    return `${TYPE_LABEL_KEY_PREFIX[vertical]}.${type}`;
}

/**
 * Resolves the display label for a listing type, from the same key the public
 * page uses.
 *
 * @param params.t - Active locale translator.
 * @param params.vertical - The commerce vertical the listing belongs to.
 * @param params.type - The enum value (e.g. `'KAYAK_RENTAL'`).
 * @returns The localized label, degrading to the raw enum value when the key is
 *   missing — the same fallback convention every other type-label call site in
 *   the web app uses.
 *
 * @example
 * ```ts
 * resolveCommerceTypeLabel({ t, vertical: 'experience', type: 'KAYAK_RENTAL' });
 * // => 'Alquiler de kayak'  (identical to what the listing page prints)
 * ```
 */
export function resolveCommerceTypeLabel({
    t,
    vertical,
    type
}: {
    readonly t: Translate;
    readonly vertical: CommerceVertical;
    readonly type: string;
}): string {
    return t(buildCommerceTypeLabelKey({ vertical, type }), type);
}
