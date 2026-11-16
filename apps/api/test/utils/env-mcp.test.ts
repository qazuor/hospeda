/**
 * @file env-mcp.test.ts
 * @description HOS-2184 T-003: defaults and validation of the MCP env vars.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('dotenv', () => ({ config: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
    apiLogger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { ApiEnvSchema } from '../../src/utils/env';

const baseEnv = (overrides: Record<string, string | undefined> = {}) => ({
    NODE_ENV: 'test',
    HOSPEDA_API_URL: 'http://localhost:3001',
    HOSPEDA_DATABASE_URL: 'postgresql://localhost:5432/hospeda_test',
    HOSPEDA_BETTER_AUTH_SECRET: 'test_better_auth_secret_key_32chars!',
    HOSPEDA_BETTER_AUTH_URL: 'http://localhost:3001/api/auth',
    HOSPEDA_SITE_URL: 'http://localhost:4321',
    HOSPEDA_LOCATION_SALT: 'test-location-salt-fixed-for-deterministic-tests-32+chars',
    HOSPEDA_VIEWS_HASH_SECRET: 'test-views-hash-secret-fixed-for-deterministic-tests-32ch',
    HOSPEDA_AI_VAULT_MASTER_KEY: 'test-vault-master-key-0123456789abcd',
    HOSPEDA_ADMIN_URL: 'http://localhost:3000',
    HOSPEDA_REVALIDATION_SECRET: 'test-revalidation-secret-at-least-32-characters-x',
    HOSPEDA_NEWSLETTER_HMAC_SECRET: 'test-newsletter-hmac-secret-at-least-32-characters',
    ...overrides
});

describe('MCP env vars', () => {
    it('defaults to disabled with 60s window, 60 max and no resource URL', () => {
        // Act
        const result = ApiEnvSchema.safeParse(baseEnv());

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.HOSPEDA_MCP_ENABLED).toBe(false);
        expect(result.data.HOSPEDA_MCP_RESOURCE_URL).toBeUndefined();
        expect(result.data.HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS).toBe(60000);
        expect(result.data.HOSPEDA_MCP_RATE_LIMIT_MAX).toBe(60);
    });

    it('parses overrides', () => {
        // Act
        const result = ApiEnvSchema.safeParse(
            baseEnv({
                HOSPEDA_MCP_ENABLED: 'true',
                HOSPEDA_MCP_RESOURCE_URL: 'https://api.hospeda.com.ar/mcp',
                HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS: '1000',
                HOSPEDA_MCP_RATE_LIMIT_MAX: '5'
            })
        );

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.HOSPEDA_MCP_ENABLED).toBe(true);
        expect(result.data.HOSPEDA_MCP_RESOURCE_URL).toBe('https://api.hospeda.com.ar/mcp');
        expect(result.data.HOSPEDA_MCP_RATE_LIMIT_WINDOW_MS).toBe(1000);
        expect(result.data.HOSPEDA_MCP_RATE_LIMIT_MAX).toBe(5);
    });

    it('requires the resource URL when enabled', () => {
        // Act
        const result = ApiEnvSchema.safeParse(baseEnv({ HOSPEDA_MCP_ENABLED: 'true' }));

        // Assert
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.issues.map((i) => i.path.join('.'))).toContain(
            'HOSPEDA_MCP_RESOURCE_URL'
        );
    });

    it('rejects a malformed resource URL', () => {
        // Act
        const result = ApiEnvSchema.safeParse(baseEnv({ HOSPEDA_MCP_RESOURCE_URL: 'not-a-url' }));

        // Assert
        expect(result.success).toBe(false);
    });
});
