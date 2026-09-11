/**
 * The write-side gate for per-dish photos (HOS-1045).
 *
 * ## Why this is not a `requireEntitlement` middleware
 *
 * `PUT .../menu` is ALREADY gated, on `manage_gastronomy_menu`, and that gate
 * must stay exactly where it is: a `-pro` owner is entitled to write a carta.
 * What they are not entitled to is a PHOTO on a dish of it — which is a
 * property of the BODY, not of the route. A second `requireEntitlement` on the
 * same route would refuse every `-pro` carta, photo or no photo, and turn a
 * premium upsell into the removal of a feature that shipped three weeks ago.
 *
 * So the check is conditional on the payload, and it is a REFUSAL rather than a
 * silent strip. Dropping the photos and answering 200 would tell the owner the
 * carta saved — which it did — while quietly discarding work they can see
 * themselves having done; they would reload, find the pictures gone, and have
 * no way to learn why. A 403 naming the entitlement is what the editor turns
 * into the upsell sentence.
 *
 * Extracted into its own module, like `menu-projection.ts` next door, so the
 * rule has a direct unit-test surface that does not require building a Hono
 * context and a subscription fixture.
 *
 * @module routes/gastronomy/protected/menu-item-photo-gate
 */

/**
 * Whether a submitted carta document carries a photo on ANY of its dishes.
 *
 * Reads defensively over `unknown` because it runs on the raw body: the route
 * factory has validated it against `GastronomyMenuReplacePayloadSchema`, but
 * this function is also the thing a test points at directly, and a gate that
 * throws on a malformed shape would be a gate that can be disabled by sending
 * a malformed shape.
 *
 * A non-empty `photoUrl` is the only trigger. `photoAlt` or `photoPublicId`
 * alone are not photos — they are metadata about one — and refusing a body that
 * carries a stray alt with no image would refuse a save the owner cannot
 * correct from the editor.
 *
 * @param body - The submitted menu document, unvalidated.
 * @returns `true` when at least one dish carries a non-empty `photoUrl`.
 */
export function menuPayloadCarriesItemPhoto(body: unknown): boolean {
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
        const items = (section as { items?: unknown }).items;
        if (!Array.isArray(items)) {
            return false;
        }

        return items.some((item) => {
            if (typeof item !== 'object' || item === null) {
                return false;
            }
            const photoUrl = (item as { photoUrl?: unknown }).photoUrl;
            return typeof photoUrl === 'string' && photoUrl.trim().length > 0;
        });
    });
}
