/**
 * Unit tests for shared short-link resolution (`utils/short-link`).
 *
 * These lock the contract the Google resolver and the import pipeline both rely
 * on: known short-link hosts are followed via `safeExternalFetch` in
 * `resolveOnly` mode (so a large terminal page cannot discard `finalUrl`), the
 * terminal `finalUrl` is returned, and an already-canonical URL costs no
 * network round-trip. `@repo/utils/safe-fetch` is mocked — no real I/O.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/utils/safe-fetch', () => ({
    safeExternalFetch: vi.fn()
}));

import { safeExternalFetch } from '@repo/utils/safe-fetch';
import { canonicalizeIfShortLink, resolveCanonicalUrl } from '../../src/utils/short-link.js';

const mockSafeExternalFetch = vi.mocked(safeExternalFetch);

const TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Fixtures — terminal URLs from the measured production chains
// ---------------------------------------------------------------------------

const SHARE_GOOGLE_URL = 'https://share.google/IUko8vyFORxaIjDM1';
const SHARE_GOOGLE_FINAL =
    'https://www.google.com/search?sca_esv=abc&kgmid=/g/11ngpqdd9h&q=Cheroga+Casa+Quinta&hl=es';

const MAPS_APP_URL = 'https://maps.app.goo.gl/6kBVJ1cPhon8YNTc6';
const MAPS_APP_FINAL =
    'https://www.google.com/maps/place/Cheroga+Casa+Quinta/@-32.4878177,-58.3626093,17z/data=!3m1!4b1!4m6';

const CANONICAL_GOOGLE_URL =
    'https://www.google.com/maps/place/Cheroga+Casa+Quinta/@-32.4878177,-58.3626093,17z/data=!3m1!4b1!4m6';

beforeEach(() => {
    vi.clearAllMocks();
    mockSafeExternalFetch.mockResolvedValue({
        ok: false,
        status: 0,
        error: 'not configured in this test',
        blocked: true
    });
});

describe('canonicalizeIfShortLink', () => {
    it('follows a share.google two-hop chain and returns the terminal finalUrl', async () => {
        mockSafeExternalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: '',
            finalUrl: SHARE_GOOGLE_FINAL
        });

        const result = await canonicalizeIfShortLink({
            rawUrl: SHARE_GOOGLE_URL,
            timeoutMs: TIMEOUT_MS
        });

        expect(mockSafeExternalFetch).toHaveBeenCalledWith({
            url: SHARE_GOOGLE_URL,
            timeoutMs: TIMEOUT_MS,
            maxRedirects: 5,
            resolveOnly: true
        });
        expect(result).toBe(SHARE_GOOGLE_FINAL);
    });

    it('follows a maps.app.goo.gl short link to its maps canonical URL', async () => {
        mockSafeExternalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: '',
            finalUrl: MAPS_APP_FINAL
        });

        const result = await canonicalizeIfShortLink({
            rawUrl: MAPS_APP_URL,
            timeoutMs: TIMEOUT_MS
        });

        expect(mockSafeExternalFetch).toHaveBeenCalledWith(
            expect.objectContaining({
                url: MAPS_APP_URL,
                maxRedirects: 5,
                resolveOnly: true
            })
        );
        expect(result).toBe(MAPS_APP_FINAL);
    });

    it('returns an already-canonical Google URL untouched with no fetch', async () => {
        const result = await canonicalizeIfShortLink({
            rawUrl: CANONICAL_GOOGLE_URL,
            timeoutMs: TIMEOUT_MS
        });

        expect(result).toBe(CANONICAL_GOOGLE_URL);
        expect(mockSafeExternalFetch).not.toHaveBeenCalled();
    });

    it('returns the input unchanged when the fetch is blocked', async () => {
        mockSafeExternalFetch.mockResolvedValueOnce({
            ok: false,
            status: 0,
            error: 'Hostname resolves to a blocked private address',
            blocked: true
        });

        const result = await canonicalizeIfShortLink({
            rawUrl: MAPS_APP_URL,
            timeoutMs: TIMEOUT_MS
        });

        expect(mockSafeExternalFetch).toHaveBeenCalledOnce();
        expect(result).toBe(MAPS_APP_URL);
    });
});

describe('resolveCanonicalUrl', () => {
    it('returns the input when the chain did not change the URL', async () => {
        mockSafeExternalFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: '',
            finalUrl: MAPS_APP_URL
        });

        const result = await resolveCanonicalUrl({ url: MAPS_APP_URL, timeoutMs: TIMEOUT_MS });

        expect(result).toBe(MAPS_APP_URL);
    });
});
