import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ScheduleSocialPostSchema } from '../../entities/social/social-post.http.schema.js';
import { SocialApprovalStatusEnum } from '../social-approval-status.enum.js';
import { SocialApprovalStatusEnumSchema } from '../social-approval-status.schema.js';
import { SocialAssetSourceEnum } from '../social-asset-source.enum.js';
import { SocialAssetSourceEnumSchema } from '../social-asset-source.schema.js';
import { SocialMediaTypeEnum } from '../social-media-type.enum.js';
import { SocialMediaTypeEnumSchema } from '../social-media-type.schema.js';
import { SocialPlatformEnum } from '../social-platform.enum.js';
import { SocialPlatformEnumSchema } from '../social-platform.schema.js';
import { SocialPostStatusEnum } from '../social-post-status.enum.js';
import { SocialPostStatusEnumSchema } from '../social-post-status.schema.js';
import { SocialPublishFormatEnum } from '../social-publish-format.enum.js';
import { SocialPublishFormatEnumSchema } from '../social-publish-format.schema.js';
import { SocialPublishResultStatusEnum } from '../social-publish-result-status.enum.js';
import { SocialPublishResultStatusEnumSchema } from '../social-publish-result-status.schema.js';
import { SocialRecurrenceTypeEnum } from '../social-recurrence-type.enum.js';
import { SocialRecurrenceTypeEnumSchema } from '../social-recurrence-type.schema.js';
import { SocialSourceEnum } from '../social-source.enum.js';
import { SocialSourceEnumSchema } from '../social-source.schema.js';

// ============================================================================
// SPEC-254 social automation enums — 9 enum files, each with a Zod schema
// ============================================================================

// ----------------------------------------------------------------------------
// SocialPlatformEnum
// ----------------------------------------------------------------------------

describe('SocialPlatformEnum', () => {
    it('should have exactly 3 values', () => {
        // Arrange / Act
        const values = Object.values(SocialPlatformEnum);

        // Assert
        expect(values).toHaveLength(3);
    });

    it('should include INSTAGRAM', () => {
        expect(SocialPlatformEnum.INSTAGRAM).toBe('INSTAGRAM');
    });

    it('should include FACEBOOK', () => {
        expect(SocialPlatformEnum.FACEBOOK).toBe('FACEBOOK');
    });

    it('should include X', () => {
        expect(SocialPlatformEnum.X).toBe('X');
    });

    describe('SocialPlatformEnumSchema', () => {
        it('should accept all 3 values', () => {
            for (const value of Object.values(SocialPlatformEnum)) {
                const result = SocialPlatformEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown platform', () => {
            // Arrange / Act
            const result = SocialPlatformEnumSchema.safeParse('TIKTOK');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialPlatformEnumSchema.safeParse('instagram').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialPlatformEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialPlatformEnumSchema.parse('FACEBOOK');

            // Assert
            expect(parsed).toBe(SocialPlatformEnum.FACEBOOK);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialPlatformEnumSchema.parse('LINKEDIN')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialPublishFormatEnum
// ----------------------------------------------------------------------------

describe('SocialPublishFormatEnum', () => {
    it('should have exactly 8 values', () => {
        // Arrange / Act
        const values = Object.values(SocialPublishFormatEnum);

        // Assert
        expect(values).toHaveLength(8);
    });

    it('should include FEED_POST', () => {
        expect(SocialPublishFormatEnum.FEED_POST).toBe('FEED_POST');
    });

    it('should include PHOTO_POST', () => {
        expect(SocialPublishFormatEnum.PHOTO_POST).toBe('PHOTO_POST');
    });

    it('should include TEXT_POST', () => {
        expect(SocialPublishFormatEnum.TEXT_POST).toBe('TEXT_POST');
    });

    it('should include IMAGE_POST', () => {
        expect(SocialPublishFormatEnum.IMAGE_POST).toBe('IMAGE_POST');
    });

    it('should include VIDEO_POST', () => {
        expect(SocialPublishFormatEnum.VIDEO_POST).toBe('VIDEO_POST');
    });

    it('should include REEL', () => {
        expect(SocialPublishFormatEnum.REEL).toBe('REEL');
    });

    it('should include STORY', () => {
        expect(SocialPublishFormatEnum.STORY).toBe('STORY');
    });

    it('should include CAROUSEL', () => {
        expect(SocialPublishFormatEnum.CAROUSEL).toBe('CAROUSEL');
    });

    describe('SocialPublishFormatEnumSchema', () => {
        it('should accept all 8 values', () => {
            for (const value of Object.values(SocialPublishFormatEnum)) {
                const result = SocialPublishFormatEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown format', () => {
            // Arrange / Act
            const result = SocialPublishFormatEnumSchema.safeParse('LIVE_STREAM');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialPublishFormatEnumSchema.safeParse('reel').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialPublishFormatEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialPublishFormatEnumSchema.parse('CAROUSEL');

            // Assert
            expect(parsed).toBe(SocialPublishFormatEnum.CAROUSEL);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialPublishFormatEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialMediaTypeEnum
// ----------------------------------------------------------------------------

describe('SocialMediaTypeEnum', () => {
    it('should have exactly 3 values', () => {
        expect(Object.values(SocialMediaTypeEnum)).toHaveLength(3);
    });

    it('should include IMAGE', () => {
        expect(SocialMediaTypeEnum.IMAGE).toBe('IMAGE');
    });

    it('should include VIDEO', () => {
        expect(SocialMediaTypeEnum.VIDEO).toBe('VIDEO');
    });

    it('should include NONE', () => {
        expect(SocialMediaTypeEnum.NONE).toBe('NONE');
    });

    describe('SocialMediaTypeEnumSchema', () => {
        it('should accept all 3 values', () => {
            for (const value of Object.values(SocialMediaTypeEnum)) {
                const result = SocialMediaTypeEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown media type', () => {
            // Arrange / Act
            const result = SocialMediaTypeEnumSchema.safeParse('AUDIO');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialMediaTypeEnumSchema.safeParse('image').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialMediaTypeEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialMediaTypeEnumSchema.parse('VIDEO');

            // Assert
            expect(parsed).toBe(SocialMediaTypeEnum.VIDEO);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialMediaTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialPostStatusEnum
// ----------------------------------------------------------------------------

describe('SocialPostStatusEnum', () => {
    it('should have exactly 10 values', () => {
        expect(Object.values(SocialPostStatusEnum)).toHaveLength(10);
    });

    it('should include DRAFT', () => {
        expect(SocialPostStatusEnum.DRAFT).toBe('DRAFT');
    });

    it('should include NEEDS_REVIEW', () => {
        expect(SocialPostStatusEnum.NEEDS_REVIEW).toBe('NEEDS_REVIEW');
    });

    it('should include APPROVED', () => {
        expect(SocialPostStatusEnum.APPROVED).toBe('APPROVED');
    });

    it('should include SCHEDULED', () => {
        expect(SocialPostStatusEnum.SCHEDULED).toBe('SCHEDULED');
    });

    it('should include READY_TO_PUBLISH', () => {
        expect(SocialPostStatusEnum.READY_TO_PUBLISH).toBe('READY_TO_PUBLISH');
    });

    it('should include PUBLISHING', () => {
        expect(SocialPostStatusEnum.PUBLISHING).toBe('PUBLISHING');
    });

    it('should include PUBLISHED', () => {
        expect(SocialPostStatusEnum.PUBLISHED).toBe('PUBLISHED');
    });

    it('should include FAILED', () => {
        expect(SocialPostStatusEnum.FAILED).toBe('FAILED');
    });

    it('should include PAUSED', () => {
        expect(SocialPostStatusEnum.PAUSED).toBe('PAUSED');
    });

    it('should include ARCHIVED', () => {
        expect(SocialPostStatusEnum.ARCHIVED).toBe('ARCHIVED');
    });

    describe('SocialPostStatusEnumSchema', () => {
        it('should accept all 10 values', () => {
            for (const value of Object.values(SocialPostStatusEnum)) {
                const result = SocialPostStatusEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown status', () => {
            // Arrange / Act
            const result = SocialPostStatusEnumSchema.safeParse('PENDING');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialPostStatusEnumSchema.safeParse('draft').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialPostStatusEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialPostStatusEnumSchema.parse('NEEDS_REVIEW');

            // Assert
            expect(parsed).toBe(SocialPostStatusEnum.NEEDS_REVIEW);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialPostStatusEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialApprovalStatusEnum
// ----------------------------------------------------------------------------

describe('SocialApprovalStatusEnum', () => {
    it('should have exactly 4 values', () => {
        expect(Object.values(SocialApprovalStatusEnum)).toHaveLength(4);
    });

    it('should include PENDING', () => {
        expect(SocialApprovalStatusEnum.PENDING).toBe('PENDING');
    });

    it('should include APPROVED', () => {
        expect(SocialApprovalStatusEnum.APPROVED).toBe('APPROVED');
    });

    it('should include REJECTED', () => {
        expect(SocialApprovalStatusEnum.REJECTED).toBe('REJECTED');
    });

    it('should include CHANGES_REQUESTED', () => {
        expect(SocialApprovalStatusEnum.CHANGES_REQUESTED).toBe('CHANGES_REQUESTED');
    });

    describe('SocialApprovalStatusEnumSchema', () => {
        it('should accept all 4 values', () => {
            for (const value of Object.values(SocialApprovalStatusEnum)) {
                const result = SocialApprovalStatusEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown approval status', () => {
            // Arrange / Act
            const result = SocialApprovalStatusEnumSchema.safeParse('UNDER_REVIEW');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialApprovalStatusEnumSchema.safeParse('pending').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialApprovalStatusEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialApprovalStatusEnumSchema.parse('CHANGES_REQUESTED');

            // Assert
            expect(parsed).toBe(SocialApprovalStatusEnum.CHANGES_REQUESTED);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialApprovalStatusEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialSourceEnum
// ----------------------------------------------------------------------------

describe('SocialSourceEnum', () => {
    it('should have exactly 4 values', () => {
        expect(Object.values(SocialSourceEnum)).toHaveLength(4);
    });

    it('should include CHATGPT', () => {
        expect(SocialSourceEnum.CHATGPT).toBe('CHATGPT');
    });

    it('should include ADMIN', () => {
        expect(SocialSourceEnum.ADMIN).toBe('ADMIN');
    });

    it('should include IMPORT', () => {
        expect(SocialSourceEnum.IMPORT).toBe('IMPORT');
    });

    it('should include SYSTEM', () => {
        expect(SocialSourceEnum.SYSTEM).toBe('SYSTEM');
    });

    describe('SocialSourceEnumSchema', () => {
        it('should accept all 4 values', () => {
            for (const value of Object.values(SocialSourceEnum)) {
                const result = SocialSourceEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown source', () => {
            // Arrange / Act
            const result = SocialSourceEnumSchema.safeParse('API');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialSourceEnumSchema.safeParse('chatgpt').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialSourceEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialSourceEnumSchema.parse('CHATGPT');

            // Assert
            expect(parsed).toBe(SocialSourceEnum.CHATGPT);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialSourceEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialAssetSourceEnum
// ----------------------------------------------------------------------------

describe('SocialAssetSourceEnum', () => {
    it('should have exactly 4 values', () => {
        expect(Object.values(SocialAssetSourceEnum)).toHaveLength(4);
    });

    it('should include CHATGPT_FILE', () => {
        expect(SocialAssetSourceEnum.CHATGPT_FILE).toBe('CHATGPT_FILE');
    });

    it('should include CLOUDINARY', () => {
        expect(SocialAssetSourceEnum.CLOUDINARY).toBe('CLOUDINARY');
    });

    it('should include MANUAL_UPLOAD', () => {
        expect(SocialAssetSourceEnum.MANUAL_UPLOAD).toBe('MANUAL_UPLOAD');
    });

    it('should include EXTERNAL_URL', () => {
        expect(SocialAssetSourceEnum.EXTERNAL_URL).toBe('EXTERNAL_URL');
    });

    describe('SocialAssetSourceEnumSchema', () => {
        it('should accept all 4 values', () => {
            for (const value of Object.values(SocialAssetSourceEnum)) {
                const result = SocialAssetSourceEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown asset source', () => {
            // Arrange / Act
            const result = SocialAssetSourceEnumSchema.safeParse('S3_UPLOAD');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialAssetSourceEnumSchema.safeParse('cloudinary').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialAssetSourceEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialAssetSourceEnumSchema.parse('EXTERNAL_URL');

            // Assert
            expect(parsed).toBe(SocialAssetSourceEnum.EXTERNAL_URL);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialAssetSourceEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// SocialPublishResultStatusEnum
// ----------------------------------------------------------------------------

describe('SocialPublishResultStatusEnum', () => {
    it('should have exactly 4 values', () => {
        expect(Object.values(SocialPublishResultStatusEnum)).toHaveLength(4);
    });

    it('should include SUCCESS', () => {
        expect(SocialPublishResultStatusEnum.SUCCESS).toBe('SUCCESS');
    });

    it('should include FAILED', () => {
        expect(SocialPublishResultStatusEnum.FAILED).toBe('FAILED');
    });

    it('should include SKIPPED', () => {
        expect(SocialPublishResultStatusEnum.SKIPPED).toBe('SKIPPED');
    });

    it('should include RETRYING', () => {
        expect(SocialPublishResultStatusEnum.RETRYING).toBe('RETRYING');
    });

    describe('SocialPublishResultStatusEnumSchema', () => {
        it('should accept all 4 values', () => {
            for (const value of Object.values(SocialPublishResultStatusEnum)) {
                const result = SocialPublishResultStatusEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown result status', () => {
            // Arrange / Act
            const result = SocialPublishResultStatusEnumSchema.safeParse('PENDING');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialPublishResultStatusEnumSchema.safeParse('success').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialPublishResultStatusEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialPublishResultStatusEnumSchema.parse('RETRYING');

            // Assert
            expect(parsed).toBe(SocialPublishResultStatusEnum.RETRYING);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialPublishResultStatusEnumSchema.parse('INVALID')).toThrowError(
                ZodError
            );
        });
    });
});

// ----------------------------------------------------------------------------
// SocialRecurrenceTypeEnum
// ----------------------------------------------------------------------------

describe('SocialRecurrenceTypeEnum', () => {
    it('should have exactly 4 values', () => {
        expect(Object.values(SocialRecurrenceTypeEnum)).toHaveLength(4);
    });

    it('should include ONCE', () => {
        expect(SocialRecurrenceTypeEnum.ONCE).toBe('ONCE');
    });

    it('should include WEEKLY', () => {
        expect(SocialRecurrenceTypeEnum.WEEKLY).toBe('WEEKLY');
    });

    it('should include BIWEEKLY', () => {
        expect(SocialRecurrenceTypeEnum.BIWEEKLY).toBe('BIWEEKLY');
    });

    it('should include MONTHLY', () => {
        expect(SocialRecurrenceTypeEnum.MONTHLY).toBe('MONTHLY');
    });

    describe('SocialRecurrenceTypeEnumSchema', () => {
        it('should accept all 4 values', () => {
            for (const value of Object.values(SocialRecurrenceTypeEnum)) {
                const result = SocialRecurrenceTypeEnumSchema.safeParse(value);
                expect(result.success).toBe(true);
            }
        });

        it('should reject an unknown recurrence type', () => {
            // Arrange / Act
            const result = SocialRecurrenceTypeEnumSchema.safeParse('DAILY');

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject lowercase variants', () => {
            expect(SocialRecurrenceTypeEnumSchema.safeParse('weekly').success).toBe(false);
        });

        it('should reject empty string', () => {
            expect(SocialRecurrenceTypeEnumSchema.safeParse('').success).toBe(false);
        });

        it('should parse a valid value and return the enum member', () => {
            // Arrange / Act
            const parsed = SocialRecurrenceTypeEnumSchema.parse('BIWEEKLY');

            // Assert
            expect(parsed).toBe(SocialRecurrenceTypeEnum.BIWEEKLY);
        });

        it('should throw ZodError on parse of an invalid value', () => {
            expect(() => SocialRecurrenceTypeEnumSchema.parse('INVALID')).toThrowError(ZodError);
        });
    });
});

// ----------------------------------------------------------------------------
// ScheduleSocialPostSchema — cross-field recurrence refinement (SPEC-254)
// ----------------------------------------------------------------------------

describe('ScheduleSocialPostSchema — recurrence cross-field validation', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();

    describe('WEEKLY recurrence', () => {
        it('should accept WEEKLY with a valid weekday', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'WEEKLY',
                recurrenceParamsJson: { weekday: 'TUESDAY' }
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should reject WEEKLY without recurrenceParamsJson', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'WEEKLY'
            });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('recurrenceParamsJson.weekday');
            }
        });

        it('should reject WEEKLY when weekday is an invalid day name', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'WEEKLY',
                recurrenceParamsJson: { weekday: 'FUNDAY' }
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject WEEKLY when weekday is lowercase', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'WEEKLY',
                recurrenceParamsJson: { weekday: 'tuesday' }
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('ONCE recurrence (default)', () => {
        it('should accept ONCE without recurrenceParamsJson', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC'
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.recurrenceType).toBe(SocialRecurrenceTypeEnum.ONCE);
            }
        });

        it('should accept ONCE even when recurrenceParamsJson is provided (not an error)', () => {
            // Arrange / Act — the schema does not reject extra params for non-WEEKLY types,
            // but the service will ignore/null them out.
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'ONCE',
                recurrenceParamsJson: { weekday: 'MONDAY' }
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('BIWEEKLY recurrence', () => {
        it('should accept BIWEEKLY without recurrenceParamsJson', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'BIWEEKLY'
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('MONTHLY recurrence', () => {
        it('should accept MONTHLY without recurrenceParamsJson', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                timezone: 'UTC',
                recurrenceType: 'MONTHLY'
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('required base fields', () => {
        it('should reject when timezone is missing', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                scheduledAt: futureDate,
                recurrenceType: 'ONCE'
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject when scheduledAt is missing', () => {
            // Arrange / Act
            const result = ScheduleSocialPostSchema.safeParse({
                timezone: 'UTC',
                recurrenceType: 'ONCE'
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
