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
 * Withholds the uploaded photo/PDF and the structured carta's sections when
 * the owner's CURRENT gastronomy plan does not grant `manage_gastronomy_menu`
 * — the rows are not deleted (see `resolveOwnerGrantsGastronomyMenuManagement`
 * in `@repo/service-core`), only kept out of the public payload.
 *
 * `menuUrl` (the external link) is NOT a parameter here on purpose: it is the
 * one fallback still free on every tier and is never gated, so the caller
 * passes it through unchanged.
 *
 * @param input.gastronomy - The stored `menuFileUrl`/`menuFileKind` columns.
 * @param input.menuSections - The structured carta's sections, as read (may be
 *   non-empty even when `ownerGrantsMenuManagement` is `false` — a downgraded
 *   owner's previously-typed carta is not deleted).
 * @param input.ownerGrantsMenuManagement - The live entitlement check result.
 * @returns The fields to spread into the public response. `menuSections` is
 *   `undefined` (not `[]`) when empty, matching the "not loaded" vs "empty"
 *   convention `amenities`/`features` already use on this schema.
 */
export function applyGastronomyMenuManagementGate(input: {
    readonly gastronomy: GastronomyMenuGateSource;
    readonly menuSections: readonly GastronomyMenuSectionPublic[];
    readonly ownerGrantsMenuManagement: boolean;
}): GastronomyMenuGateResult {
    const { gastronomy, menuSections, ownerGrantsMenuManagement } = input;

    if (!ownerGrantsMenuManagement) {
        return { menuFileUrl: null, menuFileKind: null, menuSections: undefined };
    }

    return {
        menuFileUrl: gastronomy.menuFileUrl ?? null,
        menuFileKind: gastronomy.menuFileKind ?? null,
        menuSections: menuSections.length > 0 ? menuSections : undefined
    };
}
