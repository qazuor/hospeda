/**
 * use-tours — tour catalog selectors.
 *
 * Provides reactive selectors over the validated tour catalog
 * (`validatedConfig.tours`). All selectors follow the RO-RO pattern and are
 * memoized so they only recompute when their inputs change.
 *
 * Selector overview (§7.2):
 * - {@link useTourById}         — look up a single tour by its catalog id.
 * - {@link useToursForRole}     — all tours whose `roles` includes the given role.
 * - {@link useWelcomeTourForRole} — the welcome tour for a role (first match).
 * - {@link useContextualTourForRoute} — contextual tour matching the current route
 *   via `useCurrentSection()` (route comparison against section's canonical route).
 * - {@link useWelcomeTourPending} — shared D12 suppression gate: `true` when the
 *   role's welcome tour exists and has not yet been seen.
 *
 * **D14 — SUPER_ADMIN reuse:** The selectors check `tour.roles` membership, not
 * equality. Tours authored with `roles: ['ADMIN', 'SUPER_ADMIN']` are returned by
 * `useToursForRole({ role: 'SUPER_ADMIN' })` without any special handling.
 *
 * @module hooks/use-tours
 * @see apps/admin/src/config/ia/tour.schema.ts — Tour / TourRole types
 * @see apps/admin/src/config/ia/validate.ts     — validatedConfig
 * @see apps/admin/src/hooks/use-current-section.ts — useCurrentSection
 * @see SPEC-174 §7.2, D12, D14
 */

import type { Tour, TourRole } from '@/config/ia/tour.schema';
import { validatedConfig } from '@/config/ia/validate';
import { useMemo } from 'react';
import { useAdminTourState } from './use-admin-tour-state';
import { useAuthContext } from './use-auth-context';
import { useCurrentSection } from './use-current-section';

// ============================================================================
// useTourById
// ============================================================================

/** Input for {@link useTourById}. */
export interface UseTourByIdInput {
    /** The catalog id of the tour to look up (e.g. `'host.welcome'`). */
    readonly tourId: string;
}

/**
 * Looks up a single tour from the validated config by its catalog id.
 *
 * @param input - `{ tourId }`.
 * @returns The {@link Tour} for the given id, or `undefined` if not found.
 *
 * @example
 * ```ts
 * const tour = useTourById({ tourId: 'host.welcome' });
 * ```
 */
export function useTourById({ tourId }: UseTourByIdInput): Tour | undefined {
    return useMemo(() => {
        return validatedConfig.tours[tourId];
    }, [tourId]);
}

// ============================================================================
// useToursForRole
// ============================================================================

/** Input for {@link useToursForRole}. */
export interface UseToursForRoleInput {
    /**
     * The role to filter by (e.g. `'HOST'`, `'SUPER_ADMIN'`).
     * `null`/`undefined` returns an empty array.
     */
    readonly role: TourRole | null | undefined;
}

/**
 * Returns all tours whose `roles` array includes the given role.
 *
 * Tours with `roles: 'all'` match every role. Tours with an explicit array
 * match when the array contains the given role — this handles D14 (SUPER_ADMIN
 * reusing `admin.*` contextual tours authored with
 * `roles: ['ADMIN', 'SUPER_ADMIN']`).
 *
 * @param input - `{ role }`.
 * @returns Array of {@link Tour} entries for the role (may be empty).
 *
 * @example
 * ```ts
 * const tours = useToursForRole({ role: 'SUPER_ADMIN' });
 * // Includes admin.catalogo if its roles: ['ADMIN', 'SUPER_ADMIN']
 * ```
 */
export function useToursForRole({ role }: UseToursForRoleInput): Tour[] {
    return useMemo(() => {
        if (!role) return [];
        return Object.values(validatedConfig.tours).filter((tour) => {
            if (tour.roles === 'all') return true;
            return tour.roles.includes(role);
        });
    }, [role]);
}

// ============================================================================
// useWelcomeTourForRole
// ============================================================================

/** Input for {@link useWelcomeTourForRole}. */
export interface UseWelcomeTourForRoleInput {
    /**
     * The role to look up the welcome tour for.
     * `null`/`undefined` returns `undefined`.
     */
    readonly role: TourRole | null | undefined;
}

/**
 * Returns the welcome tour (`kind: 'welcome'`) for the given role.
 *
 * Returns the first match in catalog order. In practice v1 has exactly one
 * welcome tour per role, so "first match" is deterministic.
 *
 * @param input - `{ role }`.
 * @returns The welcome {@link Tour} for the role, or `undefined` if none found.
 *
 * @example
 * ```ts
 * const welcomeTour = useWelcomeTourForRole({ role: 'HOST' });
 * // { id: 'host.welcome', kind: 'welcome', ... }
 * ```
 */
export function useWelcomeTourForRole({ role }: UseWelcomeTourForRoleInput): Tour | undefined {
    const tours = useToursForRole({ role });
    return useMemo(() => {
        return tours.find((t) => t.kind === 'welcome');
    }, [tours]);
}

// ============================================================================
// useContextualTourForRoute
// ============================================================================

/** Input for {@link useContextualTourForRoute}. */
export interface UseContextualTourForRouteInput {
    /** The current pathname to match against section routes. */
    readonly pathname: string;
}

/**
 * Returns the contextual tour (`kind: 'contextual'`) whose `route` matches the
 * canonical route of the active section for the current pathname.
 *
 * Matching strategy (per spec §7.2):
 * 1. Use `useCurrentSection()` to resolve the active section.
 * 2. Compute the section's canonical route: `section.defaultRoute ?? section.route`.
 * 3. Find the first contextual tour whose `tour.route === canonicalRoute`.
 *
 * Returns `undefined` when:
 * - No section matches the current pathname.
 * - No contextual tour has a `route` equal to the section's canonical route.
 *
 * **Note:** This hook calls `useCurrentSection()` internally and memoizes on
 * `[pathname]`. The `pathname` parameter is not used to call the router — it is
 * only here so the caller can pass the known pathname for testing and as
 * explicit documentation of the dependency. `useCurrentSection()` reads
 * `useLocation()` from the router internally.
 *
 * @param input - `{ pathname }` — the current router pathname.
 * @returns The matching contextual {@link Tour}, or `undefined` if none found.
 *
 * @example
 * ```ts
 * const tour = useContextualTourForRoute({ pathname: '/me/accommodations' });
 * // { id: 'host.misAlojamientos', kind: 'contextual', route: '/me/accommodations', ... }
 * ```
 */
export function useContextualTourForRoute({
    pathname: _pathname
}: UseContextualTourForRouteInput): Tour | undefined {
    // useCurrentSection reads useLocation() from the router internally.
    // _pathname is accepted as a documented dependency but not forwarded
    // (useCurrentSection already reads the live pathname).
    const activeSection = useCurrentSection();

    return useMemo(() => {
        if (!activeSection) return undefined;

        // Compute the canonical route for this section.
        const canonicalRoute = activeSection.defaultRoute ?? activeSection.route;
        if (!canonicalRoute) return undefined;

        // Find the first contextual tour that targets this exact route.
        return Object.values(validatedConfig.tours).find(
            (tour) => tour.kind === 'contextual' && tour.route === canonicalRoute
        );
    }, [activeSection]);
}

// ============================================================================
// useWelcomeTourPending — D12 suppression gate
// ============================================================================

/**
 * Return type of {@link useWelcomeTourPending}.
 */
export interface UseWelcomeTourPendingReturn {
    /**
     * `true` when:
     * - The current user's role has a welcome tour in the catalog.
     * - The user has NOT yet seen that tour at its current version.
     *
     * Both `TourAutoTrigger` (which fires the tour) and `AppLayout` (which passes
     * `suppressed` to `WhatsNewAutoTrigger`) consume this flag — keeping the logic
     * in one place prevents drift (D12).
     *
     * Returns `true` (pessimistic) while `useAdminTourState` is still loading
     * and the role has a welcome tour in the catalog — this closes the D12
     * loading-order race where the What's New modal could fire before the
     * tour seen-state resolved.
     */
    readonly welcomeTourPending: boolean;
}

/**
 * Shared D12 suppression gate.
 *
 * Returns `true` when the current user's welcome tour is both defined in the
 * catalog and unseen (eligible for auto-trigger). Used by `TourAutoTrigger` to
 * decide whether to fire, and by `AppLayout` to suppress `WhatsNewAutoTrigger`
 * while the welcome tour is still pending for a new user.
 *
 * Reads from `useAuthContext`, `useWelcomeTourForRole`, and `useAdminTourState`.
 * Returns `false` while the tour state is still loading.
 *
 * @returns {@link UseWelcomeTourPendingReturn}
 *
 * @example
 * ```tsx
 * const { welcomeTourPending } = useWelcomeTourPending();
 * <WhatsNewAutoTrigger suppressed={welcomeTourPending} />
 * ```
 *
 * @see apps/admin/src/components/tour/TourAutoTrigger.tsx — T-013 consumer
 * @see apps/admin/src/components/layout/AppLayout.tsx — D12 wiring
 * @see SPEC-174 §5 D12
 */
export function useWelcomeTourPending(): UseWelcomeTourPendingReturn {
    const { user } = useAuthContext();
    const role = (user?.role as TourRole | null | undefined) ?? null;
    const welcomeTour = useWelcomeTourForRole({ role });
    const { isLoading, hasSeen } = useAdminTourState();

    const welcomeTourPending = useMemo(() => {
        // No welcome tour in the catalog for this role → nothing can ever be
        // pending. The catalog is synchronous config, so this is decidable
        // even while the seen-state query is loading.
        if (!welcomeTour) return false;
        // PESSIMISTIC while loading (D12 race guard): until the tour seen-state
        // resolves we don't know whether the welcome tour will fire. Suppress
        // the What's New auto-modal during that window so the two auto-opening
        // surfaces can never stack on a first login when the whats-new query
        // settles before the settings query. Once loaded, this flips to the
        // real value and WhatsNewAutoTrigger re-evaluates (its latch is only
        // set when it actually fires).
        if (isLoading) return true;
        return !hasSeen({ tourId: welcomeTour.id, version: welcomeTour.version });
    }, [isLoading, welcomeTour, hasSeen]);

    return { welcomeTourPending };
}
