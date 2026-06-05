/**
 * Maps AI engine errors to HTTP status codes and machine-readable codes.
 *
 * This module is intentionally decoupled from the route layer so it can be
 * reused by any future transport (WebSocket, gRPC, etc.) without pulling in
 * Hono.
 *
 * @module apps/api/utils/ai-error-mapper
 */

import { AiEngineError } from '@repo/ai-core';

/**
 * The result of a successful mapping: the HTTP status and a stable code string
 * that the client can branch on.
 */
export interface AiErrorMapping {
    /** HTTP status code to use in the response. */
    readonly status: number;
    /**
     * Machine-readable code to include in the response body.
     * Matches the `engineCode` of the originating error.
     */
    readonly code: string;
}

/**
 * Maps an AI engine error to an HTTP status code and a stable code string.
 *
 * **Mapping table (owner-approved 2026-06-05):**
 *
 * | engineCode              | HTTP status | Reason                                      |
 * |-------------------------|-------------|---------------------------------------------|
 * | `MODERATION_BLOCKED`    | 422         | Input/output violates content policy        |
 * | `FEATURE_DISABLED`      | 503         | Kill-switch active — feature unavailable    |
 * | `CEILING_HIT`           | 503         | Monthly cost ceiling reached                |
 * | `ENGINE_EXHAUSTED`      | 502         | All providers failed — upstream gateway err |
 * | `NO_ENABLED_PROVIDER`   | 503         | Every provider disabled — service down      |
 * | any other AiEngineError | 500         | Unexpected engine-level failure             |
 *
 * Returns `undefined` for errors that are not `AiEngineError` instances so the
 * caller can fall back to the generic `handleRouteError` path.
 *
 * @param error - Any thrown value; only `AiEngineError` instances are mapped.
 * @returns The HTTP status + code pair, or `undefined` if not an AI error.
 */
export const mapAiEngineErrorToHttpStatus = (error: unknown): AiErrorMapping | undefined => {
    if (!(error instanceof AiEngineError)) {
        return undefined;
    }

    switch (error.engineCode) {
        case 'MODERATION_BLOCKED':
            return { status: 422, code: 'MODERATION_BLOCKED' };
        case 'FEATURE_DISABLED':
            return { status: 503, code: 'FEATURE_DISABLED' };
        case 'CEILING_HIT':
            return { status: 503, code: 'CEILING_HIT' };
        case 'ENGINE_EXHAUSTED':
            return { status: 502, code: 'ENGINE_EXHAUSTED' };
        case 'NO_ENABLED_PROVIDER':
            return { status: 503, code: 'NO_ENABLED_PROVIDER' };
        default:
            return { status: 500, code: error.engineCode };
    }
};
