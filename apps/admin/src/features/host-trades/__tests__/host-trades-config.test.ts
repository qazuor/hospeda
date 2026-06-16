/**
 * Config-level tests for the host-trades feature (T-019 — SPEC-241).
 *
 * Verifies:
 * - Column factory produces the expected columns with correct IDs.
 * - Filter bar config contains required filter params.
 * - Consolidated config contains the required sections and fields.
 */

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
        expect(ids).toContain('category');
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

    it('category column has badge options covering all enum values', () => {
        const catCol = columns.find((c) => c.id === 'category');
        expect(catCol?.badgeOptions).toBeDefined();
        expect((catCol?.badgeOptions?.length ?? 0) >= 13).toBe(true);
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
        expect(paramKeys).toContain('category');
        expect(paramKeys).toContain('isActive');
        expect(paramKeys).toContain('is24h');
        expect(paramKeys).toContain('includeDeleted');
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
        expect(fieldIds).toContain('category');
        expect(fieldIds).toContain('contact');
        expect(fieldIds).toContain('benefit');
        expect(fieldIds).toContain('destinationId');
        expect(fieldIds).toContain('is24h');
        expect(fieldIds).toContain('isActive');
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
