import { PublicationStatusEnum } from '@repo/schemas';
import { resolveAdministrativeAuthorization } from './administrative-authorization';

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
 * the publication/opt-in gate below applies identically regardless of which
 * one (or both) changed.
 *
 * `PublicationStatusEnum` is what draws the published/unpublished line since
 * V6.9b (HOS-1641), which retired `lifecycleState`. `DRAFT` is the listing
 * being configured; every other state (`PUBLISHED`, `UNPUBLISHED_BY_BILLING`,
 * `ARCHIVED`, `MODERATED`, `PURGED`) belongs to a listing that HAS been public,
 * so its address moves only if the owner asks for it.
 *
 * Hence the gate is `!== DRAFT` rather than `=== PUBLISHED`. Under
 * `=== PUBLISHED`, renaming (or re-typing) a listing taken down by billing or
 * moderation would move its address without ever offering the choice this
 * stage exists to offer. An absent or unrecognized state falls on the
 * published side for the same reason: "cannot prove it was never published"
 * has to mean "leave the address alone".
 *
 * Known gap of the translation (V6.9b): an owner unpublish returns a listing
 * from `PUBLISHED` to `DRAFT`, so a previously public `DRAFT` regenerates its
 * slug on rename. The old `INACTIVE` told "paused" apart from "never
 * published"; no publication state records "was ever published".
 *
 * There is deliberately no slug history and no redirect for a listing whose
 * slug moves — an unknown slug is a hard 404. That is exactly why the
 * published side of this gate exists: moving the URL of a listing that is
 * already indexed/shared breaks every existing link, so it never happens
 * without the owner's explicit `refreshSlugFromName` opt-in.
 */
export function shouldRegenerateSlugOnListingChange(input: {
    readonly currentPublicationStatus?: string | null;
    readonly currentName?: string | null;
    readonly nextName?: string | null;
    readonly currentType?: string | null;
    readonly nextType?: string | null;
    readonly slugWasProvided: boolean;
    readonly refreshSlugFromName?: boolean;
}): boolean {
    if (input.slugWasProvided) return false;
    // ACC:15 (HOS-1493): support editing somebody else's listing never moves
    // its public URL, not even on a never-published draft — the address is
    // not content, and only the owner may choose to move it.
    if (resolveAdministrativeAuthorization().authorization?.action === 'ACC_15') return false;

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

    if (input.currentPublicationStatus !== PublicationStatusEnum.DRAFT) {
        return input.refreshSlugFromName === true;
    }

    return true;
}
