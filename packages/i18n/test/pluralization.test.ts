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

// ---------------------------------------------------------------------------
// Build-mode independence (production vs development missing-key reporting)
// ---------------------------------------------------------------------------

/**
 * Mock `t` mirroring apps/web's `resolve()` in a PRODUCTION build: an absent
 * key is echoed back verbatim, with no `[MISSING:` marker.
 */
function createProductionT(translations: Record<string, string>) {
    return (key: string, params?: Record<string, unknown>): string => {
        const raw = translations[key];
        if (raw === undefined) {
            return key;
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

describe('pluralize — missing-key detection is build-mode independent', () => {
    describe('production mode (no [MISSING: marker)', () => {
        it('falls back to the base key when the _other key is absent', () => {
            // Arrange: only the base key exists in the catalog.
            const prodT = createProductionT({
                'billing.limit.max_active_alerts.message':
                    'Alcanzaste el limite de {{count}} alertas activas.'
            });

            // Act
            const result = pluralize({
                t: prodT,
                key: 'billing.limit.max_active_alerts.message',
                count: 5
            });

            // Assert: the user must never see the raw dotted key.
            expect(result).toBe('Alcanzaste el limite de 5 alertas activas.');
            expect(result).not.toBe('billing.limit.max_active_alerts.message_other');
        });

        it('falls back to the base key when the _one key is absent', () => {
            const prodT = createProductionT({
                'billing.limit.max_active_alerts.message':
                    'Alcanzaste el limite de {{count}} alerta activa.'
            });

            const result = pluralize({
                t: prodT,
                key: 'billing.limit.max_active_alerts.message',
                count: 1
            });

            expect(result).toBe('Alcanzaste el limite de 1 alerta activa.');
            expect(result).not.toBe('billing.limit.max_active_alerts.message_one');
        });

        it('never leaks a suffixed key when both the plural and base keys are absent', () => {
            const prodT = createProductionT({});

            const result = pluralize({ t: prodT, key: 'totally.unknown.key', count: 3 });

            // Degrades to the BASE key, never to the suffixed variant.
            expect(result).toBe('totally.unknown.key');
            expect(result).not.toBe('totally.unknown.key_other');
        });

        it('still resolves the _one key when it is present', () => {
            const prodT = createProductionT({
                'list.totalReviews_one': '{{count}} resena',
                'list.totalReviews_other': '{{count}} resenas'
            });

            const result = pluralize({ t: prodT, key: 'list.totalReviews', count: 1 });

            expect(result).toBe('1 resena');
        });

        it('still resolves the _other key when it is present', () => {
            const prodT = createProductionT({
                'list.totalReviews_one': '{{count}} resena',
                'list.totalReviews_other': '{{count}} resenas'
            });

            const result = pluralize({ t: prodT, key: 'list.totalReviews', count: 7 });

            expect(result).toBe('7 resenas');
        });

        it('merges extra params into the base-key fallback', () => {
            const prodT = createProductionT({
                'search.results': '{{count}} resultados en {{city}}'
            });

            const result = pluralize({
                t: prodT,
                key: 'search.results',
                count: 4,
                params: { city: 'Concepcion del Uruguay' }
            });

            expect(result).toBe('4 resultados en Concepcion del Uruguay');
        });
    });

    describe('development mode ([MISSING: marker) keeps working', () => {
        it('falls back to the base key when the _other key is absent', () => {
            const devT = createMockT({
                'billing.limit.max_active_alerts.message':
                    'Alcanzaste el limite de {{count}} alertas activas.'
            });

            const result = pluralize({
                t: devT,
                key: 'billing.limit.max_active_alerts.message',
                count: 5
            });

            expect(result).toBe('Alcanzaste el limite de 5 alertas activas.');
        });

        it('returns the dev marker for the base key when everything is absent', () => {
            const devT = createMockT({});

            const result = pluralize({ t: devT, key: 'totally.unknown.key', count: 3 });

            expect(result).toBe('[MISSING: totally.unknown.key]');
        });
    });

    describe('every supported locale falls back identically in production mode', () => {
        it('falls back to the base key in es', () => {
            const prodT = createProductionT({ 'review.count': '{{count}} resenas' });
            expect(pluralize({ t: prodT, key: 'review.count', count: 2 })).toBe('2 resenas');
        });

        it('falls back to the base key in en', () => {
            const prodT = createProductionT({ 'review.count': '{{count}} reviews' });
            expect(pluralize({ t: prodT, key: 'review.count', count: 2 })).toBe('2 reviews');
        });

        it('falls back to the base key in pt', () => {
            const prodT = createProductionT({ 'review.count': '{{count}} avaliacoes' });
            expect(pluralize({ t: prodT, key: 'review.count', count: 2 })).toBe('2 avaliacoes');
        });
    });
});
