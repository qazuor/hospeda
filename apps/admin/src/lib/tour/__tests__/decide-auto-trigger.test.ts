/**
 * Unit tests for `decideAutoTrigger` (decide-auto-trigger).
 *
 * Covers the full decision matrix per SPEC-174 §7.3, §7.6, D9, D13:
 *
 * - Welcome tour eligible + on dashboard → { kind: 'welcome' }
 * - Welcome tour eligible + NOT on dashboard → { kind: 'welcome-redirect' }
 * - Welcome seen + contextual unseen → { kind: 'contextual' }
 * - Welcome seen + contextual also seen → { kind: 'none' }
 * - No role → { kind: 'none' }
 * - Role with no matching tours → { kind: 'none' }
 * - Version bump re-offers welcome tour
 * - Welcome with trigger:'manual' is not auto-eligible → contextual wins
 * - No contextual tour for current route → { kind: 'none' } (even if welcome seen)
 * - SUPER_ADMIN can reuse admin.* tours (roles membership)
 *
 * Pure function — no React, no DOM.
 *
 * @see apps/admin/src/lib/tour/decide-auto-trigger.ts
 * @see SPEC-174 §7.3, §7.6, D9, D13
 */

import type { Tour, ToursRecord } from '@/config/ia/tour.schema';
import { describe, expect, it } from 'vitest';
import type { HasSeenFn } from '../decide-auto-trigger';
import { decideAutoTrigger } from '../decide-auto-trigger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DASHBOARD_ROUTE = '/dashboard';

// ---------------------------------------------------------------------------
// Tour fixtures
// ---------------------------------------------------------------------------

function makeLabel(text: string) {
    return { es: text, en: text, pt: text };
}

const HOST_WELCOME: Tour = {
    id: 'host.welcome',
    roles: ['HOST'],
    kind: 'welcome',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: true,
    steps: [{ id: 's1', target: 'center', title: makeLabel('T'), body: makeLabel('B') }]
};

const HOST_ACCOMMODATIONS: Tour = {
    id: 'host.misAlojamientos',
    roles: ['HOST'],
    kind: 'contextual',
    route: '/me/accommodations',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: false,
    steps: [{ id: 's1', target: 'center', title: makeLabel('T'), body: makeLabel('B') }]
};

const ADMIN_WELCOME: Tour = {
    id: 'admin.welcome',
    roles: ['ADMIN'],
    kind: 'welcome',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: true,
    steps: [{ id: 's1', target: 'center', title: makeLabel('T'), body: makeLabel('B') }]
};

/** Contextual tour reused by both ADMIN and SUPER_ADMIN (D14 pattern). */
const ADMIN_CATALOGO: Tour = {
    id: 'admin.catalogo',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    kind: 'contextual',
    route: '/accommodations',
    version: 1,
    trigger: 'auto-first-visit',
    showWelcomeModal: false,
    steps: [{ id: 's1', target: 'center', title: makeLabel('T'), body: makeLabel('B') }]
};

const SUPER_WELCOME: Tour = {
    id: 'superAdmin.welcome',
    roles: ['SUPER_ADMIN'],
    kind: 'welcome',
    version: 2,
    trigger: 'auto-first-visit',
    showWelcomeModal: true,
    steps: [{ id: 's1', target: 'center', title: makeLabel('T'), body: makeLabel('B') }]
};

/** Welcome tour with manual trigger — should NOT auto-fire. */
const MANUAL_WELCOME: Tour = {
    id: 'manual.welcome',
    roles: ['EDITOR'],
    kind: 'welcome',
    version: 1,
    trigger: 'manual',
    showWelcomeModal: true,
    steps: [{ id: 's1', target: 'center', title: makeLabel('T'), body: makeLabel('B') }]
};

// ---------------------------------------------------------------------------
// Catalog helpers
// ---------------------------------------------------------------------------

/** Builds a minimal ToursRecord from an array of tours. */
function catalog(...tours: Tour[]): ToursRecord {
    const record: Record<string, Tour> = {};
    for (const t of tours) {
        record[t.id] = t;
    }
    return record;
}

/** hasSeen factory — returns a fn that marks listed tourIds as seen. */
function seenFn(...seenIds: string[]): HasSeenFn {
    const set = new Set(seenIds);
    return ({ tourId }) => set.has(tourId);
}

const neverSeen: HasSeenFn = () => false;
const alwaysSeen: HasSeenFn = () => true;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('decideAutoTrigger', () => {
    // -------------------------------------------------------------------------
    // No role — bail immediately
    // -------------------------------------------------------------------------

    it('returns none when role is null', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: null,
            tours: catalog(HOST_WELCOME),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });

    it('returns none when role is undefined', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: undefined,
            tours: catalog(HOST_WELCOME),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });

    // -------------------------------------------------------------------------
    // Welcome tour — on dashboard
    // -------------------------------------------------------------------------

    it('returns welcome when user is on dashboard and welcome is unseen', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'welcome', tourId: 'host.welcome' });
    });

    // -------------------------------------------------------------------------
    // Welcome tour — NOT on dashboard → redirect
    // -------------------------------------------------------------------------

    it('returns welcome-redirect when user is off dashboard and welcome is unseen', () => {
        const result = decideAutoTrigger({
            pathname: '/me/accommodations',
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME, HOST_ACCOMMODATIONS),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'welcome-redirect', tourId: 'host.welcome' });
    });

    it('returns welcome-redirect even when there is a contextual tour for the current route', () => {
        // Welcome takes priority over contextual (D9)
        const result = decideAutoTrigger({
            pathname: '/me/accommodations',
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME, HOST_ACCOMMODATIONS),
            hasSeen: neverSeen
        });
        expect(result.kind).toBe('welcome-redirect');
    });

    // -------------------------------------------------------------------------
    // Welcome seen → contextual
    // -------------------------------------------------------------------------

    it('returns contextual when welcome is seen and contextual route matches', () => {
        const result = decideAutoTrigger({
            pathname: '/me/accommodations',
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME, HOST_ACCOMMODATIONS),
            hasSeen: seenFn('host.welcome')
        });
        expect(result).toStrictEqual({ kind: 'contextual', tourId: 'host.misAlojamientos' });
    });

    // -------------------------------------------------------------------------
    // Both seen → none
    // -------------------------------------------------------------------------

    it('returns none when both welcome and contextual are seen', () => {
        const result = decideAutoTrigger({
            pathname: '/me/accommodations',
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME, HOST_ACCOMMODATIONS),
            hasSeen: alwaysSeen
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });

    // -------------------------------------------------------------------------
    // Welcome seen + no contextual for route → none
    // -------------------------------------------------------------------------

    it('returns none when welcome is seen and no contextual matches the current route', () => {
        const result = decideAutoTrigger({
            pathname: '/billing/subscriptions',
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME, HOST_ACCOMMODATIONS),
            hasSeen: seenFn('host.welcome')
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });

    // -------------------------------------------------------------------------
    // Role filtering
    // -------------------------------------------------------------------------

    it('returns none when the role has no matching tours', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'EDITOR',
            tours: catalog(HOST_WELCOME, HOST_ACCOMMODATIONS),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });

    it('uses the correct welcome tour for ADMIN role', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'ADMIN',
            tours: catalog(HOST_WELCOME, ADMIN_WELCOME),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'welcome', tourId: 'admin.welcome' });
    });

    // -------------------------------------------------------------------------
    // Version bump re-offers welcome
    // -------------------------------------------------------------------------

    it('re-offers welcome when configVersion was bumped above seenVersion', () => {
        // Tour at version 2 — user saw version 1
        const tourV2: Tour = { ...HOST_WELCOME, version: 2 };
        const seenV1: HasSeenFn = ({ tourId, version }) =>
            tourId === 'host.welcome' && version <= 1;
        // hasSeen({ tourId: 'host.welcome', version: 2 }) → false (version 2 not seen)
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(tourV2),
            hasSeen: seenV1
        });
        expect(result).toStrictEqual({ kind: 'welcome', tourId: 'host.welcome' });
    });

    it('does not re-offer welcome when seenVersion equals configVersion', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: catalog(HOST_WELCOME),
            hasSeen: alwaysSeen
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });

    // -------------------------------------------------------------------------
    // Manual trigger — not auto-eligible
    // -------------------------------------------------------------------------

    it('ignores a welcome tour with trigger:manual (auto only respects auto-first-visit)', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'EDITOR',
            tours: catalog(MANUAL_WELCOME),
            hasSeen: neverSeen
        });
        // Manual tour should not auto-fire → none
        expect(result).toStrictEqual({ kind: 'none' });
    });

    // -------------------------------------------------------------------------
    // SUPER_ADMIN reuses admin.* contextual tours (D14)
    // -------------------------------------------------------------------------

    it('SUPER_ADMIN matches admin.catalogo contextual tour when roles includes SUPER_ADMIN', () => {
        const result = decideAutoTrigger({
            pathname: '/accommodations',
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'SUPER_ADMIN',
            tours: catalog(SUPER_WELCOME, ADMIN_CATALOGO),
            hasSeen: seenFn('superAdmin.welcome') // welcome seen
        });
        // admin.catalogo has roles: ['ADMIN', 'SUPER_ADMIN'] → super matches it
        expect(result).toStrictEqual({ kind: 'contextual', tourId: 'admin.catalogo' });
    });

    // -------------------------------------------------------------------------
    // SUPER_ADMIN welcome tour with different version
    // -------------------------------------------------------------------------

    it('offers SUPER_ADMIN welcome tour when unseen (version 2)', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'SUPER_ADMIN',
            tours: catalog(SUPER_WELCOME),
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'welcome', tourId: 'superAdmin.welcome' });
    });

    // -------------------------------------------------------------------------
    // Empty tour catalog
    // -------------------------------------------------------------------------

    it('returns none when the tour catalog is empty', () => {
        const result = decideAutoTrigger({
            pathname: DASHBOARD_ROUTE,
            dashboardRoute: DASHBOARD_ROUTE,
            role: 'HOST',
            tours: {},
            hasSeen: neverSeen
        });
        expect(result).toStrictEqual({ kind: 'none' });
    });
});
