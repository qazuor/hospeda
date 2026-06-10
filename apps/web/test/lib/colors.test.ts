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

    it('should use the per-type token with the contrast treatment (light fill + dark text)', () => {
        // Web now consumes the SAME `contrast` variant as admin so the badge
        // is identical across apps. Each type references its own distinct
        // per-type token `--accommodation-type-<type>` and the contrast variant
        // derives bg (0.95 L / reduced chroma), text (0.4 L / full chroma),
        // border (0.88 L / reduced chroma) from that token's hue.
        const result = getAccommodationTypeColor({ type: 'hotel' });
        expect(result.bg).toBe('oklch(from var(--accommodation-type-hotel) 0.95 calc(c * 0.55) h)');
        expect(result.text).toBe('oklch(from var(--accommodation-type-hotel) 0.4 c h)');
        expect(result.border).toBe(
            'oklch(from var(--accommodation-type-hotel) 0.88 calc(c * 0.55) h)'
        );
    });

    it('should give each type its OWN distinct per-type token', () => {
        const hotel = getAccommodationTypeColor({ type: 'hotel' });
        const cabin = getAccommodationTypeColor({ type: 'cabin' });
        const resort = getAccommodationTypeColor({ type: 'resort' });
        expect(hotel.text).toContain('--accommodation-type-hotel');
        expect(cabin.text).toContain('--accommodation-type-cabin');
        expect(resort.text).toContain('--accommodation-type-resort');
        // No two types share the same token.
        expect(new Set([hotel.text, cabin.text, resort.text]).size).toBe(3);
    });

    it('should normalize country_house to the kebab-case per-type token', () => {
        const result = getAccommodationTypeColor({ type: 'COUNTRY_HOUSE' });
        expect(result.text).toBe('oklch(from var(--accommodation-type-country-house) 0.4 c h)');
    });

    it('should fall back to the hotel per-type token for unknown types', () => {
        const result = getAccommodationTypeColor({ type: 'unknown_type' });
        expect(result.text).toBe('oklch(from var(--accommodation-type-hotel) 0.4 c h)');
    });
});
