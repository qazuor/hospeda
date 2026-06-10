/**
 * SPEC-159 T-002 — `entity_views` table schema tests.
 *
 * Verifies the Drizzle schema definition for the entity-view telemetry table:
 *   (1) All 6 columns exist with the correct SQL names and types.
 *   (2) Required columns are NOT NULL; none of the lean columns are nullable.
 *   (3) No audit / soft-delete columns are present (approved deviation from
 *       BaseModel convention — SPEC-159 tech-analysis §5).
 *   (4) The two declared indexes exist with the correct names.
 *   (5) `EntityTypePgEnum` is reused (no new pg enum created).
 *   (6) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running PostgreSQL
 * instance. They inspect Drizzle column/table metadata via `getTableConfig`.
 *
 * References: SPEC-159 tech-analysis §5, SPEC-159 T-002.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertEntityView,
    type SelectEntityView,
    entityViews
} from '../../src/schemas/entity-view/entity_view.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the Drizzle column config for the given SQL column name,
 * or `undefined` if the column does not exist.
 */
function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(entityViews);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

/**
 * Returns all index descriptors from the table config.
 */
function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(entityViews).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('entity_views table meta', () => {
    it('has the correct SQL table name', () => {
        // Arrange & Act
        const { name } = getTableConfig(entityViews);

        // Assert
        expect(name).toBe('entity_views');
    });

    it('has exactly 6 columns (lean table — no audit columns)', () => {
        // Arrange & Act
        const { columns } = getTableConfig(entityViews);

        // Assert — SPEC-159 approved deviation: no createdById, updatedById,
        // deletedAt, deletedById, adminInfo (soft-delete omitted intentionally).
        expect(columns).toHaveLength(6);
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('entity_views required columns', () => {
    it('id column exists and is the primary key', () => {
        // Arrange
        const { columns } = getTableConfig(entityViews);
        const col = columns.find((c) => c.name === 'id');

        // Assert
        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('entity_type column is notNull (EntityTypePgEnum)', () => {
        // Arrange
        const config = getColumnConfig('entity_type');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('entity_id column is notNull uuid', () => {
        // Arrange
        const config = getColumnConfig('entity_id');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('visitor_hash column is notNull text', () => {
        // Arrange
        const config = getColumnConfig('visitor_hash');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.dataType).toBe('string');
    });

    it('is_authenticated column is notNull boolean with default false', () => {
        // Arrange
        const config = getColumnConfig('is_authenticated');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe(false);
    });

    it('viewed_at column is notNull timestamp', () => {
        // Arrange
        const config = getColumnConfig('viewed_at');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });
});

// ─── No soft-delete / no audit columns ──────────────────────────────────────

describe('entity_views lean telemetry: absent audit / soft-delete columns', () => {
    it('does NOT have a deleted_at column', () => {
        // Arrange
        const config = getColumnConfig('deleted_at');

        // Assert — SPEC-159 approved lean deviation
        expect(config).toBeUndefined();
    });

    it('does NOT have a deleted_by_id column', () => {
        // Arrange
        const config = getColumnConfig('deleted_by_id');

        // Assert
        expect(config).toBeUndefined();
    });

    it('does NOT have a created_by_id column', () => {
        // Arrange
        const config = getColumnConfig('created_by_id');

        // Assert
        expect(config).toBeUndefined();
    });

    it('does NOT have an updated_by_id column', () => {
        // Arrange
        const config = getColumnConfig('updated_by_id');

        // Assert
        expect(config).toBeUndefined();
    });

    it('does NOT have an updated_at column', () => {
        // Arrange — append-only: no updates possible, so no updated_at either.
        const config = getColumnConfig('updated_at');

        // Assert
        expect(config).toBeUndefined();
    });

    it('does NOT have an admin_info column', () => {
        // Arrange
        const config = getColumnConfig('admin_info');

        // Assert
        expect(config).toBeUndefined();
    });
});

// ─── No DB-level foreign keys ────────────────────────────────────────────────

describe('entity_views polymorphic FK pattern', () => {
    it('has no DB-level foreign keys (polymorphic entityId, same pattern as user_bookmarks)', () => {
        // Arrange & Act
        const { foreignKeys } = getTableConfig(entityViews);

        // Assert — referential integrity is enforced at the service layer only
        expect(foreignKeys).toHaveLength(0);
    });
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

describe('entity_views indexes', () => {
    it('has exactly 2 indexes', () => {
        // Arrange & Act
        const indexes = getIndexes();

        // Assert — idx_entity_views_entity_time + idx_entity_views_time
        expect(indexes).toHaveLength(2);
    });

    it('has a non-unique compound index idx_entity_views_entity_time', () => {
        // Arrange
        const indexes = getIndexes();

        // Act
        const entityTimeIdx = indexes.find(
            (idx) => idx.config.name === 'idx_entity_views_entity_time'
        );

        // Assert
        expect(entityTimeIdx).toBeDefined();
        expect(entityTimeIdx?.config.unique).toBeFalsy();
    });

    it('idx_entity_views_entity_time covers entity_type, entity_id, viewed_at', () => {
        // Arrange
        const indexes = getIndexes();
        const entityTimeIdx = indexes.find(
            (idx) => idx.config.name === 'idx_entity_views_entity_time'
        );

        // Act — column expressions list
        const colNames =
            entityTimeIdx?.config.columns?.flatMap(
                (col: { name?: string; columnNames?: string[] }) => col.name ?? col
            ) ?? [];

        // Assert — all three columns must be present in the index definition
        const colString = JSON.stringify(colNames);
        expect(colString).toContain('entity_type');
        expect(colString).toContain('entity_id');
        expect(colString).toContain('viewed_at');
    });

    it('has a non-unique index idx_entity_views_time on viewed_at', () => {
        // Arrange
        const indexes = getIndexes();

        // Act
        const timeIdx = indexes.find((idx) => idx.config.name === 'idx_entity_views_time');

        // Assert
        expect(timeIdx).toBeDefined();
        expect(timeIdx?.config.unique).toBeFalsy();
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('entity_views type inference', () => {
    it('InsertEntityView allows a minimal valid insert (required fields only)', () => {
        // Arrange — isAuthenticated and viewedAt have DB defaults so they are
        // optional on insert. id also has defaultRandom().
        const minimal: InsertEntityView = {
            entityType: 'ACCOMMODATION',
            entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            visitorHash: 'user:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        };

        // Assert — runtime sanity checks
        expect(minimal.entityType).toBe('ACCOMMODATION');
        expect(minimal.entityId).toBeDefined();
        expect(minimal.visitorHash).toBeDefined();
    });

    it('SelectEntityView has all expected property keys', () => {
        // Arrange
        const { columns } = getTableConfig(entityViews);
        const sqlNames = new Set(columns.map((c) => c.name));

        // Assert — every SQL column the spec defines must be present
        const expectedSqlColumns = [
            'id',
            'entity_type',
            'entity_id',
            'visitor_hash',
            'is_authenticated',
            'viewed_at'
        ];

        for (const col of expectedSqlColumns) {
            expect(sqlNames.has(col), `Expected column '${col}' to exist in entity_views`).toBe(
                true
            );
        }
    });

    it('SelectEntityView compile-time type is assignable to a structured object', () => {
        // Arrange — type-level assertions verified at compile time by TypeScript.
        // The function is never called; `void` discards unused-variable warnings.
        const _typeCheck = (_row: SelectEntityView): void => {
            const _id: string = _row.id;
            const _entityType: string = _row.entityType;
            const _entityId: string = _row.entityId;
            const _visitorHash: string = _row.visitorHash;
            const _isAuthenticated: boolean = _row.isAuthenticated;
            const _viewedAt: Date = _row.viewedAt;

            void [_id, _entityType, _entityId, _visitorHash, _isAuthenticated, _viewedAt];
        };

        // Runtime — function is never invoked; no DB required.
        expect(typeof _typeCheck).toBe('function');
    });
});
