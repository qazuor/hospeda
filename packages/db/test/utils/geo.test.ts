/**
 * Unit tests for the shared Haversine geo helpers (HOS-111 T-010).
 *
 * Two complementary strategies, mirroring the existing convention in
 * `test/models/accommodation/accommodation-search.test.ts` (which inspects
 * `.queryChunks` rather than executing SQL against a live database):
 *
 * 1. **Structural SQL assertions** — flatten the `SQL` object produced by each
 *    helper (recursively, since `sql` templates nest) and assert the
 *    generated text contains the expected formula fragments / column paths,
 *    and that the bound parameters (lat/long/radius) are threaded through
 *    correctly.
 * 2. **Known coordinate pairs (mathematical oracle)** — a pure-JS reference
 *    Haversine implementation (test-only, NOT exported from the source
 *    module) mirroring the exact SQL formula, exercised against real
 *    Litoral-region coordinates from spec HOS-111 §6 Phase 2 (the Colón /
 *    Concepción del Uruguay example) to lock in the "~50 km nearby" semantics
 *    AC-9 depends on. Full numeric verification of the raw-SQL formula
 *    against a live Postgres belongs in `packages/db/test/integration/`
 *    (out of scope for this mocked unit suite).
 *
 * @module packages/db/test/utils/geo
 */

import { sql } from 'drizzle-orm';
import { jsonb, pgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
    buildCoordinatesNotNullClause,
    buildDistanceOrderByExpr,
    buildHaversineDistanceExpr,
    buildJsonbCoordinateExprs,
    buildWithinRadiusClause,
    EARTH_RADIUS_KM
} from '../../src/utils/geo';

// ─── Test fixtures ────────────────────────────────────────────────────────────

/** Minimal table with a JSONB `location` column, mirroring the real shape. */
const mockLocationTable = pgTable('mock_locations', {
    location: jsonb('location')
});

/**
 * Recursively flattens a Drizzle `SQL` object (which nests sub-`SQL`
 * instances via `queryChunks`) into its concatenated text and the ordered
 * list of bound (non-string-chunk) parameters. Mirrors the `.queryChunks`
 * inspection technique already used in
 * `test/models/accommodation/accommodation-search.test.ts`, extended to walk
 * nested SQL objects since these helpers compose several layers deep.
 */
function flattenSql(node: unknown): { readonly text: string; readonly params: unknown[] } {
    const params: unknown[] = [];
    let text = '';

    function walk(n: unknown): void {
        if (n && typeof n === 'object' && Array.isArray((n as { value?: unknown }).value)) {
            // StringChunk: { value: string[] }
            text += (n as { value: string[] }).value.join('');
            return;
        }
        if (
            n &&
            typeof n === 'object' &&
            Array.isArray((n as { queryChunks?: unknown }).queryChunks)
        ) {
            // Nested SQL object
            for (const chunk of (n as { queryChunks: unknown[] }).queryChunks) {
                walk(chunk);
            }
            return;
        }
        // Leaf param (number, column reference, etc.)
        params.push(n);
    }

    walk(node);
    return { text, params };
}

// ─── EARTH_RADIUS_KM ──────────────────────────────────────────────────────────

describe('EARTH_RADIUS_KM', () => {
    it('should be 6371 (NG-3: raw-SQL Haversine, not PostGIS)', () => {
        expect(EARTH_RADIUS_KM).toBe(6371);
    });
});

// ─── buildJsonbCoordinateExprs ────────────────────────────────────────────────

describe('buildJsonbCoordinateExprs', () => {
    it('should build a numeric-cast lat expression over coordinates.lat', () => {
        const { latExpr } = buildJsonbCoordinateExprs(mockLocationTable.location);
        const { text, params } = flattenSql(latExpr);

        expect(text).toContain("'coordinates'");
        expect(text).toContain("'lat'");
        expect(text).toContain('::numeric');
        // The column itself is threaded through as a bound param/reference.
        expect(params).toContain(mockLocationTable.location);
    });

    it('should build a numeric-cast long expression over coordinates.long (key is "long", not "lng")', () => {
        const { longExpr } = buildJsonbCoordinateExprs(mockLocationTable.location);
        const { text } = flattenSql(longExpr);

        expect(text).toContain("'coordinates'");
        expect(text).toContain("'long'");
        expect(text).not.toContain("'lng'");
        expect(text).toContain('::numeric');
    });
});

// ─── buildCoordinatesNotNullClause ────────────────────────────────────────────

describe('buildCoordinatesNotNullClause', () => {
    it('should guard on coordinates IS NOT NULL (R-1: explicit, not implicit)', () => {
        const clause = buildCoordinatesNotNullClause(mockLocationTable.location);
        const { text } = flattenSql(clause);

        expect(text).toContain("'coordinates'");
        expect(text).toContain('IS NOT NULL');
    });
});

// ─── buildHaversineDistanceExpr ───────────────────────────────────────────────

describe('buildHaversineDistanceExpr', () => {
    it('should compose the full Haversine formula with the shared EARTH_RADIUS_KM constant', () => {
        const latCol = sql`mock_lat_col`;
        const longCol = sql`mock_long_col`;
        const expr = buildHaversineDistanceExpr({ latCol, longCol, lat: -32.4846, long: -58.2326 });
        const { text, params } = flattenSql(expr);

        expect(text).toContain('asin');
        expect(text).toContain('sqrt');
        expect(text).toContain('power');
        expect(text).toContain('radians');
        expect(text).toContain('cos');
        expect(text).toContain('sin');
        expect(params).toContain(EARTH_RADIUS_KM);
    });

    it('should thread lat/long params through the formula (lat used twice, long once)', () => {
        const latCol = sql`mock_lat_col`;
        const longCol = sql`mock_long_col`;
        const expr = buildHaversineDistanceExpr({ latCol, longCol, lat: -32.4846, long: -58.2326 });
        const { params } = flattenSql(expr);

        const latOccurrences = params.filter((p) => p === -32.4846).length;
        const longOccurrences = params.filter((p) => p === -58.2326).length;

        // `lat` appears in both the delta term and the cos(radians(lat)) term;
        // `long` appears only in the delta term.
        expect(latOccurrences).toBe(2);
        expect(longOccurrences).toBe(1);
    });

    it('should embed the caller-supplied latCol/longCol fragments verbatim', () => {
        const latCol = sql`mock_lat_col`;
        const longCol = sql`mock_long_col`;
        const expr = buildHaversineDistanceExpr({ latCol, longCol, lat: 0, long: 0 });
        const { text } = flattenSql(expr);

        expect(text).toContain('mock_lat_col');
        expect(text).toContain('mock_long_col');
    });
});

// ─── buildDistanceOrderByExpr ─────────────────────────────────────────────────

describe('buildDistanceOrderByExpr', () => {
    it('should append "ASC NULLS LAST" for ascending order', () => {
        const latCol = sql`mock_lat_col`;
        const longCol = sql`mock_long_col`;
        const expr = buildDistanceOrderByExpr({ latCol, longCol, lat: 0, long: 0, order: 'asc' });
        const { text } = flattenSql(expr);

        expect(text).toContain('ASC NULLS LAST');
    });

    it('should append "DESC NULLS LAST" for descending order', () => {
        const latCol = sql`mock_lat_col`;
        const longCol = sql`mock_long_col`;
        const expr = buildDistanceOrderByExpr({ latCol, longCol, lat: 0, long: 0, order: 'desc' });
        const { text } = flattenSql(expr);

        expect(text).toContain('DESC NULLS LAST');
    });
});

// ─── buildWithinRadiusClause ──────────────────────────────────────────────────

describe('buildWithinRadiusClause', () => {
    it('should compare the distance expression against radiusKm with <=', () => {
        const latCol = sql`mock_lat_col`;
        const longCol = sql`mock_long_col`;
        const clause = buildWithinRadiusClause({
            latCol,
            longCol,
            lat: -32.4846,
            long: -58.2326,
            radiusKm: 50
        });
        const { text, params } = flattenSql(clause);

        expect(text).toContain('<=');
        expect(text).toContain('asin'); // reuses the distance formula
        expect(params).toContain(50);
    });
});

// ─── Known coordinate pairs (mathematical oracle, spec HOS-111 §6 Phase 2) ───

describe('known coordinate pairs — ~50 km "nearby" semantics (AC-9)', () => {
    /**
     * Pure-JS reference Haversine implementation, mirroring the exact SQL
     * formula in `buildHaversineDistanceExpr`. Test-only — deliberately NOT
     * exported from `src/utils/geo.ts` (the production formula lives entirely
     * in SQL per NG-3). Used only to validate that the ~50 km radius constant
     * (OQ-2) behaves as expected against real-world coordinate pairs.
     */
    function haversineKm(
        a: { lat: number; long: number },
        b: { lat: number; long: number }
    ): number {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        return (
            2 *
            EARTH_RADIUS_KM *
            Math.asin(
                Math.sqrt(
                    (1 - Math.cos(toRad(b.lat - a.lat))) / 2 +
                        Math.cos(toRad(a.lat)) *
                            Math.cos(toRad(b.lat)) *
                            ((1 - Math.cos(toRad(b.long - a.long))) / 2)
                )
            )
        );
    }

    // Approximate real-world coordinates (public geographic data).
    const COLON = { lat: -32.2265, long: -58.1382 };
    const CONCEPCION_DEL_URUGUAY = { lat: -32.4825, long: -58.2372 };
    const BUENOS_AIRES = { lat: -34.6037, long: -58.3816 };

    it('distance from a point to itself is 0', () => {
        expect(haversineKm(COLON, COLON)).toBeCloseTo(0, 5);
    });

    it('Colón ↔ Concepción del Uruguay falls within the ~50 km "nearby" radius (spec example)', () => {
        const distance = haversineKm(COLON, CONCEPCION_DEL_URUGUAY);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(50);
    });

    it('Colón ↔ Buenos Aires falls well outside the ~50 km "nearby" radius', () => {
        const distance = haversineKm(COLON, BUENOS_AIRES);
        expect(distance).toBeGreaterThan(50);
    });
});
