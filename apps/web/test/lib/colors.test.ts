/**
 * @file colors.test.ts
 * @description Unit tests for color mapping functions.
 */

import { describe, expect, it } from 'vitest';
import {
    getAccommodationTypeColor,
    getPostCategoryColor,
    getPostCategoryLabel
} from '../../src/lib/colors';

describe('getPostCategoryColor', () => {
    it('should return a ColorScheme for known categories', () => {
        const result = getPostCategoryColor({ category: 'TOURISM' });
        expect(result).toHaveProperty('bg');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('border');
    });

    it('should return primary scheme for unknown categories', () => {
        const result = getPostCategoryColor({ category: 'UNKNOWN_CATEGORY' });
        expect(result.text).toContain('primary');
    });

    it('should handle all PostCategoryEnum values', () => {
        const categories = [
            'TOURISM',
            'TIPS',
            'GASTRONOMY',
            'CULTURE',
            'NATURE',
            'EVENTS',
            'SPORT',
            'CARNIVAL',
            'NIGHTLIFE',
            'HISTORY',
            'TRADITIONS',
            'WELLNESS',
            'FAMILY',
            'ART',
            'BEACH',
            'RURAL',
            'FESTIVALS',
            'GENERAL'
        ];
        for (const category of categories) {
            const result = getPostCategoryColor({ category });
            expect(result.bg).toBeTruthy();
            expect(result.text).toBeTruthy();
            expect(result.border).toBeTruthy();
        }
    });
});

describe('getPostCategoryLabel', () => {
    it('should return translated label via t() for known category', () => {
        const mockT = (key: string, fallback?: string) => fallback ?? key;
        const result = getPostCategoryLabel({ category: 'TOURISM', t: mockT });
        expect(result).toBe('TOURISM'); // fallback = category name
    });

    it('should return category string for unknown category', () => {
        const mockT = (key: string, fallback?: string) => fallback ?? key;
        const result = getPostCategoryLabel({ category: 'UNKNOWN', t: mockT });
        expect(result).toBe('UNKNOWN');
    });

    it('should call t with the correct i18n key', () => {
        const calls: string[] = [];
        const mockT = (key: string, _fallback?: string) => {
            calls.push(key);
            return `translated:${key}`;
        };
        getPostCategoryLabel({ category: 'GASTRONOMY', t: mockT });
        expect(calls).toContain('blog.categories.gastronomy');
    });
});

describe('getAccommodationTypeColor', () => {
    it('should return a ColorScheme for known types', () => {
        const result = getAccommodationTypeColor({ type: 'hotel' });
        expect(result).toHaveProperty('bg');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('border');
    });

    it('should return accent scheme for unknown types', () => {
        const result = getAccommodationTypeColor({ type: 'unknown_type' });
        expect(result.text).toContain('accent');
    });
});
