/**
 * Public projection gate for a gastronomy listing's menú del día (HOS-1041).
 *
 * Extracted out of `getBySlug.ts` for the reason `menu-projection.ts` states:
 * the withholding rule gets a direct unit-test surface, independent of building
 * a full `GastronomyPublicSchema` fixture through the route/HTTP layer.
 *
 * @module routes/gastronomy/public/daily-specials-projection
 */
import type { GastronomyDailySpecialPublic } from '@repo/schemas';

/** The projected field, ready to spread into the public response. */
export interface GastronomyDailySpecialsGateResult {
    readonly dailySpecials: readonly GastronomyDailySpecialPublic[] | undefined;
}

/**
 * Withholds the menú del día when the owner's CURRENT gastronomy plan does not
 * grant `manage_gastronomy_daily_special`.
 *
 * The rows are not deleted (see `resolveOwnerGrantsGastronomyDailySpecial` in
 * `@repo/service-core`), only kept out of the public payload — so a lapsed
 * subscription hides today's special and a renewed one brings it straight back,
 * without the owner retyping anything.
 *
 * ## Two independent reasons a special does not appear
 *
 * This gate answers the ENTITLEMENT one. The other — the window having passed —
 * was already answered upstream, in SQL, by the `validOn` filter the caller
 * applied when reading. They are deliberately not merged: the expiry must work
 * for every paying venue on every read without consulting billing, and the
 * entitlement must hold even for a special whose window is wide open.
 *
 * @param input.dailySpecials - The specials as read, ALREADY filtered to the
 *   current day by the caller. May be non-empty even when
 *   `ownerGrantsDailySpecial` is `false` — a downgraded owner's rows are not
 *   deleted.
 * @param input.ownerGrantsDailySpecial - The live entitlement check result.
 * @returns The field to spread into the public response. `undefined` (not `[]`)
 *   when empty, matching the "not loaded" vs "empty" convention
 *   `amenities`/`features`/`menuSections` already use on this schema.
 */
export function applyGastronomyDailySpecialsGate(input: {
    readonly dailySpecials: readonly GastronomyDailySpecialPublic[];
    readonly ownerGrantsDailySpecial: boolean;
}): GastronomyDailySpecialsGateResult {
    const { dailySpecials, ownerGrantsDailySpecial } = input;

    if (!ownerGrantsDailySpecial) {
        return { dailySpecials: undefined };
    }

    return { dailySpecials: dailySpecials.length > 0 ? dailySpecials : undefined };
}
