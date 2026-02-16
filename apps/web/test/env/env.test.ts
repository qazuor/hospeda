import { describe, expect, it } from 'vitest';
import { clientEnvSchema, serverEnvSchema } from '../../src/env';

describe('serverEnvSchema', () => {
    it('should accept valid HOSPEDA_ env vars', () => {
        const result = serverEnvSchema.safeParse({
            HOSPEDA_API_URL: 'http://localhost:3001',
            HOSPEDA_SITE_URL: 'http://localhost:4322'
        });
        expect(result.success).toBe(true);
    });

    it('should accept valid PUBLIC_ env vars', () => {
        const result = serverEnvSchema.safeParse({
            PUBLIC_API_URL: 'https://api.hospeda.com',
            PUBLIC_SITE_URL: 'https://hospeda.com'
        });
        expect(result.success).toBe(true);
    });

    it('should accept mixed env vars', () => {
        const result = serverEnvSchema.safeParse({
            HOSPEDA_API_URL: 'http://localhost:3001',
            PUBLIC_SITE_URL: 'https://hospeda.com'
        });
        expect(result.success).toBe(true);
    });

    it('should reject when no API_URL variant is set', () => {
        const result = serverEnvSchema.safeParse({
            HOSPEDA_SITE_URL: 'http://localhost:4322'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toContain('API_URL');
        }
    });

    it('should reject when no SITE_URL variant is set', () => {
        const result = serverEnvSchema.safeParse({
            HOSPEDA_API_URL: 'http://localhost:3001'
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toContain('SITE_URL');
        }
    });

    it('should reject invalid URLs', () => {
        const result = serverEnvSchema.safeParse({
            HOSPEDA_API_URL: 'not-a-url',
            HOSPEDA_SITE_URL: 'http://localhost:4322'
        });
        expect(result.success).toBe(false);
    });

    it('should default NODE_ENV to development', () => {
        const result = serverEnvSchema.safeParse({
            HOSPEDA_API_URL: 'http://localhost:3001',
            HOSPEDA_SITE_URL: 'http://localhost:4322'
        });
        if (result.success) {
            expect(result.data.NODE_ENV).toBe('development');
        }
    });

    it('should accept valid NODE_ENV values', () => {
        const envs: Array<'development' | 'production' | 'test'> = [
            'development',
            'production',
            'test'
        ];

        for (const env of envs) {
            const result = serverEnvSchema.safeParse({
                HOSPEDA_API_URL: 'http://localhost:3001',
                HOSPEDA_SITE_URL: 'http://localhost:4322',
                NODE_ENV: env
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.NODE_ENV).toBe(env);
            }
        }
    });
});

describe('clientEnvSchema', () => {
    it('should accept valid PUBLIC_ env vars', () => {
        const result = clientEnvSchema.safeParse({
            PUBLIC_API_URL: 'https://api.hospeda.com',
            PUBLIC_SITE_URL: 'https://hospeda.com'
        });
        expect(result.success).toBe(true);
    });

    it('should reject when PUBLIC_API_URL is missing', () => {
        const result = clientEnvSchema.safeParse({
            PUBLIC_SITE_URL: 'https://hospeda.com'
        });
        expect(result.success).toBe(false);
    });

    it('should reject when PUBLIC_SITE_URL is missing', () => {
        const result = clientEnvSchema.safeParse({
            PUBLIC_API_URL: 'https://api.hospeda.com'
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid URLs in PUBLIC_API_URL', () => {
        const result = clientEnvSchema.safeParse({
            PUBLIC_API_URL: 'not-a-url',
            PUBLIC_SITE_URL: 'https://hospeda.com'
        });
        expect(result.success).toBe(false);
    });

    it('should reject invalid URLs in PUBLIC_SITE_URL', () => {
        const result = clientEnvSchema.safeParse({
            PUBLIC_API_URL: 'https://api.hospeda.com',
            PUBLIC_SITE_URL: 'invalid-url'
        });
        expect(result.success).toBe(false);
    });
});
