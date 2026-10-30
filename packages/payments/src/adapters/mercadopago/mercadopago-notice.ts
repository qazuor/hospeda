import { PaymentProviderError } from '../../provider/errors';
import type { ProviderNotice } from '../../provider/payment-provider';

/** Decodes the JSON body used by Mercado Pago Webhooks. Signature checks belong to the receiver. */
export function decodeMercadoPagoNotice(args: { readonly body: string }): ProviderNotice {
    let value: unknown;
    try {
        value = JSON.parse(args.body);
    } catch (cause) {
        throw invalidNotice({ type: 'unknown', cause });
    }

    const candidate = typeof value === 'object' && value !== null ? value : {};
    const type =
        'type' in candidate && typeof candidate.type === 'string' ? candidate.type : 'unknown';
    const data = 'data' in candidate ? candidate.data : undefined;
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : undefined;
    if (
        (type !== 'subscription_preapproval' && type !== 'payment') ||
        (typeof id !== 'string' && typeof id !== 'number')
    ) {
        throw invalidNotice({ type });
    }

    // A null version reads like an absent one (HOS-1724).
    const version = 'version' in candidate ? (candidate.version ?? undefined) : undefined;
    if (version !== undefined && typeof version !== 'string' && typeof version !== 'number') {
        throw invalidNotice({ type });
    }
    return {
        resourceKind: type === 'subscription_preapproval' ? 'authorization' : 'charge',
        resourceId: String(id),
        version: version === undefined ? '0' : String(version)
    };
}

function invalidNotice(args: {
    readonly type: string;
    readonly cause?: unknown;
}): PaymentProviderError {
    return new PaymentProviderError({
        code: 'INVALID_NOTICE',
        capability: 'notify',
        message: `Unsupported Mercado Pago notice type: ${args.type}`,
        ...(args.cause === undefined ? {} : { cause: args.cause })
    });
}
