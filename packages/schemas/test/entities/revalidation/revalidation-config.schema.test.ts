import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    RevalidationConfigSchema,
    RevalidationEntityTypeEnum
} from '../../../src/entities/revalidation/revalidation-config.schema.js';
import { UpdateRevalidationConfigInputSchema } from '../../../src/entities/revalidation/revalidation-config.crud.schema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const createValidConfig = () => ({
    id: '12345678-1234-4234-8234-123456789012',
    entityType: 'accommodation' as const,
    autoRevalidateOnChange: true,
    cronIntervalMinutes: 60,
    debounceSeconds: 10,
    enabled: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
});

// ---------------------------------------------------------------------------
// RevalidationEntityTypeEnum
// ---------------------------------------------------------------------------

describe('RevalidationEntityTypeEnum', () => {
    const validTypes = [
        'accommodation',
        'destination',
        'event',
        'post',
        'accommodation_review',
        'destination_review',
        'tag',
        'amenity'
    ] as const;

    it('should accept all valid entity types', () => {
        for (const type of validTypes) {
            const result = RevalidationEntityTypeEnum.safeParse(type);
            expect(result.success).toBe(true);
        }
    });

    it('should reject unknown entity types', () => {
        const invalidTypes = ['user', 'booking', 'ACCOMMODATION', '', 'review'];
        for (const type of invalidTypes) {
            const result = RevalidationEntityTypeEnum.safeParse(type);
            expect(result.success).toBe(false);
        }
    });

    it('should reject non-string values', () => {
        const result = RevalidationEntityTypeEnum.safeParse(123);
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// RevalidationConfigSchema
// ---------------------------------------------------------------------------

describe('RevalidationConfigSchema', () => {
    describe('Valid data', () => {
        it('should validate a complete valid config', () => {
            const data = createValidConfig();
            expect(() => RevalidationConfigSchema.parse(data)).not.toThrow();

            const result = RevalidationConfigSchema.parse(data);
            expect(result.id).toBe(data.id);
            expect(result.entityType).toBe(data.entityType);
            expect(result.autoRevalidateOnChange).toBe(true);
            expect(result.cronIntervalMinutes).toBe(60);
            expect(result.debounceSeconds).toBe(10);
            expect(result.enabled).toBe(true);
        });

        it('should accept all valid entity types', () => {
            const validTypes = [
                'accommodation',
                'destination',
                'event',
                'post',
                'accommodation_review',
                'destination_review',
                'tag',
                'amenity'
            ] as const;
            for (const entityType of validTypes) {
                const data = { ...createValidConfig(), entityType };
                const result = RevalidationConfigSchema.safeParse(data);
                expect(result.success).toBe(true);
            }
        });

        it('should coerce string dates to Date objects', () => {
            const data = {
                ...createValidConfig(),
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-06-01T12:00:00Z'
            };
            const result = RevalidationConfigSchema.parse(data);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should accept boundary values for cronIntervalMinutes', () => {
            const min = { ...createValidConfig(), cronIntervalMinutes: 1 };
            const max = { ...createValidConfig(), cronIntervalMinutes: 10080 };
            expect(() => RevalidationConfigSchema.parse(min)).not.toThrow();
            expect(() => RevalidationConfigSchema.parse(max)).not.toThrow();
        });

        it('should accept boundary values for debounceSeconds', () => {
            const minVal = { ...createValidConfig(), debounceSeconds: 0 };
            const maxVal = { ...createValidConfig(), debounceSeconds: 300 };
            expect(() => RevalidationConfigSchema.parse(minVal)).not.toThrow();
            expect(() => RevalidationConfigSchema.parse(maxVal)).not.toThrow();
        });
    });

    describe('Invalid data', () => {
        it('should reject config with missing required fields', () => {
            const result = RevalidationConfigSchema.safeParse({
                entityType: 'accommodation'
            });
            expect(result.success).toBe(false);
        });

        it('should reject config with invalid UUID', () => {
            const data = { ...createValidConfig(), id: 'not-a-uuid' };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject config with invalid entityType', () => {
            const data = { ...createValidConfig(), entityType: 'invalid_type' };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject non-boolean autoRevalidateOnChange', () => {
            const data = { ...createValidConfig(), autoRevalidateOnChange: 'yes' };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject non-boolean enabled', () => {
            const data = { ...createValidConfig(), enabled: 1 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('cronIntervalMinutes validation', () => {
        it('should reject 0 (below minimum)', () => {
            const data = { ...createValidConfig(), cronIntervalMinutes: 0 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject values above maximum (10080)', () => {
            const data = { ...createValidConfig(), cronIntervalMinutes: 10081 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject non-integer values', () => {
            const data = { ...createValidConfig(), cronIntervalMinutes: 60.5 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject string values', () => {
            const data = { ...createValidConfig(), cronIntervalMinutes: '60' };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('debounceSeconds validation', () => {
        it('should reject negative values (below 0)', () => {
            const data = { ...createValidConfig(), debounceSeconds: -1 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject values above maximum (300)', () => {
            const data = { ...createValidConfig(), debounceSeconds: 301 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it('should reject non-integer values', () => {
            const data = { ...createValidConfig(), debounceSeconds: 10.5 };
            const result = RevalidationConfigSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe('Type inference', () => {
        it('should produce correct TypeScript runtime types', () => {
            const result = RevalidationConfigSchema.parse(createValidConfig());
            expect(typeof result.id).toBe('string');
            expect(typeof result.entityType).toBe('string');
            expect(typeof result.autoRevalidateOnChange).toBe('boolean');
            expect(typeof result.cronIntervalMinutes).toBe('number');
            expect(typeof result.debounceSeconds).toBe('number');
            expect(typeof result.enabled).toBe('boolean');
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });
    });
});

// ---------------------------------------------------------------------------
// UpdateRevalidationConfigInputSchema
// ---------------------------------------------------------------------------

describe('UpdateRevalidationConfigInputSchema', () => {
    describe('Valid data', () => {
        it('should validate an empty object (all fields optional)', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should validate a full update payload', () => {
            const data = {
                autoRevalidateOnChange: false,
                cronIntervalMinutes: 120,
                debounceSeconds: 30,
                enabled: false
            };
            const result = UpdateRevalidationConfigInputSchema.parse(data);
            expect(result.autoRevalidateOnChange).toBe(false);
            expect(result.cronIntervalMinutes).toBe(120);
            expect(result.debounceSeconds).toBe(30);
            expect(result.enabled).toBe(false);
        });

        it('should validate a partial update with only autoRevalidateOnChange', () => {
            const data = { autoRevalidateOnChange: true };
            const result = UpdateRevalidationConfigInputSchema.parse(data);
            expect(result.autoRevalidateOnChange).toBe(true);
            expect(result.cronIntervalMinutes).toBeUndefined();
            expect(result.debounceSeconds).toBeUndefined();
            expect(result.enabled).toBeUndefined();
        });

        it('should validate a partial update with only cronIntervalMinutes', () => {
            const data = { cronIntervalMinutes: 1440 };
            const result = UpdateRevalidationConfigInputSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it('should accept boundary values for cronIntervalMinutes', () => {
            expect(
                UpdateRevalidationConfigInputSchema.safeParse({ cronIntervalMinutes: 1 }).success
            ).toBe(true);
            expect(
                UpdateRevalidationConfigInputSchema.safeParse({ cronIntervalMinutes: 10080 }).success
            ).toBe(true);
        });

        it('should accept boundary values for debounceSeconds', () => {
            expect(
                UpdateRevalidationConfigInputSchema.safeParse({ debounceSeconds: 0 }).success
            ).toBe(true);
            expect(
                UpdateRevalidationConfigInputSchema.safeParse({ debounceSeconds: 300 }).success
            ).toBe(true);
        });
    });

    describe('Invalid data', () => {
        it('should reject cronIntervalMinutes below minimum when provided', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({ cronIntervalMinutes: 0 });
            expect(result.success).toBe(false);
        });

        it('should reject cronIntervalMinutes above maximum when provided', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({
                cronIntervalMinutes: 99999
            });
            expect(result.success).toBe(false);
        });

        it('should reject debounceSeconds below 0 when provided', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({ debounceSeconds: -5 });
            expect(result.success).toBe(false);
        });

        it('should reject debounceSeconds above 300 when provided', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({ debounceSeconds: 301 });
            expect(result.success).toBe(false);
        });

        it('should reject non-boolean autoRevalidateOnChange', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({
                autoRevalidateOnChange: 'true'
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer cronIntervalMinutes', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({
                cronIntervalMinutes: 30.5
            });
            expect(result.success).toBe(false);
        });

        it('should reject non-integer debounceSeconds', () => {
            const result = UpdateRevalidationConfigInputSchema.safeParse({ debounceSeconds: 5.5 });
            expect(result.success).toBe(false);
        });

        it('should reject unknown fields (strict schema is lenient by default, just validate known invalid)', () => {
            // Unknown fields are stripped by Zod by default, not rejected
            const result = UpdateRevalidationConfigInputSchema.safeParse({
                autoRevalidateOnChange: true,
                unknownField: 'value'
            });
            // Zod strips unknowns — parse should succeed
            expect(result.success).toBe(true);
        });
    });
});
