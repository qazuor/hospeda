/**
 * build-driver-steps — maps a validated Tour config to driver.js-compatible
 * step descriptors.
 *
 * This module is pure (no React, no DOM calls). It converts a config-driven
 * {@link Tour} into an array of {@link TourDriveStep} objects that the engine
 * layer (`tour-context.tsx`) can pass directly to driver.js after lazy-loading
 * it.
 *
 * **Why a local `TourDriveStep` interface instead of `import type { DriveStep }`?**
 * driver.js is a runtime-optional dependency (lazy-imported by T-010). Importing
 * its types at compile time would create a hard package dependency even for this
 * pure module. Defining a compatible local interface keeps this file dependency-
 * free and lets T-010 do the mapping/casting when it constructs the real `driver`.
 * The shape is intentionally a strict subset of driver.js `DriveStep`.
 *
 * **Permission filtering:**
 * Tour step `permissions` are OR-logic gates (same semantics as nav sidebar items).
 * Resolution uses {@link isPermissionGateGranted} from
 * `lib/nav/permission-visibility` — the canonical KEY→VALUE bridge that expands
 * `PermissionExpression` KEYS to `PermissionEnum` VALUES via `expandPermissions`.
 * Steps whose gate denies access are silently excluded from the output array.
 *
 * @module lib/tour/build-driver-steps
 * @see apps/admin/src/lib/nav/permission-visibility.ts — isPermissionGateGranted
 * @see apps/admin/src/lib/tour/resolve-step-text.ts    — locale resolution
 * @see SPEC-174 §7.3, §7.2
 */

import type { Tour } from '@/config/ia/tour.schema';
import type { PermissionEnum } from '@repo/schemas';
import { isPermissionGateGranted } from '../nav/permission-visibility';
import { resolveStepText } from './resolve-step-text';

// ============================================================================
// Local driver.js-compatible step interface (T-010 maps this to DriveStep)
// ============================================================================

/**
 * A driver.js-compatible step descriptor produced by {@link buildDriverSteps}.
 *
 * This is a strict subset of driver.js `DriveStep`. T-010 (tour-context.tsx)
 * receives these objects and passes them to the `driver()` instance after
 * dynamic import. The mapping is 1:1 — no conversion needed at the call site.
 *
 * `element` is omitted for centered steps (driver.js treats missing element as
 * a viewport-centered overlay).
 */
export interface TourDriveStep {
    /**
     * CSS selector for the element to spotlight.
     * Omitted (`undefined`) for `'center'` target steps — driver.js renders
     * a viewport-centered popover when no element is specified.
     */
    readonly element?: string;

    /** Driver.js popover configuration. */
    readonly popover: {
        /** Step heading text, already resolved to the requested locale. */
        readonly title: string;
        /** Step body text, already resolved to the requested locale. */
        readonly description: string;
        /**
         * Which side of the target element the popover appears on.
         * Omitted when not specified — driver.js auto-positions.
         */
        readonly side?: 'top' | 'right' | 'bottom' | 'left';
        /**
         * Alignment on the perpendicular axis.
         * Omitted when not specified — driver.js defaults to `'start'`.
         */
        readonly align?: 'start' | 'center' | 'end';
    };
}

// ============================================================================
// Input / output types
// ============================================================================

/**
 * Input for {@link buildDriverSteps}.
 */
export interface BuildDriverStepsInput {
    /**
     * The validated tour definition from the IA config catalog.
     * Only `steps` and their fields are used; the tour-level `id`/`kind`/`roles`
     * are not needed here.
     */
    readonly tour: Tour;
    /**
     * The resolved locale to use for step `title` and `body` text.
     * Typically from `useTranslations().locale`.
     */
    readonly locale: string;
    /**
     * The current user's `PermissionEnum` VALUES (from `useUserPermissions()`).
     * Steps with a `permissions` gate are filtered out when the user does not
     * pass the gate. Steps without a gate are always included.
     */
    readonly userPermissions: readonly PermissionEnum[];
}

// ============================================================================
// Exported function
// ============================================================================

/**
 * Converts a validated {@link Tour} config entry into an array of
 * {@link TourDriveStep} objects ready for driver.js.
 *
 * Processing per step:
 * 1. **Permission gate** — if the step has a `permissions` array, the user
 *    must hold at least one expanded permission. Steps that fail the gate are
 *    excluded from the result.
 * 2. **Target mapping**:
 *    - `'center'` → `element` omitted (driver.js viewport-center popover).
 *    - `'data-tour:<id>'` → `element: '[data-tour="<id>"]'` (CSS attribute selector).
 * 3. **Locale resolution** — `title` and `body` are resolved via
 *    {@link resolveStepText} using the provided locale + fallback chain.
 * 4. **Side/align** — passed through as-is when present; omitted otherwise.
 *
 * Returns an empty array when all steps are filtered out by permission gates.
 *
 * @param input - `{ tour, locale, userPermissions }`.
 * @returns Array of {@link TourDriveStep} for driver.js (may be empty).
 *
 * @example
 * ```ts
 * const steps = buildDriverSteps({
 *   tour: validatedConfig.tours['host.welcome'],
 *   locale: 'es',
 *   userPermissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN],
 * });
 * // steps[0] = { popover: { title: '¡Bienvenido!', description: '...' } }
 * // (no `element` — target was 'center')
 * ```
 */
export function buildDriverSteps({
    tour,
    locale,
    userPermissions
}: BuildDriverStepsInput): TourDriveStep[] {
    const result: TourDriveStep[] = [];

    for (const step of tour.steps) {
        // Step 1: Permission gate — filter steps the user cannot see.
        if (step.permissions !== undefined) {
            const granted = isPermissionGateGranted({
                gate: step.permissions,
                userPermissions
            });
            if (!granted) {
                continue;
            }
        }

        // Step 2: Resolve DOM element selector (or omit for centered steps).
        let element: string | undefined;
        if (step.target !== 'center') {
            // 'data-tour:<id>' → '[data-tour="<id>"]'
            const tourId = step.target.slice('data-tour:'.length);
            element = `[data-tour="${tourId}"]`;
        }

        // Step 3: Resolve localized text.
        const title = resolveStepText({ field: step.title, locale });
        const description = resolveStepText({ field: step.body, locale });

        // Step 4: Build the popover config (side/align are pass-through when present).
        const popover: TourDriveStep['popover'] = {
            title,
            description,
            ...(step.side !== undefined && { side: step.side }),
            ...(step.align !== undefined && { align: step.align })
        };

        result.push({ ...(element !== undefined && { element }), popover });
    }

    return result;
}
