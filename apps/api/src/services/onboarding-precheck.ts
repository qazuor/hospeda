/**
 * Host-onboarding precheck decision logic (BETA-197).
 *
 * Pure derivation of what dialog/action the web "publicar nueva" flow should
 * show BEFORE rendering the onboarding form, based on how many DRAFT
 * accommodations the owner currently has and whether their plan still has
 * accommodation quota left. This is the single source of truth for the
 * decision matrix — the route composes counts + draft data and calls this
 * function; it does not re-derive the matrix itself.
 *
 * @module services/onboarding-precheck
 */

/**
 * The six possible outcomes the web client uses to pick which dialog (if any)
 * to show before the user reaches the onboarding form.
 */
export type OnboardingPrecheckDecision =
    | 'create_direct'
    | 'upgrade_only'
    | 'resume_or_create'
    | 'resume_delete_or_upgrade'
    | 'pick_draft_or_create'
    | 'pick_draft_delete_or_upgrade';

/**
 * Input for {@link deriveOnboardingDecision}.
 */
export interface DeriveOnboardingDecisionParams {
    /** Number of non-deleted DRAFT accommodations owned by the actor. */
    readonly draftCount: number;
    /** Whether the actor's plan still has room for one more accommodation (`checkLimit().allowed`). */
    readonly hasQuota: boolean;
}

/**
 * Derives the onboarding precheck decision from the draft count × quota matrix:
 *
 * | draftCount | hasQuota | decision                      |
 * |------------|----------|-------------------------------|
 * | 0          | true     | `create_direct`                |
 * | 0          | false    | `upgrade_only`                 |
 * | 1          | true     | `resume_or_create`             |
 * | 1          | false    | `resume_delete_or_upgrade`     |
 * | >1         | true     | `pick_draft_or_create`         |
 * | >1         | false    | `pick_draft_delete_or_upgrade` |
 *
 * @param params - See {@link DeriveOnboardingDecisionParams}.
 * @returns The decision the web client should act on.
 *
 * @example
 * ```typescript
 * deriveOnboardingDecision({ draftCount: 0, hasQuota: true });
 * // => 'create_direct'
 * ```
 */
export function deriveOnboardingDecision(
    params: DeriveOnboardingDecisionParams
): OnboardingPrecheckDecision {
    const { draftCount, hasQuota } = params;

    if (draftCount <= 0) {
        return hasQuota ? 'create_direct' : 'upgrade_only';
    }

    if (draftCount === 1) {
        return hasQuota ? 'resume_or_create' : 'resume_delete_or_upgrade';
    }

    return hasQuota ? 'pick_draft_or_create' : 'pick_draft_delete_or_upgrade';
}
