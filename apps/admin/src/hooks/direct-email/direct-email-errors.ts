/**
 * @file direct-email-errors.ts
 * @description Maps API failures of the direct email module (HOS-2685) to
 * friendly i18n keys. The API sends a machine-readable `error.reason` next to
 * `error.code`; `fetchApi` keeps the raw body on `ApiError.body`, so the reason
 * is read from there.
 */

import type { TranslationKey } from '@repo/i18n';
import { isApiError } from '@/lib/errors';

/** Reason code -> i18n key. Reasons not listed fall back to the generic message. */
const REASON_KEYS: Readonly<Record<string, TranslationKey>> = {
    DIRECT_EMAIL_RECIPIENT_SUPPRESSED: 'admin-direct-email.errors.recipientSuppressed',
    DIRECT_EMAIL_SENDER_EMAIL_MISSING: 'admin-direct-email.errors.senderEmailMissing',
    DIRECT_EMAIL_NOT_CONFIGURED: 'admin-direct-email.errors.notConfigured',
    DIRECT_EMAIL_TEST_SEND_FAILED: 'admin-direct-email.errors.testSendFailed',
    DIRECT_EMAIL_TEMPLATE_NOT_FOUND: 'admin-direct-email.errors.templateNotFound',
    DIRECT_EMAIL_PERMISSION_DENIED: 'admin-direct-email.errors.permissionDenied',
    DIRECT_EMAIL_SUPPRESSION_OPT_OUT_LOCKED: 'admin-direct-email.errors.optOutLocked'
};

/**
 * Reads `error.reason` out of an unknown thrown value.
 *
 * @param input.error - Anything thrown by a `fetchApi` call.
 * @returns The reason code, or `undefined` when the value carries none.
 */
export function getDirectEmailErrorReason({
    error
}: {
    readonly error: unknown;
}): string | undefined {
    if (!isApiError(error)) return undefined;
    const body = error.body as { error?: { reason?: unknown } } | null | undefined;
    const reason = body?.error?.reason;
    return typeof reason === 'string' ? reason : undefined;
}

/**
 * Resolves the i18n key to show for a failed direct email request.
 *
 * @param input.error - Anything thrown by a `fetchApi` call.
 * @returns A key under `admin-direct-email.errors`.
 */
export function getDirectEmailErrorKey({ error }: { readonly error: unknown }): TranslationKey {
    const reason = getDirectEmailErrorReason({ error });
    return (reason && REASON_KEYS[reason]) || 'admin-direct-email.errors.generic';
}

/**
 * Reads the provider's own error text out of `error.details`, when the API sent it
 * (`details.providerError`, or `details.message`). Production masks the details of a 5xx,
 * so callers must treat it as optional.
 *
 * @param input.error - Anything thrown by a `fetchApi` call.
 * @returns The provider text, or `undefined` when the response carries none.
 */
export function getDirectEmailProviderMessage({
    error
}: {
    readonly error: unknown;
}): string | undefined {
    if (!isApiError(error)) return undefined;
    const body = error.body as { error?: { details?: unknown } } | null | undefined;
    const details = body?.error?.details as
        | { providerError?: unknown; message?: unknown }
        | null
        | undefined;
    const text = details?.providerError ?? details?.message;
    return typeof text === 'string' && text.length > 0 ? text : undefined;
}

/**
 * Resolves the i18n key to show when a real SEND failed. A known reason (nothing was
 * sent) keeps its specific message; anything else (timeout, 5xx, network) is ambiguous,
 * so the admin is told to check the history before retrying.
 *
 * @param input.error - Anything thrown by the send call.
 * @returns A key under `admin-direct-email.errors`.
 */
export function getDirectEmailSendErrorKey({ error }: { readonly error: unknown }): TranslationKey {
    const reason = getDirectEmailErrorReason({ error });
    return (reason && REASON_KEYS[reason]) || 'admin-direct-email.errors.sendFailedCheckHistory';
}
