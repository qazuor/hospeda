import { PublicationStatusEnum } from '@repo/schemas';

function normalizeName(name: string | null | undefined): string {
    return name?.trim() ?? '';
}

/**
 * Whether a listing is PUBLISHED — i.e. whether its public address has stopped
 * following the name.
 *
 * The single definition of "published" for slug behaviour. Exported (HOS-834)
 * so the editor's address notice states the state the code actually branches
 * on, instead of a second criterion that could drift away from the one the
 * slug-refresh opt-in below already uses. A notice that disagrees with the
 * behaviour is worse than the ambiguous one it replaced.
 *
 * Mirrors the backend's `shouldRegenerateSlugOnListingChange`
 * (`packages/service-core/src/utils/listing-slug-policy.ts`), which reads
 * `PublicationStatusEnum` since HOS-1641: published means **anything other
 * than `DRAFT`** — `PUBLISHED`, `UNPUBLISHED_BY_BILLING`, `ARCHIVED`,
 * `MODERATED`, `PURGED`, and an absent/unrecognized state all fall on the
 * published side. A listing taken down by billing, moderation or the
 * inactivity clock still has a public URL that was indexed and shared, so
 * its address moves only if the owner asks for it, same as a published one. An
 * absent/unknown state falls on the published side for the same reason the
 * backend does: "cannot prove it was never published" has to mean "leave the
 * address alone" — the UI gate has to fail on the SAME side as the backend
 * policy it fronts, or a host on a state this predicate doesn't recognize
 * would get their slug silently regenerated with no opt-in offered.
 *
 * Before HOS-879's UI fix this used `=== 'ACTIVE'`, so a host with a
 * paused/archived listing never saw the opt-in even though the backend would
 * have honored the flag had it arrived.
 *
 * Same known gap as the backend (HOS-1641): an owner unpublish returns a
 * listing to `DRAFT`, so a previously public `DRAFT` reads as never published.
 *
 * @param input.publicationStatus - The listing's current publication state.
 * @returns `true` once the listing is live and its slug is frozen.
 */
export function isListingPublished(input: { readonly publicationStatus?: string | null }): boolean {
    return input.publicationStatus !== PublicationStatusEnum.DRAFT;
}

/** Shared shape for the two change-detection helpers below. */
interface SlugRefreshChangeInput {
    readonly initialName?: string | null;
    readonly currentName?: string | null;
    /**
     * HOS-879: the slug is generated from `type` + `name`, so a type change
     * is just as capable of invalidating a published slug as a rename is.
     * Both `initialType`/`currentType` are optional and only participate in
     * the check when BOTH are provided — a caller whose listing kind never
     * feeds `type` into its slug (e.g. listings, whose slug is
     * name-only) can simply omit them and keep today's name-only behavior.
     */
    readonly initialType?: string | null;
    readonly currentType?: string | null;
}

function computeNameChanged(input: SlugRefreshChangeInput): boolean {
    const initialName = normalizeName(input.initialName);
    const currentName = normalizeName(input.currentName);
    return currentName.length > 0 && currentName !== initialName;
}

function computeTypeChanged(input: SlugRefreshChangeInput): boolean {
    return (
        input.initialType !== undefined &&
        input.currentType !== undefined &&
        normalizeName(input.initialType) !== normalizeName(input.currentType)
    );
}

export function shouldOfferPublishedSlugRefresh(
    input: SlugRefreshChangeInput & { readonly currentPublicationStatus?: string | null }
): boolean {
    if (!isListingPublished({ publicationStatus: input.currentPublicationStatus })) return false;

    return computeNameChanged(input) || computeTypeChanged(input);
}

/**
 * Where the published-slug opt-in notice/checkbox should appear (HOS-879 UX
 * follow-up).
 *
 * The opt-in used to render in a single fixed spot next to `name`, so a host
 * who changed only `type` saw the checkbox pinned to a field they never
 * touched — easy to miss, and the one case (a published listing) where
 * missing it actually matters. The notice now follows whichever field(s)
 * changed: `nearName` when the name changed, `nearType` when the type changed,
 * both when both did. The two flags describe placement only — the checkbox
 * they gate is the SAME shared `refreshSlugFromName` state wherever it shows.
 *
 * @param input - Publication state plus the baseline/current name and type.
 * @returns Which position(s) should render the opt-in.
 */
export function getSlugRefreshOptInPlacement(
    input: SlugRefreshChangeInput & { readonly currentPublicationStatus?: string | null }
): { readonly nearName: boolean; readonly nearType: boolean } {
    if (!isListingPublished({ publicationStatus: input.currentPublicationStatus })) {
        return { nearName: false, nearType: false };
    }

    return { nearName: computeNameChanged(input), nearType: computeTypeChanged(input) };
}

export function buildSlugRefreshPayload(input: {
    readonly currentPublicationStatus?: string | null;
    readonly initialName?: string | null;
    readonly currentName?: string | null;
    readonly initialType?: string | null;
    readonly currentType?: string | null;
    readonly refreshSlugFromName: boolean;
}): Record<string, true> {
    if (
        !input.refreshSlugFromName ||
        !shouldOfferPublishedSlugRefresh({
            currentPublicationStatus: input.currentPublicationStatus,
            initialName: input.initialName,
            currentName: input.currentName,
            initialType: input.initialType,
            currentType: input.currentType
        })
    ) {
        return {};
    }

    return { refreshSlugFromName: true };
}
