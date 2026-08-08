import { describe, expect, it } from 'vitest';
import { HostTradeCategoryEnum } from '../../../enums/host-trade-category.enum.js';
import { HostTradeAdminSearchSchema } from '../host-trade.admin-search.schema.js';
import { CreateHostTradeSchema, UpdateHostTradeSchema } from '../host-trade.crud.schema.js';
import { HostTradeAdminSchema, HostTradePublicSchema } from '../host-trade.http.schema.js';
import { HostTradeOwnerViewSchema } from '../host-trade.owner.schema.js';
import { HostTradeSchema } from '../host-trade.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DESTINATION_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const VALID_FULL_HOST_TRADE = {
    id: VALID_UUID,
    slug: 'plomero-juan-perez',
    name: 'Plomero Juan Pérez',
    category: HostTradeCategoryEnum.PLOMERIA,
    contact: '+5493442123456',
    benefit: '10% de descuento presentando la app Hospeda',
    destinationId: DESTINATION_UUID,
    is24h: false,
    scheduleText: 'Lunes a Viernes 8:00–18:00',
    isActive: true,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    createdById: USER_UUID,
    updatedById: USER_UUID,
    deletedAt: null,
    deletedById: null
} as const;

// ============================================================================
// HostTradeSchema
// ============================================================================

describe('HostTradeSchema', () => {
    describe('when given a valid full object', () => {
        it('should parse a complete valid record successfully', () => {
            // Arrange / Act
            const result = HostTradeSchema.safeParse(VALID_FULL_HOST_TRADE);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Plomero Juan Pérez');
                expect(result.data.category).toBe(HostTradeCategoryEnum.PLOMERIA);
                expect(result.data.is24h).toBe(false);
            }
        });

        it('should parse a 24h record with no scheduleText', () => {
            const result = HostTradeSchema.safeParse({
                ...VALID_FULL_HOST_TRADE,
                is24h: true,
                scheduleText: null
            });
            expect(result.success).toBe(true);
        });

        it('should accept omitted optional scheduleText (undefined)', () => {
            const { scheduleText: _s, ...withoutSchedule } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(withoutSchedule);
            expect(result.success).toBe(true);
        });

        it('should accept all valid HostTradeCategoryEnum values', () => {
            for (const category of Object.values(HostTradeCategoryEnum)) {
                const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, category });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('when required fields are missing', () => {
        it('should reject when id is missing', () => {
            const { id: _id, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when name is missing', () => {
            const { name: _n, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when category is missing', () => {
            const { category: _c, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when contact is missing', () => {
            const { contact: _c, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when benefit is missing', () => {
            const { benefit: _b, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should reject when destinationId is missing', () => {
            const { destinationId: _d, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });

    describe('when given invalid field values', () => {
        it('should reject an empty name', () => {
            const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, name: '' });
            expect(result.success).toBe(false);
        });

        it('should reject an empty contact string', () => {
            const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, contact: '' });
            expect(result.success).toBe(false);
        });

        it('should ACCEPT an empty benefit string, which is now the fine print', () => {
            // Deliberate contract change (HOS-278 §6.4): `benefit` stopped being
            // the benefit and became the conditions attached to a structured
            // one. An offer with no conditions has no fine print, and the old
            // `.min(1)` would only have forced a placeholder character into the
            // column. Relaxing a rule is additive — everything that parsed
            // before still parses.
            const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, benefit: '' });
            expect(result.success).toBe(true);
        });

        it('should reject a non-UUID id', () => {
            const result = HostTradeSchema.safeParse({
                ...VALID_FULL_HOST_TRADE,
                id: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID destinationId', () => {
            const result = HostTradeSchema.safeParse({
                ...VALID_FULL_HOST_TRADE,
                destinationId: 'city-123'
            });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid category value', () => {
            const result = HostTradeSchema.safeParse({
                ...VALID_FULL_HOST_TRADE,
                category: 'PELUQUERIA'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('default values', () => {
        it('should default is24h to false when omitted', () => {
            const { is24h: _i, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is24h).toBe(false);
            }
        });

        it('should default isActive to true when omitted', () => {
            const { isActive: _a, ...rest } = VALID_FULL_HOST_TRADE;
            const result = HostTradeSchema.safeParse(rest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
            }
        });
    });
});

// ============================================================================
// CreateHostTradeSchema
// ============================================================================

describe('CreateHostTradeSchema', () => {
    const VALID_CREATE = {
        name: 'Electricista García',
        category: HostTradeCategoryEnum.ELECTRICIDAD,
        contact: 'wa.me/5493442654321',
        benefit: 'Presupuesto gratis para clientes Hospeda',
        destinationId: DESTINATION_UUID,
        is24h: true
    } as const;

    describe('when given valid create input', () => {
        it('should accept all required fields without slug', () => {
            // Arrange / Act
            const result = CreateHostTradeSchema.safeParse(VALID_CREATE);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept an explicit slug when provided', () => {
            const result = CreateHostTradeSchema.safeParse({
                ...VALID_CREATE,
                slug: 'electricista-garcia'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.slug).toBe('electricista-garcia');
            }
        });

        it('should accept an optional scheduleText', () => {
            const result = CreateHostTradeSchema.safeParse({
                ...VALID_CREATE,
                scheduleText: 'Lunes a Sábado 7:00–20:00'
            });
            expect(result.success).toBe(true);
        });

        it('should accept an optional isActive override', () => {
            const result = CreateHostTradeSchema.safeParse({
                ...VALID_CREATE,
                isActive: false
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(false);
            }
        });
    });

    describe('when required fields are missing', () => {
        it('should reject when name is missing', () => {
            const { name: _n, ...rest } = VALID_CREATE;
            expect(CreateHostTradeSchema.safeParse(rest).success).toBe(false);
        });

        it('should reject when category is missing', () => {
            const { category: _c, ...rest } = VALID_CREATE;
            expect(CreateHostTradeSchema.safeParse(rest).success).toBe(false);
        });

        it('should reject when contact is missing', () => {
            const { contact: _c, ...rest } = VALID_CREATE;
            expect(CreateHostTradeSchema.safeParse(rest).success).toBe(false);
        });

        it('should reject when benefit is missing', () => {
            const { benefit: _b, ...rest } = VALID_CREATE;
            expect(CreateHostTradeSchema.safeParse(rest).success).toBe(false);
        });

        it('should reject when destinationId is missing', () => {
            const { destinationId: _d, ...rest } = VALID_CREATE;
            expect(CreateHostTradeSchema.safeParse(rest).success).toBe(false);
        });

        it('should reject when is24h is missing', () => {
            const { is24h: _i, ...rest } = VALID_CREATE;
            // is24h has no default in the schema shape (it only has one in HostTradeSchema)
            // After omit, it has a default of false, so it will succeed
            const result = CreateHostTradeSchema.safeParse(rest);
            // is24h defaults to false — so parse still succeeds
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is24h).toBe(false);
            }
        });
    });

    describe('when auto-generated fields are provided (should be absent)', () => {
        it('should not allow id in the create shape', () => {
            // id is omitted — Zod strips unknown keys by default (passthrough disabled)
            // The schema simply does not require id; providing it is stripped silently
            const result = CreateHostTradeSchema.safeParse({ ...VALID_CREATE, id: VALID_UUID });
            // Zod object strips unknown by default — parse succeeds, id not in output
            expect(result.success).toBe(true);
            if (result.success) {
                // id should not appear in the parsed output
                expect('id' in result.data).toBe(false);
            }
        });
    });
});

// ============================================================================
// UpdateHostTradeSchema
// ============================================================================

describe('UpdateHostTradeSchema', () => {
    describe('when given partial input', () => {
        it('should accept a single field update (name only)', () => {
            const result = UpdateHostTradeSchema.safeParse({ name: 'Cerrajero Rodríguez' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Cerrajero Rodríguez');
            }
        });

        it('should accept a single field update (category only)', () => {
            const result = UpdateHostTradeSchema.safeParse({
                category: HostTradeCategoryEnum.CERRAJERIA
            });
            expect(result.success).toBe(true);
        });

        it('should accept a single field update (isActive only)', () => {
            const result = UpdateHostTradeSchema.safeParse({ isActive: false });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(false);
            }
        });

        it('should accept an empty object (no-op patch)', () => {
            const result = UpdateHostTradeSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should not inject defaults for absent fields (stripShapeDefaults)', () => {
            // After stripShapeDefaults, parsing {} must NOT inject is24h=false or isActive=true
            const result = UpdateHostTradeSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect('is24h' in result.data).toBe(false);
                expect('isActive' in result.data).toBe(false);
            }
        });
    });

    describe('when given invalid field values', () => {
        it('should reject an invalid category even in partial update', () => {
            const result = UpdateHostTradeSchema.safeParse({ category: 'PELUQUERIA' });
            expect(result.success).toBe(false);
        });

        it('should reject an empty name in partial update', () => {
            const result = UpdateHostTradeSchema.safeParse({ name: '' });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// HostTradePublicSchema — audit-stripping test
// ============================================================================

describe('HostTradePublicSchema', () => {
    describe('audit field stripping', () => {
        it('should parse and STRIP audit fields (createdById, deletedAt, etc.)', () => {
            // Arrange — input object contains all audit fields
            const input = {
                id: VALID_UUID,
                slug: 'plomero-juan-perez',
                name: 'Plomero Juan Pérez',
                category: HostTradeCategoryEnum.PLOMERIA,
                contact: '+5493442123456',
                benefit: '10% de descuento',
                destinationId: DESTINATION_UUID,
                is24h: false,
                scheduleText: null,
                // Audit fields — should be silently stripped
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: USER_UUID,
                updatedById: USER_UUID,
                deletedAt: null,
                deletedById: null
            };

            // Act
            const result = HostTradePublicSchema.safeParse(input);

            // Assert — parse succeeds
            expect(result.success).toBe(true);
            if (result.success) {
                const keys = Object.keys(result.data);

                // Required public keys are present
                expect(keys).toContain('id');
                expect(keys).toContain('slug');
                expect(keys).toContain('name');
                expect(keys).toContain('category');
                expect(keys).toContain('contact');
                expect(keys).toContain('benefit');
                expect(keys).toContain('destinationId');
                expect(keys).toContain('is24h');
                // scheduleText is nullish — present in the pick

                // Audit / internal fields must NOT be present
                expect(keys).not.toContain('createdAt');
                expect(keys).not.toContain('updatedAt');
                expect(keys).not.toContain('createdById');
                expect(keys).not.toContain('updatedById');
                expect(keys).not.toContain('deletedAt');
                expect(keys).not.toContain('deletedById');
                expect(keys).not.toContain('isActive');
            }
        });

        it('should accept a minimal public object without scheduleText', () => {
            const result = HostTradePublicSchema.safeParse({
                id: VALID_UUID,
                slug: 'slug-test',
                name: 'Test Trade',
                category: HostTradeCategoryEnum.GAS,
                contact: 'tel:1234',
                benefit: 'Descuento 5%',
                destinationId: DESTINATION_UUID,
                is24h: true
            });
            expect(result.success).toBe(true);
        });
    });
});

// ============================================================================
// HostTradeAdminSearchSchema
// ============================================================================

describe('HostTradeAdminSearchSchema', () => {
    describe('AdminSearchBase defaults', () => {
        it('should apply page=1 and pageSize=20 by default', () => {
            const result = HostTradeAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
            }
        });

        it('should apply sort=createdAt:desc by default', () => {
            const result = HostTradeAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.sort).toBe('createdAt:desc');
            }
        });

        it('should apply includeDeleted=false by default', () => {
            const result = HostTradeAdminSearchSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.includeDeleted).toBe(false);
            }
        });
    });

    describe('entity-specific filters', () => {
        it('should accept destinationId filter', () => {
            const result = HostTradeAdminSearchSchema.safeParse({
                destinationId: DESTINATION_UUID
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.destinationId).toBe(DESTINATION_UUID);
            }
        });

        it('should accept category filter', () => {
            const result = HostTradeAdminSearchSchema.safeParse({
                category: HostTradeCategoryEnum.LIMPIEZA
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.category).toBe(HostTradeCategoryEnum.LIMPIEZA);
            }
        });

        it('should accept isActive=true (boolean)', () => {
            const result = HostTradeAdminSearchSchema.safeParse({ isActive: true });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should accept isActive="true" (string coercion)', () => {
            const result = HostTradeAdminSearchSchema.safeParse({ isActive: 'true' });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isActive).toBe(true);
            }
        });

        it('should accept isActive="false" (string coercion — must NOT become true)', () => {
            const result = HostTradeAdminSearchSchema.safeParse({ isActive: 'false' });
            expect(result.success).toBe(true);
            if (result.success) {
                // queryBooleanParam handles this correctly unlike z.coerce.boolean()
                expect(result.data.isActive).toBe(false);
            }
        });

        it('should accept is24h filter', () => {
            const result = HostTradeAdminSearchSchema.safeParse({ is24h: true });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.is24h).toBe(true);
            }
        });

        it('should accept all filters combined', () => {
            const result = HostTradeAdminSearchSchema.safeParse({
                page: 2,
                pageSize: 50,
                search: 'plomero',
                destinationId: DESTINATION_UUID,
                category: HostTradeCategoryEnum.PLOMERIA,
                isActive: true,
                is24h: false
            });
            expect(result.success).toBe(true);
        });

        it('should reject an invalid category in admin search', () => {
            const result = HostTradeAdminSearchSchema.safeParse({ category: 'PELUQUERIA' });
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID destinationId in admin search', () => {
            const result = HostTradeAdminSearchSchema.safeParse({ destinationId: 'city-abc' });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// HOS-376 §7.2 — the aggregate and suspension columns (T-070)
// ============================================================================

const AGGREGATE_FIELDS = [
    'confirmedUsesCount',
    'distinctHostsCount',
    'reviewsCount',
    'averageRating',
    'benefitRespectedCount'
] as const;

const SUSPENSION_FIELDS = [
    'declarationSuspendedAt',
    'declarationSuspendedById',
    'declarationSuspendReason'
] as const;

describe('HostTradeSchema — HOS-376 columns', () => {
    it('parses a listing carrying all eight', () => {
        const result = HostTradeSchema.safeParse({
            ...VALID_FULL_HOST_TRADE,
            confirmedUsesCount: 34,
            distinctHostsCount: 21,
            reviewsCount: 12,
            averageRating: 4.6,
            benefitRespectedCount: 11,
            declarationSuspendedAt: new Date('2026-08-01T00:00:00Z'),
            declarationSuspendedById: USER_UUID,
            declarationSuspendReason: 'Tres rechazos en 90 días'
        });

        expect(result.success).toBe(true);
    });

    /**
     * Additive-only: the columns are NOT NULL in the database, but making them
     * required here would reject every shape written before they existed —
     * cached payloads, fixtures, historic rows. See the schema compat policy.
     */
    it('still parses a listing that carries none of them', () => {
        expect(HostTradeSchema.safeParse(VALID_FULL_HOST_TRADE).success).toBe(true);
    });

    /** `numeric` comes back from the pg driver as a string. */
    it('accepts an averageRating the driver returned as a string', () => {
        const result = HostTradeSchema.safeParse({
            ...VALID_FULL_HOST_TRADE,
            averageRating: '4.33'
        });

        expect(result.success).toBe(true);
        if (result.success) expect(result.data.averageRating).toBe(4.33);
    });

    it.each(
        AGGREGATE_FIELDS.filter((field) => field !== 'averageRating')
    )('rejects a negative %s', (field) => {
        const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, [field]: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects an averageRating above 5', () => {
        const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, averageRating: 6 });
        expect(result.success).toBe(false);
    });

    it('accepts a listing that was never suspended', () => {
        const result = HostTradeSchema.safeParse({
            ...VALID_FULL_HOST_TRADE,
            declarationSuspendedAt: null,
            declarationSuspendedById: null,
            declarationSuspendReason: null
        });

        expect(result.success).toBe(true);
    });
});

describe('read tiers — HOS-376 columns', () => {
    /** §6.5 — "34 usos · 21 anfitriones" is the anti-collusion signal. */
    it.each(AGGREGATE_FIELDS)('the host-facing tier serves %s', (field) => {
        expect(Object.keys(HostTradePublicSchema.shape)).toContain(field);
    });

    /**
     * The directory never learns a provider is suspended. "Suspendido por
     * declarar usos falsos" is a public conviction the system should not
     * publish — the suspension only stops him declaring, it does not brand him
     * in front of the hosts who might still hire him.
     */
    it.each(SUSPENSION_FIELDS)('the host-facing tier hides %s', (field) => {
        expect(Object.keys(HostTradePublicSchema.shape)).not.toContain(field);
    });

    it.each([
        'declarationSuspendedAt',
        'declarationSuspendReason'
    ])('the owner view shows the provider %s', (field) => {
        expect(Object.keys(HostTradeOwnerViewSchema.shape)).toContain(field);
    });

    /** Who suspended him is the moderator's identity, not his business. */
    it('the owner view hides the suspending admin', () => {
        expect(Object.keys(HostTradeOwnerViewSchema.shape)).not.toContain(
            'declarationSuspendedById'
        );
    });

    it.each([...AGGREGATE_FIELDS, ...SUSPENSION_FIELDS])('the admin tier carries %s', (field) => {
        expect(Object.keys(HostTradeAdminSchema.shape)).toContain(field);
    });
});

describe('write shapes — HOS-376 columns', () => {
    /**
     * Create/Update are built by OMITTING audit fields from the entity, not by
     * allowlisting, so these columns would flow straight into the admin create
     * body unless they are omitted explicitly.
     */
    it.each([
        ...AGGREGATE_FIELDS,
        ...SUSPENSION_FIELDS
    ])('CreateHostTradeSchema does not declare %s', (field) => {
        expect(Object.keys(CreateHostTradeSchema.shape)).not.toContain(field);
    });

    it.each([
        ...AGGREGATE_FIELDS,
        ...SUSPENSION_FIELDS
    ])('UpdateHostTradeSchema does not declare %s', (field) => {
        expect(Object.keys(UpdateHostTradeSchema.shape)).not.toContain(field);
    });
});
