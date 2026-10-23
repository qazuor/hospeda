/**
 * Unit tests for the breadcrumb route-table helpers (HOS-1754).
 *
 * Covers:
 * - `matchesRoutePattern` for literal paths, `$param` segments, splats,
 *   trailing slashes, case sensitivity and regex-special characters.
 * - `isRegisteredPath` against the subscription route table that reproduces
 *   the issue (prefixes without a page vs. real leaves) and the fail-open
 *   behaviour with an empty route table.
 * - `getRoutePaths` with and without `routesByPath`.
 *
 * @see apps/admin/src/lib/breadcrumb-routes.ts
 */

import { describe, expect, it } from 'vitest';
import { getRoutePaths, isRegisteredPath, matchesRoutePattern } from '@/lib/breadcrumb-routes';

const SUBSCRIPTION_ID = '04c89660-09eb-40ec-8294-35a1c165192b';
const CANCELLATION_PATTERN = '/billing/subscriptions/$subscriptionId/cancellation';
const REVOCATION_PATTERN = '/billing/subscriptions/$subscriptionId/revocation';
const SUBSCRIPTION_PATTERN = '/billing/subscriptions/$subscriptionId';

const ISSUE_ROUTE_PATHS: readonly string[] = [
    '/billing/exchange-rates',
    CANCELLATION_PATTERN,
    REVOCATION_PATTERN,
    '/access/users'
];

describe('matchesRoutePattern', () => {
    it('matches an identical literal path', () => {
        expect(
            matchesRoutePattern({
                path: '/billing/exchange-rates',
                pattern: '/billing/exchange-rates'
            })
        ).toBe(true);
    });

    it('treats a trailing slash as irrelevant on both sides', () => {
        expect(
            matchesRoutePattern({
                path: '/billing/exchange-rates/',
                pattern: '/billing/exchange-rates'
            })
        ).toBe(true);
        expect(
            matchesRoutePattern({
                path: '/billing/exchange-rates',
                pattern: '/billing/exchange-rates/'
            })
        ).toBe(true);
    });

    it('keeps the root path as a single slash', () => {
        expect(matchesRoutePattern({ path: '/', pattern: '/' })).toBe(true);
        expect(matchesRoutePattern({ path: '/billing', pattern: '/' })).toBe(false);
    });

    it('accepts any non-empty value for a $param segment', () => {
        expect(
            matchesRoutePattern({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`,
                pattern: CANCELLATION_PATTERN
            })
        ).toBe(true);
        expect(
            matchesRoutePattern({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}/revocation`,
                pattern: REVOCATION_PATTERN
            })
        ).toBe(true);
    });

    it('rejects an empty value for a $param segment', () => {
        expect(
            matchesRoutePattern({
                path: '/billing/subscriptions',
                pattern: SUBSCRIPTION_PATTERN
            })
        ).toBe(false);
    });

    it('rejects a $param segment that spans a slash', () => {
        expect(
            matchesRoutePattern({
                path: '/billing/subscriptions/abc/def',
                pattern: SUBSCRIPTION_PATTERN
            })
        ).toBe(false);
    });

    it('does not match a prefix against the longer leaf pattern', () => {
        expect(
            matchesRoutePattern({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}`,
                pattern: CANCELLATION_PATTERN
            })
        ).toBe(false);
    });

    it('does not match the longer leaf against the shorter prefix pattern', () => {
        expect(
            matchesRoutePattern({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`,
                pattern: SUBSCRIPTION_PATTERN
            })
        ).toBe(false);
    });

    it('accepts any remainder (including empty) for a final splat segment', () => {
        expect(matchesRoutePattern({ path: '/files', pattern: '/files/$' })).toBe(true);
        expect(matchesRoutePattern({ path: '/files/a', pattern: '/files/$' })).toBe(true);
        expect(matchesRoutePattern({ path: '/files/a/b/c', pattern: '/files/$' })).toBe(true);
    });

    it('does not match a splat pattern against a different literal prefix', () => {
        expect(matchesRoutePattern({ path: '/documents/a', pattern: '/files/$' })).toBe(false);
    });

    it('compares literal segments case-sensitively', () => {
        expect(
            matchesRoutePattern({
                path: '/Billing/Exchange-Rates',
                pattern: '/billing/exchange-rates'
            })
        ).toBe(false);
    });

    it('escapes regex-special characters in literal segments', () => {
        expect(
            matchesRoutePattern({ path: '/billing/plans.v2', pattern: '/billing/plans.v2' })
        ).toBe(true);
        expect(
            matchesRoutePattern({ path: '/billing/plansXv2', pattern: '/billing/plans.v2' })
        ).toBe(false);
    });
});

describe('isRegisteredPath', () => {
    it('rejects the subscription prefixes that have no page', () => {
        expect(isRegisteredPath({ path: '/billing', routePaths: ISSUE_ROUTE_PATHS })).toBe(false);
        expect(
            isRegisteredPath({ path: '/billing/subscriptions', routePaths: ISSUE_ROUTE_PATHS })
        ).toBe(false);
        expect(
            isRegisteredPath({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}`,
                routePaths: ISSUE_ROUTE_PATHS
            })
        ).toBe(false);
    });

    it('accepts the subscription leaves and the other registered routes', () => {
        expect(
            isRegisteredPath({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}/cancellation`,
                routePaths: ISSUE_ROUTE_PATHS
            })
        ).toBe(true);
        expect(
            isRegisteredPath({
                path: `/billing/subscriptions/${SUBSCRIPTION_ID}/revocation`,
                routePaths: ISSUE_ROUTE_PATHS
            })
        ).toBe(true);
        expect(
            isRegisteredPath({ path: '/billing/exchange-rates', routePaths: ISSUE_ROUTE_PATHS })
        ).toBe(true);
        expect(isRegisteredPath({ path: '/access/users', routePaths: ISSUE_ROUTE_PATHS })).toBe(
            true
        );
    });

    it('fail-opens when the route table is empty', () => {
        expect(isRegisteredPath({ path: '/billing', routePaths: [] })).toBe(true);
        expect(isRegisteredPath({ path: '/totally/unknown', routePaths: [] })).toBe(true);
    });
});

describe('getRoutePaths', () => {
    it('returns the keys of routesByPath', () => {
        expect(
            getRoutePaths({
                router: {
                    routesByPath: {
                        '/access': {},
                        '/access/users': {}
                    }
                }
            })
        ).toEqual(['/access', '/access/users']);
    });

    it('returns an empty list when routesByPath is absent', () => {
        expect(getRoutePaths({ router: {} })).toEqual([]);
    });

    it('returns an empty list when routesByPath is undefined', () => {
        expect(getRoutePaths({ router: { routesByPath: undefined } })).toEqual([]);
    });
});
