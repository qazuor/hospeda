/**
 * @file accommodation-media-api.test.ts
 * @description Unit tests for the accommodationMediaApi endpoint wrappers (SPEC-204).
 *
 * Verifies that each method delegates to the correct apiClient method with the
 * expected path, HTTP verb, and parameters.
 *
 * Mirrors the style of accommodation-edit-api.test.ts: mock `apiClient` at the
 * module level and assert on the call shape for each wrapper function.
 */

import { apiClient } from '@/lib/api/client';
import { accommodationMediaApi } from '@/lib/api/endpoints-protected';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        getProtected: vi.fn(),
        postProtected: vi.fn(),
        delete: vi.fn(),
        put: vi.fn()
    }
}));

const ACC_ID = 'acc-uuid-123';
const MEDIA_ID = 'media-uuid-456';

describe('accommodationMediaApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── listMedia ───────────────────────────────────────────────────────────

    describe('listMedia', () => {
        it('calls getProtected with the correct path and default state=visible', async () => {
            vi.mocked(apiClient.getProtected).mockResolvedValue({
                ok: true,
                data: { media: [] }
            });

            await accommodationMediaApi.listMedia({ id: ACC_ID });

            expect(apiClient.getProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media`,
                params: { state: 'visible' },
                cookieHeader: undefined
            });
        });

        it('forwards an explicit state=archived param', async () => {
            vi.mocked(apiClient.getProtected).mockResolvedValue({
                ok: true,
                data: { media: [] }
            });

            await accommodationMediaApi.listMedia({ id: ACC_ID, state: 'archived' });

            expect(apiClient.getProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media`,
                params: { state: 'archived' },
                cookieHeader: undefined
            });
        });

        it('forwards a cookieHeader for SSR callers', async () => {
            vi.mocked(apiClient.getProtected).mockResolvedValue({
                ok: true,
                data: { media: [] }
            });

            const cookieHeader = 'session=abc123';
            await accommodationMediaApi.listMedia({ id: ACC_ID, cookieHeader });

            expect(apiClient.getProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media`,
                params: { state: 'visible' },
                cookieHeader
            });
        });
    });

    // ── addMedia ────────────────────────────────────────────────────────────

    describe('addMedia', () => {
        it('calls postProtected with the correct path and body', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue({
                ok: true,
                data: { media: { id: MEDIA_ID, url: 'https://cdn.example.com/img.jpg' } }
            });

            const body = {
                url: 'https://cdn.example.com/img.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/img1',
                moderationState: 'APPROVED'
            };

            await accommodationMediaApi.addMedia({ id: ACC_ID, body });

            expect(apiClient.postProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media`,
                body
            });
        });

        it('supports optional caption, description, and alt fields', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue({
                ok: true,
                data: { media: { id: MEDIA_ID, url: 'https://cdn.example.com/img.jpg' } }
            });

            const body = {
                url: 'https://cdn.example.com/img.jpg',
                publicId: 'hospeda/abc/img1',
                caption: 'Vista al jardín',
                description: 'Jardín trasero con piscina',
                alt: 'Piscina del jardín trasero',
                moderationState: 'APPROVED'
            };

            await accommodationMediaApi.addMedia({ id: ACC_ID, body });

            expect(apiClient.postProtected).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media`,
                body
            });
        });
    });

    // ── removeMedia ─────────────────────────────────────────────────────────

    describe('removeMedia', () => {
        it('calls delete with the path including mediaId (no body)', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({
                ok: true,
                data: {}
            });

            await accommodationMediaApi.removeMedia({ id: ACC_ID, mediaId: MEDIA_ID });

            expect(apiClient.delete).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media/${MEDIA_ID}`
            });
        });

        it('embeds the mediaId in the URL path, not as a query param', async () => {
            vi.mocked(apiClient.delete).mockResolvedValue({ ok: true, data: {} });

            await accommodationMediaApi.removeMedia({ id: ACC_ID, mediaId: 'specific-uuid' });

            const callArgs = vi.mocked(apiClient.delete).mock.calls[0]?.[0];
            expect(callArgs?.path).toMatch(/\/specific-uuid$/);
            // No query string character
            expect(callArgs?.path).not.toContain('?');
        });
    });

    // ── setFeaturedMedia ────────────────────────────────────────────────────

    describe('setFeaturedMedia', () => {
        it('calls put with the correct /featured path (no body)', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({
                ok: true,
                data: { media: { id: MEDIA_ID, isFeatured: true } }
            });

            await accommodationMediaApi.setFeaturedMedia({ id: ACC_ID, mediaId: MEDIA_ID });

            expect(apiClient.put).toHaveBeenCalledWith({
                path: `/api/v1/protected/accommodations/${ACC_ID}/media/${MEDIA_ID}/featured`
            });
        });

        it('path ends with /featured segment', async () => {
            vi.mocked(apiClient.put).mockResolvedValue({ ok: true, data: { media: {} } });

            await accommodationMediaApi.setFeaturedMedia({ id: ACC_ID, mediaId: 'some-id' });

            const callArgs = vi.mocked(apiClient.put).mock.calls[0]?.[0];
            expect(callArgs?.path).toMatch(/\/featured$/);
        });
    });
});
