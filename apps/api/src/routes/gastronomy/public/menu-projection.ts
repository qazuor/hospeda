/**
 * Public projection gate for a gastronomy listing's menu (HOS-895 PR2).
 *
 * Extracted out of `getBySlug.ts` so the withholding rule has a direct unit
 * test surface, independent of building a full `GastronomyPublicSchema`
 * fixture through the route/HTTP layer.
 *
 * @module routes/gastronomy/public/menu-projection
 */
import type { GastronomyMenuFileKind, GastronomyMenuSectionPublic } from '@repo/schemas';

/** What the public route needs from the stored listing to project its menu. */
export interface GastronomyMenuGateSource {
    readonly menuFileUrl?: string | null | undefined;
    readonly menuFileKind?: GastronomyMenuFileKind | null | undefined;
}

/** The projected fields, ready to spread into the public response. */
export interface GastronomyMenuGateResult {
    readonly menuFileUrl: string | null;
    readonly menuFileKind: GastronomyMenuFileKind | null;
    readonly menuSections: readonly GastronomyMenuSectionPublic[] | undefined;
}

/**
 * Strips a section or dish of its translations.
 *
 * `nameI18n`/`descriptionI18n` are set to `null` rather than deleted: the
 * public schema declares them as nullable fields (they flow through
 * `.omit()` from the stored schema untouched — see the schema module's
 * "what `.omit()` does NOT hide" note), so a consumer must see an absent
 * translation the same way it sees a dish that was never translated at all.
 *
 * @param entity - A section or a dish, as read from the database.
 * @param keepTranslations - Whether to keep `nameI18n`/`descriptionI18n`.
 * @returns The entity with its translations projected.
 */
function projectTranslations<T extends { nameI18n?: unknown; descriptionI18n?: unknown }>(
    entity: T,
    keepTranslations: boolean
): T {
    return keepTranslations ? entity : { ...entity, nameI18n: null, descriptionI18n: null };
}

/**
 * Strips every dish of its photo, and of the photo's Cloudinary id — and, on
 * the same pass, every section and dish of its translations.
 *
 * THREE removals, and only two of them are entitlement gates:
 *
 *  - `photoPublicId` goes ALWAYS, entitled or not. It is an internal handle
 *    for destroying the asset; `GastronomyMenuItemPublicSchema` omits it, and
 *    this is what makes that omission true at runtime instead of only in the
 *    type. The sections arriving here are raw DB rows, which carry it.
 *  - `photoUrl`/`photoAlt` go only when the owner's plan does not grant
 *    `menu_item_photos`.
 *  - `nameI18n`/`descriptionI18n` (HOS-1043) go, on BOTH the section and its
 *    dishes, only when the owner's plan does not grant
 *    `multilingual_gastronomy_menu`.
 *
 * @param sections - The carta as read from the database.
 * @param keepPhoto - Whether to keep `photoUrl`/`photoAlt`.
 * @param keepTranslations - Whether to keep `nameI18n`/`descriptionI18n`.
 * @returns The sections with each dish projected.
 */
function projectSections(
    sections: readonly GastronomyMenuSectionPublic[],
    keepPhoto: boolean,
    keepTranslations: boolean
): readonly GastronomyMenuSectionPublic[] {
    return sections.map((section) => ({
        ...projectTranslations(section, keepTranslations),
        items: section.items.map((item) => {
            // Destructured out rather than deleted: `photoPublicId` is present
            // on the row this came from even though the PUBLIC type does not
            // declare it, so the cast is what lets it be named at all.
            const { photoPublicId: _photoPublicId, ...rest } = item as typeof item & {
                photoPublicId?: string | null;
            };

            const withPhoto = keepPhoto ? rest : { ...rest, photoUrl: null, photoAlt: null };
            return projectTranslations(withPhoto, keepTranslations);
        })
    }));
}

/**
 * Withholds the uploaded photo/PDF, the structured carta's sections, and the
 * per-dish photos when the owner's CURRENT gastronomy plan does not grant the
 * corresponding key — the rows are not deleted (see
 * `resolveOwnerGastronomyMenuGrants` in `@repo/service-core`), only kept out of
 * the public payload.
 *
 * The two gates are INDEPENDENT and nest in one direction only. A `-pro` owner
 * grants `manage_gastronomy_menu` but not `menu_item_photos`: their carta is
 * published, each dish without its picture. The inverse cannot happen, because
 * the only plan granting the photo key also grants the carta key — but the
 * check does not rely on that, and a carta withheld takes its photos with it
 * whatever the second grant says.
 *
 * `menuUrl` (the external link) is NOT a parameter here on purpose: it is the
 * one fallback still free on every tier and is never gated, so the caller
 * passes it through unchanged.
 *
 * @param input.gastronomy - The stored `menuFileUrl`/`menuFileKind` columns.
 * @param input.menuSections - The structured carta's sections, as read (may be
 *   non-empty even when `ownerGrantsMenuManagement` is `false` — a downgraded
 *   owner's previously-typed carta is not deleted).
 * @param input.ownerGrantsMenuManagement - The live `manage_gastronomy_menu`
 *   check result.
 * @param input.ownerGrantsMenuItemPhotos - The live `menu_item_photos` check
 *   result (HOS-1045).
 * @param input.ownerGrantsMenuTranslations - The live
 *   `multilingual_gastronomy_menu` check result (HOS-1043).
 * @returns The fields to spread into the public response. `menuSections` is
 *   `undefined` (not `[]`) when empty, matching the "not loaded" vs "empty"
 *   convention `amenities`/`features` already use on this schema.
 */
export function applyGastronomyMenuManagementGate(input: {
    readonly gastronomy: GastronomyMenuGateSource;
    readonly menuSections: readonly GastronomyMenuSectionPublic[];
    readonly ownerGrantsMenuManagement: boolean;
    readonly ownerGrantsMenuItemPhotos: boolean;
    readonly ownerGrantsMenuTranslations: boolean;
}): GastronomyMenuGateResult {
    const {
        gastronomy,
        menuSections,
        ownerGrantsMenuManagement,
        ownerGrantsMenuItemPhotos,
        ownerGrantsMenuTranslations
    } = input;

    if (!ownerGrantsMenuManagement) {
        return { menuFileUrl: null, menuFileKind: null, menuSections: undefined };
    }

    return {
        menuFileUrl: gastronomy.menuFileUrl ?? null,
        menuFileKind: gastronomy.menuFileKind ?? null,
        menuSections:
            menuSections.length > 0
                ? projectSections(
                      menuSections,
                      ownerGrantsMenuItemPhotos,
                      ownerGrantsMenuTranslations
                  )
                : undefined
    };
}
