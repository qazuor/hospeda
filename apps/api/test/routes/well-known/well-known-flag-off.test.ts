/**
 * AC-1 (HOS-2184 T-006): with the MCP flag off (or unset) every OAuth
 * discovery path answers the normal 404. Exercised through the real app so the
 * global middleware stack is covered.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { env, validateApiEnv } from '../../../src/utils/env';

const PATHS = [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-authorization-server',
    '/.well-known/openid-configuration',
    '/.well-known/oauth-authorization-server/api/auth',
    '/.well-known/openid-configuration/api/auth',
    '/api/auth/.well-known/openid-configuration'
] as const;

describe('well-known routes with HOSPEDA_MCP_ENABLED off (AC-1)', () => {
    beforeAll(() => {
        validateApiEnv();
    });

    afterEach(() => {
        env.HOSPEDA_MCP_ENABLED = false;
    });

    it.each(PATHS)('answers 404 on %s when the flag is false', async (path) => {
        // Arrange
        env.HOSPEDA_MCP_ENABLED = false;
        const app = initApp();

        // Act
        const res = await app.request(path, { headers: { 'user-agent': 'test-client' } });

        // Assert
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Route not found' }
        });
    });

    it.each(PATHS)('treats an undefined flag as off on %s', async (path) => {
        // Arrange
        env.HOSPEDA_MCP_ENABLED = undefined as unknown as boolean;
        const app = initApp();

        // Act
        const res = await app.request(path, { headers: { 'user-agent': 'test-client' } });

        // Assert
        expect(res.status).toBe(404);
    });
});
