/**
 * @file route-own-gate-declaration.guard.test.ts
 * @description Static guard for HOS-1908 — every route declares its OWN gate.
 *
 * Until HOS-1908 the route factories registered each route's middlewares with
 * `app.use(path, mw)`, which filters by path but not by method. Sibling routes
 * sharing a path (`GET /{id}`, `PUT /{id}`, `PATCH /{id}`, `DELETE /{id}`)
 * therefore ran each other's gates: a `PATCH` needed VIEW + UPDATE, and a route
 * that declared nothing could look protected only because a sibling did.
 *
 * The factory now scopes every middleware to its route's own method. This
 * guard builds the REAL app and reads, from the mounted routes, the gate each
 * `(method, path)` declares on its own registration (via the descriptor
 * `authorizationMiddleware` attaches). It fails when:
 *
 * 1. a gate declared by another `(method, path)` runs for a route, or a
 *    method-agnostic gate sits on an exact path that several methods serve
 *    (the HOS-1908 leak, at app level — a router-level `app.use('/prefix/*')`
 *    gate is method-agnostic on purpose and is not a leak);
 * 2. a `/api/v1/protected/*` or `/api/v1/admin/*` route has no authenticating
 *    gate of its own (or router-level);
 * 3. a `/api/v1/admin/*` route's gate is not admin-tier;
 * 4. an admin route declares no permission at all — neither a permission, an
 *    OR-group, nor a `listingAccess` decision — so the only thing between an
 *    actor and the handler is the admin-panel baseline.
 *
 * Every exception is listed below with its reason, and the lists are frozen in
 * BOTH directions: a new offender fails, and so does an entry that stopped
 * offending (delete it). Do not add to them to make a new route pass — declare
 * the gate on the route.
 *
 * @module test/static-guards/route-own-gate-declaration
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import {
    type RouteGateDescriptor,
    readRouteGateDescriptor
} from '../../src/middlewares/route-gate-descriptor';
import { adminListVenuesRoute } from '../../src/routes/venue/admin/list';
import { adminVenueOptionsRoute } from '../../src/routes/venue/admin/options';
import { protectedGetVenueDailySpecialsRoute } from '../../src/routes/venue/protected/getDailySpecials';
import { protectedGetVenueEventsRoute } from '../../src/routes/venue/protected/getEvents';
import { protectedGetVenueMediaRoute } from '../../src/routes/venue/protected/getMedia';
import { protectedGetVenueMenuRoute } from '../../src/routes/venue/protected/getMenu';
import { validateApiEnv } from '../../src/utils/env';

/** Hono's `RouterRoute` shape as exposed on `app.routes`. */
interface MountedRoute {
    readonly method: string;
    readonly path: string;
    readonly handler: unknown;
}

/** One endpoint and the gates that run for it before its handler. */
interface EndpointGates {
    readonly key: string;
    readonly method: string;
    readonly path: string;
    /** Gates registered for this exact `(method, path)`. */
    readonly own: readonly RouteGateDescriptor[];
    /** Gates registered with `app.use()` (method-agnostic on purpose). */
    readonly routerLevel: readonly RouteGateDescriptor[];
    /** Gates registered for ANOTHER `(method, path)` that still run here. */
    readonly foreign: readonly string[];
    /** `(method, path)` whose handler answers the request. */
    readonly servedBy: string | null;
}

/** Sample value substituted for every path parameter. */
const SAMPLE_PARAM = '00000000-0000-4000-8000-000000000001';

/**
 * Protected/admin routes with no authorization-middleware gate of their own.
 * Pre-existing and untouched by HOS-1908 (none of them ever received a
 * sibling's gate). The reason states what is in the route TODAY, not that it
 * is correct: the entries marked "no route-level check" are open questions
 * reported to the owner, not endorsed exceptions.
 */
const NO_OWN_GATE_ALLOWLIST: Readonly<Record<string, string>> = {
    'GET /api/v1/protected/accommodations/:id/contact': 'plain Hono route; inline isGuestActor 401',
    'GET /api/v1/protected/accommodations/:id/whatsapp':
        'plain Hono route; inline isGuestActor 401',
    'GET /api/v1/admin/conversations/unread-count':
        'router-level requireAuthenticatedAdminConversation',
    'GET /api/v1/admin/conversations': 'router-level requireAuthenticatedAdminConversation',
    'GET /api/v1/admin/conversations/:id': 'router-level requireAuthenticatedAdminConversation',
    'POST /api/v1/admin/conversations/:id/messages':
        'router-level requireAuthenticatedAdminConversation',
    'PATCH /api/v1/admin/conversations/:id/status':
        'router-level requireAuthenticatedAdminConversation',
    'PATCH /api/v1/admin/conversations/:id/archive':
        'router-level requireAuthenticatedAdminConversation',
    'DELETE /api/v1/admin/conversations/:id': 'router-level requireAuthenticatedAdminConversation',
    // OAuth redirect target: reached by Google, not by a session (CSRF cookie).
    'GET /api/v1/protected/accommodations/calendar-sync/google/callback':
        'public by design: OAuth callback validated by a CSRF cookie',
    'POST /api/v1/protected/auth/change-password':
        'createSimpleRoute; handler throws 401 without a session user'
};

/**
 * Admin routes whose gate enforces only the admin-panel baseline
 * (`ACCESS_PANEL_ADMIN` / `ACCESS_API_ADMIN`) and declare no permission.
 * Pre-existing; each one either checks permissions in its service or is a
 * low-risk read. Listed so the set cannot grow silently.
 */
const BASELINE_ONLY_ADMIN_ALLOWLIST: readonly string[] = [
    'GET /api/v1/admin/metrics',
    'GET /api/v1/admin/metrics/prometheus',
    'GET /api/v1/admin/metrics/api',
    'GET /api/v1/admin/metrics/system',
    'GET /api/v1/admin/users/options',
    'GET /api/v1/admin/accommodations',
    'GET /api/v1/admin/accommodations/options',
    'GET /api/v1/admin/accommodations/:id',
    'GET /api/v1/admin/accommodations/:id/faqs',
    'GET /api/v1/admin/accommodations/:id/media',
    'GET /api/v1/admin/experiences',
    'GET /api/v1/admin/experiences/options',
    'GET /api/v1/admin/destinations/options',
    'POST /api/v1/admin/destinations/:id/restore',
    'PATCH /api/v1/admin/destinations/:id/faqs/reorder',
    'GET /api/v1/admin/destinations/:id/faqs',
    'POST /api/v1/admin/destinations/:id/faqs',
    'PUT /api/v1/admin/destinations/:id/faqs/:faqId',
    'DELETE /api/v1/admin/destinations/:id/faqs/:faqId',
    'GET /api/v1/admin/events/options',
    'GET /api/v1/admin/comments',
    'PATCH /api/v1/admin/comments/:commentId/moderation',
    'DELETE /api/v1/admin/comments/:commentId/hard',
    'POST /api/v1/admin/comments/:commentId/restore',
    'GET /api/v1/admin/comments/:commentId',
    'DELETE /api/v1/admin/comments/:commentId',
    'GET /api/v1/admin/event-locations/options',
    'GET /api/v1/admin/event-organizers/options',
    'GET /api/v1/admin/moderation/reviews/pending-count',
    'GET /api/v1/admin/revalidation/health'
];

/** A route-factory sub-app: exposes the routes it registered. */
interface RouteSubApp {
    readonly routes: readonly MountedRoute[];
}

/**
 * Venue-vertical exceptions, named by the exported route object rather than by
 * URL: the mount segment still carries the retired vertical word, which the
 * venue-rename frontier guard does not let new files spell. The keys are
 * resolved against the mounted app, so a rename of the segment cannot leave
 * these entries pointing at nothing.
 */
const VENUE_NO_OWN_GATE_ROUTES: readonly RouteSubApp[] = [
    protectedGetVenueMenuRoute,
    protectedGetVenueDailySpecialsRoute,
    protectedGetVenueEventsRoute,
    protectedGetVenueMediaRoute
];
const VENUE_BASELINE_ONLY_ADMIN_ROUTES: readonly RouteSubApp[] = [
    adminListVenuesRoute,
    adminVenueOptionsRoute
];

/**
 * Follows Hono's composed-handler wrapper (added when a sub-app with its own
 * error handler is mounted) back to the registered function.
 */
const unwrapHandler = (handler: unknown): unknown => {
    let current = handler;
    for (let depth = 0; depth < 5; depth++) {
        if (typeof current !== 'function') return current;
        const inner: unknown = Reflect.get(current, '__COMPOSED_HANDLER');
        if (inner === undefined) return current;
        current = inner;
    }
    return current;
};

/** Hono router match result: `[[[handler, route], params][], stash?]`. */
type MatchResult = readonly [readonly (readonly [readonly [unknown, MountedRoute], unknown])[]];

/**
 * Builds, for every mounted endpoint, the gates that run before its handler.
 */
const collectEndpointGates = (): {
    readonly endpoints: readonly EndpointGates[];
    readonly mountedKeysOf: (subApp: RouteSubApp) => readonly string[];
} => {
    validateApiEnv();
    const app = initApp();
    const routes = app.routes as unknown as readonly MountedRoute[];
    // TYPE-WORKAROUND: Hono exposes the router on the app instance but not in its public type.
    const router = (app as unknown as { router: { match: (m: string, p: string) => MatchResult } })
        .router;

    const lastIndexByKey = new Map<string, number>();
    routes.forEach((route, index) => {
        if (route.method !== 'ALL') lastIndexByKey.set(`${route.method} ${route.path}`, index);
    });
    const terminals = new Set<MountedRoute>(
        [...lastIndexByKey.values()].map((index) => routes[index] as MountedRoute)
    );
    const methodsByPath = new Map<string, Set<string>>();
    for (const route of terminals) {
        const methods = methodsByPath.get(route.path) ?? new Set<string>();
        methods.add(route.method);
        methodsByPath.set(route.path, methods);
    }
    /**
     * A method-agnostic gate registered at a wildcard (`/prefix/*`) or at a
     * path that only one method serves is a deliberate router-level gate. One
     * registered at an exact path that several methods serve is the HOS-1908
     * shape: every sibling method runs it.
     */
    const isRouterLevel = (route: MountedRoute): boolean =>
        route.path.includes('*') || (methodsByPath.get(route.path)?.size ?? 0) <= 1;

    /** Every `(method, path)` the app serves through `subApp`'s handler. */
    const mountedKeysOf = (subApp: RouteSubApp): readonly string[] => {
        const handler = subApp.routes.filter((route) => route.method !== 'ALL').at(-1)?.handler;
        return [...terminals]
            .filter((route) => handler !== undefined && unwrapHandler(route.handler) === handler)
            .map((route) => `${route.method} ${route.path}`);
    };

    const endpoints = [...lastIndexByKey.keys()].map((key) => {
        const [method = '', path = ''] = key.split(' ');
        const concrete = path
            .replace(/:[A-Za-z0-9_]+(\{[^}]*\})?/g, SAMPLE_PARAM)
            .replace(/\*/g, 'x');
        const [matched] = router.match(method, concrete);
        const own: RouteGateDescriptor[] = [];
        const routerLevel: RouteGateDescriptor[] = [];
        const foreign: string[] = [];
        let servedBy: string | null = null;

        for (const [[handler, route]] of matched) {
            if (terminals.has(route)) {
                servedBy = `${route.method} ${route.path}`;
                break;
            }
            const gate = readRouteGateDescriptor({ handler: unwrapHandler(handler) });
            if (!gate) continue;
            if (route.method === 'ALL') {
                if (isRouterLevel(route)) routerLevel.push(gate);
                else foreign.push(`ALL ${route.path}`);
            } else if (route.method === method && route.path === path) own.push(gate);
            else foreign.push(`${route.method} ${route.path}`);
        }

        return { key, method, path, own, routerLevel, foreign, servedBy };
    });

    return { endpoints, mountedKeysOf };
};

const declaresPermission = (gate: RouteGateDescriptor): boolean =>
    gate.requiredPermissions.length > 0 ||
    gate.anyOfPermissions.length > 0 ||
    gate.listingAccessOperation !== undefined;

const isScoped = (path: string): boolean =>
    path.startsWith('/api/v1/protected/') || path.startsWith('/api/v1/admin/');

describe('HOS-1908 static guard — every route declares its own gate', () => {
    let endpoints: readonly EndpointGates[] = [];
    let noOwnGateKeys: readonly string[] = [];
    let baselineOnlyKeys: readonly string[] = [];

    beforeAll(() => {
        const collected = collectEndpointGates();
        endpoints = collected.endpoints;
        const resolve = (subApps: readonly RouteSubApp[]): readonly string[] =>
            subApps.flatMap((subApp) => {
                const keys = collected.mountedKeysOf(subApp);
                // A route object that resolves to nothing would silently drop
                // its exception; fail loudly instead.
                if (keys.length === 0) throw new Error('allowlisted route is not mounted');
                return keys;
            });
        noOwnGateKeys = [
            ...Object.keys(NO_OWN_GATE_ALLOWLIST),
            ...resolve(VENUE_NO_OWN_GATE_ROUTES)
        ];
        baselineOnlyKeys = [
            ...BASELINE_ONLY_ADMIN_ALLOWLIST,
            ...resolve(VENUE_BASELINE_ONLY_ADMIN_ROUTES)
        ];
    });

    it('reads real gates from the mounted app (not vacuous)', () => {
        const withOwnGate = endpoints.filter((endpoint) => endpoint.own.length > 0);
        expect(endpoints.length).toBeGreaterThan(500);
        expect(withOwnGate.length).toBeGreaterThan(500);

        const patch = endpoints.find((e) => e.key === 'PATCH /api/v1/admin/attractions/:id');
        expect(patch?.servedBy).toBe('PATCH /api/v1/admin/attractions/:id');
        expect(patch?.own).toEqual([
            {
                level: 'admin',
                requiredPermissions: ['attraction.update'],
                anyOfPermissions: []
            }
        ]);
    });

    it('every endpoint is answered by its own handler', () => {
        const misrouted = endpoints
            .filter((e) => e.servedBy !== e.key)
            .map((e) => `${e.key} -> ${e.servedBy ?? 'nothing'}`);
        expect(misrouted).toEqual([]);
    });

    it("no route runs a gate declared by another route's method or path", () => {
        const leaks = endpoints
            .filter((e) => e.foreign.length > 0)
            .map((e) => `${e.key} <= ${e.foreign.join(', ')}`);
        expect(leaks, leaks.join('\n')).toEqual([]);
    });

    it('every protected/admin route authenticates through its own (or a router-level) gate', () => {
        const offenders = endpoints
            .filter((e) => isScoped(e.path))
            .filter((e) => ![...e.own, ...e.routerLevel].some((gate) => gate.level !== 'public'))
            .map((e) => e.key)
            .sort();
        expect(offenders).toEqual([...noOwnGateKeys].sort());
    });

    it('every admin route with a gate is admin-tier and declares a permission', () => {
        const adminEndpoints = endpoints.filter(
            (e) => e.path.startsWith('/api/v1/admin/') && !noOwnGateKeys.includes(e.key)
        );

        const notAdminTier = adminEndpoints
            .filter((e) => ![...e.own, ...e.routerLevel].some((gate) => gate.level === 'admin'))
            .map((e) => e.key);
        expect(notAdminTier).toEqual([]);

        const baselineOnly = adminEndpoints
            .filter(
                (e) =>
                    ![...e.own, ...e.routerLevel].some(
                        (gate) => gate.level === 'admin' && declaresPermission(gate)
                    )
            )
            .map((e) => e.key)
            .sort();
        expect(baselineOnly).toEqual([...baselineOnlyKeys].sort());
    });
});
