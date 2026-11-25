/**
 * @file dashboards.test.ts
 * @description Pure rules behind the phase-3 dashboards (HOS-2473..2476):
 * the host outcome (lock vs error vs unavailable), the owner dashboard view,
 * the owner access gate, and AC-11 (general and host dashboards share no
 * widget).
 */

import { describe, expect, it } from 'vitest';
import { GENERAL_DASHBOARD_WIDGETS } from '../../../src/lib/account/general-dashboard';
import {
    HOST_DASHBOARD_WIDGETS,
    HOST_QUICK_ACTIONS,
    resolveHostDashboardOutcome
} from '../../../src/lib/account/host-dashboard';
import {
    buildOwnerDashboardRows,
    OWNER_DASHBOARD_WIDGETS,
    resolveOwnerDashboardRedirect,
    resolveOwnerDashboardView
} from '../../../src/lib/account/owner-listing-dashboard';

describe('AC-11: the general and host dashboards share no widget', () => {
    it('their widget id lists do not intersect', () => {
        const general = new Set<string>(GENERAL_DASHBOARD_WIDGETS);
        expect(HOST_DASHBOARD_WIDGETS.filter((id) => general.has(id))).toEqual([]);
    });

    it('the host dashboard no longer carries the plan summary (D19)', () => {
        expect(HOST_DASHBOARD_WIDGETS).not.toContain('subscription');
        expect(HOST_QUICK_ACTIONS.map((row) => row.path)).not.toContain('mi-cuenta/suscripcion');
    });

    it('the host quick actions go to the OWNER inbox (HOS-2418)', () => {
        expect(HOST_QUICK_ACTIONS.find((row) => row.id === 'ownerMessages')?.path).toBe(
            'mi-cuenta/consultas-propietario'
        );
    });
});

describe('resolveHostDashboardOutcome', () => {
    it('is a lock for ENTITLEMENT_REQUIRED and an error for anything else', () => {
        expect(
            resolveHostDashboardOutcome({
                result: { ok: false, error: { code: 'ENTITLEMENT_REQUIRED' } }
            })
        ).toEqual({ kind: 'locked' });
        expect(
            resolveHostDashboardOutcome({
                result: { ok: false, error: { code: 'INTERNAL_ERROR' } }
            })
        ).toEqual({ kind: 'error' });
    });

    it('turns an `unavailable` section or a missing number into null, never 0', () => {
        const outcome = resolveHostDashboardOutcome({
            result: {
                ok: true,
                data: {
                    properties: { total: 0, published: 0, draft: 0 },
                    unreadConversations: 0,
                    unavailable: ['properties']
                }
            }
        });
        expect(outcome).toEqual({ kind: 'ready', properties: null, unread: 0 });
        expect(resolveHostDashboardOutcome({ result: { ok: true, data: {} } })).toEqual({
            kind: 'ready',
            properties: null,
            unread: null
        });
    });
});

describe('resolveOwnerDashboardView', () => {
    const listings = { total: 2, published: 1, draft: 1, archived: 0 };

    it('a failed read is an error on both widgets, never ready zeros', () => {
        expect(resolveOwnerDashboardView({ read: { status: 'error' } })).toEqual({
            listings: { status: 'error' },
            traffic: { status: 'error' },
            isEmpty: false
        });
    });

    it('maps granted / locked / unavailable traffic', () => {
        const base = { vertical: 'venue' as const, listings };
        expect(
            resolveOwnerDashboardView({
                read: {
                    status: 'ready',
                    data: {
                        ...base,
                        trafficAccess: 'granted',
                        traffic: { windowDays: 7, unique: 1, total: 2 }
                    }
                }
            }).traffic
        ).toEqual({ status: 'ready', data: { windowDays: 7, unique: 1, total: 2 } });
        expect(
            resolveOwnerDashboardView({
                read: { status: 'ready', data: { ...base, trafficAccess: 'locked' } }
            }).traffic
        ).toEqual({ status: 'locked' });
        expect(
            resolveOwnerDashboardView({
                read: { status: 'ready', data: { ...base, trafficAccess: 'unavailable' } }
            }).traffic
        ).toEqual({ status: 'error' });
    });

    it('is empty only when the read succeeded with zero listings', () => {
        const empty = { total: 0, published: 0, draft: 0, archived: 0 };
        expect(
            resolveOwnerDashboardView({
                read: {
                    status: 'ready',
                    data: { vertical: 'experience', listings: empty, trafficAccess: 'locked' }
                }
            }).isEmpty
        ).toBe(true);
    });

    it('uses distinct widget ids per vertical', () => {
        expect(OWNER_DASHBOARD_WIDGETS.venue).not.toEqual(OWNER_DASHBOARD_WIDGETS.experience);
        expect(buildOwnerDashboardRows({ vertical: 'venue' }).map((row) => row.id)).toEqual([
            'listings',
            'newListing'
        ]);
    });
});

describe('resolveOwnerDashboardRedirect', () => {
    const input = { locale: 'es' as const, currentUrl: '/es/mi-cuenta/tablero-locales/' };

    it('sends an anonymous visitor to login', () => {
        expect(
            resolveOwnerDashboardRedirect({ ...input, vertical: 'venue', permissions: null })
        ).toMatch(/signin|login|auth/);
    });

    it('renders for the permission holder and redirects everyone else home', () => {
        expect(
            resolveOwnerDashboardRedirect({
                ...input,
                vertical: 'venue',
                permissions: ['venue.editOwn']
            })
        ).toBeNull();
        expect(
            resolveOwnerDashboardRedirect({
                ...input,
                vertical: 'experience',
                permissions: ['venue.editOwn']
            })
        ).toBe('/es/mi-cuenta/');
        expect(
            resolveOwnerDashboardRedirect({ ...input, vertical: 'venue', permissions: [] })
        ).toBe('/es/mi-cuenta/');
    });
});
