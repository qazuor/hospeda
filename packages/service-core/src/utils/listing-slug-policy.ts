import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * Decides whether a listing slug should follow a rename automatically.
 *
 * HOS-784 stage 1 applies only while the listing has never been published in
 * the current data model. There is no historical `publishedAt` / `everPublished`
 * field for accommodations, gastronomies, or experiences, so `ACTIVE` is the
 * only shared publish proxy available without introducing persistence changes.
 */
export function shouldRegenerateSlugOnDraftRename(input: {
    readonly currentLifecycleState?: string | null;
    readonly currentName?: string | null;
    readonly nextName?: string | null;
    readonly slugWasProvided: boolean;
}): boolean {
    if (input.slugWasProvided) return false;
    if (input.currentLifecycleState === LifecycleStatusEnum.ACTIVE) return false;

    const nextName = input.nextName?.trim();
    if (!nextName) return false;

    const currentName = input.currentName?.trim() ?? '';
    return nextName !== currentName;
}
