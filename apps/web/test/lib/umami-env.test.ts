/**
 * @file umami-env.test.ts
 * @description HOS-2119 T-012: the web client Umami vars are optional (analytics
 * disabled when absent), PUBLIC_UMAMI_SCRIPT_URL must be a URL and
 * PUBLIC_UMAMI_WEBSITE_ID must be a UUID.
 */

import { describe, expect, it } from 'vitest';
import { serverEnvSchema } from '../../src/env';

const baseValid = {
    PUBLIC_API_URL: 'https://api.test',
    PUBLIC_SITE_URL: 'https://site.test',
    PUBLIC_ADMIN_URL: 'https://admin.test',
    NODE_ENV: 'development'
} as const;

const VALID_UUID = '3f1c2b4e-8a6d-4c1f-9b2e-7d5a1e0c9f33';

describe('serverEnvSchema - PUBLIC_UMAMI_* (HOS-2119)', () => {
    it('accepts an env without either Umami var', () => {
        expect(serverEnvSchema.safeParse(baseValid).success).toBe(true);
    });

    it('accepts a valid script URL and website id', () => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            PUBLIC_UMAMI_SCRIPT_URL: 'https://stats.example.com/xyz.js',
            PUBLIC_UMAMI_WEBSITE_ID: VALID_UUID
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.PUBLIC_UMAMI_SCRIPT_URL).toBe('https://stats.example.com/xyz.js');
            expect(result.data.PUBLIC_UMAMI_WEBSITE_ID).toBe(VALID_UUID);
        }
    });

    it('rejects a script URL that is not a URL', () => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            PUBLIC_UMAMI_SCRIPT_URL: 'not-a-url'
        });
        expect(result.success).toBe(false);
    });

    it('rejects a website id that is not a UUID', () => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            PUBLIC_UMAMI_WEBSITE_ID: 'not-a-uuid'
        });
        expect(result.success).toBe(false);
    });
});
