/**
 * Regression tests for the public health probes (HOS-1911).
 *
 * `/health/live` declared the full response envelope as its response schema while
 * its handler returns the bare payload, so the strip step failed closed and the
 * route answered 500 in every environment. Each probe must answer 200 with the
 * standard envelope around the payload it declares.
 *
 * @module test/routes/health/liveness-readiness
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

interface ProbeBody {
    readonly success: boolean;
    readonly data: Record<string, unknown>;
}

describe('public health probes (HOS-1911)', () => {
    let app: AppOpenAPI;

    beforeAll(async () => {
        app = await initApp();
    });

    it.each([
        ['/health/live', 'alive'],
        ['/health/ready', 'ready']
    ])('GET %s answers 200 with the %s payload in the standard envelope', async (path, key) => {
        // Arrange / Act
        const res = await app.request(path, { headers: { 'user-agent': 'test-agent' } });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as ProbeBody;
        expect(body.success).toBe(true);
        expect(body.data[key]).toBe(true);
        expect(typeof body.data.timestamp).toBe('string');
    });

    it('GET /health answers 200', async () => {
        // Arrange / Act
        const res = await app.request('/health', { headers: { 'user-agent': 'test-agent' } });

        // Assert
        expect(res.status).toBe(200);
    });
});

describe('healthRoutes factory route (HOS-1911)', () => {
    it('GET / answers 200 with the health payload (it declared the full envelope before)', async () => {
        // Arrange
        const { healthRoutes } = await import('../../../src/routes/health');

        // Act
        const res = await healthRoutes.request('/', { headers: { 'user-agent': 'test-agent' } });

        // Assert
        expect(res.status).toBe(200);
        const body = (await res.json()) as ProbeBody;
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('healthy');
    });
});
