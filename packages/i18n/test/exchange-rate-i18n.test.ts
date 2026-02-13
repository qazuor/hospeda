/**
 * Test suite for exchange-rate i18n translations
 * Validates Spanish and English translation key structure and completeness
 */

import { describe, expect, it } from 'vitest';
import exchangeRateEn from '../src/locales/en/exchange-rate.json';
import exchangeRateEs from '../src/locales/es/exchange-rate.json';

/**
 * Recursively extracts all keys from an object into an array of dot-notation paths
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];

    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
        } else {
            keys.push(fullKey);
        }
    }

    return keys.sort();
}

/**
 * Checks if all values in an object are non-empty strings
 */
function hasNoEmptyValues(obj: Record<string, unknown>, path = ''): boolean {
    for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            if (!hasNoEmptyValues(value as Record<string, unknown>, currentPath)) {
                return false;
            }
        } else if (typeof value === 'string') {
            if (value.trim() === '') {
                console.error(`Empty value at key: ${currentPath}`);
                return false;
            }
        }
    }

    return true;
}

describe('exchange-rate i18n translations', () => {
    describe('Spanish translations', () => {
        it('should have all required top-level keys', () => {
            const requiredKeys = [
                'title',
                'subtitle',
                'labels',
                'rateTypes',
                'sources',
                'conversion',
                'admin',
                'errors',
                'status'
            ];

            for (const key of requiredKeys) {
                expect(exchangeRateEs).toHaveProperty(key);
            }
        });

        it('should have all label keys', () => {
            const requiredLabels = [
                'rate',
                'inverseRate',
                'currency',
                'fromCurrency',
                'toCurrency',
                'amount',
                'convertedAmount',
                'lastUpdated',
                'source',
                'rateType',
                'expiresAt',
                'manualOverride'
            ];

            for (const label of requiredLabels) {
                expect(exchangeRateEs.labels).toHaveProperty(label);
            }
        });

        it('should have all rate type translations', () => {
            const requiredRateTypes = ['oficial', 'blue', 'mep', 'ccl', 'tarjeta', 'standard'];

            for (const rateType of requiredRateTypes) {
                expect(exchangeRateEs.rateTypes).toHaveProperty(rateType);
            }
        });

        it('should have all source translations', () => {
            const requiredSources = ['dolarapi', 'exchangerate-api', 'manual'];

            for (const source of requiredSources) {
                expect(exchangeRateEs.sources).toHaveProperty(source);
            }
        });

        it('should have all conversion keys', () => {
            expect(exchangeRateEs.conversion).toHaveProperty('disclaimer');
            expect(exchangeRateEs.conversion).toHaveProperty('convert');
            expect(exchangeRateEs.conversion).toHaveProperty('result');
        });

        it('should have all admin keys', () => {
            const requiredAdminKeys = [
                'config',
                'fetchInterval',
                'fetchIntervalMinutes',
                'fetchIntervalHours',
                'enableAutoFetch',
                'showDisclaimer',
                'disclaimerText',
                'defaultRateType',
                'fetchNow',
                'fetchSuccess',
                'addOverride',
                'removeOverride',
                'history'
            ];

            for (const key of requiredAdminKeys) {
                expect(exchangeRateEs.admin).toHaveProperty(key);
            }
        });

        it('should have all error messages', () => {
            const requiredErrors = [
                'rateNotAvailable',
                'conversionError',
                'fetchError',
                'invalidCurrencyPair',
                'staleRate'
            ];

            for (const error of requiredErrors) {
                expect(exchangeRateEs.errors).toHaveProperty(error);
            }
        });

        it('should have all status translations', () => {
            const requiredStatuses = ['fresh', 'stale', 'manual'];

            for (const status of requiredStatuses) {
                expect(exchangeRateEs.status).toHaveProperty(status);
            }
        });

        it('should have no empty string values', () => {
            expect(hasNoEmptyValues(exchangeRateEs)).toBe(true);
        });
    });

    describe('English translations', () => {
        it('should have all required top-level keys', () => {
            const requiredKeys = [
                'title',
                'subtitle',
                'labels',
                'rateTypes',
                'sources',
                'conversion',
                'admin',
                'errors',
                'status'
            ];

            for (const key of requiredKeys) {
                expect(exchangeRateEn).toHaveProperty(key);
            }
        });

        it('should have all label keys', () => {
            const requiredLabels = [
                'rate',
                'inverseRate',
                'currency',
                'fromCurrency',
                'toCurrency',
                'amount',
                'convertedAmount',
                'lastUpdated',
                'source',
                'rateType',
                'expiresAt',
                'manualOverride'
            ];

            for (const label of requiredLabels) {
                expect(exchangeRateEn.labels).toHaveProperty(label);
            }
        });

        it('should have all rate type translations', () => {
            const requiredRateTypes = ['oficial', 'blue', 'mep', 'ccl', 'tarjeta', 'standard'];

            for (const rateType of requiredRateTypes) {
                expect(exchangeRateEn.rateTypes).toHaveProperty(rateType);
            }
        });

        it('should have all source translations', () => {
            const requiredSources = ['dolarapi', 'exchangerate-api', 'manual'];

            for (const source of requiredSources) {
                expect(exchangeRateEn.sources).toHaveProperty(source);
            }
        });

        it('should have all conversion keys', () => {
            expect(exchangeRateEn.conversion).toHaveProperty('disclaimer');
            expect(exchangeRateEn.conversion).toHaveProperty('convert');
            expect(exchangeRateEn.conversion).toHaveProperty('result');
        });

        it('should have all admin keys', () => {
            const requiredAdminKeys = [
                'config',
                'fetchInterval',
                'fetchIntervalMinutes',
                'fetchIntervalHours',
                'enableAutoFetch',
                'showDisclaimer',
                'disclaimerText',
                'defaultRateType',
                'fetchNow',
                'fetchSuccess',
                'addOverride',
                'removeOverride',
                'history'
            ];

            for (const key of requiredAdminKeys) {
                expect(exchangeRateEn.admin).toHaveProperty(key);
            }
        });

        it('should have all error messages', () => {
            const requiredErrors = [
                'rateNotAvailable',
                'conversionError',
                'fetchError',
                'invalidCurrencyPair',
                'staleRate'
            ];

            for (const error of requiredErrors) {
                expect(exchangeRateEn.errors).toHaveProperty(error);
            }
        });

        it('should have all status translations', () => {
            const requiredStatuses = ['fresh', 'stale', 'manual'];

            for (const status of requiredStatuses) {
                expect(exchangeRateEn.status).toHaveProperty(status);
            }
        });

        it('should have no empty string values', () => {
            expect(hasNoEmptyValues(exchangeRateEn)).toBe(true);
        });
    });

    describe('Cross-locale validation', () => {
        it('should have matching key structures between Spanish and English', () => {
            const esKeys = extractKeys(exchangeRateEs);
            const enKeys = extractKeys(exchangeRateEn);

            expect(esKeys).toEqual(enKeys);
        });

        it('should have matching number of translations', () => {
            const esKeys = extractKeys(exchangeRateEs);
            const enKeys = extractKeys(exchangeRateEn);

            expect(esKeys.length).toBe(enKeys.length);
            expect(esKeys.length).toBeGreaterThan(0);
        });
    });
});
