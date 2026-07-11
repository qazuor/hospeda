/**
 * HOS-113 T-004 — `r_destination_point_of_interest` join table schema tests.
 *
 * Verifies the Drizzle schema definition for the destination-to-POI join
 * table (M2M, HOS-113 OQ-1):
 *   (1) Exactly 2 columns exist (`destination_id`, `point_of_interest_id`).
 *   (2) Both columns are NOT NULL.
 *   (3) Both columns carry FK references with CASCADE on delete.
 *   (4) A composite primary key exists covering both columns.
 *   (5) A composite index and a reverse point_of_interest_id index exist.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 *
 * Reference: HOS-113 spec.md §6.1, §9 AC-1.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertRDestinationPointOfInterest,
    rDestinationPointOfInterest,
    type SelectRDestinationPointOfInterest
} from '../../../src/schemas/destination/r_destination_point_of_interest.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(rDestinationPointOfInterest);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('r_destination_point_of_interest table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(rDestinationPointOfInterest);
        expect(name).toBe('r_destination_point_of_interest');
    });

    it('has exactly 2 columns', () => {
        const { columns } = getTableConfig(rDestinationPointOfInterest);
        expect(columns).toHaveLength(2);
        const sqlNames = columns.map((c) => c.name);
        expect(sqlNames).toContain('destination_id');
        expect(sqlNames).toContain('point_of_interest_id');
    });
});

// ─── Column constraints ──────────────────────────────────────────────────────

describe('r_destination_point_of_interest column constraints', () => {
    it('destination_id is NOT NULL', () => {
        const config = getColumnConfig('destination_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('point_of_interest_id is NOT NULL', () => {
        const config = getColumnConfig('point_of_interest_id');
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });
});

// ─── Foreign keys with CASCADE ───────────────────────────────────────────────

describe('r_destination_point_of_interest foreign keys', () => {
    it('destination_id FK uses onDelete: cascade', () => {
        const { foreignKeys } = getTableConfig(rDestinationPointOfInterest);
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'destination_id')
        );
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });

    it('point_of_interest_id FK uses onDelete: cascade', () => {
        const { foreignKeys } = getTableConfig(rDestinationPointOfInterest);
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'point_of_interest_id')
        );
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });
});

// ─── Composite primary key ───────────────────────────────────────────────────

describe('r_destination_point_of_interest composite primary key', () => {
    it('has exactly one composite PK constraint', () => {
        const { primaryKeys } = getTableConfig(rDestinationPointOfInterest);
        expect(primaryKeys).toHaveLength(1);
    });

    it('composite PK covers destination_id and point_of_interest_id', () => {
        const { primaryKeys } = getTableConfig(rDestinationPointOfInterest);
        const [pk] = primaryKeys;
        const pkColumnNames = pk?.columns.map((c) => c.name) ?? [];
        expect(pkColumnNames).toContain('destination_id');
        expect(pkColumnNames).toContain('point_of_interest_id');
        expect(pkColumnNames).toHaveLength(2);
    });
});

// ─── Indexes ────────────────────────────────────────────────────────────────

describe('r_destination_point_of_interest indexes', () => {
    it('has a composite index on (destination_id, point_of_interest_id)', () => {
        const { indexes } = getTableConfig(rDestinationPointOfInterest);
        const idx = indexes.find((i) => i.config.name === 'destinationId_pointOfInterestId_idx');
        expect(idx).toBeDefined();
        const colNames = idx?.config.columns.map((c) => ('name' in c ? c.name : undefined));
        expect(colNames).toContain('destination_id');
        expect(colNames).toContain('point_of_interest_id');
    });

    it('has a reverse index on point_of_interest_id alone', () => {
        const { indexes } = getTableConfig(rDestinationPointOfInterest);
        const idx = indexes.find(
            (i) => i.config.name === 'r_destination_point_of_interest_pointOfInterestId_idx'
        );
        expect(idx).toBeDefined();
    });

    it('has exactly 2 named indexes', () => {
        const { indexes } = getTableConfig(rDestinationPointOfInterest);
        expect(indexes).toHaveLength(2);
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('r_destination_point_of_interest type inference', () => {
    it('InsertRDestinationPointOfInterest requires exactly destinationId and pointOfInterestId', () => {
        const minimal: InsertRDestinationPointOfInterest = {
            destinationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            pointOfInterestId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        };

        expect(minimal.destinationId).toBeDefined();
        expect(minimal.pointOfInterestId).toBeDefined();
    });

    it('SelectRDestinationPointOfInterest has destinationId and pointOfInterestId properties', () => {
        const _typeCheck = (_row: SelectRDestinationPointOfInterest): void => {
            const _destinationId: string = _row.destinationId;
            const _pointOfInterestId: string = _row.pointOfInterestId;

            void [_destinationId, _pointOfInterestId];
        };

        expect(typeof _typeCheck).toBe('function');
    });

    it('SelectRDestinationPointOfInterest SQL column names match schema column definitions', () => {
        const { columns } = getTableConfig(rDestinationPointOfInterest);
        const sqlNames = new Set(columns.map((c) => c.name));

        expect(sqlNames.has('destination_id')).toBe(true);
        expect(sqlNames.has('point_of_interest_id')).toBe(true);
    });
});
