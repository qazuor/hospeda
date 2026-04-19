/**
 * Tests for `GET /api/v1/public/health/media` (SPEC-078-GAPS GAP-078-232).
 *
 * Verifies:
 *   - 200 when provider.healthCheck() resolves with {ok: true}
 *   - 503 when provider.healthCheck() resolves with {ok: false}
 *   - 503 when getMediaProvider() returns null (creds missing)
 *   - The route is public (no auth required)
 *   - Provider mutating methods (upload/delete/deleteByPrefix) are never called
 *
 * @module test/routes/health/media
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHealthCheck, mockUpload, mockDelete, mockDeleteByPrefix, mockGetMediaProvider } =
    vi.hoisted(() => ({
        mockHealthCheck: vi.fn(),
        mockUpload: vi.fn(),
        mockDelete: vi.fn(),
        mockDeleteByPrefix: vi.fn(),
        mockGetMediaProvider: vi.fn()
    }));

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: mockGetMediaProvider
}));

import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

const setProvider = (healthResult: { ok: boolean; message?: string } | null) => {
    if (healthResult === null) {
        mockGetMediaProvider.mockReturnValue(null);
        return;
    }
    mockHealthCheck.mockResolvedValue(healthResult);
    mockGetMediaProvider.mockReturnValue({
        upload: mockUpload,
        delete: mockDelete,
        deleteByPrefix: mockDeleteByPrefix,
        healthCheck: mockHealthCheck
    });
};

describe('GET /api/v1/public/health/media — SPEC-078-GAPS GAP-078-232', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        app = await initApp();
    });

    beforeEach(() => {
        mockHealthCheck.mockReset();
        mockUpload.mockReset();
        mockDelete.mockReset();
        mockDeleteByPrefix.mockReset();
        mockGetMediaProvider.mockReset();
    });

    it('returns 200 with status: ok when provider.healthCheck succeeds', async () => {
        // Arrange
        setProvider({ ok: true });

        // Act
        const res = await app.request('/api/v1/public/health/media');

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            success: boolean;
            data: { status: string; cloudName?: string; timestamp: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('ok');
        expect(typeof body.data.timestamp).toBe('string');
        expect(mockHealthCheck).toHaveBeenCalledOnce();
        expect(mockUpload).not.toHaveBeenCalled();
        expect(mockDelete).not.toHaveBeenCalled();
        expect(mockDeleteByPrefix).not.toHaveBeenCalled();
    });

    it('returns 503 with status: error and message when provider.healthCheck fails', async () => {
        // Arrange
        setProvider({ ok: false, message: 'Invalid API key (http_code=401)' });

        // Act
        const res = await app.request('/api/v1/public/health/media');

        // Assert
        expect(res.status).toBe(503);
        const body = (await res.json()) as {
            success: boolean;
            data: { status: string; message: string };
        };
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('error');
        expect(body.data.message).toContain('Invalid API key');
    });

    it('returns 503 when the media provider is not configured', async () => {
        // Arrange
        setProvider(null);

        // Act
        const res = await app.request('/api/v1/public/health/media');

        // Assert
        expect(res.status).toBe(503);
        const body = (await res.json()) as {
            success: boolean;
            data: { status: string; message: string };
        };
        expect(body.data.status).toBe('error');
        expect(body.data.message).toMatch(/not configured/i);
        expect(mockHealthCheck).not.toHaveBeenCalled();
    });

    it('does not require authentication', async () => {
        // Arrange
        setProvider({ ok: true });

        // Act — request with NO Authorization header
        const res = await app.request('/api/v1/public/health/media');

        // Assert
        expect(res.status).toBe(200);
    });
});
