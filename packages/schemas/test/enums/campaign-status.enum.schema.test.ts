import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { CampaignStatusEnum } from '../../src/enums/campaign-status.enum';
import { CampaignStatusSchema } from '../../src/enums/campaign-status.schema';

describe('CampaignStatusEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(CampaignStatusEnum.DRAFT).toBe('DRAFT');
            expect(CampaignStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(CampaignStatusEnum.PAUSED).toBe('PAUSED');
            expect(CampaignStatusEnum.COMPLETED).toBe('COMPLETED');
            expect(CampaignStatusEnum.CANCELLED).toBe('CANCELLED');
        });

        it('should have exactly 5 values', () => {
            const values = Object.values(CampaignStatusEnum);
            expect(values).toHaveLength(5);
        });

        it('should contain all expected values', () => {
            const values = Object.values(CampaignStatusEnum);
            expect(values).toEqual(
                expect.arrayContaining(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
            );
        });
    });

    describe('CampaignStatusSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(CampaignStatusSchema.parse('DRAFT')).toBe('DRAFT');
            expect(CampaignStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(CampaignStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(CampaignStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
            expect(CampaignStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
        });

        it('should reject invalid values', () => {
            expect(() => CampaignStatusSchema.parse('INVALID')).toThrow();
            expect(() => CampaignStatusSchema.parse('')).toThrow();
            expect(() => CampaignStatusSchema.parse(null)).toThrow();
            expect(() => CampaignStatusSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                CampaignStatusSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.campaignStatus.invalid');
            }
        });
    });
});
