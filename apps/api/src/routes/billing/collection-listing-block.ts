/**
 * Collection-listing block for the protected billing tier (H-66 / HOS-446).
 *
 * WHY THIS EXISTS
 * ---------------
 * `@qazuor/qzpay-hono` ships a complete billing CRUD and Hospeda mounts it
 * wholesale under `/api/v1/protected/billing`. Its list handlers are written for
 * a trusted consumer: they return every row and treat `customerId` as an
 * OPTIONAL filter the caller may supply, never as an imposed limit. The two
 * guards in front of them each deferred to the other — the admin guard lets
 * every GET through "filtered by ownership middleware", and the ownership
 * middleware passes through whenever the path names no resource — so the
 * effective boundary became "does the path carry an id?" rather than "is this
 * mine?". Any authenticated user could list every customer's name and email.
 *
 * The defect is in the MOUNT, not in a handler: patching the five endpoints we
 * found would leave the next collection endpoint qzpay adds equally open. So
 * this module derives what to block FROM the library's own route table at boot.
 * A new bare-collection GET upstream is blocked the moment it exists, with no
 * code change here.
 *
 * WHY 404 AND NOT 403
 * -------------------
 * 403 would answer "this listing exists and you may not have it"; the truth is
 * that the listing is not part of the user-facing tier at all. Admin listings
 * live under `/api/v1/admin/billing`, behind their own permission gate. The
 * answer is deliberately identical for every actor — nothing about the caller
 * can be inferred from it. (The separate question of 403-vs-404 for a FOREIGN
 * resource that does exist is a repo-wide criterion still pending in H-72; this
 * module does not settle it and does not touch the `:id` routes that raise it.)
 *
 * @module routes/billing/collection-listing-block
 */

import type { Context } from 'hono';
import type { AppOpenAPI } from '../../types';
import { createRouter } from '../../utils/create-app';

/**
 * A route as registered on a Hono app instance (`app.routes`).
 * Declared structurally so this module does not depend on Hono internals.
 */
interface RegisteredRoute {
    readonly method: string;
    readonly path: string;
}

/**
 * Collection segments that are legitimately served at the protected tier and
 * must therefore NOT be blocked.
 *
 * - `plans` is catalog data, not customer data. Hospeda already overrides
 *   `GET /plans` with `protectedPlansListRouter`, which filters out hidden test
 *   plans; blocking the segment here would shadow that override.
 *
 * Every entry needs a reason: an exemption is the one way a listing gets back
 * onto the user tier.
 */
export const TIER_EXEMPT_COLLECTIONS: ReadonlySet<string> = new Set(['plans']);

/**
 * Collections known to be exposed by qzpay and confirmed to serve customer data.
 *
 * Discovery from the live route table is the primary mechanism; this baseline is
 * the floor that survives it. If `createBillingRoutes` ever fails to build (the
 * factory returns an empty router on error) discovery yields nothing, and
 * without a floor the block would silently disappear along with the routes it
 * guards. `collection-listing-deny-by-default.test.ts` asserts every entry here
 * is still a real qzpay collection, so the constant cannot rot into a lie.
 */
export const BASELINE_BLOCKED_COLLECTIONS: ReadonlySet<string> = new Set([
    'customers',
    'subscriptions',
    'invoices',
    'payments',
    'promo-codes'
]);

/**
 * Resource lookups that are not listings, yet expose the same catalog data a
 * blocked listing would — reachable by guessing the key instead of by paging.
 *
 * `GET /promo-codes/:code` hands the full promo-code row to any authenticated
 * caller who guesses the name, and coupon names are guessable by construction
 * (`LANZAMIENTO50`, `BIENVENIDO30`, `FREEMONTH` all resolved on the first try in
 * local verification). Blocking the listing while leaving this open would move
 * the catalog behind a guess, not behind a gate.
 *
 * The legitimate user-facing path is untouched: Hospeda's own
 * `POST /promo-codes/validate` (`userPromoCodesRouter`, mounted earlier) answers
 * "is the code I typed valid, and what would it do", returning the sanitized
 * `effectPreview` shape rather than the raw row. Admin promo-code reads live
 * under `/api/v1/admin/billing/promo-codes`. No repo consumer calls this route.
 */
const BLOCKED_RESOURCE_LOOKUPS: readonly string[] = ['/promo-codes/:code'];

/**
 * Reads the route table off a Hono app instance.
 *
 * @param app - The router to inspect
 * @returns Its registered routes, or an empty list when unavailable
 */
function readRegisteredRoutes(app: AppOpenAPI): readonly RegisteredRoute[] {
    // TYPE-WORKAROUND: Hono exposes its route table as `app.routes`, but AppOpenAPI's public type does not surface it; the structural cast reads that table without depending on Hono internals.
    const routes = (app as unknown as { routes?: readonly RegisteredRoute[] }).routes;
    return Array.isArray(routes) ? routes : [];
}

/**
 * Finds the bare-collection GET segments in a route table.
 *
 * A bare collection is a GET whose path is a single literal segment — `/customers`,
 * `/payments` — i.e. it names a resource type with no instance and no sub-resource.
 * That shape is exactly the one qzpay serves unscoped. Anything carrying an id
 * (`/customers/:id`) is already covered by `billingOwnershipMiddleware`.
 *
 * Parameter and wildcard segments are ignored: `/:id` is not a collection.
 *
 * @param routes - Route table to scan
 * @returns Sorted, de-duplicated collection segments
 */
export function findCollectionListingSegments(
    routes: readonly RegisteredRoute[]
): readonly string[] {
    const segments = new Set<string>();

    for (const route of routes) {
        if (route.method.toUpperCase() !== 'GET') {
            continue;
        }

        const parts = route.path.split('/').filter(Boolean);

        if (parts.length !== 1) {
            continue;
        }

        const segment = parts[0];

        if (!segment || segment.startsWith(':') || segment.includes('*')) {
            continue;
        }

        segments.add(segment);
    }

    return [...segments].sort();
}

/**
 * Resolves the final set of collection segments to block.
 *
 * @param qzpayRoutes - The mounted qzpay router, scanned for collection listings
 * @returns Sorted segments to block at the protected tier
 */
export function resolveBlockedCollections(qzpayRoutes: AppOpenAPI): readonly string[] {
    const discovered = findCollectionListingSegments(readRegisteredRoutes(qzpayRoutes));

    return [...new Set([...discovered, ...BASELINE_BLOCKED_COLLECTIONS])]
        .filter((segment) => !TIER_EXEMPT_COLLECTIONS.has(segment))
        .sort();
}

/**
 * Builds a router that answers 404 for every qzpay collection listing.
 *
 * MUST be mounted BEFORE the qzpay wrapper: Hono resolves by first match, which
 * is the same ordering rule the `protected-plans-list`, `promo-codes`,
 * `downgrade-preview` and `subscription-cancel` overrides already rely on. Only
 * exact collection paths are registered — no wildcard middleware — so sibling
 * routers mounted on the same prefix (`/usage`, `/addons`, `/trial`) are
 * untouched.
 *
 * @param qzpayRoutes - The qzpay router whose surface defines what to block
 * @returns Router registering a 404 handler per blocked collection
 *
 * @example
 * ```typescript
 * const qzpayRoutes = createQZPayBillingRouter();
 * router.route('/', createCollectionListingBlocker(qzpayRoutes));
 * // ... qzpay wrapper mounted after
 * ```
 */
export function createCollectionListingBlocker(qzpayRoutes: AppOpenAPI): AppOpenAPI {
    const router = createRouter();

    const blockedPaths = [
        ...resolveBlockedCollections(qzpayRoutes).map((segment) => `/${segment}`),
        ...BLOCKED_RESOURCE_LOOKUPS
    ];

    for (const path of blockedPaths) {
        router.get(path, (c: Context) =>
            c.json(
                {
                    error: 'NOT_FOUND',
                    message: 'This billing listing is not available on the user API'
                },
                404
            )
        );
    }

    return router;
}
