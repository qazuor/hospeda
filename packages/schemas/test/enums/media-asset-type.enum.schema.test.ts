import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { MediaAssetTypeEnum } from '../../src/enums/media-asset-type.enum';
import { MediaAssetTypeSchema } from '../../src/enums/media-asset-type.schema';

describe('MediaAssetTypeEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(MediaAssetTypeEnum.IMAGE).toBe('IMAGE');
            expect(MediaAssetTypeEnum.HTML).toBe('HTML');
            expect(MediaAssetTypeEnum.VIDEO).toBe('VIDEO');
        });

        it('should have exactly 3 values', () => {
            const values = Object.values(MediaAssetTypeEnum);
            expect(values).toHaveLength(3);
        });

        it('should contain all expected values', () => {
            const values = Object.values(MediaAssetTypeEnum);
            expect(values).toEqual(expect.arrayContaining(['IMAGE', 'HTML', 'VIDEO']));
        });
    });

    describe('MediaAssetTypeSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(MediaAssetTypeSchema.parse('IMAGE')).toBe('IMAGE');
            expect(MediaAssetTypeSchema.parse('HTML')).toBe('HTML');
            expect(MediaAssetTypeSchema.parse('VIDEO')).toBe('VIDEO');
        });

        it('should reject invalid values', () => {
            expect(() => MediaAssetTypeSchema.parse('INVALID')).toThrow();
            expect(() => MediaAssetTypeSchema.parse('')).toThrow();
            expect(() => MediaAssetTypeSchema.parse(null)).toThrow();
            expect(() => MediaAssetTypeSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                MediaAssetTypeSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.mediaAssetType.invalid');
            }
        });
    });
});
