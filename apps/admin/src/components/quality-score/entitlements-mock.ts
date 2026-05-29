/**
 * Mock plan-feature flags consumed by the QualityScore widget.
 *
 * Phase 4 (entitlements UX) will replace this module with a real
 * `useEntitlements()` hook backed by the billing service. Until then we
 * surface the Premium group of the score popover by hardcoding two
 * "locked" features — enough to validate the UX without dragging in the
 * billing dependency tree.
 *
 * NOTE: keep this file dumb and side-effect-free. The day the real hook
 * lands we delete this file and update the only import (the accommodation
 * score hook) to use the production source.
 */
export interface EntitlementsSnapshot {
    /** Plan unlocks video gallery uploads. */
    readonly hasVideoGalleryFeature: boolean;
    /** Plan unlocks the 360° virtual tour embed. */
    readonly hasVirtualTourFeature: boolean;
}

/**
 * Returns mock entitlements. Currently every viewer sees both features as
 * locked, so the Premium group always renders. When entitlements wire up
 * for real, callers won't change — only this module disappears.
 */
export function useMockEntitlements(): EntitlementsSnapshot {
    return {
        hasVideoGalleryFeature: false,
        hasVirtualTourFeature: false
    };
}
