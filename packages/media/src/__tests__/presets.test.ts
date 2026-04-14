import { describe, expect, it } from 'vitest';
import { MEDIA_PRESETS } from '../presets.js';
import type { MediaPreset } from '../presets.js';

describe('MEDIA_PRESETS', () => {
    const EXPECTED_PRESETS: MediaPreset[] = [
        'thumbnail',
        'card',
        'hero',
        'gallery',
        'avatar',
        'full',
        'og'
    ];

    it('should contain all 7 expected preset keys', () => {
        expect(Object.keys(MEDIA_PRESETS)).toHaveLength(7);
        for (const key of EXPECTED_PRESETS) {
            expect(MEDIA_PRESETS).toHaveProperty(key);
        }
    });

    it('should have non-empty string values for every preset', () => {
        for (const key of EXPECTED_PRESETS) {
            const value = MEDIA_PRESETS[key];
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        }
    });

    describe('thumbnail preset', () => {
        it('should contain w_200 and h_200', () => {
            expect(MEDIA_PRESETS.thumbnail).toContain('w_200');
            expect(MEDIA_PRESETS.thumbnail).toContain('h_200');
        });

        it('should use c_thumb crop mode', () => {
            expect(MEDIA_PRESETS.thumbnail).toContain('c_thumb');
        });
    });

    describe('card preset', () => {
        it('should contain w_400 and h_300', () => {
            expect(MEDIA_PRESETS.card).toContain('w_400');
            expect(MEDIA_PRESETS.card).toContain('h_300');
        });

        it('should use c_fill crop mode', () => {
            expect(MEDIA_PRESETS.card).toContain('c_fill');
        });
    });

    describe('hero preset', () => {
        it('should contain w_1200 and h_600', () => {
            expect(MEDIA_PRESETS.hero).toContain('w_1200');
            expect(MEDIA_PRESETS.hero).toContain('h_600');
        });
    });

    describe('gallery preset', () => {
        it('should contain w_800', () => {
            expect(MEDIA_PRESETS.gallery).toContain('w_800');
        });
    });

    describe('avatar preset', () => {
        it('should contain w_150 and h_150', () => {
            expect(MEDIA_PRESETS.avatar).toContain('w_150');
            expect(MEDIA_PRESETS.avatar).toContain('h_150');
        });

        it('should use face-detection gravity (g_face)', () => {
            expect(MEDIA_PRESETS.avatar).toContain('g_face');
        });
    });

    describe('full preset', () => {
        it('should contain only quality and format transforms', () => {
            expect(MEDIA_PRESETS.full).toContain('q_auto');
            expect(MEDIA_PRESETS.full).toContain('f_auto');
        });
    });

    describe('og preset', () => {
        it('should match Open Graph standard dimensions (1200x630)', () => {
            expect(MEDIA_PRESETS.og).toContain('w_1200');
            expect(MEDIA_PRESETS.og).toContain('h_630');
        });
    });

    describe('all presets', () => {
        it('should include q_auto for automatic quality', () => {
            for (const key of EXPECTED_PRESETS) {
                expect(MEDIA_PRESETS[key]).toContain('q_auto');
            }
        });

        it('should include f_auto for automatic format selection', () => {
            for (const key of EXPECTED_PRESETS) {
                expect(MEDIA_PRESETS[key]).toContain('f_auto');
            }
        });
    });
});
