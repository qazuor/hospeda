/**
 * SPEC-167 T-002 — `planRestricted` Zod schema tests.
 *
 * Verifies that the `planRestricted` boolean field is correctly defined on:
 *   (1) AccommodationSchema — full entity round-trip and default
 *   (2) AccommodationCreateInputSchema / AccommodationUpdateInputSchema — field is omitted (server-managed)
 *   (3) OwnerPromotionSchema — no longer declares it (the column was dropped by HOS-1419)
 *   (4) OwnerPromotionCreateInputSchema / OwnerPromotionUpdateInputSchema — field is rejected
 *
 * Design decision D-3 (SPEC-167 §4): `planRestricted` MUST be a separate flag from
 * `ownerSuspended` (accommodations) and `lifecycleState` (promotions) so the two
 * restriction states do not collide.
 *
 * References: SPEC-167 §3, §4 (D-3), T-002.
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationCreateInputSchema,
    AccommodationUpdateInputSchema
} from '../../src/entities/accommodation/accommodation.crud.schema.js';
import { AccommodationSchema } from '../../src/entities/accommodation/accommodation.schema.js';
import {
    OwnerPromotionCreateInputSchema,
    OwnerPromotionUpdateInputSchema
} from '../../src/entities/ownerPromotion/owner-promotion.crud.schema.js';
import { OwnerPromotionSchema } from '../../src/entities/ownerPromotion/owner-promotion.schema.js';
import {
    createMinimalAccommodation,
    createValidAccommodation
} from '../fixtures/accommodation.fixtures.js';
import { createOwnerPromotionCreateInput } from '../fixtures/ownerPromotion.fixtures.js';

// ─── AccommodationSchema ─────────────────────────────────────────────────────

describe('AccommodationSchema.planRestricted (SPEC-167 T-002)', () => {
    it('defaults to false when not provided', () => {
        // Arrange
        const data = createMinimalAccommodation();

        // Act
        const result = AccommodationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.planRestricted).toBe(false);
        }
    });

    it('round-trips planRestricted: true through parse', () => {
        // Arrange
        const data = { ...createValidAccommodation(), planRestricted: true };

        // Act
        const result = AccommodationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.planRestricted).toBe(true);
        }
    });

    it('round-trips planRestricted: false through parse', () => {
        // Arrange
        const data = { ...createValidAccommodation(), planRestricted: false };

        // Act
        const result = AccommodationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.planRestricted).toBe(false);
        }
    });

    it('is a distinct field from ownerSuspended (D-3: states must not collide)', () => {
        // Arrange: both flags set independently
        const data = { ...createValidAccommodation(), ownerSuspended: true, planRestricted: false };

        // Act
        const result = AccommodationSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.ownerSuspended).toBe(true);
            expect(result.data.planRestricted).toBe(false);
        }
    });
});

// ─── AccommodationCreateInputSchema ─────────────────────────────────────────

describe('AccommodationCreateInputSchema.planRestricted omitted (SPEC-167 T-002)', () => {
    it('rejects planRestricted in create input (server-managed field)', () => {
        // Arrange — fixture does NOT include planRestricted; add it explicitly
        const base = createMinimalAccommodation();
        // Remove fields that are not in create input schema
        const {
            id: _id,
            createdAt: _ca,
            updatedAt: _ua,
            createdById: _cb,
            updatedById: _ub,
            ...withoutAudit
        } = base;
        const input = { ...withoutAudit, planRestricted: true };

        // Act — .strict() surfaces the unknown key
        const result = AccommodationCreateInputSchema.strict().safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

// ─── AccommodationUpdateInputSchema ─────────────────────────────────────────

describe('AccommodationUpdateInputSchema.planRestricted omitted (SPEC-167 T-002)', () => {
    it('rejects planRestricted in update input (server-managed field)', () => {
        // Arrange
        const input = { name: 'Updated Name', planRestricted: true };

        // Act — .strict() surfaces the unknown key
        const result = AccommodationUpdateInputSchema.strict().safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

// ─── OwnerPromotionSchema ────────────────────────────────────────────────────

describe('OwnerPromotionSchema no longer declares planRestricted (HOS-1419)', () => {
    it('drops the old plan-downgrade flag with its column', () => {
        // Arrange
        const shape = OwnerPromotionSchema.shape as Record<string, unknown>;

        // Act + Assert — `owner_promotions.plan_restricted` was dropped with the
        // old billing; `accommodations.plan_restricted` (above) survives.
        expect(shape.planRestricted).toBeUndefined();
    });
});

// ─── OwnerPromotionCreateInputSchema ────────────────────────────────────────

describe('OwnerPromotionCreateInputSchema.planRestricted omitted (SPEC-167 T-002)', () => {
    it('rejects planRestricted in create input (server-managed field)', () => {
        // Arrange
        const input = { ...createOwnerPromotionCreateInput(), planRestricted: true };

        // Act — .strict() surfaces the unknown key
        const result = OwnerPromotionCreateInputSchema.strict().safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});

// ─── OwnerPromotionUpdateInputSchema ────────────────────────────────────────

describe('OwnerPromotionUpdateInputSchema.planRestricted omitted (SPEC-167 T-002)', () => {
    it('rejects planRestricted in update input (server-managed field)', () => {
        // Arrange — update schema is .strict() already; add planRestricted
        const input = { title: 'Updated Title', planRestricted: false };

        // Act
        const result = OwnerPromotionUpdateInputSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(false);
    });
});
