const ACTIVE_LISTING_STATE = 'ACTIVE';

function normalizeName(name: string | null | undefined): string {
    return name?.trim() ?? '';
}

export function shouldOfferPublishedSlugRefresh(input: {
    readonly currentLifecycleState?: string | null;
    readonly initialName?: string | null;
    readonly currentName?: string | null;
}): boolean {
    if (input.currentLifecycleState !== ACTIVE_LISTING_STATE) return false;

    const initialName = normalizeName(input.initialName);
    const currentName = normalizeName(input.currentName);

    return currentName.length > 0 && currentName !== initialName;
}

export function buildSlugRefreshPayload(input: {
    readonly currentLifecycleState?: string | null;
    readonly initialName?: string | null;
    readonly currentName?: string | null;
    readonly refreshSlugFromName: boolean;
}): Record<string, true> {
    if (
        !input.refreshSlugFromName ||
        !shouldOfferPublishedSlugRefresh({
            currentLifecycleState: input.currentLifecycleState,
            initialName: input.initialName,
            currentName: input.currentName
        })
    ) {
        return {};
    }

    return { refreshSlugFromName: true };
}
