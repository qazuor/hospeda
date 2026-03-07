import { categoryBg } from '@/lib/category-colors';
/**
 * Tests for category-colors.ts - Event category color mappings.
 */
import { describe, expect, it } from 'vitest';

describe('categoryBg', () => {
    describe('English API category names', () => {
        it('should return accent classes for "cultural"', () => {
            expect(categoryBg('cultural')).toBe('bg-accent text-accent-foreground');
        });

        it('should return primary classes for "sports"', () => {
            expect(categoryBg('sports')).toBe('bg-primary text-primary-foreground');
        });

        it('should return forest classes for "gastronomy"', () => {
            expect(categoryBg('gastronomy')).toBe('bg-hospeda-forest text-card');
        });

        it('should return river classes for "wellness"', () => {
            expect(categoryBg('wellness')).toBe('bg-hospeda-river text-card');
        });
    });

    describe('Spanish legacy category names (from seed data)', () => {
        it('should return accent classes for "Cultura"', () => {
            expect(categoryBg('Cultura')).toBe('bg-accent text-accent-foreground');
        });

        it('should return primary classes for "Deporte"', () => {
            expect(categoryBg('Deporte')).toBe('bg-primary text-primary-foreground');
        });

        it('should return forest classes for "Gastronomia"', () => {
            expect(categoryBg('Gastronomia')).toBe('bg-hospeda-forest text-card');
        });

        it('should return river classes for "Bienestar"', () => {
            expect(categoryBg('Bienestar')).toBe('bg-hospeda-river text-card');
        });
    });

    describe('unknown / fallback categories', () => {
        it('should return accent classes as default for unknown category', () => {
            expect(categoryBg('unknown-category')).toBe('bg-accent text-accent-foreground');
        });

        it('should return accent classes for empty string', () => {
            expect(categoryBg('')).toBe('bg-accent text-accent-foreground');
        });

        it('should be case-sensitive (lowercase "cultura" does not match "Cultura")', () => {
            // 'cultura' (lowercase) should fall through to default
            expect(categoryBg('cultura')).toBe('bg-accent text-accent-foreground');
        });
    });

    describe('return value structure', () => {
        it('should always return a non-empty string', () => {
            const categories = [
                'cultural',
                'sports',
                'gastronomy',
                'wellness',
                'Cultura',
                'Deporte',
                'Gastronomia',
                'Bienestar',
                'other'
            ];
            for (const cat of categories) {
                const result = categoryBg(cat);
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
            }
        });

        it('should always include both bg and text classes', () => {
            const categories = ['cultural', 'sports', 'gastronomy', 'wellness'];
            for (const cat of categories) {
                const result = categoryBg(cat);
                expect(result).toMatch(/bg-/);
                expect(result).toMatch(/text-/);
            }
        });
    });
});
