// @vitest-environment jsdom
/**
 * Config-level tests for the host-trades feature (T-019 — SPEC-241).
 *
 * Verifies:
 * - Column factory produces the expected columns with correct IDs.
 * - Filter bar config contains required filter params.
 * - Consolidated config contains the required sections and fields.
 */

import { CreateHostTradeSchema } from '@repo/schemas';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createHostTradeConsolidatedConfig } from '../config/host-trade-consolidated.config';
import { createHostTradesColumns } from '../config/host-trades.columns';
import { hostTradesConfig } from '../config/host-trades.config';

/** Minimal translation stub — returns the key as-is. */
const t = (key: string): string => key;

// ---------------------------------------------------------------------------
// Column factory
// ---------------------------------------------------------------------------

describe('createHostTradesColumns', () => {
    const columns = createHostTradesColumns(t);

    it('returns at least the required columns', () => {
        const ids = columns.map((c) => c.id);
        expect(ids).toContain('name');
        expect(ids).toContain('categories');
        expect(ids).toContain('contact');
        expect(ids).toContain('is24h');
        expect(ids).toContain('isActive');
        expect(ids).toContain('createdAt');
        expect(ids).toContain('actions');
    });

    it('name column has a link handler', () => {
        const nameCol = columns.find((c) => c.id === 'name');
        expect(nameCol?.linkHandler).toBeDefined();
        const link = nameCol?.linkHandler?.({ id: 'uuid-1', name: 'Test' } as unknown as Parameters<
            NonNullable<typeof nameCol.linkHandler>
        >[0]);
        expect(link?.to).toBe('/platform/host-trades/$id');
        expect((link?.params as { id: string })?.id).toBe('uuid-1');
    });

    it('exposes the categories column and no legacy category column', () => {
        const ids = columns.map((c) => c.id);
        expect(ids).toContain('categories');
        expect(ids).not.toContain('category');
    });

    /**
     * One badge per category, labelled from the category's own nameI18n (HOS-919
     * AC-4.4). The cell is data, not a header, so a hardcoded label would be a
     * second copy of words the catalog owns.
     */
    it('renders one badge per category, labelled from nameI18n', () => {
        const column = columns.find((c) => c.id === 'categories');
        const row = {
            id: 'h-1',
            categories: [
                { id: 'c-1', slug: 'plomeria', nameI18n: { es: 'Plomería', en: 'P', pt: 'P' } },
                { id: 'c-2', slug: 'gas', nameI18n: { es: 'Gas', en: 'G', pt: 'G' } },
                { id: 'c-3', slug: 'sin-es', nameI18n: { es: '', en: 'English only', pt: '' } }
            ]
        } as unknown as Parameters<NonNullable<typeof column>['widgetRenderer'] & object>[0];

        const { container } = render(
            (column?.widgetRenderer as (r: typeof row) => React.ReactElement)(row)
        );

        const badges = container.querySelectorAll('[data-testid="provider-category-badge"]');
        expect(Array.from(badges).map((badge) => badge.textContent)).toEqual([
            'Plomería',
            'Gas',
            'English only'
        ]);
    });

    it('renders no badge for a provider without categories', () => {
        const column = columns.find((c) => c.id === 'categories');
        const row = { id: 'h-1', categories: [] } as unknown as Parameters<
            NonNullable<typeof column>['widgetRenderer'] & object
        >[0];

        const { container } = render(
            (column?.widgetRenderer as (r: typeof row) => React.ReactElement)(row)
        );

        expect(container.querySelectorAll('[data-testid="provider-category-badge"]')).toHaveLength(
            0
        );
    });
});

// ---------------------------------------------------------------------------
// Entity config
// ---------------------------------------------------------------------------

describe('hostTradesConfig', () => {
    it('points to the correct API endpoint', () => {
        expect(hostTradesConfig.apiEndpoint).toBe('/api/v1/admin/host-trades');
    });

    it('defines the expected filter params', () => {
        const paramKeys = (hostTradesConfig.filterBarConfig?.filters ?? []).map((f) => f.paramKey);
        expect(paramKeys).toContain('categories');
        expect(paramKeys).not.toContain('category');
        expect(paramKeys).toContain('isActive');
        expect(paramKeys).toContain('is24h');
        expect(paramKeys).toContain('includeDeleted');
    });

    it('category filter is a catalog-driven multi-select that sends `categories`', () => {
        const filter = hostTradesConfig.filterBarConfig?.filters.find(
            (f) => f.paramKey === 'categories'
        );

        expect(filter?.type).toBe('multi-select');
    });

    it('options come from the catalog, not from hardcoded entries', () => {
        const filter = hostTradesConfig.filterBarConfig?.filters.find(
            (f) => f.paramKey === 'categories'
        ) as { options?: unknown; loadOptions?: unknown } | undefined;

        expect(filter?.options).toBeUndefined();
        expect(typeof filter?.loadOptions).toBe('function');
    });

    it('does not keep the retired enum-based filter labels', () => {
        const serialized = JSON.stringify(
            (hostTradesConfig.filterBarConfig?.filters ?? []).map((f) => ({
                paramKey: f.paramKey,
                labelKey: f.labelKey
            }))
        );

        expect(serialized).not.toContain('hostTradeCategory');
    });

    it('uses the correct entity type', () => {
        expect(hostTradesConfig.entityType).toBe('host-trade');
    });

    it('create button path leads to the new page', () => {
        expect(hostTradesConfig.layoutConfig.createButtonPath).toBe('/platform/host-trades/new');
    });
});

// ---------------------------------------------------------------------------
// Consolidated config
// ---------------------------------------------------------------------------

describe('createHostTradeConsolidatedConfig', () => {
    const config = createHostTradeConsolidatedConfig(t);

    it('has exactly one section', () => {
        expect(config.sections).toHaveLength(1);
        expect(config.sections[0]?.id).toBe('basic-info');
    });

    it('basic-info section contains required fields', () => {
        const fieldIds = config.sections[0]?.fields.map((f) => f.id) ?? [];
        expect(fieldIds).toContain('name');
        expect(fieldIds).toContain('categoryIds');
        expect(fieldIds).not.toContain('category');
        expect(fieldIds).toContain('contact');
        expect(fieldIds).toContain('benefit');
        expect(fieldIds).toContain('destinationId');
        expect(fieldIds).toContain('is24h');
        expect(fieldIds).toContain('isActive');
    });

    it('categoryIds is a required catalog multi-select limited to 1..10', () => {
        const field = config.sections[0]?.fields.find((f) => f.id === 'categoryIds');
        const typeConfig = field?.typeConfig as
            | {
                  multiple?: boolean;
                  minItems?: number;
                  maxItems?: number;
                  loadAllFn?: unknown;
                  loadByIdsFn?: unknown;
              }
            | undefined;

        expect(field?.type).toBe('ENTITY_MULTISELECT');
        expect(field?.required).toBe(true);
        expect(typeConfig?.multiple).toBe(true);
        expect(typeConfig?.minItems).toBe(1);
        expect(typeConfig?.maxItems).toBe(10);
        expect(typeof typeConfig?.loadAllFn).toBe('function');
        expect(typeof typeConfig?.loadByIdsFn).toBe('function');
    });

    it('the create schema accepts a payload that carries categoryIds', () => {
        const result = CreateHostTradeSchema.safeParse({
            name: 'Plomero',
            contact: '+54 9 3442 123456',
            benefit: '10 %',
            destinationId: '11111111-1111-4111-8111-111111111111',
            categoryIds: ['22222222-2222-4222-8222-222222222222'],
            is24h: false,
            isActive: true
        });

        expect(result.success).toBe(true);
    });

    it('destinationId field uses DESTINATION_SELECT type', () => {
        const destField = config.sections[0]?.fields.find((f) => f.id === 'destinationId');
        expect(destField?.type).toBe('DESTINATION_SELECT');
    });

    it('isActive field is only available in view and edit modes (not create)', () => {
        const activeField = config.sections[0]?.fields.find((f) => f.id === 'isActive');
        expect(activeField?.modes).toEqual(['view', 'edit']);
        expect(activeField?.modes).not.toContain('create');
    });
});
