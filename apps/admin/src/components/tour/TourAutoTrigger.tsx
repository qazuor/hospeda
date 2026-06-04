/**
 * TourAutoTrigger — headless component that auto-fires the appropriate tour.
 *
 * Mounted inside `AppLayout` (below the `_authed` guard area) so the router,
 * auth context, and TourProvider are always available. Renders `null` — no
 * visual output.
 *
 * ## Decision logic (§7.6, D13)
 *
 * On each unique `[pathname, isLoaded, role]` combination the component:
 * 1. Bails when `!isLoaded`, `isRunning`, or `!role`.
 * 2. Calls `decideAutoTrigger` with the full tour catalog and seen-state.
 * 3. Dispatches the action:
 *    - `'welcome'` — double-rAF then `startTour` (ensures `data-tour` targets
 *      are painted before driver.js queries the DOM).
 *    - `'welcome-redirect'` (D13) — navigates to `dashboardRoute` via the
 *      TanStack router. The NEXT effect run (on the dashboard pathname) fires
 *      the tour. Does NOT call `startTour` pre-redirect.
 *    - `'contextual'` — double-rAF then `startTour`.
 *    - `'none'` — no-op.
 *
 * ## Strict-mode double-fire guard
 *
 * A `useRef` latch keyed per pathname prevents the same pathname from triggering
 * twice. React 19 strict mode mounts effects twice in development; the latch
 * ensures the second run is a no-op.
 *
 * ## Dashboard route resolution
 *
 * The dashboard route is `/dashboard` (sourced from `sections.inicio.defaultRoute`
 * in the config). It is exposed via the constant `DASHBOARD_ROUTE` below — the
 * validated config does not expose it directly as a getter, so we define the
 * constant with a comment pointing to the config source.
 *
 * @module components/tour/TourAutoTrigger
 * @see apps/admin/src/lib/tour/decide-auto-trigger.ts — decision function
 * @see apps/admin/src/hooks/use-admin-tour-state.ts   — seen-state
 * @see apps/admin/src/hooks/use-tours.ts              — useWelcomeTourPending
 * @see apps/admin/src/contexts/tour-context.tsx       — startTour
 * @see SPEC-174 §7.6, D9, D12, D13
 */

import type { TourRole } from '@/config/ia/tour.schema';
import { validatedConfig } from '@/config/ia/validate';
import { useTour } from '@/contexts/tour-context';
import { useAdminTourState } from '@/hooks/use-admin-tour-state';
import { useAuthContext } from '@/hooks/use-auth-context';
import { decideAutoTrigger } from '@/lib/tour/decide-auto-trigger';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Dashboard route constant
// ---------------------------------------------------------------------------

/**
 * Canonical dashboard route for the admin panel.
 *
 * Source: `sections.inicio.defaultRoute` in `apps/admin/src/config/ia/sections.ts`.
 * That section definition has `route: '/dashboard', defaultRoute: '/dashboard'`.
 * The validated config does not expose individual section routes as top-level
 * getters, so we define this constant directly.
 */
const DASHBOARD_ROUTE = '/dashboard';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Headless auto-trigger component. Renders `null`.
 *
 * Mount once inside `AppLayout` (below `_authed`). The component uses
 * `useEffect` keyed on `[pathname, isLoaded, role]` to evaluate the auto-trigger
 * decision once per route + load state combination.
 */
export function TourAutoTrigger() {
    const { pathname } = useLocation();
    const router = useRouter();
    const { user } = useAuthContext();
    const role = (user?.role as TourRole | null | undefined) ?? null;
    const { isLoading, hasSeen } = useAdminTourState();
    const { isRunning, startTour } = useTour();

    const isLoaded = !isLoading;

    /**
     * Per-pathname latch set — prevents the same pathname from triggering a tour
     * twice (React 19 strict-mode double-mount guard).
     */
    const firedForPathname = useRef<Set<string>>(new Set());

    useEffect(() => {
        // --- Guard conditions ---
        if (!isLoaded) return;
        if (isRunning) return;
        if (!role) return;

        // Latch: already fired for this pathname in this mount.
        if (firedForPathname.current.has(pathname)) return;

        const decision = decideAutoTrigger({
            pathname,
            dashboardRoute: DASHBOARD_ROUTE,
            role,
            tours: validatedConfig.tours,
            hasSeen
        });

        if (decision.kind === 'none') return;

        // Set latch BEFORE async work to prevent the second strict-mode run.
        firedForPathname.current.add(pathname);

        if (decision.kind === 'welcome-redirect') {
            // D13: navigate to dashboard. The NEXT effect invocation (on /dashboard)
            // will call decideAutoTrigger again — this time with kind 'welcome' —
            // and fire the tour there. We do NOT call startTour here.
            void router.navigate({ to: DASHBOARD_ROUTE });
            return;
        }

        // For 'welcome' and 'contextual': double-rAF to guarantee that all
        // data-tour targets have painted before driver.js queries the DOM.
        const { tourId } = decision;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                startTour({ tourId, source: 'auto' });
            });
        });
    }, [pathname, isLoaded, role, isRunning, hasSeen, startTour, router]);

    return null;
}
