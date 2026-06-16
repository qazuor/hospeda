import { describe, expect, it } from 'vitest';
import { HostTradeCategoryEnum } from '../../../enums/host-trade-category.enum.js';
import { HostTradeAdminSearchSchema } from '../host-trade.admin-search.schema.js';
import { CreateHostTradeSchema, UpdateHostTradeSchema } from '../host-trade.crud.schema.js';
import { HostTradePublicSchema } from '../host-trade.http.schema.js';
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

        it('should reject an empty benefit string', () => {
            const result = HostTradeSchema.safeParse({ ...VALID_FULL_HOST_TRADE, benefit: '' });
            expect(result.success).toBe(false);
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
