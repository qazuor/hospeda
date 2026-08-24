import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * Decides whether a listing slug should be regenerated from a rename.
 *
 * HOS-784 has two behaviors sharing the same decision point:
 * - unpublished listing rename -> regenerate automatically
 * - published listing rename -> regenerate only when the caller explicitly opts in
 *
 * There is no historical `publishedAt` / `everPublished` field for
 * accommodations, gastronomies, or experiences, so `ACTIVE` is the only shared
 * publish proxy available without introducing persistence changes.
 */
export function shouldRegenerateSlugOnRename(input: {
    readonly currentLifecycleState?: string | null;
    readonly currentName?: string | null;
    readonly nextName?: string | null;
    readonly slugWasProvided: boolean;
    readonly refreshSlugFromName?: boolean;
}): boolean {
    if (input.slugWasProvided) return false;

    const nextName = input.nextName?.trim();
    if (!nextName) return false;

    const currentName = input.currentName?.trim() ?? '';
    if (nextName === currentName) return false;

    if (input.currentLifecycleState === LifecycleStatusEnum.ACTIVE) {
        return input.refreshSlugFromName === true;
    }

    return true;
}
