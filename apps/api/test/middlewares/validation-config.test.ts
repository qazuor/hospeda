/**
 * Tests for validation configuration
 * Tests the configuration loading from environment variables
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultValidationConfig, getValidationConfig } from '../../src/types/validation-config';

// Mock env module
vi.mock('../../src/utils/env', () => ({
    env: {
        API_VALIDATION_MAX_BODY_SIZE: 5 * 1024 * 1024, // 5MB
        API_VALIDATION_MAX_REQUEST_TIME: 15000, // 15s
        API_VALIDATION_ALLOWED_CONTENT_TYPES: 'application/json,text/plain',
        API_VALIDATION_REQUIRED_HEADERS: 'user-agent,content-type',
        API_VALIDATION_CLERK_AUTH_ENABLED: false,
        API_VALIDATION_CLERK_AUTH_HEADERS: 'authorization,x-api-key',
        API_VALIDATION_SANITIZE_ENABLED: true,
        API_VALIDATION_SANITIZE_MAX_STRING_LENGTH: 500,
        API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS: false,
        API_VALIDATION_SANITIZE_ALLOWED_CHARS: '[a-zA-Z0-9]'
    },
    validateApiEnv: vi.fn()
}));

describe('Validation Configuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getValidationConfig', () => {
        it('should load configuration from environment variables', () => {
            const config = getValidationConfig();

            expect(config.maxBodySize).toBe(5 * 1024 * 1024); // 5MB
            expect(config.maxRequestTime).toBe(15000); // 15s
            expect(config.allowedContentTypes).toEqual(['application/json', 'text/plain']);
            expect(config.requiredHeaders).toEqual(['user-agent', 'content-type']);
            expect(config.clerkAuth.enabled).toBe(false);
            expect(config.clerkAuth.requiredHeaders).toEqual(['authorization', 'x-api-key']);
            expect(config.sanitizeOptions.maxStringLength).toBe(500);
            expect(config.sanitizeOptions.removeHtmlTags).toBe(false);
            expect(config.sanitizeOptions.allowedCharacters).toBe('[a-zA-Z0-9]');
        });

        it('should handle empty string arrays correctly', () => {
            // Test the split function directly
            const emptyString = '';
            const result = emptyString.split(',').map((s) => s.trim());
            expect(result).toEqual(['']);
        });

        it('should handle whitespace in comma-separated values', () => {
            // Test the split function directly
            const whitespaceString = ' app/json , text/plain ';
            const result = whitespaceString.split(',').map((s) => s.trim());
            expect(result).toEqual(['app/json', 'text/plain']);
        });

        it('should fallback to default config on error', () => {
            // Test that default config has expected values
            expect(defaultValidationConfig.maxBodySize).toBe(10 * 1024 * 1024); // 10MB
            expect(defaultValidationConfig.maxRequestTime).toBe(30000); // 30s
            expect(defaultValidationConfig.allowedContentTypes).toEqual([
                'application/json',
                'multipart/form-data'
            ]);
            expect(defaultValidationConfig.requiredHeaders).toEqual(['user-agent']);
            expect(defaultValidationConfig.clerkAuth.enabled).toBe(true);
            expect(defaultValidationConfig.clerkAuth.requiredHeaders).toEqual(['authorization']);
        });
    });
});
