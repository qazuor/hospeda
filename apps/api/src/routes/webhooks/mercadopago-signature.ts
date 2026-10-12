import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verifies the measured Mercado Pago Webhooks HMAC manifest. */
export function verifyMercadoPagoSignature(input: {
    readonly signatureHeader: string | undefined;
    readonly requestId: string | undefined;
    readonly dataId: string | undefined;
    readonly secret: string | undefined;
}): boolean {
    const { signatureHeader, requestId, dataId, secret } = input;
    if (!signatureHeader || !requestId || !dataId || !secret) return false;

    let timestamp: string | undefined;
    let signature: string | undefined;
    for (const part of signatureHeader.split(',')) {
        const [rawKey, rawValue, ...rest] = part.split('=');
        const key = rawKey?.trim();
        const value = rawValue?.trim();
        if (!key || !value || rest.length > 0) return false;
        if (key === 'ts') {
            if (timestamp !== undefined || !/^\d+$/.test(value)) return false;
            timestamp = value;
        } else if (key === 'v1') {
            if (signature !== undefined || !/^[a-f\d]{64}$/i.test(value)) return false;
            signature = value;
        }
    }
    if (!timestamp || !signature) return false;

    const manifestId = /^[a-z\d]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    const manifest = `id:${manifestId};request-id:${requestId};ts:${timestamp};`;
    const expected = createHmac('sha256', secret).update(manifest).digest();
    const received = Buffer.from(signature, 'hex');
    if (expected.length !== received.length) return false;
    try {
        return timingSafeEqual(expected, received);
    } catch {
        return false;
    }
}
