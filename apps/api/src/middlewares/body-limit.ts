/**
 * @file body-limit.ts
 * @description Request body size guard, with a wider ceiling on upload routes.
 *
 * A single global cap cannot serve both purposes. Most endpoints carry JSON and
 * should be capped tightly — that cap is what protects auth, search, PATCH and
 * webhook handlers from oversized payloads. Upload endpoints legitimately carry
 * a photo, and since HOS-322 that photo may be up to
 * `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` (15 MB by default), well above the global
 * cap.
 *
 * Raising the global cap to fit the photo would widen the exposed surface of
 * every other endpoint to enable exactly three routes — a bad trade. So the
 * ceiling is resolved per request path: the three upload routes get their own,
 * derived from the same env vars the upload handlers validate against, and
 * everything else keeps the tight global cap.
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

/**
 * Slack added on top of a file cap when it is used as a BODY cap.
 *
 * The body of a multipart upload is the file plus the envelope: boundaries,
 * per-part headers, filename, and the other form fields (`entityType`,
 * `entityId`, `role`, `tags`...). Without this slack, a file exactly at the
 * cap would be rejected by the stream guard, whose error is blunt and generic.
 * The slack keeps the precise, per-file check in the handler as the thing that
 * actually rejects an oversized photo, leaving this guard as a backstop
 * against payloads that are not merely a little over.
 */
const MULTIPART_ENVELOPE_SLACK_BYTES = 16 * 1024;

/** Upload route that carries an entity photo, capped by the media limit. */
const ENTITY_UPLOAD_PATHS = new Set([
    '/api/v1/protected/media/upload-entity',
    '/api/v1/admin/media/upload'
]);

/** Upload route that carries an avatar, capped by the (lower) avatar limit. */
const AVATAR_UPLOAD_PATHS = new Set(['/api/v1/protected/media/upload']);

/**
 * Resolve the body ceiling, in MB, that applies to a request path.
 *
 * @param path - The request path
 * @returns The ceiling in MB, before multipart slack is added
 */
const resolveLimitMb = (path: string): number => {
    // `env` is populated by `validateApiEnv()` at startup, which always runs
    // before a request arrives. The fallbacks are the canonical constants, so
    // a caller that somehow beats startup still gets the documented cap rather
    // than a NaN ceiling that would reject every upload.
    if (ENTITY_UPLOAD_PATHS.has(path)) {
        return env?.HOSPEDA_MEDIA_MAX_FILE_SIZE_MB ?? DEFAULT_ENTITY_MAX_FILE_SIZE_MB;
    }
    if (AVATAR_UPLOAD_PATHS.has(path)) {
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

const getLimiter = (limitMb: number, isUpload: boolean): MiddlewareHandler => {
    // Keyed by BOTH inputs: an upload ceiling that happens to equal the global
    // one still needs the multipart slack and the upload-specific error.
    const key = `${limitMb}:${isUpload}`;
    const cached = limiters.get(key);
    if (cached) {
        return cached;
    }

    const maxSize = mbToBytes(limitMb) + (isUpload ? MULTIPART_ENVELOPE_SLACK_BYTES : 0);
    const limiter = bodyLimit({
        maxSize,
        onError: (c) =>
            c.json(
                {
                    success: false,
                    error: isUpload
                        ? {
                              // Same code and wording the upload handlers use for
                              // their own size rejection, so the owner sees one
                              // consistent message stating the real limit no
                              // matter which guard fires first.
                              code: 'PAYLOAD_TOO_LARGE',
                              message: `File exceeds the ${limitMb}MB limit`
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
        const path = normalisePath(c.req.path);
        const isUpload = ENTITY_UPLOAD_PATHS.has(path) || AVATAR_UPLOAD_PATHS.has(path);
        return getLimiter(resolveLimitMb(path), isUpload)(c, next);
    };
};

/** Exported for tests and documentation. */
export const BODY_LIMIT_CONSTANTS = {
    GLOBAL_BODY_LIMIT_MB,
    MULTIPART_ENVELOPE_SLACK_BYTES
} as const;
