/**
 * decide-auto-trigger — pure auto-trigger decision function.
 *
 * Given the current router state, user role, available tours, and seen-state,
 * determines what (if anything) should be auto-triggered. This is the single
 * source of truth for the auto-trigger logic (SPEC-174 §7.3, §7.6, D9, D13).
 *
 * **Priority rules (owner-locked):**
 * 1. Welcome tour always wins over contextual (D9).
 * 2. Welcome tour is eligible when:
 *    - `trigger === 'auto-first-visit'`
 *    - `shouldOfferTour({ configVersion, seenVersion })` returns `true`
 *    - The tour targets the current user's role.
 * 3. If the welcome tour is eligible AND the current pathname is the dashboard
 *    route → `{ kind: 'welcome', tourId }`.
 * 4. If the welcome tour is eligible AND the current pathname is NOT the dashboard
 *    route → `{ kind: 'welcome-redirect', tourId }`. The caller navigates to the
 *    dashboard BEFORE starting the tour (D13: redirect only when offering).
 * 5. If no eligible welcome tour, check contextual tours:
 *    - Match `tour.route` to the current pathname (exact equality — contextual
 *      tours target a single specific route).
 *    - Eligible when `trigger === 'auto-first-visit'` AND unseen per version.
 *    - Result: `{ kind: 'contextual', tourId }`.
 * 6. If nothing matches → `{ kind: 'none' }`.
 *
 * Manual replay is NOT this function's concern — it is always allowed regardless
 * of seen state or version (handled directly by `startTour`).
 *
 * Pure function — no React, no DOM, no side effects.
 *
 * @module lib/tour/decide-auto-trigger
 * @see apps/admin/src/lib/tour/compare-version.ts — shouldOfferTour
 * @see apps/admin/src/components/tour/TourAutoTrigger.tsx — consumer
 * @see SPEC-174 §7.3, §7.6, D9, D13
 */

import type { Tour, ToursRecord } from '@/config/ia/tour.schema';
import type { TourRole } from '@/config/ia/tour.schema';

// ============================================================================
// Input / output types
// ============================================================================

/** The seen-state function shape matching `useAdminTourState().hasSeen`. */
export type HasSeenFn = (input: { tourId: string; version: number }) => boolean;

/**
 * Input for {@link decideAutoTrigger}.
 */
export interface DecideAutoTriggerInput {
    /**
     * Current router pathname (e.g. `'/dashboard'`, `'/me/accommodations'`).
     */
    readonly pathname: string;
    /**
     * The canonical dashboard route for the admin panel (e.g. `'/dashboard'`).
     * Used to determine whether a redirect is needed before the welcome tour.
     */
    readonly dashboardRoute: string;
    /**
     * The current user's role. Only tours whose `roles` includes this role (or
     * `'all'`) will be considered. `null`/`undefined` → `{ kind: 'none' }`.
     */
    readonly role: TourRole | null | undefined;
    /**
     * The full validated tour catalog (from `validatedConfig.tours`).
     */
    readonly tours: ToursRecord;
    /**
     * Seen-state checker from `useAdminTourState().hasSeen`.
     * `hasSeen({ tourId, version })` returns `true` when the user has already
     * acknowledged this tour at the given (or higher) version.
     */
    readonly hasSeen: HasSeenFn;
}

/** No tour should be auto-triggered. */
export interface TriggerNone {
    readonly kind: 'none';
}

/** Welcome tour — current route IS the dashboard. */
export interface TriggerWelcome {
    readonly kind: 'welcome';
    readonly tourId: string;
}

/** Welcome tour — current route is NOT the dashboard; caller must redirect first. */
export interface TriggerWelcomeRedirect {
    readonly kind: 'welcome-redirect';
    readonly tourId: string;
}

/** Contextual tour for the current route. */
export interface TriggerContextual {
    readonly kind: 'contextual';
    readonly tourId: string;
}

/**
 * Union of all possible auto-trigger decisions.
 */
export type TriggerDecision =
    | TriggerNone
    | TriggerWelcome
    | TriggerWelcomeRedirect
    | TriggerContextual;

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Returns `true` when the tour targets the given role.
 * `roles: 'all'` matches any role.
 *
 * @param tour - The tour definition.
 * @param role - The current user's role.
 */
function tourTargetsRole(tour: Tour, role: TourRole): boolean {
    if (tour.roles === 'all') return true;
    return tour.roles.includes(role);
}

/**
 * Returns `true` when the tour should be auto-offered (trigger + version check).
 *
 * @param tour    - The tour definition.
 * @param hasSeen - The seen-state checker.
 */
function isAutoEligible(tour: Tour, hasSeen: HasSeenFn): boolean {
    if (tour.trigger !== 'auto-first-visit') return false;
    return !hasSeen({ tourId: tour.id, version: tour.version });
}

// ============================================================================
// Exported function
// ============================================================================

/**
 * Determines what auto-trigger action (if any) should fire given the current
 * app state.
 *
 * Priority:
 * 1. Welcome tour (eligible + correct route) → `{ kind: 'welcome' }`.
 * 2. Welcome tour (eligible + wrong route) → `{ kind: 'welcome-redirect' }`.
 * 3. Contextual tour for the current route (no eligible welcome) → `{ kind: 'contextual' }`.
 * 4. Nothing eligible → `{ kind: 'none' }`.
 *
 * @param input - {@link DecideAutoTriggerInput}.
 * @returns A {@link TriggerDecision} describing what to do.
 *
 * @example
 * ```ts
 * // New host, first login, on dashboard:
 * decideAutoTrigger({
 *   pathname: '/dashboard', dashboardRoute: '/dashboard',
 *   role: 'HOST', tours: validatedConfig.tours,
 *   hasSeen: () => false,
 * });
 * // { kind: 'welcome', tourId: 'host.welcome' }
 *
 * // New host, first login, on a different route:
 * decideAutoTrigger({
 *   pathname: '/me/accommodations', dashboardRoute: '/dashboard',
 *   role: 'HOST', tours: validatedConfig.tours,
 *   hasSeen: () => false,
 * });
 * // { kind: 'welcome-redirect', tourId: 'host.welcome' }
 *
 * // Host has seen welcome, first visit to /me/accommodations:
 * decideAutoTrigger({
 *   pathname: '/me/accommodations', dashboardRoute: '/dashboard',
 *   role: 'HOST', tours: validatedConfig.tours,
 *   hasSeen: ({ tourId }) => tourId === 'host.welcome',
 * });
 * // { kind: 'contextual', tourId: 'host.misAlojamientos' }
 * ```
 */
export function decideAutoTrigger({
    pathname,
    dashboardRoute,
    role,
    tours,
    hasSeen
}: DecideAutoTriggerInput): TriggerDecision {
    // No role → cannot match any tour.
    if (!role) {
        return { kind: 'none' };
    }

    const tourList = Object.values(tours);

    // -------------------------------------------------------------------------
    // Phase 1: Welcome tour (highest priority)
    // -------------------------------------------------------------------------
    for (const tour of tourList) {
        if (tour.kind !== 'welcome') continue;
        if (!tourTargetsRole(tour, role)) continue;
        if (!isAutoEligible(tour, hasSeen)) continue;

        // Welcome tour is eligible. Determine redirect vs. direct.
        if (pathname === dashboardRoute) {
            return { kind: 'welcome', tourId: tour.id };
        }
        return { kind: 'welcome-redirect', tourId: tour.id };
    }

    // -------------------------------------------------------------------------
    // Phase 2: Contextual tour for the current route
    // -------------------------------------------------------------------------
    for (const tour of tourList) {
        if (tour.kind !== 'contextual') continue;
        if (!tourTargetsRole(tour, role)) continue;
        if (tour.route !== pathname) continue;
        if (!isAutoEligible(tour, hasSeen)) continue;

        return { kind: 'contextual', tourId: tour.id };
    }

    return { kind: 'none' };
}
