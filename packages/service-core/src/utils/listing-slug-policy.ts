import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * Decides whether a listing slug should be regenerated from a rename.
 *
 * HOS-784 has two behaviors sharing this one decision point:
 * - a listing that was never published -> regenerate automatically
 * - a listing that was -> regenerate only when the owner explicitly opts in
 *
 * `LifecycleStatusEnum` is what draws that line. `DRAFT` is documented as
 * "never published ... never having been operational"; `INACTIVE` is "was
 * active, currently paused" (its own example being an accommodation paused for
 * the season) and `ARCHIVED` is retired-for-good. A paused or archived listing
 * therefore HAS a public URL that was indexed and shared, so it belongs on the
 * same side as `ACTIVE`: its address moves only if the owner asks for it.
 *
 * Hence the gate is `!== DRAFT` rather than `=== ACTIVE`. The difference is
 * not cosmetic — under `=== ACTIVE`, renaming a paused listing moved its
 * address without ever offering the choice this stage exists to offer. An
 * absent or unrecognized state falls on the published side for the same
 * reason: "cannot prove it was never published" has to mean "leave the address
 * alone".
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

    if (input.currentLifecycleState !== LifecycleStatusEnum.DRAFT) {
        return input.refreshSlugFromName === true;
    }

    return true;
}
