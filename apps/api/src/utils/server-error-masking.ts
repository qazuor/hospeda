/**
 * Single rule for what a client may read on a server-fault (5xx) response
 * (HOS-2296).
 *
 * The API has two error formatters: `handleRouteError` (route-factory catch,
 * `utils/response-helpers.ts`) and `createErrorHandler` (global `onError`,
 * `middlewares/response.ts`). Each computes its own HTTP status from its own
 * table (HOS-748), so the rule is deliberately keyed on the COMPUTED status,
 * never on a list of error codes: whatever ends up >= 500 is masked, and a
 * code added to either table later is covered without touching this file.
 *
 * The real message is never lost: both formatters log the original error
 * before responding.
 */

/**
 * Generic client-facing text for a masked 5xx.
 *
 * Same string `handleRouteError` already used as its last-resort fallback.
 */
export const GENERIC_SERVER_ERROR_MESSAGE = 'An unexpected error occurred';

/** The client-visible part of an error payload. */
export interface MaskableErrorPayload {
    readonly message: string;
    readonly details?: unknown;
    readonly reason?: string;
}

/**
 * Whether an HTTP status is a server fault whose payload must not be echoed.
 *
 * @param params - Receive object
 * @param params.statusCode - The HTTP status the formatter computed
 * @returns `true` for any status >= 500
 */
export const isServerErrorStatus = ({ statusCode }: { readonly statusCode: number }): boolean =>
    statusCode >= 500;

/**
 * Returns the payload a client may see for `statusCode`.
 *
 * - below 500: returned untouched (4xx messages are written for the caller,
 *   and `details` is part of the public contract for some codes, HOS-700);
 * - 500 and above: `message` becomes the generic text and `details`/`reason`
 *   are dropped, because they name internal failure modes (SQL, hosts, config
 *   keys). `code` is not part of the payload here, so the caller keeps it;
 * - `debugErrors` (`HOSPEDA_API_DEBUG_ERRORS`, refused in production by the env
 *   schema) lifts the masking.
 *
 * @param params - Receive object
 * @param params.statusCode - The HTTP status the formatter computed
 * @param params.payload - The message, details and reason the error carries
 * @param params.debugErrors - Whether verbose errors are enabled
 * @param params.genericMessage - Replacement text, defaults to {@link GENERIC_SERVER_ERROR_MESSAGE}
 * @returns The payload to serialize
 */
export const maskServerErrorPayload = ({
    statusCode,
    payload,
    debugErrors,
    genericMessage = GENERIC_SERVER_ERROR_MESSAGE
}: {
    readonly statusCode: number;
    readonly payload: MaskableErrorPayload;
    readonly debugErrors: boolean | undefined;
    readonly genericMessage?: string;
}): MaskableErrorPayload => {
    if (debugErrors || !isServerErrorStatus({ statusCode })) {
        return payload;
    }
    return { message: genericMessage };
};
