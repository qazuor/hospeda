/**
 * @file needs-plan-banner.ts
 * @description Pure decision logic for the "anfitrión en preparación" banner
 * on the host property-listing page (HOS-217).
 *
 * A tourist who completes the accommodation mini-onboarding becomes a HOST
 * (role + "Área anfitrión" menu) immediately, but drafting/editing a
 * property is free — the owner plan is only required at PUBLISH time. That
 * leaves a window where a HOST can have draft properties they cannot yet
 * publish (no owner/complex-category subscription — a tourist plan, an
 * expired/no trial, or no subscription at all). This module centralises the
 * show/hide decision for the proactive banner that communicates that state,
 * so both the Astro page and unit tests share a single implementation
 * (mirrors the `usage-badge.ts` / `publish-precheck-panel-content.ts`
 * pattern already used in this directory).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Inputs needed to decide whether to show the "anfitrión en preparación"
 * banner on the host property-listing page.
 */
export interface NeedsPlanBannerParams {
    /** Whether the owner has zero accommodations at all (empty state renders instead). */
    readonly isEmpty: boolean;
    /** Whether the SSR fetch for accommodations failed. */
    readonly fetchError: boolean;
    /** Whether the protected effective-set read succeeded. */
    readonly effectiveSetReadOk: boolean;
    /** Whether at least one of the owner's accommodations is a DRAFT. */
    readonly hasDraftProperty: boolean;
    /**
     * Whether the owner currently holds a real owner/complex-category
     * live non-trial title, resolved from the accommodation effective set.
     */
    readonly hasOwnerPlan: boolean;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * Decides whether to render the proactive "anfitrión en preparación" banner.
 *
 * A failed effective-set read suppresses the banner because plan absence is
 * unknown; the pure AND includes that read status.
 *
 * The banner is shown only when there is something concrete for it to
 * describe (at least one DRAFT property) and nothing else is already
 * covering that message (the empty state has its own "Publicar ahora" CTA;
 * a fetch error already shows its own error state).
 *
 * @param params - See {@link NeedsPlanBannerParams}.
 * @returns `true` when the banner should render.
 *
 * @example
 * ```ts
 * const showNeedsPlanBanner = shouldShowNeedsPlanBanner({
 *   isEmpty: properties.length === 0,
 *   fetchError,
 *   hasDraftProperty: properties.some((p) => p.lifecycleState === LifecycleStatusEnum.DRAFT),
 *   hasOwnerPlan
 * });
 * ```
 */
export function shouldShowNeedsPlanBanner({
    isEmpty,
    fetchError,
    effectiveSetReadOk,
    hasDraftProperty,
    hasOwnerPlan
}: NeedsPlanBannerParams): boolean {
    return !isEmpty && !fetchError && effectiveSetReadOk && hasDraftProperty && !hasOwnerPlan;
}
