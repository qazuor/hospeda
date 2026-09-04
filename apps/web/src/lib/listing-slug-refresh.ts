const ACTIVE_LISTING_STATE = 'ACTIVE';

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
 * @param input.lifecycleState - The listing's current lifecycle state.
 * @returns `true` once the listing is live and its slug is frozen.
 */
export function isListingPublished(input: { readonly lifecycleState?: string | null }): boolean {
    return input.lifecycleState === ACTIVE_LISTING_STATE;
}

export function shouldOfferPublishedSlugRefresh(input: {
    readonly currentLifecycleState?: string | null;
    readonly initialName?: string | null;
    readonly currentName?: string | null;
    /**
     * HOS-879: the slug is generated from `type` + `name`, so a type change
     * is just as capable of invalidating a published slug as a rename is.
     * Both `initialType`/`currentType` are optional and only participate in
     * the check when BOTH are provided — a caller whose listing kind never
     * feeds `type` into its slug (e.g. commerce listings, whose slug is
     * name-only) can simply omit them and keep today's name-only behavior.
     */
    readonly initialType?: string | null;
    readonly currentType?: string | null;
}): boolean {
    if (!isListingPublished({ lifecycleState: input.currentLifecycleState })) return false;

    const initialName = normalizeName(input.initialName);
    const currentName = normalizeName(input.currentName);
    const nameChanged = currentName.length > 0 && currentName !== initialName;

    const typeChanged =
        input.initialType !== undefined &&
        input.currentType !== undefined &&
        normalizeName(input.initialType) !== normalizeName(input.currentType);

    return nameChanged || typeChanged;
}

export function buildSlugRefreshPayload(input: {
    readonly currentLifecycleState?: string | null;
    readonly initialName?: string | null;
    readonly currentName?: string | null;
    readonly initialType?: string | null;
    readonly currentType?: string | null;
    readonly refreshSlugFromName: boolean;
}): Record<string, true> {
    if (
        !input.refreshSlugFromName ||
        !shouldOfferPublishedSlugRefresh({
            currentLifecycleState: input.currentLifecycleState,
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
