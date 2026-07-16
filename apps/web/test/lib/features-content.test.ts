/**
 * @file features-content.test.ts
 * @description Unit tests for `apps/web/src/lib/features-content.ts`, the
 * structured data driving the `/[lang]/funcionalidades/` marketing page
 * (HOS-119). Verifies row counts, spot-checked cupos against the
 * owner-approved brochure, the absence of price-looking strings, and — most
 * importantly — that every i18n key referenced by the module actually
 * exists in `packages/i18n/src/locales/es/features.json`. `t()`'s key
 * parameter is an untyped `string`, so a typo in a `*Key` field would
 * otherwise only surface as silently-wrong copy in production.
 *
 * Tasks: T-009
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ANFITRIONES_ADDONS,
    ANFITRIONES_LIST,
    ANFITRIONES_TABLE_ROWS,
    EXTRAS,
    GASTRO_LIST,
    HERO_STATS,
    MARCAS_CARDS,
    PILLARS,
    type PlanCellValue,
    SOON_ITEMS,
    SUBNAV_LINKS,
    VIAJEROS_LIST,
    VIAJEROS_TABLE_ROWS
} from '../../src/lib/features-content';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const ES_LOCALE_PATH = resolve(__dirname, '../../../../packages/i18n/src/locales/es/features.json');

/** Recursively flattens a nested JSON object to dot-notation leaf keys, prefixed with `features.`. */
function flattenJsonKeys(obj: Record<string, unknown>, prefix = 'features'): Set<string> {
    const keys = new Set<string>();
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = `${prefix}.${key}`;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            for (const nested of flattenJsonKeys(value as Record<string, unknown>, fullKey)) {
                keys.add(nested);
            }
        } else {
            keys.add(fullKey);
        }
    }
    return keys;
}

const esLocale = JSON.parse(readFileSync(ES_LOCALE_PATH, 'utf8')) as Record<string, unknown>;
const esKeys = flattenJsonKeys(esLocale);

/** Collects every `*Key` string field referenced anywhere in the module's exported data. */
function collectReferencedKeys(): string[] {
    const keys: string[] = [];

    for (const pillar of PILLARS) {
        keys.push(pillar.titleKey, pillar.descriptionKey);
    }
    for (const link of SUBNAV_LINKS) {
        keys.push(link.labelKey);
    }
    for (const stat of HERO_STATS) {
        keys.push(stat.valueKey, stat.labelKey);
    }
    for (const item of [...VIAJEROS_LIST, ...ANFITRIONES_LIST, ...GASTRO_LIST]) {
        keys.push(item.titleKey, item.descriptionKey);
    }
    for (const row of [...VIAJEROS_TABLE_ROWS, ...ANFITRIONES_TABLE_ROWS]) {
        keys.push(row.labelKey);
        if (row.noteKey) keys.push(row.noteKey);
        for (const cell of row.cells) {
            if (cell.kind === 'text') keys.push(cell.labelKey);
        }
    }
    for (const addon of ANFITRIONES_ADDONS) {
        keys.push(addon.titleKey, addon.descriptionKey);
    }
    for (const card of MARCAS_CARDS) {
        keys.push(card.titleKey, card.descriptionKey);
    }
    for (const extra of EXTRAS) {
        keys.push(extra.titleKey, extra.descriptionKey);
    }
    for (const item of SOON_ITEMS) {
        keys.push(item.titleKey, item.descriptionKey);
    }

    return keys;
}

/** Extracts the numeric value of a `limit`/`unlimited` cell for a spot-check assertion. */
function cellDisplayValue(cell: PlanCellValue): string {
    if (cell.kind === 'limit') return cell.value;
    if (cell.kind === 'unlimited') return '∞';
    return cell.kind;
}

// ─── Row counts ─────────────────────────────────────────────────────────────

describe('features-content — plan table row counts', () => {
    it('has 11 rows in the Viajeros plan table', () => {
        expect(VIAJEROS_TABLE_ROWS).toHaveLength(11);
    });

    it('has 13 rows in the Anfitriones plan table', () => {
        expect(ANFITRIONES_TABLE_ROWS).toHaveLength(13);
    });

    it('every row has exactly 3 cells (Gratis/Plus/VIP or Básico/Pro/Premium)', () => {
        for (const row of [...VIAJEROS_TABLE_ROWS, ...ANFITRIONES_TABLE_ROWS]) {
            expect(row.cells).toHaveLength(3);
        }
    });
});

// ─── Spot-check cupos against the brochure ─────────────────────────────────

describe('features-content — brochure cupo spot-checks', () => {
    it('Viajeros "favoritos": Gratis=5, Plus=25, VIP=unlimited', () => {
        const row = VIAJEROS_TABLE_ROWS.find(
            (r) => r.labelKey === 'features.viajeros.table.rows.favorites.label'
        );
        expect(row).toBeDefined();
        expect(row?.cells.map(cellDisplayValue)).toEqual(['5', '25', '∞']);
    });

    it('Anfitriones "alojamientos publicables" (listings): Básico=1, Pro=3, Premium=10', () => {
        const row = ANFITRIONES_TABLE_ROWS.find(
            (r) => r.labelKey === 'features.anfitriones.table.rows.listings.label'
        );
        expect(row).toBeDefined();
        expect(row?.cells.map(cellDisplayValue)).toEqual(['1', '3', '10']);
    });

    it('Anfitriones "fotos por alojamiento": Básico=15, Pro=30, Premium=50', () => {
        const row = ANFITRIONES_TABLE_ROWS.find(
            (r) => r.labelKey === 'features.anfitriones.table.rows.photos.label'
        );
        expect(row).toBeDefined();
        expect(row?.cells.map(cellDisplayValue)).toEqual(['15', '30', '50']);
    });

    it('Viajeros "colecciones": Gratis=no, Plus=10, VIP=25', () => {
        const row = VIAJEROS_TABLE_ROWS.find(
            (r) => r.labelKey === 'features.viajeros.table.rows.collections.label'
        );
        expect(row).toBeDefined();
        expect(row?.cells.map(cellDisplayValue)).toEqual(['no', '10', '25']);
    });

    it('Anfitriones "listado destacado" (featuredListing): Básico=addon, Pro=yes, Premium=yes', () => {
        const row = ANFITRIONES_TABLE_ROWS.find(
            (r) => r.labelKey === 'features.anfitriones.table.rows.featuredListing.label'
        );
        expect(row).toBeDefined();
        expect(row?.cells.map((c) => c.kind)).toEqual(['addon', 'yes', 'yes']);
    });
});

// ─── Próximamente ───────────────────────────────────────────────────────────

describe('features-content — próximamente items', () => {
    it('has exactly 7 items', () => {
        expect(SOON_ITEMS).toHaveLength(7);
    });

    it('every item has a unique id', () => {
        const ids = SOON_ITEMS.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

// ─── No prices anywhere ─────────────────────────────────────────────────────

const FEATURES_CONTENT_SRC = readFileSync(
    resolve(__dirname, '../../src/lib/features-content.ts'),
    'utf8'
);

describe('features-content — no price-looking strings', () => {
    it('the module source contains no "$" or "/mes" literal (no hardcoded prices)', () => {
        expect(FEATURES_CONTENT_SRC).not.toMatch(/\$/);
        expect(FEATURES_CONTENT_SRC).not.toMatch(/\/mes/);
    });

    it('no plan-table cell carries a raw numeric price (only limit/unlimited/yes/no/addon/text kinds)', () => {
        const allowedKinds = new Set(['yes', 'no', 'limit', 'unlimited', 'addon', 'text']);
        for (const row of [...VIAJEROS_TABLE_ROWS, ...ANFITRIONES_TABLE_ROWS]) {
            for (const cell of row.cells) {
                expect(allowedKinds.has(cell.kind)).toBe(true);
            }
        }
    });
});

// ─── i18n key existence guard ───────────────────────────────────────────────

describe('features-content — i18n key existence guard', () => {
    it('every *Key field referenced by features-content.ts exists in es/features.json', () => {
        const referencedKeys = collectReferencedKeys();
        const missingKeys = referencedKeys.filter((key) => !esKeys.has(key));
        expect(missingKeys).toEqual([]);
    });

    it('collected at least one key per section (sanity check the collector itself works)', () => {
        expect(collectReferencedKeys().length).toBeGreaterThan(50);
    });
});
