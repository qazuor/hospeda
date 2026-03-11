/**
 * Generic audit middleware for Hono.
 *
 * Automatically logs all state-changing HTTP requests (POST, PUT, PATCH, DELETE)
 * as structured audit events. Read-only methods (GET, HEAD, OPTIONS) are skipped.
 *
 * The middleware runs *after* the route handler so the response status code is
 * available. The request body is cloned before `next()` because Hono consumes
 * the body stream during handler execution.
 *
 * @module audit-middleware
 */

import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { isGuestActor } from '../utils/actor';
import { AuditEventType, auditLog } from '../utils/audit-logger';

/** HTTP methods that represent state-changing operations. */
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Configuration for the audit middleware.
 */
export interface AuditMiddlewareConfig {
    /**
     * Route paths to exclude from audit logging.
     * Exact path matching only (no glob patterns).
     *
     * @example
     * ```ts
     * excludePaths: ['/api/v1/health', '/api/v1/metrics']
     * ```
     */
    readonly excludePaths?: readonly string[];
}

/**
 * Extract a safe actor identity from the Hono context.
 * Falls back to anonymous/guest values when no actor is present.
 */
function resolveActorIdentity(actor: Actor | undefined): {
    actorId: string;
    actorRole: string;
} {
    if (!actor || isGuestActor(actor)) {
        return { actorId: 'anonymous', actorRole: 'guest' };
    }
    return { actorId: actor.id, actorRole: actor.role };
}

/**
 * Attempt to parse the raw request body text as JSON.
 * Returns `undefined` on parse failure or empty input so callers can
 * treat missing bodies uniformly.
 *
 * @param text - Raw UTF-8 body text from the cloned request.
 * @returns Parsed JSON value, or `undefined`.
 */
function parseBodySafely(text: string): unknown | undefined {
    if (!text || text.trim() === '') {
        return undefined;
    }
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return undefined;
    }
}

/**
 * Creates a Hono middleware that writes a `ROUTE_MUTATION` audit log entry
 * for every POST, PUT, PATCH, and DELETE request.
 *
 * Usage:
 * ```ts
 * app.use('/api/v1/admin/*', auditMiddleware());
 * app.use('/api/v1/protected/*', auditMiddleware({ excludePaths: ['/api/v1/protected/ping'] }));
 * ```
 *
 * The middleware is intentionally non-blocking: audit failures are caught
 * internally by `auditLog()` and never propagate to the caller.
 *
 * @param config - Optional configuration (excluded paths, etc.)
 * @returns Hono MiddlewareHandler
 */
export const auditMiddleware = (config: AuditMiddlewareConfig = {}): MiddlewareHandler => {
    const { excludePaths = [] } = config;
    const excludeSet = new Set(excludePaths);

    return async (c, next) => {
        const method = c.req.method.toUpperCase();

        // Skip read-only requests immediately
        if (!MUTATION_METHODS.has(method)) {
            await next();
            return;
        }

        // Skip explicitly excluded paths
        const path = c.req.path;
        if (excludeSet.has(path)) {
            await next();
            return;
        }

        // Clone the request body before calling next() because the stream
        // is consumed during handler execution and cannot be re-read.
        let rawBody: string | undefined;
        const contentType = c.req.header('content-type') ?? '';
        if (contentType.includes('application/json')) {
            try {
                const cloned = c.req.raw.clone();
                rawBody = await cloned.text();
            } catch {
                // Body clone failed; proceed without body capture
            }
        }

        await next();

        // Actor is available only after actorMiddleware has run
        const actor = c.get('actor') as Actor | undefined;
        const { actorId, actorRole } = resolveActorIdentity(actor);
        const statusCode = c.res.status;
        const requestBody = parseBodySafely(rawBody ?? '');

        auditLog({
            auditEvent: AuditEventType.ROUTE_MUTATION,
            actorId,
            actorRole,
            method,
            path,
            statusCode,
            ...(requestBody !== undefined ? { requestBody } : {})
        });
    };
};
