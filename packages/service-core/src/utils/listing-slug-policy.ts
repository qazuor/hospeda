import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * Decides whether a listing slug should be regenerated because its name
 * and/or its type changed.
 *
 * HOS-784 established two behaviors sharing this one decision point, for a
 * rename:
 * - a listing that was never published -> regenerate automatically
 * - a listing that was -> regenerate only when the owner explicitly opts in
 *
 * HOS-879 extends the same decision point to a TYPE change (the slug is
 * generated from `type` + `name`, so a type change is just as capable of
 * invalidating the current slug as a rename is — e.g. `COUNTRY_HOUSE` ->
 * `CABIN` leaves a `countryhouse-...` URL that no longer matches the
 * accommodation's own type badge and filters). Name and type are evaluated
 * independently and either one changing is enough to consider regenerating;
 * the lifecycle/opt-in gate below applies identically regardless of which
 * one (or both) changed.
 *
 * `LifecycleStatusEnum` is what draws the published/unpublished line.
 * `DRAFT` is documented as "never published ... never having been
 * operational"; `INACTIVE` is "was active, currently paused" (its own
 * example being an accommodation paused for the season) and `ARCHIVED` is
 * retired-for-good. A paused or archived listing therefore HAS a public URL
 * that was indexed and shared, so it belongs on the same side as `ACTIVE`:
 * its address moves only if the owner asks for it.
 *
 * Hence the gate is `!== DRAFT` rather than `=== ACTIVE`. The difference is
 * not cosmetic — under `=== ACTIVE`, renaming (or re-typing) a paused
 * listing moved its address without ever offering the choice this stage
 * exists to offer. An absent or unrecognized state falls on the published
 * side for the same reason: "cannot prove it was never published" has to
 * mean "leave the address alone".
 *
 * There is deliberately no slug history and no redirect for a listing whose
 * slug moves — an unknown slug is a hard 404. That is exactly why the
 * published side of this gate exists: moving the URL of a listing that is
 * already indexed/shared breaks every existing link, so it never happens
 * without the owner's explicit `refreshSlugFromName` opt-in.
 */
export function shouldRegenerateSlugOnListingChange(input: {
    readonly currentLifecycleState?: string | null;
    readonly currentName?: string | null;
    readonly nextName?: string | null;
    readonly currentType?: string | null;
    readonly nextType?: string | null;
    readonly slugWasProvided: boolean;
    readonly refreshSlugFromName?: boolean;
}): boolean {
    if (input.slugWasProvided) return false;

    const currentName = input.currentName?.trim() ?? '';

    // `nextName === undefined` means the caller did not touch the name field
    // at all (a partial update touching only `type`, for instance) — that is
    // "no rename requested", not "rename to nothing". An explicitly-provided
    // blank/whitespace name, on the other hand, is never a valid rename
    // target regardless of what else changed, so it bails out entirely (this
    // mirrors the pre-HOS-879 behavior for a plain rename).
    let nextName: string;
    if (input.nextName === undefined) {
        nextName = currentName;
    } else {
        const trimmed = input.nextName?.trim() ?? '';
        if (!trimmed) return false;
        nextName = trimmed;
    }

    const currentType = input.currentType?.trim() ?? '';
    const nextType = input.nextType === undefined ? currentType : (input.nextType?.trim() ?? '');

    const nameChanged = nextName !== currentName;
    const typeChanged = nextType !== currentType;

    if (!nameChanged && !typeChanged) return false;

    if (input.currentLifecycleState !== LifecycleStatusEnum.DRAFT) {
        return input.refreshSlugFromName === true;
    }

    return true;
}
