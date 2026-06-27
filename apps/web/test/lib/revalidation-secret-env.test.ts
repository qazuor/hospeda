/**
 * @file revalidation-secret-env.test.ts
 * @description FU-1 regression: HOSPEDA_REVALIDATION_SECRET must be OPTIONAL in
 * dev/test (so ubiquitous accessors like getApiUrl() never throw when the Vite
 * SSR module-runner lacks the server-only var) and REQUIRED in production (the
 * cache-revalidation endpoint authenticates with it).
 */

import { describe, expect, it } from 'vitest';
import { serverEnvSchema } from '../../src/env';

// Minimal object that satisfies the URL-pair refines (API/SITE/ADMIN).
const baseValid = {
    PUBLIC_API_URL: 'https://api.test',
    PUBLIC_SITE_URL: 'https://site.test',
    PUBLIC_ADMIN_URL: 'https://admin.test'
} as const;

// Production also requires Sentry DSN + PostHog key (separate refines).
const prodMonitoring = {
    PUBLIC_SENTRY_DSN: 'https://abc@o0.ingest.sentry.io/1',
    PUBLIC_POSTHOG_KEY: 'phc_test'
} as const;

describe('serverEnvSchema — HOSPEDA_REVALIDATION_SECRET (FU-1)', () => {
    it('accepts a development env WITHOUT the revalidation secret', () => {
        const result = serverEnvSchema.safeParse({ ...baseValid, NODE_ENV: 'development' });
        expect(result.success).toBe(true);
    });

    it('rejects a production env WITHOUT the revalidation secret', () => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            ...prodMonitoring,
            NODE_ENV: 'production'
        });
        expect(result.success).toBe(false);
    });

    it('accepts a production env WITH a valid (>=32 char) revalidation secret', () => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            ...prodMonitoring,
            NODE_ENV: 'production',
            HOSPEDA_REVALIDATION_SECRET: 'a'.repeat(32)
        });
        expect(result.success).toBe(true);
    });

    it('still enforces the >=32 length when the secret IS provided', () => {
        const result = serverEnvSchema.safeParse({
            ...baseValid,
            NODE_ENV: 'development',
            HOSPEDA_REVALIDATION_SECRET: 'too-short'
        });
        expect(result.success).toBe(false);
    });
});
