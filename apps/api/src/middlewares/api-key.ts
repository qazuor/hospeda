/**
 * @file api-key.ts
 *
 * Inbound API-key authentication middleware for machine callers
 * (Custom GPT via x-hospeda-ai-key, Make.com via x-hospeda-make-key).
 *
 * Security design
 * ---------------
 * - Both sides of the comparison are hashed with createHmac(sha256, fixed-salt)
 *   before calling timingSafeEqual. This ensures equal-length digests and
 *   eliminates the length side-channel (a raw string comparison leaks length
 *   even under timingSafeEqual because Buffer.byteLength differs).
 * - Fail-closed: if the expected key is absent/empty (env not configured)
 *   the middleware returns 401 and logs a warning. It never grants access
 *   when the key is unconfigured.
 * - On success a synthetic SYSTEM-role actor is injected into context so
 *   downstream handlers that call getActorFromContext(c) do not crash.
 *   The synthetic actor has _isSystemActor=false so authorization middleware
 *   does NOT reject it at the HTTP level (the authorization middleware guards
 *   against _isSystemActor=true).
 *
 * @module api-key-middleware
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { apiLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Fixed HMAC salt used when hashing both sides of the comparison.
 * This is NOT a secret — its only purpose is to produce fixed-length
 * SHA-256 digests from arbitrary-length strings so timingSafeEqual never
 * sees buffers of different lengths (which would panic in older Node versions
 * and still leaks via the thrown error).
 */
const HASH_SALT = '__hospeda_apikey_hash__';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Identity shape for the synthetic actor injected on successful auth.
 * Mirrors the Actor interface but requires only the stable machine-identity
 * fields (id + display label). The role is always RoleEnum.SYSTEM.
 */
export interface ApiKeyActorIdentity {
    /**
     * Stable machine identifier, e.g. 'gpt-action' or 'make-integration'.
     * Used as Actor.id and must be a non-empty string (not a UUID — machine
     * actors are never in the users table).
     */
    readonly id: string;
    /** Human-readable label for logs. Used as Actor.name. */
    readonly name: string;
}

/**
 * Configuration object for apiKeyMiddleware.
 */
export interface ApiKeyMiddlewareConfig {
    /**
     * HTTP header name to read the caller's key from.
     * e.g. 'x-hospeda-ai-key' or 'x-hospeda-make-key'.
     */
    readonly headerName: string;
    /**
     * Callable that returns the expected key (from env).
     * Called on every request so env changes are reflected without restart.
     * Returns undefined/empty when the env var is not configured.
     */
    readonly getExpectedKey: () => string | undefined;
    /** Synthetic actor to inject into context on successful authentication. */
    readonly actor: ApiKeyActorIdentity;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hash a string into a fixed-length Buffer using HMAC-SHA256 with a fixed
 * internal salt. The result is always 32 bytes regardless of input length,
 * making it safe for timingSafeEqual comparisons.
 *
 * @param value - Raw string to hash
 * @returns 32-byte Buffer
 */
function hashKey(value: string): Buffer {
    return createHmac('sha256', HASH_SALT).update(value).digest();
}

/**
 * Constant-time comparison of two raw API key strings.
 * Hashes both inputs first to prevent length side-channel leaks.
 *
 * @param input - Key received from the caller
 * @param expected - Key from server configuration
 * @returns true when the keys match
 */
export function compareApiKeys(input: { provided: string; expected: string }): boolean {
    const a = hashKey(input.provided);
    const b = hashKey(input.expected);
    // Lengths are always equal (both are SHA-256 digests), but guard defensively.
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Standard error envelope
// ---------------------------------------------------------------------------

/**
 * Standard error envelope used by all API routes.
 * @see ResponseFactory in route handlers
 */
function buildUnauthorizedResponse(message: string): {
    success: false;
    error: { code: string; message: string };
} {
    return {
        success: false,
        error: {
            code: 'UNAUTHORIZED',
            message
        }
    };
}

// ---------------------------------------------------------------------------
// Synthetic actor factory
// ---------------------------------------------------------------------------

/**
 * Creates a synthetic Actor for a machine caller.
 * - role: RoleEnum.SYSTEM (reserved non-loginable machine identity)
 * - permissions: empty — these routes must NOT go through permission middleware.
 *   Route handlers themselves enforce what is allowed per endpoint.
 * - _isSystemActor: intentionally FALSE. The authorization middleware rejects
 *   _isSystemActor=true at the HTTP level (it is reserved for internal service
 *   calls). Machine-caller actors are external HTTP clients, not internal actors.
 */
function buildMachineActor(identity: ApiKeyActorIdentity): Actor {
    return {
        id: identity.id,
        name: identity.name,
        role: RoleEnum.SYSTEM,
        permissions: [],
        _isSystemActor: false
    };
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Creates a Hono middleware that authenticates inbound machine callers
 * using a static API key sent in a request header.
 *
 * On valid key:
 *   - Sets `actor` on context so downstream code (logging, handlers) does not
 *     crash when calling getActorFromContext(c).
 *   - Calls next() to continue the chain.
 *
 * On invalid/missing key or unconfigured env:
 *   - Returns 401 with the standard error envelope.
 *   - Logs a WARN (mismatch/missing) or a clear warning (env not configured).
 *   - Does NOT call next().
 *
 * @param config - Header name, expected-key getter, and actor identity
 * @returns Hono MiddlewareHandler
 *
 * @example
 * ```typescript
 * const gptAuthMiddleware = apiKeyMiddleware({
 *   headerName: 'x-hospeda-ai-key',
 *   getExpectedKey: () => env.HOSPEDA_AI_SOCIAL_KEY,
 *   actor: { id: 'gpt-action', name: 'Custom GPT Social Action' },
 * });
 * ```
 */
export const apiKeyMiddleware = (config: ApiKeyMiddlewareConfig): MiddlewareHandler => {
    return async (c, next) => {
        const expectedKey = config.getExpectedKey();

        // Fail-closed: env var not configured
        if (!expectedKey || expectedKey.trim() === '') {
            apiLogger.warn(
                {
                    header: config.headerName,
                    actorId: config.actor.id,
                    reason: 'API_KEY_ENV_NOT_CONFIGURED'
                },
                `API key middleware: expected key is not configured for actor '${config.actor.id}'. Set the corresponding env var. Rejecting request.`
            );
            return c.json(
                buildUnauthorizedResponse('API key authentication is not configured'),
                401
            );
        }

        const providedKey = c.req.header(config.headerName);

        // Missing header
        if (!providedKey) {
            apiLogger.warn(
                {
                    header: config.headerName,
                    actorId: config.actor.id,
                    ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
                    reason: 'API_KEY_MISSING'
                },
                `API key middleware: missing '${config.headerName}' header`
            );
            return c.json(buildUnauthorizedResponse('Missing API key'), 401);
        }

        // Constant-time comparison
        const isValid = compareApiKeys({ provided: providedKey, expected: expectedKey });

        if (!isValid) {
            apiLogger.warn(
                {
                    header: config.headerName,
                    actorId: config.actor.id,
                    ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
                    reason: 'API_KEY_MISMATCH'
                },
                `API key middleware: key mismatch for header '${config.headerName}'`
            );
            return c.json(buildUnauthorizedResponse('Invalid API key'), 401);
        }

        // Success — inject synthetic actor and continue
        c.set('actor', buildMachineActor(config.actor));
        await next();
    };
};
