/**
 * Config-level tests for the gastronomy admin feature (T-059 — SPEC-239).
 *
 * Verifies:
 * - Column factory produces the expected columns with correct IDs, types, and
 *   badge options covering all enum values.
 * - `gastronomyListConfig` (built on `createCommerceListConfig`) points to the
 *   correct endpoint, includes shared commerce filters, and appends
 *   gastronomy-specific filters (type, priceRange) AFTER the shared ones.
 * - `createGastronomyConsolidatedConfig` assembles exactly 3 sections in the
 *   correct order with the expected field IDs and FieldTypeEnum values.
 * - Schema validation passes/fails as expected for create and update payloads.
 */

import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntityType } from '@/components/table/DataTable';
import { createGastronomyConsolidatedConfig } from '@/features/gastronomy/config/gastronomy-consolidated.config';
import { createGastronomyColumns } from '@/features/gastronomy/config/gastronomy.columns';
import { gastronomyListConfig } from '@/features/gastronomy/config/gastronomy.config';
import {
    GastronomyAdminCreateInputSchema,
    GastronomyTypeEnum,
    GastronomyUpdateInputSchema,
    PriceRangeEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';

/** Minimal translation stub — returns the key as-is. */
const t = (key: string): string => key;

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

describe('createGastronomyColumns', () => {
    const columns = createGastronomyColumns(t);

    it('returns all required column IDs', () => {
        const ids = columns.map((c) => c.id);
        expect(ids).toContain('name');
        expect(ids).toContain('type');
        expect(ids).toContain('priceRange');
        expect(ids).toContain('destination');
        expect(ids).toContain('isFeatured');
        expect(ids).toContain('owner');
        expect(ids).toContain('lifecycleStatus');
        expect(ids).toContain('createdAt');
        expect(ids).toContain('actions');
    });

    it('name column links to the /gastronomies/$id route', () => {
        const nameCol = columns.find((c) => c.id === 'name');
        expect(nameCol?.linkHandler).toBeDefined();
        const link = nameCol?.linkHandler?.({
            id: 'uuid-gastro-1',
            name: 'Test Restó'
        } as unknown as Parameters<NonNullable<typeof nameCol.linkHandler>>[0]);
        expect(link?.to).toBe('/gastronomies/$id');
        expect((link?.params as { id: string })?.id).toBe('uuid-gastro-1');
    });

    it('name column returns undefined when row has no id', () => {
        const nameCol = columns.find((c) => c.id === 'name');
        const link = nameCol?.linkHandler?.({
            name: 'No ID'
        } as unknown as Parameters<NonNullable<typeof nameCol.linkHandler>>[0]);
        expect(link).toBeUndefined();
    });

    it('name column uses GASTRONOMY entity type', () => {
        const nameCol = columns.find((c) => c.id === 'name');
        expect(nameCol?.entityOptions?.entityType).toBe(EntityType.GASTRONOMY);
    });

    it('type column has badge options for all 9 GastronomyTypeEnum values', () => {
        const typeCol = columns.find((c) => c.id === 'type');
        const enumValues = Object.values(GastronomyTypeEnum);
        expect(typeCol?.badgeOptions).toBeDefined();
        expect(typeCol?.badgeOptions?.length).toBe(enumValues.length);
        for (const val of enumValues) {
            expect(typeCol?.badgeOptions?.some((opt) => opt.value === val)).toBe(true);
        }
    });

    it('priceRange column has badge options for all 4 PriceRangeEnum values', () => {
        const priceRangeCol = columns.find((c) => c.id === 'priceRange');
        const enumValues = Object.values(PriceRangeEnum);
        expect(priceRangeCol?.badgeOptions).toBeDefined();
        expect(priceRangeCol?.badgeOptions?.length).toBe(enumValues.length);
        for (const val of enumValues) {
            expect(priceRangeCol?.badgeOptions?.some((opt) => opt.value === val)).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// Entity list config
// ---------------------------------------------------------------------------

describe('gastronomyListConfig', () => {
    it('points to the correct API endpoint', () => {
        expect(gastronomyListConfig.apiEndpoint).toBe('/api/v1/admin/gastronomies');
    });

    it('uses the GASTRONOMY entity type', () => {
        expect(gastronomyListConfig.entityType).toBe(EntityType.GASTRONOMY);
    });

    it('basePath is /gastronomies (top-level, not under /platform)', () => {
        expect(gastronomyListConfig.basePath).toBe('/gastronomies');
    });

    it('createButtonPath leads to /gastronomies/new', () => {
        expect(gastronomyListConfig.layoutConfig?.createButtonPath).toBe('/gastronomies/new');
    });

    it('always includes the four shared commerce filter params', () => {
        const paramKeys = (gastronomyListConfig.filterBarConfig?.filters ?? []).map(
            (f) => f.paramKey
        );
        expect(paramKeys).toContain('destinationId');
        expect(paramKeys).toContain('isFeatured');
        expect(paramKeys).toContain('ownerId');
        expect(paramKeys).toContain('includeDeleted');
    });

    it('includes gastronomy-specific filter: type', () => {
        const paramKeys = (gastronomyListConfig.filterBarConfig?.filters ?? []).map(
            (f) => f.paramKey
        );
        expect(paramKeys).toContain('type');
    });

    it('includes gastronomy-specific filter: priceRange', () => {
        const paramKeys = (gastronomyListConfig.filterBarConfig?.filters ?? []).map(
            (f) => f.paramKey
        );
        expect(paramKeys).toContain('priceRange');
    });

    it('shared filters appear before gastronomy-specific filters (lower order)', () => {
        const filters = gastronomyListConfig.filterBarConfig?.filters ?? [];
        const destinationIdx = filters.findIndex((f) => f.paramKey === 'destinationId');
        const typeIdx = filters.findIndex((f) => f.paramKey === 'type');
        const priceRangeIdx = filters.findIndex((f) => f.paramKey === 'priceRange');
        expect(destinationIdx).toBeLessThan(typeIdx);
        expect(typeIdx).toBeLessThan(priceRangeIdx);
    });

    it('type filter options cover all GastronomyTypeEnum values', () => {
        const typeFilter = (gastronomyListConfig.filterBarConfig?.filters ?? []).find(
            (f) => f.paramKey === 'type'
        );
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const optionValues = (typeFilter?.type === 'select' ? typeFilter.options : []).map(
            (o) => o.value
        );
        for (const val of Object.values(GastronomyTypeEnum)) {
            expect(optionValues).toContain(val);
        }
    });

    it('priceRange filter options cover all PriceRangeEnum values', () => {
        const priceFilter = (gastronomyListConfig.filterBarConfig?.filters ?? []).find(
            (f) => f.paramKey === 'priceRange'
        );
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const optionValues = (priceFilter?.type === 'select' ? priceFilter.options : []).map(
            (o) => o.value
        );
        for (const val of Object.values(PriceRangeEnum)) {
            expect(optionValues).toContain(val);
        }
    });
});

// ---------------------------------------------------------------------------
// Consolidated config
// ---------------------------------------------------------------------------

describe('createGastronomyConsolidatedConfig', () => {
    const config = createGastronomyConsolidatedConfig(t);

    it('has exactly 3 sections in the correct order', () => {
        expect(config.sections).toHaveLength(3);
        expect(config.sections[0]?.id).toBe('commerce-identity');
        expect(config.sections[1]?.id).toBe('gastronomy-specific');
        expect(config.sections[2]?.id).toBe('commerce-operational');
    });

    it('commerce-identity section contains required core text fields', () => {
        const ids = config.sections[0]?.fields.map((f) => f.id) ?? [];
        expect(ids).toContain('name');
        expect(ids).toContain('slug');
        expect(ids).toContain('summary');
        expect(ids).toContain('description');
        expect(ids).toContain('destinationId');
        expect(ids).toContain('ownerId');
    });

    it('gastronomy-specific section contains type, priceRange, and menuUrl fields', () => {
        const ids = config.sections[1]?.fields.map((f) => f.id) ?? [];
        expect(ids).toContain('type');
        expect(ids).toContain('priceRange');
        expect(ids).toContain('menuUrl');
    });

    it('type field is required and uses SELECT type', () => {
        const typeField = config.sections[1]?.fields.find((f) => f.id === 'type');
        expect(typeField?.required).toBe(true);
        expect(typeField?.type).toBe(FieldTypeEnum.SELECT);
    });

    it('priceRange field is optional and uses SELECT type', () => {
        const priceRangeField = config.sections[1]?.fields.find((f) => f.id === 'priceRange');
        expect(priceRangeField?.required).toBe(false);
        expect(priceRangeField?.type).toBe(FieldTypeEnum.SELECT);
    });

    it('menuUrl field is optional and uses TEXT type', () => {
        const menuUrlField = config.sections[1]?.fields.find((f) => f.id === 'menuUrl');
        expect(menuUrlField?.required).toBe(false);
        expect(menuUrlField?.type).toBe(FieldTypeEnum.TEXT);
    });

    it('gastronomy-specific section is visible in view, edit, and create modes', () => {
        const section = config.sections[1];
        expect(section?.modes).toContain('view');
        expect(section?.modes).toContain('edit');
        expect(section?.modes).toContain('create');
    });

    it('commerce-operational section contains contact and social fields', () => {
        const ids = config.sections[2]?.fields.map((f) => f.id) ?? [];
        expect(ids).toContain('contactInfo.phone');
        expect(ids).toContain('contactInfo.email');
        expect(ids).toContain('socialNetworks.instagram');
    });

    it('commerce-identity section does NOT contain gastronomy-specific fields', () => {
        const ids = config.sections[0]?.fields.map((f) => f.id) ?? [];
        expect(ids).not.toContain('type');
        expect(ids).not.toContain('priceRange');
        expect(ids).not.toContain('menuUrl');
    });
});

// ---------------------------------------------------------------------------
// Schema validation — create input
// ---------------------------------------------------------------------------

describe('GastronomyAdminCreateInputSchema — safeParse', () => {
    // Valid UUIDs use strict format (version nibble 1-8, variant nibble 8-b)
    const VALID_UUID = 'a1b2c3d4-e5f6-4789-8abc-def012345678';

    const VALID_PAYLOAD = {
        name: 'La Parrilla del Gaucho',
        slug: 'la-parrilla-del-gaucho',
        summary: 'Parrilla tradicional argentina con las mejores carnes',
        description:
            'La mejor carne de la ciudad, con un ambiente familiar y acogedor en pleno centro.',
        type: GastronomyTypeEnum.PARRILLA
    };

    it('accepts a minimal valid payload (required fields only)', () => {
        const result = GastronomyAdminCreateInputSchema.safeParse(VALID_PAYLOAD);
        expect(result.success).toBe(true);
    });

    it('accepts a full valid payload with all optional fields', () => {
        const result = GastronomyAdminCreateInputSchema.safeParse({
            ...VALID_PAYLOAD,
            destinationId: VALID_UUID,
            ownerId: VALID_UUID,
            priceRange: PriceRangeEnum.MID,
            menuUrl: 'https://laparrilla.com/menu',
            isFeatured: false
        });
        expect(result.success).toBe(true);
    });

    it('rejects a payload missing the required name field', () => {
        const { name: _name, ...withoutName } = VALID_PAYLOAD;
        const result = GastronomyAdminCreateInputSchema.safeParse(withoutName);
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths.some((p) => p.includes('name'))).toBe(true);
        }
    });

    it('rejects a payload missing the required type field', () => {
        const { type: _type, ...withoutType } = VALID_PAYLOAD;
        const result = GastronomyAdminCreateInputSchema.safeParse(withoutType);
        expect(result.success).toBe(false);
    });

    it('rejects an invalid GastronomyTypeEnum value', () => {
        const result = GastronomyAdminCreateInputSchema.safeParse({
            ...VALID_PAYLOAD,
            type: 'INVALID_TYPE'
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid PriceRangeEnum value', () => {
        const result = GastronomyAdminCreateInputSchema.safeParse({
            ...VALID_PAYLOAD,
            priceRange: 'INVALID_RANGE'
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Schema validation — update input
// ---------------------------------------------------------------------------

describe('GastronomyUpdateInputSchema — safeParse', () => {
    it('accepts an empty object (all fields optional in update)', () => {
        const result = GastronomyUpdateInputSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts a partial update with only name', () => {
        const result = GastronomyUpdateInputSchema.safeParse({ name: 'Nuevo Nombre' });
        expect(result.success).toBe(true);
    });

    it('accepts a partial update with only type', () => {
        const result = GastronomyUpdateInputSchema.safeParse({
            type: GastronomyTypeEnum.CAFE
        });
        expect(result.success).toBe(true);
    });

    it('accepts a partial update with only priceRange', () => {
        const result = GastronomyUpdateInputSchema.safeParse({
            priceRange: PriceRangeEnum.PREMIUM
        });
        expect(result.success).toBe(true);
    });

    it('rejects an invalid type value even in a partial update', () => {
        const result = GastronomyUpdateInputSchema.safeParse({ type: 'NOT_A_TYPE' });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid priceRange value even in a partial update', () => {
        const result = GastronomyUpdateInputSchema.safeParse({ priceRange: 'CHEAP' });
        expect(result.success).toBe(false);
    });
});
