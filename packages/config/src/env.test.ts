import type { ConfigEnv, UserConfig } from 'vite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exposeSharedEnv, getEnv, getEnvBoolean, getEnvNumber } from './env.js';

describe('env utilities', () => {
    beforeEach(() => {
        // Clear environment variables before each test
        vi.unstubAllEnvs();
    });

    describe('getEnv', () => {
        it('should return environment variable value', () => {
            vi.stubEnv('TEST_VAR', 'test-value');
            expect(getEnv('TEST_VAR')).toBe('test-value');
        });

        it('should return fallback when variable is missing', () => {
            expect(getEnv('MISSING_VAR', 'fallback')).toBe('fallback');
        });

        it('should throw error when variable is missing and no fallback', () => {
            expect(() => getEnv('MISSING_VAR')).toThrow(
                '[config] Missing environment variable: MISSING_VAR'
            );
        });
    });

    describe('getEnvBoolean', () => {
        it('should return true for truthy values', () => {
            const truthyValues = ['true', '1', 'yes', 'on', 'TRUE', 'YES', 'ON'];

            for (const value of truthyValues) {
                vi.stubEnv('BOOL_VAR', value);
                expect(getEnvBoolean('BOOL_VAR')).toBe(true);
            }
        });

        it('should return false for falsy values', () => {
            const falsyValues = ['false', '0', 'no', 'off', 'FALSE', 'NO', 'OFF', 'random'];

            for (const value of falsyValues) {
                vi.stubEnv('BOOL_VAR', value);
                expect(getEnvBoolean('BOOL_VAR')).toBe(false);
            }
        });

        it('should return fallback when variable is missing', () => {
            expect(getEnvBoolean('MISSING_VAR', true)).toBe(true);
            expect(getEnvBoolean('MISSING_VAR')).toBe(false);
        });
    });

    describe('getEnvNumber', () => {
        it('should return numeric value', () => {
            vi.stubEnv('NUM_VAR', '42');
            expect(getEnvNumber('NUM_VAR')).toBe(42);
        });

        it('should return fallback when variable is missing', () => {
            expect(getEnvNumber('MISSING_VAR', 100)).toBe(100);
        });

        it('should throw error when variable is missing and no fallback', () => {
            expect(() => getEnvNumber('MISSING_VAR')).toThrow(
                '[config] Missing environment variable: MISSING_VAR'
            );
        });

        it('should throw error for invalid number', () => {
            vi.stubEnv('INVALID_NUM', 'not-a-number');
            expect(() => getEnvNumber('INVALID_NUM')).toThrow(
                '[config] Environment variable INVALID_NUM is not a valid number: not-a-number'
            );
        });
    });

    describe('exposeSharedEnv', () => {
        it('should create Vite plugin with correct name', () => {
            const plugin = exposeSharedEnv({});
            expect(plugin.name).toBe('expose-shared-env');
        });

        it('should generate correct define mappings', () => {
            vi.stubEnv('HOSPEDA_API_URL', 'https://api.example.com');
            vi.stubEnv('HOSPEDA_CLERK_KEY', 'pk_test_123');

            const plugin = exposeSharedEnv({
                PUBLIC_API_URL: 'HOSPEDA_API_URL',
                PUBLIC_CLERK_PUBLISHABLE_KEY: 'HOSPEDA_CLERK_KEY'
            });

            const config =
                typeof plugin.config === 'function'
                    ? plugin.config({} as UserConfig, { command: 'build' } as ConfigEnv)
                    : plugin.config?.handler?.({} as UserConfig, { command: 'build' } as ConfigEnv);
            expect(config).toEqual({
                define: {
                    'import.meta.env.PUBLIC_API_URL': '"https://api.example.com"',
                    'import.meta.env.VITE_API_URL': '"https://api.example.com"',
                    'import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY': '"pk_test_123"',
                    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': '"pk_test_123"'
                }
            });
        });

        it('should handle missing environment variables with empty string', () => {
            const plugin = exposeSharedEnv({
                PUBLIC_MISSING: 'MISSING_VAR'
            });

            const config =
                typeof plugin.config === 'function'
                    ? plugin.config({} as UserConfig, { command: 'build' } as ConfigEnv)
                    : plugin.config?.handler?.({} as UserConfig, { command: 'build' } as ConfigEnv);
            expect(config).toEqual({
                define: {
                    'import.meta.env.PUBLIC_MISSING': '""',
                    'import.meta.env.VITE_MISSING': '""'
                }
            });
        });
    });
});
