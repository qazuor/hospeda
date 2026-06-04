/**
 * Unit tests for `buildDriverSteps` (build-driver-steps).
 *
 * Covers:
 * - 'center' target → no `element` in output step.
 * - 'data-tour:<id>' target → `element: '[data-tour="<id>"]'` in output.
 * - Locale resolution: correct locale selected, fallback to es.
 * - Permission filtering: gated step excluded when user lacks permission.
 * - Permission filtering: gated step included when user has permission.
 * - Ungated steps (no permissions field) are always included.
 * - side/align passed through when present, omitted when absent.
 * - Empty result when all steps filtered by permissions.
 *
 * Pure function — no React, no DOM.
 *
 * @see apps/admin/src/lib/tour/build-driver-steps.ts
 * @see SPEC-174 §7.3
 */

import type { Tour } from '@/config/ia/tour.schema';
import type { IsPermissionGateGrantedInput } from '@/lib/nav/permission-visibility';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock isPermissionGateGranted — controls permission outcomes in tests.
// Must be declared before any module imports that depend on it.
// ---------------------------------------------------------------------------

const mockIsPermissionGateGranted = vi.fn((_input: IsPermissionGateGrantedInput) => true);

vi.mock('@/lib/nav/permission-visibility', () => ({
    isPermissionGateGranted: (input: IsPermissionGateGrantedInput) =>
        mockIsPermissionGateGranted(input)
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { buildDriverSteps } from '../build-driver-steps';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLabel(text: string) {
    return { es: `${text} es`, en: `${text} en`, pt: `${text} pt` };
}

/** A simple tour with one centered step and one data-tour step. */
const BASIC_TOUR: Tour = {
    id: 'host.welcome',
    roles: ['HOST'],
    kind: 'welcome',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: true,
    steps: [
        {
            id: 'greeting',
            target: 'center',
            title: makeLabel('Greeting title'),
            body: makeLabel('Greeting body')
        },
        {
            id: 'main-menu',
            target: 'data-tour:main-menu',
            title: makeLabel('Menu title'),
            body: makeLabel('Menu body'),
            side: 'bottom',
            align: 'start'
        }
    ]
};

/** A tour with a gated step. */
const GATED_TOUR: Tour = {
    id: 'host.misAlojamientos',
    roles: ['HOST'],
    kind: 'contextual',
    route: '/me/accommodations',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: false,
    steps: [
        {
            id: 'ungated',
            target: 'center',
            title: makeLabel('Ungated title'),
            body: makeLabel('Ungated body')
        },
        {
            id: 'gated',
            target: 'data-tour:sidebar',
            title: makeLabel('Gated title'),
            body: makeLabel('Gated body'),
            permissions: ['ACCOMMODATION_VIEW_OWN']
        }
    ]
};

describe('buildDriverSteps', () => {
    beforeEach(() => {
        // By default, grant all permissions.
        mockIsPermissionGateGranted.mockReturnValue(true);
    });

    // -------------------------------------------------------------------------
    // Target mapping
    // -------------------------------------------------------------------------

    it('omits `element` for a center target', () => {
        // Arrange
        const steps = buildDriverSteps({
            tour: BASIC_TOUR,
            locale: 'es',
            userPermissions: []
        });

        // Assert — first step is 'center', so no element key
        expect(steps[0]).not.toHaveProperty('element');
    });

    it('maps data-tour:<id> target to [data-tour="<id>"] CSS selector', () => {
        // Arrange
        const steps = buildDriverSteps({
            tour: BASIC_TOUR,
            locale: 'es',
            userPermissions: []
        });

        // Assert — second step has element selector
        expect(steps[1]).toHaveProperty('element', '[data-tour="main-menu"]');
    });

    it('maps data-tour:sidebar target correctly', () => {
        const tour: Tour = {
            id: 'test',
            roles: ['ADMIN'],
            kind: 'contextual',
            route: '/accommodations',
            version: 1,
            trigger: 'auto-first-visit',
            showWelcomeModal: false,
            steps: [
                {
                    id: 's1',
                    target: 'data-tour:sidebar',
                    title: makeLabel('T'),
                    body: makeLabel('B')
                }
            ]
        };
        const steps = buildDriverSteps({ tour, locale: 'es', userPermissions: [] });
        expect(steps[0]).toHaveProperty('element', '[data-tour="sidebar"]');
    });

    // -------------------------------------------------------------------------
    // Locale resolution
    // -------------------------------------------------------------------------

    it('resolves title and body in the requested locale (es)', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'es', userPermissions: [] });
        expect(steps[0].popover.title).toBe('Greeting title es');
        expect(steps[0].popover.description).toBe('Greeting body es');
    });

    it('resolves title and body in the requested locale (en)', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'en', userPermissions: [] });
        expect(steps[0].popover.title).toBe('Greeting title en');
        expect(steps[0].popover.description).toBe('Greeting body en');
    });

    it('resolves title and body in the requested locale (pt)', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'pt', userPermissions: [] });
        expect(steps[0].popover.title).toBe('Greeting title pt');
    });

    it('falls back to es for an unknown locale', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'fr', userPermissions: [] });
        expect(steps[0].popover.title).toBe('Greeting title es');
    });

    // -------------------------------------------------------------------------
    // Side / align pass-through
    // -------------------------------------------------------------------------

    it('passes through side when present', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'es', userPermissions: [] });
        // Second step has side: 'bottom'
        expect(steps[1].popover.side).toBe('bottom');
    });

    it('passes through align when present', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'es', userPermissions: [] });
        // Second step has align: 'start'
        expect(steps[1].popover.align).toBe('start');
    });

    it('omits side when not specified', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'es', userPermissions: [] });
        // First step has no side
        expect(steps[0].popover).not.toHaveProperty('side');
    });

    it('omits align when not specified', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'es', userPermissions: [] });
        // First step has no align
        expect(steps[0].popover).not.toHaveProperty('align');
    });

    // -------------------------------------------------------------------------
    // Permission filtering — gated steps
    // -------------------------------------------------------------------------

    it('includes a gated step when the user has permission', () => {
        // Arrange — mock grants the gated step
        mockIsPermissionGateGranted.mockImplementation(({ gate }) => {
            if (!gate) return true;
            return true; // grant all
        });

        const steps = buildDriverSteps({
            tour: GATED_TOUR,
            locale: 'es',
            userPermissions: [PermissionEnum.ACCOMMODATION_VIEW_OWN]
        });

        // Both ungated + gated steps included
        expect(steps).toHaveLength(2);
    });

    it('excludes a gated step when the user lacks permission', () => {
        // Arrange — deny the gated step (has permissions field), allow ungated
        mockIsPermissionGateGranted.mockImplementation(({ gate }) => {
            if (!gate) return true;
            return false; // deny gated
        });

        const steps = buildDriverSteps({
            tour: GATED_TOUR,
            locale: 'es',
            userPermissions: []
        });

        // Only the ungated step
        expect(steps).toHaveLength(1);
        expect(steps[0].popover.title).toBe('Ungated title es');
    });

    it('returns empty array when all steps are filtered by permissions', () => {
        // Arrange — deny everything
        mockIsPermissionGateGranted.mockReturnValue(false);

        const allGatedTour: Tour = {
            id: 'all-gated',
            roles: ['ADMIN'],
            kind: 'contextual',
            route: '/access/users',
            version: 1,
            trigger: 'auto-first-visit',
            showWelcomeModal: false,
            steps: [
                {
                    id: 'g1',
                    target: 'center',
                    title: makeLabel('G1'),
                    body: makeLabel('G1 body'),
                    permissions: ['USER_READ_ALL']
                },
                {
                    id: 'g2',
                    target: 'data-tour:sidebar',
                    title: makeLabel('G2'),
                    body: makeLabel('G2 body'),
                    permissions: ['USER_READ_ALL']
                }
            ]
        };

        const steps = buildDriverSteps({ tour: allGatedTour, locale: 'es', userPermissions: [] });
        expect(steps).toHaveLength(0);
    });

    it('always includes ungated steps regardless of user permissions', () => {
        // Arrange — deny all gated steps
        mockIsPermissionGateGranted.mockImplementation(({ gate }) => {
            return !gate; // ungated → true, gated → false
        });

        const steps = buildDriverSteps({
            tour: BASIC_TOUR,
            locale: 'es',
            userPermissions: []
        });

        // BASIC_TOUR has no gated steps → both should be included
        expect(steps).toHaveLength(2);
    });

    // -------------------------------------------------------------------------
    // Output shape
    // -------------------------------------------------------------------------

    it('produces the correct output shape for a center step', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'es', userPermissions: [] });
        expect(steps[0]).toStrictEqual({
            popover: {
                title: 'Greeting title es',
                description: 'Greeting body es'
            }
        });
    });

    it('produces the correct output shape for a data-tour step with side/align', () => {
        const steps = buildDriverSteps({ tour: BASIC_TOUR, locale: 'en', userPermissions: [] });
        expect(steps[1]).toStrictEqual({
            element: '[data-tour="main-menu"]',
            popover: {
                title: 'Menu title en',
                description: 'Menu body en',
                side: 'bottom',
                align: 'start'
            }
        });
    });
});
