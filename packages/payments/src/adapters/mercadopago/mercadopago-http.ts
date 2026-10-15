import type { PaymentCapability } from '../../provider/capabilities';
import { PaymentProviderError } from '../../provider/errors';

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
    assertResponseOk(response, capability);
    let body: unknown;
    try {
        body = await response.json();
    } catch (cause) {
        throw providerError('UNAVAILABLE', capability, 'Mercado Pago returned invalid JSON', cause);
    }
    const result = schema.safeParse(body);
    if (!result.success)
        throw providerError(
            'UNAVAILABLE',
            capability,
            'Mercado Pago returned an invalid response',
            result.error
        );
    return result.data;
}

/** Throws a typed error for a non-successful Mercado Pago response. */
export function assertResponseOk(response: Response, capability: PaymentCapability): void {
    if (response.ok) return;
    const code =
        response.status === 404
            ? 'NOT_FOUND'
            : response.status === 400 || response.status === 409 || response.status === 422
              ? 'REJECTED'
              : 'UNAVAILABLE';
    throw providerError(code, capability, `Mercado Pago request failed (${response.status})`);
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

/** Builds the typed error used by adapter capabilities not implemented yet. */
export function notImplemented(args: {
    readonly capability: PaymentCapability;
}): PaymentProviderError {
    return new PaymentProviderError({
        code: 'NOT_IMPLEMENTED',
        capability: args.capability,
        message: `the Mercado Pago adapter does not implement ${args.capability} yet`
    });
}
