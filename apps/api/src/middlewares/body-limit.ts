/**
 * @file body-limit.ts
 * @description Request body size guard, with a wider ceiling on upload routes.
 *
 * The entity cap and the global cap are currently the SAME number (10 MB), so
 * be precise about what resolving the ceiling per path actually buys — the
 * answer is not "uploads may carry more":
 *
 * 1. **16 KB of envelope slack on upload routes.** The global cap measures the
 *    whole request body; the media cap measures the FILE. A photo exactly at
 *    the cap arrives as body = file + boundaries + field parts, which exceeds a
 *    flat 10 MB guard. That guard's error is blunt and generic
 *    (`REQUEST_TOO_LARGE`, no size, no i18n mapping), so the owner was told
 *    nothing useful about a file that was in fact legal. With the slack the
 *    request survives to the handler, where the check on the parsed buffer
 *    decides and names the limit it applied.
 *
 *    This middleware remains the guard that rejects an oversized upload — the
 *    routes' own Content-Length pre-checks share its threshold deliberately, so
 *    that none of them can be tighter than it and reintroduce the false 413.
 * 2. **A LOWER ceiling on avatars (5 MB, not 10).** This is the only place that
 *    can enforce it early: the avatar handler's own pre-check reads
 *    `content-length`, so a chunked request without that header used to stream
 *    up to the full global 10 MB into memory before being refused. Deleting
 *    this branch would quietly double that surface.
 * 3. **A ceiling that tracks the env vars.** Lowering
 *    `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` narrows the body guard too, instead of
 *    leaving a 10 MB hole behind a 3 MB file cap.
 *
 * Raising the global cap instead would widen the exposed surface of every other
 * endpoint — auth, search, PATCH, webhooks — to serve three routes, and would
 * still not give avatars their tighter bound.
 *
 * This MUST live in the global middleware chain rather than in a route's
 * `options.middlewares`: Hono runs `app.use()` middleware before any route-level
 * middleware, so a per-route body limit registered on the upload route would run
 * only after the global guard had already rejected the request.
 *
 * @module middlewares/body-limit
 */
import {
    DEFAULT_AVATAR_MAX_FILE_SIZE_MB,
    DEFAULT_ENTITY_MAX_FILE_SIZE_MB,
    MULTIPART_ENVELOPE_SLACK_BYTES,
    mbToBytes
} from '@repo/media';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { env } from '../utils/env.js';

/**
 * Global body cap in MB, applied to every route that is not an upload route.
 *
 * Matches the long-running Node server's tolerance on the VPS. Deliberately
 * NOT an env var: it is a security boundary for the whole API, and the upload
 * routes — the only ones with a legitimate reason to exceed it — carry their
 * own tunable ceiling below.
 */
const GLOBAL_BODY_LIMIT_MB = 10;

/** Upload route that carries an entity photo, capped by the media limit. */
const ENTITY_UPLOAD_PATHS = new Set([
    '/api/v1/protected/media/upload-entity',
    '/api/v1/admin/media/upload'
]);

/** Upload route that carries an avatar, capped by the (lower) avatar limit. */
const AVATAR_UPLOAD_PATHS = new Set(['/api/v1/protected/media/upload']);

/** Which ceiling a request path falls under. */
type LimitKind = 'entity' | 'avatar' | 'global';

/**
 * Classify a request path.
 *
 * @param path - The normalised request path
 * @returns The kind of ceiling that applies
 */
const resolveKind = (path: string): LimitKind => {
    if (ENTITY_UPLOAD_PATHS.has(path)) {
        return 'entity';
    }
    if (AVATAR_UPLOAD_PATHS.has(path)) {
        return 'avatar';
    }
    return 'global';
};

/**
 * Resolve the ceiling, in MB, for a classified path.
 *
 * `env` is populated by `validateApiEnv()` at startup, which always runs before
 * a request arrives. The fallbacks are the canonical constants, so a caller
 * that somehow beats startup still gets the documented cap rather than a NaN
 * ceiling that would reject every upload.
 *
 * @param kind - The kind of ceiling that applies
 * @returns The ceiling in MB
 */
const resolveLimitMb = (kind: LimitKind): number => {
    if (kind === 'entity') {
        return env?.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB ?? DEFAULT_ENTITY_MAX_FILE_SIZE_MB;
    }
    if (kind === 'avatar') {
        return env?.HOSPEDA_AVATAR_MAX_FILE_SIZE_MB ?? DEFAULT_AVATAR_MAX_FILE_SIZE_MB;
    }
    return GLOBAL_BODY_LIMIT_MB;
};

/**
 * Build (and memoise) a Hono `bodyLimit` for a given ceiling.
 *
 * `bodyLimit` takes a fixed `maxSize`, so one instance is built per distinct
 * ceiling. They are created lazily on first use because `env` is only
 * populated once `validateApiEnv()` has run at startup.
 */
const limiters = new Map<string, MiddlewareHandler>();

const getLimiter = (limitMb: number, kind: LimitKind): MiddlewareHandler => {
    // Keyed by BOTH inputs: an upload ceiling that happens to equal the global
    // one still needs the multipart slack and the upload-specific error.
    const key = `${limitMb}:${kind}`;
    const cached = limiters.get(key);
    if (cached) {
        return cached;
    }

    const isUpload = kind !== 'global';
    const maxSize = mbToBytes(limitMb) + (isUpload ? MULTIPART_ENVELOPE_SLACK_BYTES : 0);
    const limiter = bodyLimit({
        maxSize,
        onError: (c) =>
            c.json(
                {
                    success: false,
                    // Upload routes reuse the code AND the exact wording their
                    // own handler uses for a size rejection, so the owner sees
                    // one consistent message naming the real limit no matter
                    // which of the two guards fires first.
                    error: isUpload
                        ? {
                              code: 'PAYLOAD_TOO_LARGE',
                              message:
                                  kind === 'avatar'
                                      ? `Avatar file exceeds the ${limitMb}MB limit`
                                      : `File exceeds the ${limitMb}MB limit`
                          }
                        : {
                              code: 'REQUEST_TOO_LARGE',
                              message: 'Request body exceeds the maximum allowed size'
                          }
                },
                413
            )
    });

    limiters.set(key, limiter);
    return limiter;
};

/**
 * Normalise a request path for matching: drop a trailing slash so
 * `/upload-entity/` resolves to the same ceiling as `/upload-entity`.
 */
const normalisePath = (path: string): string =>
    path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

/**
 * Body-size middleware that applies the ceiling matching the request path.
 *
 * @returns A Hono middleware enforcing the resolved ceiling
 */
export const bodyLimitMiddleware = (): MiddlewareHandler => {
    return async (c, next) => {
        const kind = resolveKind(normalisePath(c.req.path));
        return getLimiter(resolveLimitMb(kind), kind)(c, next);
    };
};

/**
 * The upload paths this middleware widens the ceiling for.
 *
 * Exported so a guard test can assert every literal still resolves to a
 * registered route: they are copies of paths owned by `routes/index.ts` and the
 * route modules, and a rename there would otherwise silently drop an upload
 * route back to the tight global cap.
 */
export const WIDENED_UPLOAD_PATHS = [...ENTITY_UPLOAD_PATHS, ...AVATAR_UPLOAD_PATHS] as const;
