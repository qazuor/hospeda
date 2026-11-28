/**
 * @file receipt-direct.test.ts
 * @description The «Ver recibo» link of the payment email opens the PDF directly
 * (HOS-2682): the owner gets the file inline, a missing, foreign or malformed id
 * get one and the same «not found», and a dead session goes back to sign in
 * with the receipt as the return address.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
    internal: undefined as string | undefined,
    secret: undefined as string | undefined
}));
vi.mock('@/lib/env', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/env')>()),
    getApiUrl: () => 'https://api.hospeda.test',
    getInternalApiUrl: () => env.internal,
    getInternalRequestSecret: () => env.secret
}));

import { isReceiptId, openOwnReceiptPdf } from '@/lib/account/receipt-direct';
import { buildLoginRedirect, isProtectedRoute } from '@/lib/middleware-helpers';

const RECEIPT = '33333333-3333-4333-8333-333333333333';
const COOKIE = 'hospeda.session_token=abc';

function pdfResponse(): Response {
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="comprobante-7.pdf"',
            'Content-Length': '5',
            'Cache-Control': 'private, no-store'
        }
    });
}

function apiError(status: number): Response {
    return new Response(JSON.stringify({ success: false, error: { code: 'X' } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

beforeEach(() => {
    env.internal = undefined;
    env.secret = undefined;
});

describe('openOwnReceiptPdf', () => {
    it("streams the owner's PDF inline, forwarding the session cookie", async () => {
        // Arrange
        const fetchImpl = vi.fn(async () => pdfResponse());

        // Act
        const outcome = await openOwnReceiptPdf({
            receiptId: RECEIPT,
            cookieHeader: COOKIE,
            fetchImpl
        });

        // Assert
        expect(outcome.kind).toBe('pdf');
        if (outcome.kind !== 'pdf') return;
        expect(outcome.response.status).toBe(200);
        expect(outcome.response.headers.get('Content-Type')).toBe('application/pdf');
        expect(outcome.response.headers.get('Content-Disposition')).toBe(
            'inline; filename="comprobante-7.pdf"'
        );
        expect(outcome.response.headers.get('Cache-Control')).toBe('private, no-store');
        const bytes = new Uint8Array(await outcome.response.arrayBuffer());
        expect(new TextDecoder().decode(bytes)).toBe('%PDF-');
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(
            `https://api.hospeda.test/api/v1/protected/billing-subscription/receipts/${RECEIPT}/pdf`
        );
        expect((init.headers as Record<string, string>).cookie).toBe(COOKIE);
        expect((init.headers as Record<string, string>)['X-Internal-Request']).toBeUndefined();
    });

    it('uses the internal API URL with the shared secret when configured', async () => {
        env.internal = 'http://api.internal:3001';
        env.secret = 's3cret';
        const fetchImpl = vi.fn(async () => pdfResponse());

        await openOwnReceiptPdf({ receiptId: RECEIPT, cookieHeader: COOKIE, fetchImpl });

        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url.startsWith('http://api.internal:3001/api/v1/protected/')).toBe(true);
        expect((init.headers as Record<string, string>)['X-Internal-Request']).toBe('s3cret');
    });

    it('answers a foreign receipt exactly like a missing or malformed one', async () => {
        // The API answers 404 for both a missing receipt and somebody else's.
        const foreign = await openOwnReceiptPdf({
            receiptId: RECEIPT,
            cookieHeader: COOKIE,
            fetchImpl: vi.fn(async () => apiError(404))
        });
        const rejected = await openOwnReceiptPdf({
            receiptId: RECEIPT,
            cookieHeader: COOKIE,
            fetchImpl: vi.fn(async () => apiError(400))
        });
        const neverAsked = vi.fn(async () => pdfResponse());
        const malformed = await openOwnReceiptPdf({
            receiptId: 'not-a-uuid',
            cookieHeader: COOKIE,
            fetchImpl: neverAsked
        });

        expect(foreign).toEqual({ kind: 'notFound' });
        expect(rejected).toEqual({ kind: 'notFound' });
        expect(malformed).toEqual({ kind: 'notFound' });
        expect(neverAsked).not.toHaveBeenCalled();
    });

    it('sends a visitor whose session the API rejects back to sign in', async () => {
        const expired = await openOwnReceiptPdf({
            receiptId: RECEIPT,
            cookieHeader: COOKIE,
            fetchImpl: vi.fn(async () => apiError(401))
        });
        const noCookie = await openOwnReceiptPdf({
            receiptId: RECEIPT,
            cookieHeader: undefined,
            fetchImpl: vi.fn(async () => pdfResponse())
        });
        expect(expired).toEqual({ kind: 'signIn' });
        expect(noCookie).toEqual({ kind: 'signIn' });
    });

    it('reports an API failure, a non-PDF body or a network error as an error, never as not found', async () => {
        const failures = [
            vi.fn(async () => apiError(500)),
            vi.fn(async () => apiError(403)),
            vi.fn(
                async () =>
                    new Response('<html></html>', {
                        status: 200,
                        headers: { 'Content-Type': 'text/html' }
                    })
            ),
            vi.fn(async () => {
                throw new TypeError('fetch failed');
            })
        ];
        for (const fetchImpl of failures) {
            expect(
                await openOwnReceiptPdf({ receiptId: RECEIPT, cookieHeader: COOKIE, fetchImpl })
            ).toEqual({
                kind: 'error'
            });
        }
    });
});

describe('isReceiptId', () => {
    it('accepts only the UUID shape the API accepts', () => {
        expect(isReceiptId({ value: RECEIPT })).toBe(true);
        expect(isReceiptId({ value: undefined })).toBe(false);
        expect(isReceiptId({ value: '../../admin' })).toBe(false);
        expect(isReceiptId({ value: `${RECEIPT}x` })).toBe(false);
    });
});

describe('the receipt route', () => {
    const path = `/es/mi-cuenta/recibos/${RECEIPT}/`;

    it('is protected, and signing in comes back to the receipt', () => {
        expect(isProtectedRoute({ path })).toBe(true);
        const login = buildLoginRedirect({ locale: 'es', currentUrl: path });
        expect(login).toContain('/es/auth/signin/');
        expect(new URL(login, 'https://hospeda.test').searchParams.get('returnUrl')).toBe(path);
    });

    it('returns the PDF itself and rewrites every other outcome to the shared not-found page', () => {
        const source = readFileSync(
            join(__dirname, '../../../src/pages/[lang]/mi-cuenta/recibos/[receiptId].astro'),
            'utf8'
        );
        expect(source).toMatch(/if \(outcome\.kind === 'pdf'\) return outcome\.response;/);
        expect(source).toMatch(
            /outcome\.kind === 'notFound'[\s\S]*?Astro\.rewrite\(buildAccountNotFoundTarget/
        );
        expect(source).toMatch(/outcome\.kind === 'signIn'\) return loginRedirect\(\)/);
        expect(source).toMatch(/if \(!Astro\.locals\.user\) \{\s*return loginRedirect\(\);/);
    });
});
