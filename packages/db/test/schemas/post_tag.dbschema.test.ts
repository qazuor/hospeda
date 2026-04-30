/**
 * SPEC-086 T-007 — `post_tags` table schema tests.
 *
 * Verifies the Drizzle schema definition for the PostTag subsystem:
 *   (1) All required columns exist with the correct SQL names.
 *   (2) Required columns are NOT NULL; optional columns are nullable.
 *   (3) `name` and `slug` have unique indexes.
 *   (4) `lifecycle_state` has a non-unique index.
 *   (5) `$inferInsert` shape exposes required and optional fields correctly
 *       (compile-time assertion via satisfies + runtime shape checks).
 *
 * These are in-process schema tests — they do NOT require a running PostgreSQL
 * instance. They inspect Drizzle column metadata via `getTableConfig`.
 *
 * References: SPEC-086 D-001, D-013, D-018, AC-F13
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertPostTag,
    type SelectPostTag,
    postTags
} from '../../src/schemas/tag/post_tag.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the Drizzle column config for the given SQL column name.
 * Uses `getTableConfig` to avoid coupling to internal property names.
 */
function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(postTags);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

/**
 * Returns all index descriptors from the table config.
 */
function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(postTags).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('post_tags table meta', () => {
    it('has the correct SQL table name', () => {
        // Arrange & Act
        const { name } = getTableConfig(postTags);

        // Assert
        expect(name).toBe('post_tags');
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('post_tags required columns', () => {
    it('id column exists and is the primary key', () => {
        // Arrange — `getTableConfig().primaryKeys` only contains composite PK
        // constraints; inline `.primaryKey()` is recorded on the column config.
        const { columns } = getTableConfig(postTags);
        const col = columns.find((c) => c.name === 'id');

        // Assert — column present and carries the primaryKey flag
        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('name column is notNull text', () => {
        // Arrange
        const config = getColumnConfig('name');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.dataType).toBe('string');
    });

    it('slug column is notNull text', () => {
        // Arrange
        const config = getColumnConfig('slug');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.dataType).toBe('string');
    });

    it('color column is notNull (enum)', () => {
        // Arrange
        const config = getColumnConfig('color');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('lifecycle_state column is notNull with default ACTIVE', () => {
        // Arrange
        const config = getColumnConfig('lifecycle_state');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.default).toBe('ACTIVE');
    });

    it('created_at column is notNull timestamp', () => {
        // Arrange
        const config = getColumnConfig('created_at');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('updated_at column is notNull timestamp', () => {
        // Arrange
        const config = getColumnConfig('updated_at');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });
});

// ─── Optional (nullable) columns ────────────────────────────────────────────

describe('post_tags nullable columns', () => {
    it('icon column is nullable', () => {
        // Arrange
        const config = getColumnConfig('icon');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('description column is nullable', () => {
        // Arrange
        const config = getColumnConfig('description');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('created_by_id column is nullable', () => {
        // Arrange
        const config = getColumnConfig('created_by_id');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('updated_by_id column is nullable', () => {
        // Arrange
        const config = getColumnConfig('updated_by_id');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('deleted_at column is nullable', () => {
        // Arrange
        const config = getColumnConfig('deleted_at');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('deleted_by_id column is nullable', () => {
        // Arrange
        const config = getColumnConfig('deleted_by_id');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });
});

// ─── Indexes ────────────────────────────────────────────────────────────────

describe('post_tags indexes', () => {
    it('has a unique index on name (post_tags_name_idx)', () => {
        // Arrange
        const indexes = getIndexes();

        // Act
        const nameIdx = indexes.find((idx) => idx.config.name === 'post_tags_name_idx');

        // Assert
        expect(nameIdx).toBeDefined();
        expect(nameIdx?.config.unique).toBe(true);
    });

    it('has a unique index on slug (post_tags_slug_idx)', () => {
        // Arrange
        const indexes = getIndexes();

        // Act
        const slugIdx = indexes.find((idx) => idx.config.name === 'post_tags_slug_idx');

        // Assert
        expect(slugIdx).toBeDefined();
        expect(slugIdx?.config.unique).toBe(true);
    });

    it('has a non-unique index on lifecycle_state (post_tags_lifecycle_idx)', () => {
        // Arrange
        const indexes = getIndexes();

        // Act
        const lifecycleIdx = indexes.find((idx) => idx.config.name === 'post_tags_lifecycle_idx');

        // Assert
        expect(lifecycleIdx).toBeDefined();
        // Non-unique index must NOT have unique: true
        expect(lifecycleIdx?.config.unique).toBeFalsy();
    });

    it('has exactly 3 named indexes', () => {
        // Arrange
        const indexes = getIndexes();

        // Assert — name, slug (unique), lifecycle (non-unique)
        expect(indexes.length).toBe(3);
    });
});

// ─── Type-level shape (compile-time + runtime) ──────────────────────────────

describe('post_tags type inference', () => {
    it('InsertPostTag allows a minimal valid insert object (required fields only)', () => {
        // Arrange — satisfies verifies compile-time shape; runtime checks that
        // the assignment doesn't throw at TS-compile time (this test passes if
        // the file compiles).
        const minimal = {
            name: 'Gastronomía',
            slug: 'gastronomia',
            color: 'RED'
        } satisfies Pick<InsertPostTag, 'name' | 'slug' | 'color'>;

        // Assert — runtime sanity checks
        expect(minimal.name).toBe('Gastronomía');
        expect(minimal.slug).toBe('gastronomia');
        expect(minimal.color).toBe('RED');
    });

    it('InsertPostTag accepts optional fields (icon, description)', () => {
        // Arrange
        const withOptionals = {
            name: 'Viajes',
            slug: 'viajes',
            color: 'BLUE',
            icon: 'Airplane',
            description: 'Contenido sobre viajes y turismo'
        } satisfies Pick<InsertPostTag, 'name' | 'slug' | 'color' | 'icon' | 'description'>;

        // Assert
        expect(withOptionals.icon).toBe('Airplane');
        expect(withOptionals.description).toBeDefined();
    });

    it('SelectPostTag has all expected property keys', () => {
        // Arrange — build a record of all expected keys for a selected row.
        // This is a runtime proxy for the compile-time type: if a column is
        // removed or renamed in the schema, getTableConfig will reflect it and
        // this test breaks.
        const { columns } = getTableConfig(postTags);
        const sqlNames = new Set(columns.map((c) => c.name));

        // Assert — every SQL column we care about is present in the table
        const expectedSqlColumns = [
            'id',
            'name',
            'slug',
            'color',
            'icon',
            'description',
            'lifecycle_state',
            'created_at',
            'updated_at',
            'created_by_id',
            'updated_by_id',
            'deleted_at',
            'deleted_by_id'
        ];

        for (const col of expectedSqlColumns) {
            expect(sqlNames.has(col), `Expected column '${col}' to exist in post_tags`).toBe(true);
        }
    });

    it('SelectPostTag compile-time type is assignable to a structured object', () => {
        // Arrange — this type-level assertion verifies that SelectPostTag
        // has the expected shape without requiring a real DB row.
        // The `satisfies` keyword makes TypeScript error at compile time if
        // the inferred type does not match. `as never` is used for the actual
        // value so no runtime object is created.
        const _typeCheck = (_row: SelectPostTag): void => {
            // These destructure assignments would fail at compile time if any
            // of these properties did not exist on SelectPostTag.
            const _id: string = _row.id;
            const _name: string = _row.name;
            const _slug: string = _row.slug;
            const _color: string = _row.color;
            const _icon: string | null = _row.icon;
            const _description: string | null = _row.description;
            const _lifecycleState: string = _row.lifecycleState;
            const _createdAt: Date = _row.createdAt;
            const _updatedAt: Date = _row.updatedAt;
            const _createdById: string | null = _row.createdById;
            const _updatedById: string | null = _row.updatedById;
            const _deletedAt: Date | null = _row.deletedAt;
            const _deletedById: string | null = _row.deletedById;

            // Use all variables to satisfy the no-unused-variables rule.
            void [
                _id,
                _name,
                _slug,
                _color,
                _icon,
                _description,
                _lifecycleState,
                _createdAt,
                _updatedAt,
                _createdById,
                _updatedById,
                _deletedAt,
                _deletedById
            ];
        };

        // Runtime — the function is never called so no DB is needed.
        expect(typeof _typeCheck).toBe('function');
    });
});
