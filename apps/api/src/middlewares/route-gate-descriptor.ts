/**
 * Introspectable description of a route's authorization gate (HOS-1908).
 *
 * The authorization middleware is an opaque closure, so nothing outside it can
 * tell which tier or permissions a mounted route actually declares. That made
 * one class of bug invisible: until HOS-1908 every per-route middleware was
 * registered for ALL methods, so a route that declared nothing could be
 * "protected" by a sibling route that shares its path under another method,
 * and no test would notice when that sibling moved.
 *
 * Attaching the gate's declaration to the middleware function lets a static
 * guard (`test/static-guards/route-own-gate-declaration.guard.test.ts`) read,
 * from the real mounted app, what each route declares on ITS OWN registration.
 * The descriptor is metadata only: it never changes what the middleware does.
 *
 * @module middlewares/route-gate-descriptor
 */

import type { PermissionEnum } from '@repo/schemas';
import type { AuthorizationLevel, ListingAccessConfig } from '../types/authorization';

/** Registry key — `Symbol.for` so a re-imported module reads the same key. */
const ROUTE_GATE_DESCRIPTOR_KEY = Symbol.for('hospeda.api.routeGateDescriptor');

/**
 * What an authorization gate declares.
 */
export interface RouteGateDescriptor {
    /** Tier the gate enforces. */
    readonly level: AuthorizationLevel;
    /** AND-list of permissions the gate requires. */
    readonly requiredPermissions: readonly PermissionEnum[];
    /** OR-groups of permissions the gate requires (each group ANDed). */
    readonly anyOfPermissions: readonly (readonly PermissionEnum[])[];
    /**
     * Listing-access operation the route resolves in its handler wrapper,
     * when it declares `listingAccess`. That resolver is the route's
     * permission decision for foreign listings (administrative action 15),
     * so it counts as a declared permission even when the gate itself only
     * enforces the tier.
     */
    readonly listingAccessOperation?: ListingAccessConfig['operation'];
}

/**
 * Attaches (or replaces) the gate descriptor on a middleware function.
 *
 * @param input.handler - The middleware function to describe.
 * @param input.descriptor - What the gate declares.
 * @returns The same function, for chaining.
 */
export const describeRouteGate = <T extends object>({
    handler,
    descriptor
}: {
    readonly handler: T;
    readonly descriptor: RouteGateDescriptor;
}): T => {
    Object.defineProperty(handler, ROUTE_GATE_DESCRIPTOR_KEY, {
        value: Object.freeze({ ...descriptor }),
        enumerable: false,
        configurable: true,
        writable: false
    });
    return handler;
};

/**
 * Reads the gate descriptor from a middleware function.
 *
 * @param input.handler - Any registered handler.
 * @returns The descriptor, or `undefined` when the handler is not a described gate.
 */
export const readRouteGateDescriptor = ({
    handler
}: {
    readonly handler: unknown;
}): RouteGateDescriptor | undefined => {
    if (typeof handler !== 'function') return undefined;
    const value: unknown = Reflect.get(handler, ROUTE_GATE_DESCRIPTOR_KEY);
    return value === undefined ? undefined : (value as RouteGateDescriptor);
};

/**
 * Records on a gate that its route also resolves listing access.
 *
 * @param input.gate - The route's authorization middleware (already described).
 * @param input.listingAccess - The route's listing-access declaration, if any.
 * @returns The same gate.
 */
export const describeListingAccessOnGate = <T extends object>({
    gate,
    listingAccess
}: {
    readonly gate: T;
    readonly listingAccess: ListingAccessConfig | undefined;
}): T => {
    const current = readRouteGateDescriptor({ handler: gate });
    if (!listingAccess || !current) return gate;
    return describeRouteGate({
        handler: gate,
        descriptor: { ...current, listingAccessOperation: listingAccess.operation }
    });
};
