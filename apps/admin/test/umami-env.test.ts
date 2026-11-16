/**
 * @file umami-env.test.ts
 * @description HOS-2119 T-013: the admin client Umami vars are optional (analytics
 * disabled when absent), VITE_UMAMI_SCRIPT_URL must be a URL and
 * VITE_UMAMI_WEBSITE_ID must be a UUID.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger', () => ({
    adminLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { AdminEnvSchema } from '../src/env';

const baseValid = {
    VITE_API_URL: 'http://localhost:3001',
    VITE_SITE_URL: 'http://localhost:4321',
    VITE_ADMIN_URL: 'http://localhost:3000',
    HOSPEDA_API_URL: 'http://localhost:3001',
    VITE_BETTER_AUTH_URL: 'http://localhost:3001/api/auth',
    NODE_ENV: 'development'
} as const;

const VALID_UUID = '3f1c2b4e-8a6d-4c1f-9b2e-7d5a1e0c9f33';

describe('AdminEnvSchema - VITE_UMAMI_* (HOS-2119)', () => {
    it('accepts an env without either Umami var', () => {
        expect(AdminEnvSchema.safeParse(baseValid).success).toBe(true);
    });

    it('accepts a valid script URL and website id', () => {
        const result = AdminEnvSchema.safeParse({
            ...baseValid,
            VITE_UMAMI_SCRIPT_URL: 'https://stats.example.com/xyz.js',
            VITE_UMAMI_WEBSITE_ID: VALID_UUID
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.VITE_UMAMI_SCRIPT_URL).toBe('https://stats.example.com/xyz.js');
            expect(result.data.VITE_UMAMI_WEBSITE_ID).toBe(VALID_UUID);
        }
    });

    it('rejects a script URL that is not a URL', () => {
        expect(
            AdminEnvSchema.safeParse({ ...baseValid, VITE_UMAMI_SCRIPT_URL: 'not-a-url' }).success
        ).toBe(false);
    });

    it('rejects a website id that is not a UUID', () => {
        expect(
            AdminEnvSchema.safeParse({ ...baseValid, VITE_UMAMI_WEBSITE_ID: 'not-a-uuid' }).success
        ).toBe(false);
    });
});
