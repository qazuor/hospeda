import { describe, expect, it } from 'vitest';
import { ExperiencePriceUnitEnum } from '../../../enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
import {
    ExperienceAdminSchema,
    ExperienceProtectedSchema,
    ExperiencePublicSchema
} from '../experience.access.schema.js';

// ============================================================================
// Helpers
// ============================================================================

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const buildPublicExperience = (
    overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
    id: VALID_UUID,
    name: 'Excursión a Colón',
    slug: 'excursion-a-colon',
    summary: 'Visitá la ciudad vecina de Colón con guía incluido.',
    description:
        'Una excursión completa a la ciudad de Colón, con visita a las termas y el parque nacional.',
    type: ExperienceTypeEnum.EXCURSION,
    priceFrom: 1500000,
    priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
    isPriceOnRequest: false,
    hasActiveSubscription: true,
    isFeatured: false,
    destinationId: VALID_UUID,
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 12,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    // BaseAuditFields: nullable (not optional) — must be explicitly null when absent
    createdById: null,
    updatedById: null,
    ...overrides
});

// ============================================================================
// SPEC-210 Public Tier Leak-Guard Tests
// ============================================================================

describe('ExperiencePublicSchema — SPEC-210 leak-guard discipline', () => {
    describe('public-safe fields are present', () => {
        it('should parse a valid public-tier response', () => {
            // Arrange
            const raw = buildPublicExperience();

            // Act
            const result = ExperiencePublicSchema.safeParse(raw);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should include id, slug, name, type in parsed output', () => {
            const raw = buildPublicExperience();
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.id).toBe(VALID_UUID);
                expect(result.data.slug).toBe('excursion-a-colon');
                expect(result.data.name).toBe('Excursión a Colón');
                expect(result.data.type).toBe(ExperienceTypeEnum.EXCURSION);
            }
        });

        it('should include priceFrom, priceUnit, isPriceOnRequest (experience-specific)', () => {
            const raw = buildPublicExperience();
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.priceFrom).toBe(1500000);
                expect(result.data.priceUnit).toBe(ExperiencePriceUnitEnum.PER_PERSON);
                expect(result.data.isPriceOnRequest).toBe(false);
            }
        });

        it('should include hasActiveSubscription (visibility gate for clients)', () => {
            const raw = buildPublicExperience({ hasActiveSubscription: true });
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.hasActiveSubscription).toBe(true);
            }
        });
    });

    describe('admin/internal fields are NOT part of public schema', () => {
        it('should NOT include adminInfo in parsed output (leak-guard)', () => {
            // Arrange — provide adminInfo in the raw input (simulate a service layer leak)
            const raw = buildPublicExperience({
                adminInfo: { internalNote: 'SENSITIVE_ADMIN_DATA' }
            });

            // Act
            const result = ExperiencePublicSchema.safeParse(raw);

            // Assert — adminInfo is stripped because it is not in the pick list
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).adminInfo).toBeUndefined();
            }
        });

        it('should NOT include ownerId in parsed output (leak-guard)', () => {
            const raw = buildPublicExperience({ ownerId: VALID_UUID });
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).ownerId).toBeUndefined();
            }
        });

        it('should NOT include contactInfo in parsed output (leak-guard)', () => {
            const raw = buildPublicExperience({
                contactInfo: { mobilePhone: '+54911234567', personalEmail: 'owner@example.com' }
            });
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).contactInfo).toBeUndefined();
            }
        });

        it('should NOT include translationMeta in parsed output (admin-only)', () => {
            const raw = buildPublicExperience({ translationMeta: { es: { name: {} } } });
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                expect((result.data as Record<string, unknown>).translationMeta).toBeUndefined();
            }
        });
    });
});

// ============================================================================
// ExperienceProtectedSchema
// ============================================================================

describe('ExperienceProtectedSchema', () => {
    it('should parse a valid protected-tier response', () => {
        const raw = {
            ...buildPublicExperience(),
            ownerId: VALID_UUID,
            contactInfo: { mobilePhone: '+54911234567' },
            lifecycleState: 'ACTIVE',
            updatedAt: new Date('2024-01-02')
        };
        const result = ExperienceProtectedSchema.safeParse(raw);
        expect(result.success).toBe(true);
    });

    it('should include ownerId in protected output', () => {
        const raw = {
            ...buildPublicExperience(),
            ownerId: VALID_UUID,
            lifecycleState: 'ACTIVE',
            updatedAt: new Date('2024-01-02')
        };
        const result = ExperienceProtectedSchema.safeParse(raw);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.ownerId).toBe(VALID_UUID);
        }
    });

    it('should NOT include adminInfo in protected output (admin-only)', () => {
        const raw = {
            ...buildPublicExperience(),
            ownerId: VALID_UUID,
            lifecycleState: 'ACTIVE',
            updatedAt: new Date('2024-01-02'),
            adminInfo: { internalNote: 'SENSITIVE' }
        };
        const result = ExperienceProtectedSchema.safeParse(raw);
        expect(result.success).toBe(true);
        if (result.success) {
            expect((result.data as Record<string, unknown>).adminInfo).toBeUndefined();
        }
    });
});

// ============================================================================
// ExperienceAdminSchema
// ============================================================================

describe('ExperienceAdminSchema', () => {
    it('should parse a full experience including admin fields', () => {
        const raw = {
            ...buildPublicExperience(),
            ownerId: VALID_UUID,
            contactInfo: { mobilePhone: '+54911234567' },
            lifecycleState: 'ACTIVE',
            moderationState: 'APPROVED',
            adminInfo: { internalNote: 'Verified owner' },
            updatedAt: new Date('2024-01-02'),
            createdById: VALID_UUID,
            updatedById: VALID_UUID
        };
        const result = ExperienceAdminSchema.safeParse(raw);
        expect(result.success).toBe(true);
    });

    it('should allow a short description (DRAFT listing, relaxed constraint)', () => {
        // Admin schema relaxes the min(20) constraint on description
        const raw = {
            ...buildPublicExperience(),
            ownerId: VALID_UUID,
            lifecycleState: 'DRAFT',
            description: 'Short desc',
            updatedAt: new Date('2024-01-02')
        };
        const result = ExperienceAdminSchema.safeParse(raw);
        expect(result.success).toBe(true);
    });
});
