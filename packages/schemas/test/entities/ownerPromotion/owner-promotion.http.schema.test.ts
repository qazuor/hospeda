/**
 * Tests for owner promotion HTTP schema converter functions.
 *
 * Verifies:
 * - OwnerPromotionSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainOwnerPromotionSearch maps all domain-compatible fields
 * - httpToDomainOwnerPromotionCreate maps to domain create with null coercion
 * - httpToDomainOwnerPromotionUpdate only includes provided fields
 */
import { describe, expect, it } from 'vitest';
import {
    OwnerPromotionSearchHttpSchema,
    httpToDomainOwnerPromotionCreate,
    httpToDomainOwnerPromotionSearch,
    httpToDomainOwnerPromotionUpdate
} from '../../../src/entities/ownerPromotion/owner-promotion.http.schema.js';
import { LifecycleStatusEnum } from '../../../src/enums/lifecycle-state.enum.js';
import { OwnerPromotionDiscountTypeEnum } from '../../../src/enums/owner-promotion-discount-type.enum.js';

// ---------------------------------------------------------------------------
// Valid UUIDs for testing
// ---------------------------------------------------------------------------

const OWNER_UUID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const ACCOMMODATION_UUID = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

// ---------------------------------------------------------------------------
// OwnerPromotionSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('OwnerPromotionSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept ownerId UUID filter', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({ ownerId: OWNER_UUID });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.ownerId).toBe(OWNER_UUID);
        }
    });

    it('should reject non-UUID ownerId', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({ ownerId: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('should accept valid discountType enum', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.discountType).toBe(OwnerPromotionDiscountTypeEnum.PERCENTAGE);
        }
    });

    it('should reject invalid discountType', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({ discountType: 'unknown' });
        expect(result.success).toBe(false);
    });

    it('should coerce minDiscountValue and maxDiscountValue from strings to numbers', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({
            minDiscountValue: '10',
            maxDiscountValue: '50'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.minDiscountValue).toBe(10);
            expect(result.data.maxDiscountValue).toBe(50);
        }
    });

    it('should coerce hasMaxRedemptions from string "true" to boolean', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({ hasMaxRedemptions: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hasMaxRedemptions).toBe(true);
        }
    });

    it('should coerce date range filters from ISO datetime strings', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({
            validFromAfter: '2024-01-01T00:00:00Z',
            validUntilBefore: '2025-12-31T23:59:59Z'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.validFromAfter).toBeInstanceOf(Date);
            expect(result.data.validUntilBefore).toBeInstanceOf(Date);
        }
    });

    it('should reject date range filters without time component (ISO date strings)', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({
            validFromAfter: '2024-01-01'
        });
        expect(result.success).toBe(false);
    });

    it('should accept titleContains text filter', () => {
        const result = OwnerPromotionSearchHttpSchema.safeParse({ titleContains: 'summer' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.titleContains).toBe('summer');
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainOwnerPromotionSearch
// ---------------------------------------------------------------------------

describe('httpToDomainOwnerPromotionSearch', () => {
    it('should map pagination fields to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({ page: '2', pageSize: '25' });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(25);
    });

    it('should map ownerId and accommodationId to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({
            ownerId: OWNER_UUID,
            accommodationId: ACCOMMODATION_UUID
        });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.ownerId).toBe(OWNER_UUID);
        expect(result.accommodationId).toBe(ACCOMMODATION_UUID);
    });

    it('should map discountType filter to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({
            discountType: OwnerPromotionDiscountTypeEnum.FIXED
        });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.discountType).toBe(OwnerPromotionDiscountTypeEnum.FIXED);
    });

    it('should map lifecycleState filter through to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('should map date range filters to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({
            validFromAfter: '2024-01-01T00:00:00Z',
            validFromBefore: '2024-06-30T23:59:59Z',
            validUntilAfter: '2024-07-01T00:00:00Z',
            validUntilBefore: '2024-12-31T23:59:59Z',
            createdAfter: '2024-01-01T00:00:00Z',
            createdBefore: '2024-12-31T23:59:59Z'
        });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.validFromAfter).toBeInstanceOf(Date);
        expect(result.validFromBefore).toBeInstanceOf(Date);
        expect(result.validUntilAfter).toBeInstanceOf(Date);
        expect(result.validUntilBefore).toBeInstanceOf(Date);
        expect(result.createdAfter).toBeInstanceOf(Date);
        expect(result.createdBefore).toBeInstanceOf(Date);
    });

    it('should map discount value range filters', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({
            minDiscountValue: '5',
            maxDiscountValue: '75'
        });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.minDiscountValue).toBe(5);
        expect(result.maxDiscountValue).toBe(75);
    });

    it('should map redemption filters to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({
            hasMaxRedemptions: 'true',
            minCurrentRedemptions: '1',
            maxCurrentRedemptions: '100'
        });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.hasMaxRedemptions).toBe(true);
        expect(result.minCurrentRedemptions).toBe(1);
        expect(result.maxCurrentRedemptions).toBe(100);
    });

    it('should map titleContains filter to domain search', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({ titleContains: 'winter deal' });

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.titleContains).toBe('winter deal');
    });

    it('should handle empty input with all-undefined domain fields', () => {
        // Arrange
        const parsed = OwnerPromotionSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainOwnerPromotionSearch(parsed);

        // Assert
        expect(result.ownerId).toBeUndefined();
        expect(result.discountType).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainOwnerPromotionCreate
// ---------------------------------------------------------------------------

describe('httpToDomainOwnerPromotionCreate', () => {
    const baseValidFrom = new Date('2024-06-01');

    it('should map required fields to domain create input', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            title: 'Summer Discount',
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            discountValue: 20,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.ownerId).toBe(OWNER_UUID);
        expect(result.title).toBe('Summer Discount');
        expect(result.discountType).toBe(OwnerPromotionDiscountTypeEnum.PERCENTAGE);
        expect(result.discountValue).toBe(20);
    });

    it('should coerce optional accommodationId to null when absent', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            title: 'Global Promo',
            discountType: OwnerPromotionDiscountTypeEnum.FIXED,
            discountValue: 500,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.accommodationId).toBeNull();
    });

    it('should include accommodationId when provided', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            accommodationId: ACCOMMODATION_UUID,
            title: 'Property Deal',
            discountType: OwnerPromotionDiscountTypeEnum.FIXED,
            discountValue: 1000,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.accommodationId).toBe(ACCOMMODATION_UUID);
    });

    it('should coerce optional description to null when absent', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            title: 'No Description',
            discountType: OwnerPromotionDiscountTypeEnum.FREE_NIGHT,
            discountValue: 1,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.description).toBeNull();
    });

    it('should coerce optional validUntil to null when absent', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            title: 'Open Ended',
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            discountValue: 10,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.validUntil).toBeNull();
    });

    it('should pass lifecycleState from HTTP data', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            title: 'Draft Promo',
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            discountValue: 15,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.DRAFT
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);
    });

    it('should pass validFrom date through correctly', () => {
        // Arrange
        const httpData = {
            ownerId: OWNER_UUID,
            title: 'Dated Promo',
            discountType: OwnerPromotionDiscountTypeEnum.FIXED,
            discountValue: 200,
            validFrom: baseValidFrom,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };

        // Act
        const result = httpToDomainOwnerPromotionCreate(httpData);

        // Assert
        expect(result.validFrom).toEqual(baseValidFrom);
    });
});

// ---------------------------------------------------------------------------
// httpToDomainOwnerPromotionUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainOwnerPromotionUpdate', () => {
    it('should include title when provided', () => {
        // Arrange
        const httpData = { title: 'Updated Title' };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result.title).toBe('Updated Title');
    });

    it('should include discountType when provided', () => {
        // Arrange
        const httpData = { discountType: OwnerPromotionDiscountTypeEnum.FIXED };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result.discountType).toBe(OwnerPromotionDiscountTypeEnum.FIXED);
    });

    it('should include discountValue when provided', () => {
        // Arrange
        const httpData = { discountValue: 30 };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result.discountValue).toBe(30);
    });

    it('should coerce undefined accommodationId to null in update', () => {
        // Arrange
        const httpData = { accommodationId: undefined };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert — undefined key should not appear in result
        expect('accommodationId' in result).toBe(false);
    });

    it('should include accommodationId as null when explicitly set to null', () => {
        // Arrange — use null explicitly (accommodationId can be cleared)
        const httpData = { accommodationId: null as unknown as string };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result.accommodationId).toBeNull();
    });

    it('should include lifecycleState when provided', () => {
        // Arrange
        const httpData = { lifecycleState: LifecycleStatusEnum.ARCHIVED };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
    });

    it('should include validFrom date when provided', () => {
        // Arrange
        const newDate = new Date('2025-01-01');
        const httpData = { validFrom: newDate };

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result.validFrom).toEqual(newDate);
    });

    it('should return empty object when no fields provided', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainOwnerPromotionUpdate(httpData);

        // Assert
        expect(result).toEqual({});
    });
});
