import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * Decides whether a listing slug should follow a rename automatically.
 *
 * HOS-784 stage 1 applies only while the listing has never been published.
 * `LifecycleStatusEnum` already draws that line: `DRAFT` is documented as
 * "never published ... never having been operational", while `INACTIVE` is
 * "was active, currently paused" and `ARCHIVED` is retired-for-good. A paused
 * or archived listing therefore HAS a public URL that was indexed and shared,
 * and renaming it must not move that URL — which is the whole point of the
 * feature.
 *
 * So the gate is `=== DRAFT`, not `!== ACTIVE`. The difference is not
 * cosmetic: under `!== ACTIVE`, renaming an accommodation paused for the
 * season — the enum's own example for INACTIVE — silently changed its
 * address. An absent or unrecognized lifecycle state is treated as published
 * for the same reason: the conservative side of this decision is to leave the
 * URL alone.
 */
export function shouldRegenerateSlugOnDraftRename(input: {
    readonly currentLifecycleState?: string | null;
    readonly currentName?: string | null;
    readonly nextName?: string | null;
    readonly slugWasProvided: boolean;
}): boolean {
    if (input.slugWasProvided) return false;
    if (input.currentLifecycleState !== LifecycleStatusEnum.DRAFT) return false;

    const nextName = input.nextName?.trim();
    if (!nextName) return false;

    const currentName = input.currentName?.trim() ?? '';
    return nextName !== currentName;
}
