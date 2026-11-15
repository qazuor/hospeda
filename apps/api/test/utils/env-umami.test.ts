/**
 * @file env-umami.test.ts
 * @description HOS-2119 T-011: the four server-side Umami env vars are optional
 * in the API Zod schema and registered (with the API key flagged secret).
 */

import { ENV_REGISTRY } from '@repo/config';
import { describe, expect, it } from 'vitest';
import { ApiEnvBaseSchema } from '../../src/utils/env-schema';

const UMAMI_VARS = [
    'HOSPEDA_UMAMI_URL',
    'HOSPEDA_UMAMI_WEBSITE_ID_WEB',
    'HOSPEDA_UMAMI_WEBSITE_ID_ADMIN',
    'HOSPEDA_UMAMI_API_KEY'
] as const;

const WEBSITE_ID = '3f2b1c9e-5a4d-4e8b-9c1a-0d7e6f5a4b3c';

describe('HOSPEDA_UMAMI_* env vars', () => {
    it('should declare all four vars in the API schema shape', () => {
        // Arrange
        const keys = Object.keys(ApiEnvBaseSchema.shape);

        // Assert
        for (const name of UMAMI_VARS) {
            expect(keys).toContain(name);
        }
    });

    it('should accept all four vars when set to valid values', () => {
        // Arrange
        const shape = ApiEnvBaseSchema.shape;

        // Act + Assert
        expect(shape.HOSPEDA_UMAMI_URL.safeParse('https://umami.example.com').success).toBe(true);
        expect(shape.HOSPEDA_UMAMI_WEBSITE_ID_WEB.safeParse(WEBSITE_ID).success).toBe(true);
        expect(shape.HOSPEDA_UMAMI_WEBSITE_ID_ADMIN.safeParse(WEBSITE_ID).success).toBe(true);
        expect(shape.HOSPEDA_UMAMI_API_KEY.safeParse('umami_test_key').success).toBe(true);
    });

    it('should treat all four vars as optional', () => {
        // Arrange
        const shape = ApiEnvBaseSchema.shape;

        // Assert
        for (const name of UMAMI_VARS) {
            expect(shape[name].safeParse(undefined).success).toBe(true);
        }
    });

    it('should reject a non-URL HOSPEDA_UMAMI_URL and a non-UUID website id', () => {
        const shape = ApiEnvBaseSchema.shape;
        expect(shape.HOSPEDA_UMAMI_URL.safeParse('not a url').success).toBe(false);
        expect(shape.HOSPEDA_UMAMI_WEBSITE_ID_WEB.safeParse('nope').success).toBe(false);
    });

    it('should parse blank and whitespace-only values as undefined (Coolify "KEY=")', () => {
        // Arrange
        const shape = ApiEnvBaseSchema.shape;

        // Act + Assert
        for (const name of UMAMI_VARS) {
            for (const blank of ['', '   ']) {
                const result = shape[name].safeParse(blank);
                expect(result.success, `${name} with ${JSON.stringify(blank)}`).toBe(true);
                expect(result.data).toBeUndefined();
            }
        }
    });

    it('should not crash the base schema when all four vars are empty strings', () => {
        // Arrange
        const emptyUmami = Object.fromEntries(UMAMI_VARS.map((name) => [name, '']));

        // Act
        const result = ApiEnvBaseSchema.pick({
            HOSPEDA_UMAMI_URL: true,
            HOSPEDA_UMAMI_WEBSITE_ID_WEB: true,
            HOSPEDA_UMAMI_WEBSITE_ID_ADMIN: true,
            HOSPEDA_UMAMI_API_KEY: true
        }).safeParse(emptyUmami);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should register all four vars for the api app, with only the API key secret', () => {
        for (const name of UMAMI_VARS) {
            const entry = ENV_REGISTRY.find((e) => e.name === name);
            expect(entry, `${name} missing from registry`).toBeDefined();
            expect(entry?.apps).toContain('api');
            expect(entry?.required).toBe(false);
            expect(entry?.secret).toBe(name === 'HOSPEDA_UMAMI_API_KEY');
        }
    });
});
