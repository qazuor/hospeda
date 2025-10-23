import { describe, expect, it } from 'vitest';
import {
    AdSlotReservationStatusEnum,
    AdSlotReservationStatusSchema,
    CampaignChannelEnum,
    CampaignChannelSchema,
    CampaignStatusEnum,
    CampaignStatusSchema,
    MediaAssetTypeEnum,
    MediaAssetTypeSchema
} from '../../src/enums';

describe('Campaigns and Advertising Enums Integration', () => {
    describe('enums can be imported from main index', () => {
        it('should import CampaignChannelEnum', () => {
            expect(CampaignChannelEnum.WEB).toBe('WEB');
            expect(CampaignChannelEnum.SOCIAL).toBe('SOCIAL');
        });

        it('should import CampaignStatusEnum', () => {
            expect(CampaignStatusEnum.DRAFT).toBe('DRAFT');
            expect(CampaignStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(CampaignStatusEnum.PAUSED).toBe('PAUSED');
            expect(CampaignStatusEnum.COMPLETED).toBe('COMPLETED');
            expect(CampaignStatusEnum.CANCELLED).toBe('CANCELLED');
        });

        it('should import MediaAssetTypeEnum', () => {
            expect(MediaAssetTypeEnum.IMAGE).toBe('IMAGE');
            expect(MediaAssetTypeEnum.HTML).toBe('HTML');
            expect(MediaAssetTypeEnum.VIDEO).toBe('VIDEO');
        });

        it('should import AdSlotReservationStatusEnum', () => {
            expect(AdSlotReservationStatusEnum.RESERVED).toBe('RESERVED');
            expect(AdSlotReservationStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(AdSlotReservationStatusEnum.PAUSED).toBe('PAUSED');
            expect(AdSlotReservationStatusEnum.ENDED).toBe('ENDED');
            expect(AdSlotReservationStatusEnum.CANCELLED).toBe('CANCELLED');
        });
    });

    describe('schemas can validate enum values', () => {
        it('should validate campaign workflow', () => {
            // Valid campaign progression
            expect(CampaignStatusSchema.parse('DRAFT')).toBe('DRAFT');
            expect(CampaignStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(CampaignStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(CampaignStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
        });

        it('should validate ad slot reservation workflow', () => {
            // Valid ad slot reservation progression
            expect(AdSlotReservationStatusSchema.parse('RESERVED')).toBe('RESERVED');
            expect(AdSlotReservationStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(AdSlotReservationStatusSchema.parse('ENDED')).toBe('ENDED');
        });

        it('should validate media assets for campaigns', () => {
            const mediaTypes = ['IMAGE', 'HTML', 'VIDEO'];
            for (const type of mediaTypes) {
                expect(MediaAssetTypeSchema.parse(type)).toBe(type);
            }
        });

        it('should validate campaign channels', () => {
            const channels = ['WEB', 'SOCIAL'];
            for (const channel of channels) {
                expect(CampaignChannelSchema.parse(channel)).toBe(channel);
            }
        });
    });

    describe('business logic validations', () => {
        it('should have consistent pause/active states between campaign and ad slot', () => {
            // Both have ACTIVE and PAUSED states for consistency
            expect(CampaignStatusEnum.ACTIVE).toBe(AdSlotReservationStatusEnum.ACTIVE);
            expect(CampaignStatusEnum.PAUSED).toBe(AdSlotReservationStatusEnum.PAUSED);
        });

        it('should have different final states for campaign vs ad slot', () => {
            // Campaign ends as COMPLETED, ad slot ends as ENDED
            expect(CampaignStatusEnum.COMPLETED).toBe('COMPLETED');
            expect(AdSlotReservationStatusEnum.ENDED).toBe('ENDED');
        });

        it('should support cancellation for both campaigns and ad slots', () => {
            expect(CampaignStatusEnum.CANCELLED).toBe('CANCELLED');
            expect(AdSlotReservationStatusEnum.CANCELLED).toBe('CANCELLED');
        });
    });

    describe('enum completeness', () => {
        it('should have correct number of values in each enum', () => {
            expect(Object.values(CampaignChannelEnum)).toHaveLength(2);
            expect(Object.values(CampaignStatusEnum)).toHaveLength(5);
            expect(Object.values(MediaAssetTypeEnum)).toHaveLength(3);
            expect(Object.values(AdSlotReservationStatusEnum)).toHaveLength(5);
        });

        it('should validate that all enum values are strings', () => {
            for (const value of Object.values(CampaignChannelEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(CampaignStatusEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(MediaAssetTypeEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(AdSlotReservationStatusEnum)) {
                expect(typeof value).toBe('string');
            }
        });
    });
});
