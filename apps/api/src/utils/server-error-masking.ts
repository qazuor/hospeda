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

/** The client-visible part of an error payload that the 5xx rule rewrites. */
export interface MaskableErrorPayload {
    readonly message: string;
    readonly details?: unknown;
}

/**
 * Whether a response must not echo the error's own message and details.
 *
 * True for any status >= 500 unless `debugErrors` (`HOSPEDA_API_DEBUG_ERRORS`,
 * refused in production by the env schema) is on.
 *
 * @param params - Receive object
 * @param params.statusCode - The HTTP status the formatter computed
 * @param params.debugErrors - Whether verbose errors are enabled
 * @returns `true` when the payload has to be masked
 */
export const shouldMaskServerError = ({
    statusCode,
    debugErrors
}: {
    readonly statusCode: number;
    readonly debugErrors: boolean | undefined;
}): boolean => !debugErrors && statusCode >= 500;

/**
 * Returns the message and details a client may see for `statusCode`.
 *
 * - below 500: returned untouched (4xx messages are written for the caller,
 *   and `details` is part of the public contract for some codes, HOS-700);
 * - 500 and above: `message` becomes the generic text and `details` is dropped,
 *   because they name internal failure modes (SQL, hosts, config keys).
 *
 * `code` and `reason` are not part of this payload: `code` is always kept, and
 * `reason` is a machine identifier whose policy differs per formatter (see the
 * callers), so each decides for itself.
 *
 * @param params - Receive object
 * @param params.statusCode - The HTTP status the formatter computed
 * @param params.payload - The message and details the error carries
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
}): MaskableErrorPayload =>
    shouldMaskServerError({ statusCode, debugErrors }) ? { message: genericMessage } : payload;
