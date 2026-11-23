/**
 * Tests for the partner logo upload helper (HOS-2506).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));

import { uploadPartnerLogo } from '../../../src/lib/media/upload-partner-logo';

const file = new File([new Uint8Array(4)], 'logo.png', { type: 'image/png' });
const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
});

const respond = (status: number, body: unknown) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('uploadPartnerLogo', () => {
    it('posts the file as multipart to the partner logo endpoint with the session', async () => {
        fetchMock.mockResolvedValue(
            respond(200, { success: true, data: { url: 'https://cdn.test/l.png' } })
        );

        const result = await uploadPartnerLogo({ file, locale: 'es' });

        expect(result).toEqual({ ok: true, url: 'https://cdn.test/l.png' });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('http://api.test/api/v1/protected/partners/mine/logo');
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('include');
        expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    });

    it('turns an API error into a localized failure message', async () => {
        fetchMock.mockResolvedValue(
            respond(422, { success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'x' } })
        );

        const result = await uploadPartnerLogo({ file, locale: 'es' });

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.message.length).toBeGreaterThan(0);
    });

    it('falls back to the generic message on a non-JSON answer', async () => {
        fetchMock.mockResolvedValue(respond(502, '<html>bad gateway</html>'));

        const result = await uploadPartnerLogo({ file, locale: 'es' });

        expect(result).toEqual({
            ok: false,
            message: 'No pudimos subir la imagen. Probá de nuevo.'
        });
    });

    it('falls back to the generic message when the network fails', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));

        const result = await uploadPartnerLogo({ file, locale: 'es' });

        expect(result.ok).toBe(false);
    });

    it('fails when a 200 answer carries no url', async () => {
        fetchMock.mockResolvedValue(respond(200, { success: true, data: {} }));

        const result = await uploadPartnerLogo({ file, locale: 'es' });

        expect(result.ok).toBe(false);
    });
});
