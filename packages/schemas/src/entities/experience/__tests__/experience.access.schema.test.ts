import { describe, expect, it } from 'vitest';
import { ExperiencePriceUnitEnum } from '../../../enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
import {
    ExperienceAdminListItemSchema,
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

        /**
         * HOS-815 RECALIBRATES THIS LEAK-GUARD — it is deliberately narrowed,
         * not deleted.
         *
         * It used to assert `contactInfo` was absent WHOLESALE. That was the
         * bug: an experience cannot be published without a phone or an email
         * (the listing form blocks it, to protect the traveller from a
         * dead-end listing), and then the public payload carried neither — so
         * the only contact affordance on the page was Hospeda's own WhatsApp
         * button. The datum was demanded and then withheld from the person it
         * was demanded for.
         *
         * The guard's PURPOSE is preserved and still enforced below: the
         * sensitive half of the blob must never reach an anonymous visitor.
         * What changed is the boundary, from "nothing" to an explicit
         * four-key allow-list. Zod strips everything not named in
         * `ExperiencePublicContactInfoSchema`, so the subset is fail-closed
         * and stays fail-closed if `contact_info` grows a key.
         */
        it('should strip the non-published contactInfo keys (leak-guard)', () => {
            const raw = buildPublicExperience({
                contactInfo: {
                    mobilePhone: '+54911234567',
                    personalEmail: 'owner@example.com',
                    homePhone: '+543442111111',
                    whatsapp: '+54911234567',
                    preferredEmail: 'WORK',
                    preferredPhone: 'MOBILE'
                }
            });
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                const contactInfo = (result.data as Record<string, unknown>).contactInfo as
                    | Record<string, unknown>
                    | null
                    | undefined;

                // Personal channels: collected as personal contact, never the
                // listing's published channel.
                expect(contactInfo).not.toHaveProperty('personalEmail');
                expect(contactInfo).not.toHaveProperty('homePhone');
                // The WhatsApp number is gated by the VIEWER's plan on a
                // separate protected endpoint (HOS-19). This payload is
                // shared-cached with no auth in the cache key, so emitting it
                // here would serve a gated value to every visitor.
                expect(contactInfo).not.toHaveProperty('whatsapp');
                // Internal routing preferences, not contact values.
                expect(contactInfo).not.toHaveProperty('preferredEmail');
                expect(contactInfo).not.toHaveProperty('preferredPhone');
            }
        });

        it('should publish exactly the four intended contact keys (HOS-815)', () => {
            const raw = buildPublicExperience({
                contactInfo: {
                    workEmail: 'contacto@kayakaventura.com.ar',
                    workPhone: '+543442222222',
                    mobilePhone: '+54911234567',
                    website: 'https://kayakaventura.com.ar',
                    personalEmail: 'owner@example.com',
                    whatsapp: '+54911234567'
                }
            });
            const result = ExperiencePublicSchema.safeParse(raw);
            expect(result.success).toBe(true);
            if (result.success) {
                const contactInfo = (result.data as Record<string, unknown>).contactInfo as Record<
                    string,
                    unknown
                >;

                // An exact key set, not a subset check: a fifth key appearing
                // here must be a deliberate decision, never an accident.
                expect(Object.keys(contactInfo).sort()).toEqual([
                    'mobilePhone',
                    'website',
                    'workEmail',
                    'workPhone'
                ]);
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

// ============================================================================
// ExperienceAdminListItemSchema — eager-loaded relation summaries (bug #8)
// Without these fields the admin grid can only render raw FK UUIDs in the
// Destino / Propietario columns. Mirrors GastronomyAdminListItemSchema.
// ============================================================================

describe('ExperienceAdminListItemSchema', () => {
    const buildAdminRow = (overrides: Record<string, unknown> = {}) => ({
        ...buildPublicExperience(),
        ownerId: VALID_UUID,
        lifecycleState: 'ACTIVE',
        moderationState: 'APPROVED',
        ...overrides
    });

    it('parses the eager-loaded destination + owner relation summaries', () => {
        const raw = buildAdminRow({
            destination: { id: VALID_UUID, name: 'Colón', slug: 'colon' },
            owner: {
                id: VALID_UUID,
                displayName: 'Seed Commerce Owner',
                firstName: null,
                lastName: null,
                email: 'owner@example.com'
            }
        });
        const result = ExperienceAdminListItemSchema.safeParse(raw);
        expect(result.success).toBe(true);
    });

    it('allows the relation summaries to be absent (freshly admin-created listing)', () => {
        const result = ExperienceAdminListItemSchema.safeParse(buildAdminRow());
        expect(result.success).toBe(true);
    });

    it('retains the destination.name needed by the admin grid column', () => {
        const raw = buildAdminRow({
            destination: { id: VALID_UUID, name: 'Gualeguaychú', slug: 'gualeguaychu' }
        });
        const result = ExperienceAdminListItemSchema.safeParse(raw);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.destination?.name).toBe('Gualeguaychú');
        }
    });
});
