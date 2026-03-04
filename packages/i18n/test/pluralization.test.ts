/**
 * Unit tests for the pluralize() utility.
 *
 * Verifies CLDR _one/_other key resolution based on count,
 * automatic {{count}} injection, fallback behavior, and
 * additional parameter passthrough.
 */

import { describe, expect, it } from 'vitest';
import { pluralize } from '../src/pluralization';

/**
 * Creates a mock translation function that returns a known value
 * for matching keys, simulating the real `t` function behavior.
 */
function createMockT(translations: Record<string, string>) {
    return (key: string, params?: Record<string, unknown>): string => {
        const raw = translations[key];
        if (!raw) {
            return `[MISSING: ${key}]`;
        }
        if (!params) return raw;

        return Object.keys(params).reduce((acc, k) => {
            const v = params[k];
            return acc
                .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
                .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }, raw);
    };
}

// ---------------------------------------------------------------------------
// _one / _other key resolution
// ---------------------------------------------------------------------------

describe('pluralize', () => {
    describe('key resolution', () => {
        const mockT = createMockT({
            'list.totalReviews_one': '{{count}} review',
            'list.totalReviews_other': '{{count}} reviews'
        });

        it('should select _one key when count is 1', () => {
            // Arrange
            const count = 1;

            // Act
            const result = pluralize({ t: mockT, key: 'list.totalReviews', count });

            // Assert
            expect(result).toBe('1 review');
        });

        it('should select _other key when count is 0', () => {
            // Arrange
            const count = 0;

            // Act
            const result = pluralize({ t: mockT, key: 'list.totalReviews', count });

            // Assert
            expect(result).toBe('0 reviews');
        });

        it('should select _other key when count is 2', () => {
            // Arrange
            const count = 2;

            // Act
            const result = pluralize({ t: mockT, key: 'list.totalReviews', count });

            // Assert
            expect(result).toBe('2 reviews');
        });

        it('should select _other key when count is 5', () => {
            const result = pluralize({ t: mockT, key: 'list.totalReviews', count: 5 });
            expect(result).toBe('5 reviews');
        });

        it('should select _other key when count is 100', () => {
            const result = pluralize({ t: mockT, key: 'list.totalReviews', count: 100 });
            expect(result).toBe('100 reviews');
        });
    });

    // ---------------------------------------------------------------------------
    // {{count}} auto-injection
    // ---------------------------------------------------------------------------

    describe('count parameter injection', () => {
        const mockT = createMockT({
            items_one: '{{count}} item found',
            items_other: '{{count}} items found'
        });

        it('should automatically inject count into params', () => {
            // Arrange / Act
            const result = pluralize({ t: mockT, key: 'items', count: 42 });

            // Assert
            expect(result).toBe('42 items found');
        });

        it('should inject count 1 into _one key', () => {
            const result = pluralize({ t: mockT, key: 'items', count: 1 });
            expect(result).toBe('1 item found');
        });
    });

    // ---------------------------------------------------------------------------
    // Additional params alongside count
    // ---------------------------------------------------------------------------

    describe('additional params', () => {
        const mockT = createMockT({
            'search.results_one': '{{count}} result in {{city}}',
            'search.results_other': '{{count}} results in {{city}}'
        });

        it('should merge additional params with count', () => {
            // Arrange
            const params = { city: 'Buenos Aires' };

            // Act
            const result = pluralize({
                t: mockT,
                key: 'search.results',
                count: 3,
                params
            });

            // Assert
            expect(result).toBe('3 results in Buenos Aires');
        });

        it('should merge additional params with count for singular', () => {
            const result = pluralize({
                t: mockT,
                key: 'search.results',
                count: 1,
                params: { city: 'Montevideo' }
            });

            expect(result).toBe('1 result in Montevideo');
        });
    });

    // ---------------------------------------------------------------------------
    // Fallback when plural keys are missing
    // ---------------------------------------------------------------------------

    describe('fallback behavior', () => {
        it('should return the base key result when _one/_other keys are missing', () => {
            // Arrange: t that only has the base key (no _one/_other variants)
            const mockT = createMockT({
                'simple.label': 'items: {{count}}'
            });

            // Act
            const result = pluralize({ t: mockT, key: 'simple.label', count: 5 });

            // Assert: falls back to calling t with the base key
            expect(result).toContain('5');
        });

        it('should use _other key result even when _one is missing', () => {
            const mockT = createMockT({
                partial_other: '{{count}} things'
            });

            const result = pluralize({ t: mockT, key: 'partial', count: 3 });
            expect(result).toBe('3 things');
        });

        it('should fall back to base key when only _one is available and count !== 1', () => {
            const mockT = createMockT({
                onlyOne_one: '{{count}} thing',
                onlyOne: '{{count}} things (fallback)'
            });

            const result = pluralize({ t: mockT, key: 'onlyOne', count: 5 });

            // _other is missing, so it returns the [MISSING] marker from mockT
            // The function should try _other first, then fall back to base key
            expect(result).toBe('5 things (fallback)');
        });
    });
});
