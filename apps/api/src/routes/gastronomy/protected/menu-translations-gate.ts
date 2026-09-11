/**
 * The write-side gate for carta translations (HOS-1043).
 *
 * ## Why this is not a `requireEntitlement` middleware
 *
 * `PUT .../menu` is ALREADY gated, on `manage_gastronomy_menu`, and that gate
 * must stay exactly where it is: a `-pro` owner is entitled to write a carta.
 * What they are not entitled to is TRANSLATING it — which is a property of
 * the BODY, not of the route. A second `requireEntitlement` on the same route
 * would refuse every `-pro` carta, translated or not, and turn a premium
 * upsell into the removal of a feature that already works.
 *
 * So the check is conditional on the payload, and it is a REFUSAL rather than
 * a silent strip — the same shape (and the same reasoning) as
 * `menuPayloadCarriesItemPhoto` / `menu-item-photo-gate.ts` next door. Dropping
 * the translations and answering 200 would tell the owner the carta saved —
 * which it did — while quietly discarding work they can see themselves having
 * typed.
 *
 * Extracted into its own module for the same reason: a direct unit-test
 * surface that does not require building a Hono context and a subscription
 * fixture.
 *
 * @module routes/gastronomy/protected/menu-translations-gate
 */

/**
 * Whether one dish or section's `nameI18n`/`descriptionI18n` field is present.
 *
 * Presence alone is the trigger, not a check on individual locale content:
 * `i18nText({...})` on the input schema requires `es`, `en` AND `pt` together
 * whenever the object is submitted at all (it is `.nullish()`, not partial),
 * so there is no submission that carries an i18n object with only the
 * Spanish leg filled in. A caller reaching this function with unvalidated
 * `unknown` still only needs to ask "is the field there".
 *
 * @param value - The raw `nameI18n` or `descriptionI18n` value from the body.
 * @returns `true` when the field is a non-null object.
 */
function isTranslationField(value: unknown): boolean {
    return typeof value === 'object' && value !== null;
}

/**
 * Whether a submitted carta document carries a translation on ANY of its
 * sections or dishes.
 *
 * Reads defensively over `unknown` because it runs on the raw body — see
 * `menuPayloadCarriesItemPhoto` for why a gate that throws on a malformed
 * shape is a gate that can be disabled by sending one.
 *
 * @param body - The submitted menu document, unvalidated.
 * @returns `true` when at least one section or dish carries `nameI18n` or
 *   `descriptionI18n`.
 */
export function menuPayloadCarriesTranslations(body: unknown): boolean {
    if (typeof body !== 'object' || body === null) {
        return false;
    }

    const sections = (body as { sections?: unknown }).sections;
    if (!Array.isArray(sections)) {
        return false;
    }

    return sections.some((section) => {
        if (typeof section !== 'object' || section === null) {
            return false;
        }

        const sectionRecord = section as { nameI18n?: unknown; descriptionI18n?: unknown };
        if (
            isTranslationField(sectionRecord.nameI18n) ||
            isTranslationField(sectionRecord.descriptionI18n)
        ) {
            return true;
        }

        const items = (section as { items?: unknown }).items;
        if (!Array.isArray(items)) {
            return false;
        }

        return items.some((item) => {
            if (typeof item !== 'object' || item === null) {
                return false;
            }
            const itemRecord = item as { nameI18n?: unknown; descriptionI18n?: unknown };
            return (
                isTranslationField(itemRecord.nameI18n) ||
                isTranslationField(itemRecord.descriptionI18n)
            );
        });
    });
}
