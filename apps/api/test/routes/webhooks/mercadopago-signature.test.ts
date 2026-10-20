import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMercadoPagoSignature } from '../../../src/routes/webhooks/mercadopago-signature';

const secret = 'test-webhook-secret';
const requestId = 'request-123';
const dataId = 'ABC123';
const timestamp = '1791820800';
const manifest = `id:abc123;request-id:${requestId};ts:${timestamp};`;
const signature = createHmac('sha256', secret).update(manifest).digest('hex');
const signatureHeader = `v1=${signature}, ts=${timestamp}`;

describe('verifyMercadoPagoSignature', () => {
    it('accepts a valid signature and lowercases alphanumeric data ids', () => {
        expect(verifyMercadoPagoSignature({ signatureHeader, requestId, dataId, secret })).toBe(
            true
        );
    });

    it.each([
        ['different secret', { secret: 'other-secret' }],
        ['changed v1', { signatureHeader: `ts=${timestamp},v1=${'0'.repeat(64)}` }],
        ['changed timestamp', { signatureHeader: `ts=1791820801,v1=${signature}` }],
        [
            'manifest without final semicolon',
            {
                signatureHeader: `ts=${timestamp},v1=${createHmac('sha256', secret)
                    .update(`id:abc123;request-id:${requestId};ts:${timestamp}`)
                    .digest('hex')}`
            }
        ],
        ['missing signature header', { signatureHeader: undefined }],
        ['malformed signature header', { signatureHeader: 'ts=x,v1=not-hex' }]
    ])('rejects %s', (_name, overrides) => {
        expect(
            verifyMercadoPagoSignature({
                signatureHeader,
                requestId,
                dataId,
                secret,
                ...overrides
            })
        ).toBe(false);
    });
});
