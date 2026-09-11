import { describe, expect, it } from 'vitest';
import { ExperiencePriceUnitEnum } from '../../../enums/experience-price-unit.enum.js';
import { ExperienceTypeEnum } from '../../../enums/experience-type.enum.js';
import {
    ExperienceAdminListItemSchema,
    ExperienceAdminSchema,
    ExperienceProtectedSchema,
    ExperiencePublicSchema
} from '../experience.access.schema.js';
import {
    MAX_EXPERIENCE_CHECKLIST_ITEMS,
    MAX_EXPERIENCE_DURATION_MINUTES
} from '../experience.schema.js';

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

// ============================================================================
// HOS-1048 — the meeting point survives the tier projections
// ============================================================================

/**
 * These run the FULL tier parse, not a parse of some field-level schema.
 *
 * That is the whole point. `stripWithSchema` hands the WHOLE payload to the
 * tier schema and Zod object schemas drop unknown keys, so a field the handler
 * attaches and the tier does not declare disappears from the response with no
 * error anywhere — the page renders nothing and the route looks innocent. A
 * test over a `MeetingPointSchema` would pass happily while that happened; only
 * a parse of the real public/protected schema can tell.
 */
describe('meeting point across the access tiers (HOS-1048)', () => {
    const MEETING_POINT = 'Muelle 3 del puerto, frente a la caseta azul';

    it('publishes the meeting point on the PUBLIC tier, coordinates included', () => {
        // Arrange — the field is NOT entitlement-gated (owner decision
        // 2026-09-01): an anonymous visitor must be able to read where the
        // experience starts. Only the map that draws the pair is paid
        // (HOS-1049).
        const raw = buildPublicExperience({
            meetingPoint: MEETING_POINT,
            meetingPointLat: -32.4825,
            meetingPointLong: -58.2333
        });

        // Act
        const result = ExperiencePublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.meetingPoint).toBe(MEETING_POINT);
            expect(result.data.meetingPointLat).toBe(-32.4825);
            expect(result.data.meetingPointLong).toBe(-58.2333);
        }
    });

    it('accepts a meeting point with no coordinates at all', () => {
        // A landmark an owner never pinned is a valid listing, not an error.
        const raw = buildPublicExperience({ meetingPoint: MEETING_POINT });

        const result = ExperiencePublicSchema.safeParse(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.meetingPoint).toBe(MEETING_POINT);
            expect(result.data.meetingPointLat ?? null).toBeNull();
        }
    });

    it('accepts an explicit null meeting point (nothing declared yet)', () => {
        const raw = buildPublicExperience({
            meetingPoint: null,
            meetingPointLat: null,
            meetingPointLong: null
        });

        const result = ExperiencePublicSchema.safeParse(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.meetingPoint).toBeNull();
        }
    });

    it('keeps a coordinate of 0 rather than treating it as absent', () => {
        // 0/0 is a real point in the Gulf of Guinea. Any falsy-based handling
        // downstream would erase it, so the schema must at least preserve it.
        const raw = buildPublicExperience({
            meetingPoint: MEETING_POINT,
            meetingPointLat: 0,
            meetingPointLong: 0
        });

        const result = ExperiencePublicSchema.safeParse(raw);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.meetingPointLat).toBe(0);
            expect(result.data.meetingPointLong).toBe(0);
        }
    });

    it('rejects coordinates outside the WGS84 ranges', () => {
        const badLat = ExperiencePublicSchema.safeParse(
            buildPublicExperience({ meetingPointLat: 91 })
        );
        const badLong = ExperiencePublicSchema.safeParse(
            buildPublicExperience({ meetingPointLong: -181 })
        );

        expect(badLat.success).toBe(false);
        expect(badLong.success).toBe(false);
    });

    it('rejects a meeting point longer than the column contract', () => {
        const result = ExperiencePublicSchema.safeParse(
            buildPublicExperience({ meetingPoint: 'x'.repeat(301) })
        );

        expect(result.success).toBe(false);
    });

    it('round-trips the meeting point on the PROTECTED tier for the owner editor', () => {
        // Arrange — the owner editor seeds its form from this tier. If the
        // projection dropped the field, the form would re-open blank and the
        // next save would clear a meeting point the owner never touched.
        const raw = {
            ...buildPublicExperience({
                meetingPoint: MEETING_POINT,
                meetingPointLat: -32.4825,
                meetingPointLong: -58.2333
            }),
            ownerId: VALID_UUID,
            lifecycleState: 'ACTIVE'
        };

        // Act
        const result = ExperienceProtectedSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.meetingPoint).toBe(MEETING_POINT);
            expect(result.data.meetingPointLat).toBe(-32.4825);
            expect(result.data.meetingPointLong).toBe(-58.2333);
        }
    });
});

// ============================================================================
// HOS-898 / HOS-1046 / HOS-1047 / HOS-1056 — practical ficha data
// ============================================================================

describe('practical ficha fields reach the public tier', () => {
    /**
     * The point of this block is the HOS-924 failure mode, not the values.
     *
     * There, a field the write validator accepted was missing from the public
     * pick, so `stripWithSchema` dropped it on the way out: saved, never shown,
     * no error anywhere. So each assertion below names the key explicitly and
     * `expect.objectContaining` is deliberately NOT used — it cannot tell a
     * present key from a missing one, which is precisely the bug being guarded.
     */
    const buildWithPracticalFields = (
        overrides: Record<string, unknown> = {}
    ): Record<string, unknown> =>
        buildPublicExperience({
            durationMinutes: 150,
            whatToBring: ['Repelente', 'Calzado cerrado', 'Traje de baño'],
            requirements: ['Edad mínima 12 años', 'Saber nadar'],
            cancellationPolicy:
                'Si baja el río o hay alerta de viento, reprogramamos sin cargo o devolvemos la seña.',
            acceptsPrivateGroups: true,
            ...overrides
        });

    it('publishes all four on the PUBLIC tier while still stripping a non-public field', () => {
        // Arrange — `adminInfo` is the NEGATIVE control: it is not in the
        // public pick, so a run where it survives means the schema is not
        // stripping at all and the positive assertions below prove nothing.
        const raw = buildWithPracticalFields({ adminInfo: { notes: 'internal' } });

        // Act
        const result = ExperiencePublicSchema.safeParse(raw);

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.durationMinutes).toBe(150);
        expect(result.data.whatToBring).toEqual(['Repelente', 'Calzado cerrado', 'Traje de baño']);
        expect(result.data.requirements).toEqual(['Edad mínima 12 años', 'Saber nadar']);
        expect(result.data.cancellationPolicy).toContain('reprogramamos sin cargo');
        expect(result.data.acceptsPrivateGroups).toBe(true);
        expect(Object.keys(result.data)).not.toContain('adminInfo');
    });

    it('round-trips all four on the PROTECTED tier so the owner editor can read them back', () => {
        // A field the editor cannot read back re-opens blank, and the next save
        // clears it silently — the same reason the meeting point is on this
        // tier (HOS-1048).
        const raw = {
            ...buildWithPracticalFields(),
            ownerId: VALID_UUID,
            lifecycleState: 'ACTIVE'
        };

        const result = ExperienceProtectedSchema.safeParse(raw);

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.durationMinutes).toBe(150);
        expect(result.data.whatToBring).toHaveLength(3);
        expect(result.data.requirements).toHaveLength(2);
        expect(result.data.cancellationPolicy).toContain('reprogramamos sin cargo');
        expect(result.data.acceptsPrivateGroups).toBe(true);
    });

    it('defaults the two checklists to [] and the group flag to false when absent', () => {
        // A legacy row predating the columns arrives without the keys. "No
        // items" must have ONE representation, so the consumer never has to
        // test for both null and [].
        const result = ExperiencePublicSchema.safeParse(buildPublicExperience());

        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.whatToBring).toEqual([]);
        expect(result.data.requirements).toEqual([]);
        expect(result.data.acceptsPrivateGroups).toBe(false);
        expect(result.data.durationMinutes ?? null).toBeNull();
        expect(result.data.cancellationPolicy ?? null).toBeNull();
    });

    it('trims checklist items and rejects one that is blank after trimming', () => {
        const trimmed = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({ whatToBring: ['  Repelente  '] })
        );
        // A blank row from the form must not persist as a bullet over nothing.
        const blank = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({ whatToBring: ['   '] })
        );

        expect(trimmed.success).toBe(true);
        if (trimmed.success) expect(trimmed.data.whatToBring).toEqual(['Repelente']);
        expect(blank.success).toBe(false);
    });

    it('rejects a duration that is zero, fractional, or past the 30-day cap', () => {
        const zero = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({ durationMinutes: 0 })
        );
        const fractional = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({ durationMinutes: 90.5 })
        );
        const tooLong = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({ durationMinutes: MAX_EXPERIENCE_DURATION_MINUTES + 1 })
        );
        const atCap = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({ durationMinutes: MAX_EXPERIENCE_DURATION_MINUTES })
        );

        expect(zero.success).toBe(false);
        expect(fractional.success).toBe(false);
        expect(tooLong.success).toBe(false);
        expect(atCap.success).toBe(true);
    });

    it('rejects more checklist items than the cap allows', () => {
        const result = ExperiencePublicSchema.safeParse(
            buildWithPracticalFields({
                requirements: Array.from(
                    { length: MAX_EXPERIENCE_CHECKLIST_ITEMS + 1 },
                    (_unused, index) => `Requisito ${index}`
                )
            })
        );

        expect(result.success).toBe(false);
    });
});
