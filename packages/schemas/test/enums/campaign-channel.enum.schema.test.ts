import { describe, expect, it } from 'vitest';
import type { ZodError } from 'zod';
import { CampaignChannelEnum } from '../../src/enums/campaign-channel.enum';
import { CampaignChannelSchema } from '../../src/enums/campaign-channel.schema';

describe('CampaignChannelEnum', () => {
    describe('enum values', () => {
        it('should have correct enum values', () => {
            expect(CampaignChannelEnum.WEB).toBe('WEB');
            expect(CampaignChannelEnum.SOCIAL).toBe('SOCIAL');
        });

        it('should have exactly 2 values', () => {
            const values = Object.values(CampaignChannelEnum);
            expect(values).toHaveLength(2);
        });

        it('should contain all expected values', () => {
            const values = Object.values(CampaignChannelEnum);
            expect(values).toEqual(expect.arrayContaining(['WEB', 'SOCIAL']));
        });
    });

    describe('CampaignChannelSchema validation', () => {
        it('should validate correct enum values', () => {
            expect(CampaignChannelSchema.parse('WEB')).toBe('WEB');
            expect(CampaignChannelSchema.parse('SOCIAL')).toBe('SOCIAL');
        });

        it('should reject invalid values', () => {
            expect(() => CampaignChannelSchema.parse('INVALID')).toThrow();
            expect(() => CampaignChannelSchema.parse('')).toThrow();
            expect(() => CampaignChannelSchema.parse(null)).toThrow();
            expect(() => CampaignChannelSchema.parse(undefined)).toThrow();
        });

        it('should have correct error message for invalid values', () => {
            try {
                CampaignChannelSchema.parse('INVALID');
                expect.fail('Should have thrown an error');
            } catch (error) {
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.campaignChannel.invalid');
            }
        });
    });
});
