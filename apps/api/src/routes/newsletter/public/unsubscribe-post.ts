/**
 * @route POST /api/v1/public/newsletter/unsubscribe
 *
 * Performs the newsletter unsubscribe (HOS-2617). The web confirmation page
 * (`/{locale}/newsletter/unsubscribe/`) calls it with `{ "token": "<hmac>" }`
 * once the person clicks "Confirmar baja". The GET twin never unsubscribes
 * (mail scanners prefetch links); it only redirects to that page.
 *
 * It also serves RFC 8058 one-click unsubscribe: a mailbox provider POSTs
 * `List-Unsubscribe=One-Click` (form-encoded) to the `List-Unsubscribe` URL,
 * which carries the token in the query string. The token is therefore read
 * from the JSON body, the form body or the query, in that order.
 *
 * Idempotent: an already-unsubscribed subscriber answers 200 as well.
 */

import { ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { apiLogger } from '../../../utils/logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { getDefaultNewsletterService } from '../protected/_singletons';

/** Upper bound for a token. Real tokens are well under 300 characters. */
const MAX_TOKEN_LENGTH = 1024;

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Extracts the token from the JSON body, then the form body, then the query.
 * A body that cannot be parsed counts as absent, so the query still wins.
 */
async function extractToken(c: Context): Promise<string> {
    const contentType = (c.req.header('content-type') ?? '').toLowerCase();
    try {
        if (contentType.includes('application/json')) {
            const body = (await c.req.json()) as { token?: unknown } | null;
            const fromBody = readString(body?.token);
            if (fromBody) return fromBody;
        } else if (
            contentType.includes('application/x-www-form-urlencoded') ||
            contentType.includes('multipart/form-data')
        ) {
            const form = await c.req.parseBody();
            const fromForm = readString(form.token);
            if (fromForm) return fromForm;
        }
    } catch {
        // Fall through to the query string.
    }
    return readString(c.req.query('token'));
}

/**
 * Maps a service error to the HTTP status and `error.code` pair of the API
 * error contract. A bad or expired token is 401, an unknown subscriber 404.
 */
function mapServiceError(error: { code?: string; reason?: string }): {
    status: 401 | 404 | 500 | 503;
    code: string;
    reason: string;
} {
    const reason = error.reason ?? error.code ?? 'NEWSLETTER_TOKEN_INVALID';
    if (reason === 'NEWSLETTER_TOKEN_EXPIRED') {
        return { status: 401, code: ServiceErrorCode.UNAUTHORIZED, reason };
    }
    if (error.code === ServiceErrorCode.NOT_FOUND) {
        return { status: 404, code: ServiceErrorCode.NOT_FOUND, reason };
    }
    if (error.code === ServiceErrorCode.SERVICE_UNAVAILABLE) {
        return { status: 503, code: ServiceErrorCode.SERVICE_UNAVAILABLE, reason };
    }
    if (error.code === ServiceErrorCode.UNAUTHORIZED) {
        return { status: 401, code: ServiceErrorCode.UNAUTHORIZED, reason };
    }
    return { status: 500, code: ServiceErrorCode.INTERNAL_ERROR, reason };
}

/**
 * POST handler. Answers JSON: `{ success: true, data: { status } }` or the
 * standard error envelope.
 */
export async function unsubscribePostHandler(c: Context): Promise<Response> {
    const token = await extractToken(c);
    if (!token || token.length > MAX_TOKEN_LENGTH) {
        return createErrorResponse(
            {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'A valid unsubscribe token is required',
                reason: 'NEWSLETTER_TOKEN_INVALID'
            },
            c,
            400
        );
    }

    try {
        const result = await getDefaultNewsletterService().unsubscribeByToken(token);
        if (result.error) {
            const mapped = mapServiceError(result.error);
            apiLogger.info({ reason: mapped.reason }, 'Newsletter unsubscribe (POST) failed');
            return createErrorResponse(
                { code: mapped.code, message: 'Unsubscribe failed', reason: mapped.reason },
                c,
                mapped.status
            );
        }
        return c.json({
            success: true,
            data: { status: result.data?.status ?? 'unsubscribed' },
            metadata: {
                timestamp: new Date().toISOString(),
                requestId: c.get('requestId') || 'unknown'
            }
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('HOSPEDA_NEWSLETTER_HMAC_SECRET')) {
            apiLogger.error({ error: message }, 'Newsletter unsubscribe (POST): not configured');
            return createErrorResponse(
                {
                    code: ServiceErrorCode.SERVICE_UNAVAILABLE,
                    message: 'Newsletter service is not available'
                },
                c,
                503
            );
        }
        apiLogger.error({ error: message }, 'Newsletter unsubscribe (POST): unexpected error');
        return createErrorResponse(
            { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Unexpected error' },
            c,
            500
        );
    }
}
