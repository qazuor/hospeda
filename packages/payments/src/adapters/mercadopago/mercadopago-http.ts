import type { PaymentCapability } from '../../provider/capabilities';
import { PaymentProviderError, type TransientProviderFailure } from '../../provider/errors';

/** Sends one authenticated Mercado Pago request from the adapter transport. */
export type MercadoPagoSend = (args: {
    readonly capability: PaymentCapability;
    readonly path: string;
    readonly method: 'GET' | 'POST' | 'PUT';
    readonly body?: unknown;
    readonly headers?: Readonly<Record<string, string>>;
}) => Promise<Response>;

/** Parses a successful JSON response and maps malformed responses to UNAVAILABLE. */
export async function parseResponse<T>(
    schema: import('zod').ZodType<T>,
    response: Response,
    capability: PaymentCapability
): Promise<T> {
    if (!response.ok) {
        const code = responseErrorCode(response.status);
        const body = await readMercadoPagoErrorBody(response);
        throw new PaymentProviderError({
            code,
            capability,
            message: `Mercado Pago request failed (${response.status})`,
            cause: { status: response.status, body },
            ...transientFromResponse(response)
        });
    }
    let body: unknown;
    try {
        body = await response.json();
    } catch (cause) {
        throw providerError('UNAVAILABLE', capability, 'Mercado Pago returned invalid JSON', cause);
    }
    const result = schema.safeParse(body);
    if (!result.success) {
        const paths = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].slice(
            0,
            5
        );
        const suffix = result.error.issues.some((issue) => !paths.includes(issue.path.join('.')))
            ? ', …'
            : '';
        throw providerError(
            'UNAVAILABLE',
            capability,
            `Mercado Pago returned an invalid response at ${paths.join(', ')}${suffix}`,
            result.error
        );
    }
    return result.data;
}

/** Throws a typed error for a non-successful Mercado Pago response. */
export function assertResponseOk(response: Response, capability: PaymentCapability): void {
    if (response.ok) return;
    const code = responseErrorCode(response.status);
    throw new PaymentProviderError({
        code,
        capability,
        message: `Mercado Pago request failed (${response.status})`,
        ...transientFromResponse(response)
    });
}

/**
 * Classifies a non-OK response as transient (HOS-1968): 429 is a throttle, 5xx an outage.
 * Reads the provider's `Retry-After` (delta-seconds or HTTP date) when present.
 */
function transientFromResponse(response: Response): { transient?: TransientProviderFailure } {
    const kind =
        response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'UNAVAILABLE' : null;
    if (kind === null) return {};
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));
    return {
        transient: { kind, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) }
    };
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
    if (value === null) return undefined;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    const instant = Date.parse(trimmed);
    if (Number.isNaN(instant)) return undefined;
    return Math.max(0, Math.ceil((instant - Date.now()) / 1000));
}

/**
 * Reads and sanitizes an MP error body before it can reach logs or Sentry (HOS-1746).
 * The adapter must sanitize locally because the capture hook receives raw values, not logger-redacted data.
 */
export async function readMercadoPagoErrorBody(response: Response): Promise<unknown> {
    let body: unknown;
    try {
        body = await refundErrorCause(response);
    } catch {
        return undefined;
    }
    const sanitized = sanitizeErrorBody(body);
    let serialized: string;
    try {
        serialized = JSON.stringify(sanitized);
    } catch {
        return sanitized;
    }
    return serialized.length > 2000 ? `${serialized.slice(0, 2000)}…[truncated]` : sanitized;
}

function sanitizeErrorBody(value: unknown): unknown {
    if (typeof value === 'string')
        return value.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[REDACTED_EMAIL]');
    if (Array.isArray(value)) return value.map(sanitizeErrorBody);
    if (typeof value === 'object' && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                key,
                /email/i.test(key) ? '[REDACTED]' : sanitizeErrorBody(entry)
            ])
        );
    }
    return value;
}

function responseErrorCode(status: number): 'NOT_FOUND' | 'REJECTED' | 'UNAVAILABLE' {
    return status === 404
        ? 'NOT_FOUND'
        : status === 400 || status === 409 || status === 422
          ? 'REJECTED'
          : 'UNAVAILABLE';
}

/** Reads a refund error body without losing either its JSON shape or plain text. */
export async function refundErrorCause(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) return text;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

/** Builds a typed payment provider error for an adapter operation. */
export function providerError(
    code: 'UNAVAILABLE' | 'NOT_FOUND' | 'REJECTED',
    capability: PaymentCapability,
    message: string,
    cause?: unknown
): PaymentProviderError {
    return new PaymentProviderError({
        code,
        capability,
        message,
        ...(cause === undefined ? {} : { cause })
    });
}
