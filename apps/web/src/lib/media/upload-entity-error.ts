/**
 * @file upload-entity-error.ts
 * @description Typed failure of the `upload-entity` endpoint and its
 * localization (HOS-1218).
 *
 * Kept apart from `upload-entity.ts` (the XHR helper) so a test that mocks the
 * helper module wholesale does not turn these exports into `undefined`.
 */

import { type ApiErrorShape, translateApiError } from '@/lib/api-errors';

/**
 * A failed `upload-entity` call, carrying the machine-readable fields of the
 * API's error payload (HOS-1218).
 *
 * The API builds an English `message` for its log; the screen must not paint
 * it. `code`, `reason` and `details` are what {@link describeUploadEntityError}
 * resolves to a localized sentence. `message` stays English on purpose: it is
 * the log fallback and what non-UI callers (and older tests) read.
 */
export class UploadEntityError extends Error {
    /** Canonical error code (`GALLERY_LIMIT_EXCEEDED`, `NETWORK_ERROR`, ...). */
    readonly code: string | undefined;
    /** Finer-grained reason that wins over `code` in the i18n lookup. */
    readonly reason: string | undefined;
    /** Endpoint details (e.g. `{ limit }`), forwarded as interpolation params. */
    readonly details: unknown;
    /** HTTP status of the failed request, when there was a response. */
    readonly status: number | undefined;

    constructor({
        message,
        code,
        reason,
        details,
        status
    }: {
        readonly message: string;
        readonly code?: string;
        readonly reason?: string;
        readonly details?: unknown;
        readonly status?: number;
    }) {
        super(message);
        this.name = 'UploadEntityError';
        this.code = code;
        this.reason = reason;
        this.details = details;
        this.status = status;
    }
}

/**
 * Translator accepted by {@link describeUploadEntityError}. Narrower than the
 * shared `TranslationFn` on `params` so the editors' own `Translate` aliases
 * (`Record<string, string | number>`) satisfy it without a cast at each site.
 */
export type UploadErrorTranslate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

/** Error payload shape the API sends under `error`. */
export interface UploadErrorBody {
    readonly error?: {
        readonly code?: string;
        readonly reason?: string;
        readonly message?: string;
        readonly details?: unknown;
    };
}

/**
 * Build the typed error for a non-success `upload-entity` response.
 *
 * A response without a usable error body still gets `GENERIC`, so the screen
 * shows the localized generic sentence rather than the English fallback.
 *
 * @param params.body - The parsed JSON body, or `null` when it did not parse.
 * @param params.status - HTTP status of the response.
 * @returns The error to throw.
 */
export function buildUploadEntityError({
    body,
    status
}: {
    readonly body: UploadErrorBody | null | undefined;
    readonly status: number;
}): UploadEntityError {
    const error = body?.error;
    return new UploadEntityError({
        message: error?.message ?? 'Upload failed',
        code: error?.code ?? 'GENERIC',
        reason: error?.reason,
        details: error?.details,
        status
    });
}

/**
 * Resolve an upload failure to text for the screen.
 *
 * A {@link UploadEntityError} is translated from its `code`/`reason` through
 * `common.apiError.*`; an unmapped code degrades to `fallback` (localized by
 * the caller), never to the API's English message. Any other `Error` keeps its
 * own message, as before.
 *
 * @param params.err - The thrown value.
 * @param params.t - Active translator.
 * @param params.fallback - Localized text for an unmapped code or a non-Error.
 * @returns A user-facing string.
 */
export function describeUploadEntityError({
    err,
    t,
    fallback
}: {
    readonly err: unknown;
    readonly t: UploadErrorTranslate;
    readonly fallback: string;
}): string {
    if (err instanceof UploadEntityError) {
        const error: ApiErrorShape = {
            code: err.code,
            reason: err.reason,
            details: err.details,
            status: err.status
        };
        return translateApiError({
            error,
            t: (key, fb, params) => t(key, fb, params as Record<string, string | number>),
            fallback
        });
    }
    return err instanceof Error ? err.message : fallback;
}
