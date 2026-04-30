/**
 * SPEC-086 T-008 — `r_post_post_tag` join table schema tests.
 *
 * Verifies the Drizzle schema definition for the post-to-PostTag join table:
 *   (1) Exactly 2 columns exist (`post_id`, `post_tag_id`).
 *   (2) Both columns are NOT NULL.
 *   (3) Both columns carry FK references with CASCADE on delete.
 *   (4) A composite primary key exists covering both columns.
 *
 * These are in-process schema tests — they do NOT require a running PostgreSQL
 * instance. They inspect Drizzle column/table metadata via `getTableConfig`.
 *
 * References: SPEC-086 D-001, D-018, AC-F03
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertRPostPostTag,
    type SelectRPostPostTag,
    rPostPostTag
} from '../../src/schemas/tag/r_post_post_tag.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns the Drizzle column config for the given SQL column name,
 * or `undefined` if the column does not exist.
 */
function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(rPostPostTag);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('r_post_post_tag table meta', () => {
    it('has the correct SQL table name', () => {
        // Arrange & Act
        const { name } = getTableConfig(rPostPostTag);

        // Assert
        expect(name).toBe('r_post_post_tag');
    });

    it('has exactly 2 columns', () => {
        // Arrange & Act
        const { columns } = getTableConfig(rPostPostTag);

        // Assert — no audit fields, no extra columns (D-001)
        expect(columns).toHaveLength(2);
        const sqlNames = columns.map((c) => c.name);
        expect(sqlNames).toContain('post_id');
        expect(sqlNames).toContain('post_tag_id');
    });
});

// ─── Column constraints ──────────────────────────────────────────────────────

describe('r_post_post_tag column constraints', () => {
    it('post_id is NOT NULL', () => {
        // Arrange
        const config = getColumnConfig('post_id');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('post_tag_id is NOT NULL', () => {
        // Arrange
        const config = getColumnConfig('post_tag_id');

        // Assert
        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('post_id FK is tracked in the table-level foreignKeys list', () => {
        // Drizzle records FK metadata on getTableConfig().foreignKeys,
        // not on the individual column object.
        const { foreignKeys } = getTableConfig(rPostPostTag);

        const fk = foreignKeys.find((f) => f.reference().columns.some((c) => c.name === 'post_id'));

        expect(fk).toBeDefined();
    });

    it('post_tag_id FK is tracked in the table-level foreignKeys list', () => {
        const { foreignKeys } = getTableConfig(rPostPostTag);

        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'post_tag_id')
        );

        expect(fk).toBeDefined();
    });
});

// ─── Foreign keys with CASCADE ───────────────────────────────────────────────

describe('r_post_post_tag foreign keys', () => {
    it('post_id FK uses onDelete: cascade', () => {
        // Arrange
        const { foreignKeys } = getTableConfig(rPostPostTag);

        // Act — find the FK whose column is post_id
        const fk = foreignKeys.find((f) => f.reference().columns.some((c) => c.name === 'post_id'));

        // Assert
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });

    it('post_tag_id FK uses onDelete: cascade', () => {
        // Arrange
        const { foreignKeys } = getTableConfig(rPostPostTag);

        // Act — find the FK whose column is post_tag_id
        const fk = foreignKeys.find((f) =>
            f.reference().columns.some((c) => c.name === 'post_tag_id')
        );

        // Assert
        expect(fk).toBeDefined();
        expect(fk?.onDelete).toBe('cascade');
    });
});

// ─── Composite primary key ───────────────────────────────────────────────────

describe('r_post_post_tag composite primary key', () => {
    it('has exactly one composite PK constraint', () => {
        // Arrange & Act
        const { primaryKeys } = getTableConfig(rPostPostTag);

        // Assert
        expect(primaryKeys).toHaveLength(1);
    });

    it('composite PK covers post_id and post_tag_id', () => {
        // Arrange
        const { primaryKeys } = getTableConfig(rPostPostTag);
        const [pk] = primaryKeys;

        // Act
        const pkColumnNames = pk?.columns.map((c) => c.name) ?? [];

        // Assert — both columns must be part of the PK
        expect(pkColumnNames).toContain('post_id');
        expect(pkColumnNames).toContain('post_tag_id');
        expect(pkColumnNames).toHaveLength(2);
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('r_post_post_tag type inference', () => {
    it('InsertRPostPostTag requires exactly postId and postTagId', () => {
        // Arrange — both fields are mandatory (NOT NULL, no defaults)
        const minimal: InsertRPostPostTag = {
            postId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            postTagId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        };

        // Assert — runtime sanity checks
        expect(minimal.postId).toBeDefined();
        expect(minimal.postTagId).toBeDefined();
    });

    it('SelectRPostPostTag has postId and postTagId properties', () => {
        // Arrange — compile-time shape check via assignment in a typed function.
        const _typeCheck = (_row: SelectRPostPostTag): void => {
            const _postId: string = _row.postId;
            const _postTagId: string = _row.postTagId;

            void [_postId, _postTagId];
        };

        // Runtime — the function is never called so no DB is needed.
        expect(typeof _typeCheck).toBe('function');
    });

    it('SelectRPostPostTag SQL column names match schema column definitions', () => {
        // Arrange
        const { columns } = getTableConfig(rPostPostTag);
        const sqlNames = new Set(columns.map((c) => c.name));

        // Assert
        expect(sqlNames.has('post_id')).toBe(true);
        expect(sqlNames.has('post_tag_id')).toBe(true);
    });
});
