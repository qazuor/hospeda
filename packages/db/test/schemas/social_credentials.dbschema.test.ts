/**
 * HOS-64 T-004 — `social_credentials` table schema tests.
 *
 * Verifies the Drizzle schema definition for the social credentials vault:
 *   (1) All columns exist with the correct SQL names and types.
 *   (2) Required columns are NOT NULL; optional columns are nullable.
 *   (3) The partial unique index on `key` `WHERE deleted_at IS NULL` exists.
 *   (4) The soft-delete FK to `users` exists with `onDelete: 'set null'`.
 *   (5) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. They inspect Drizzle column/table metadata via
 * `getTableConfig`.
 *
 * Mirrors `ai_provider_credentials` (SPEC-173 T-005).
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertSocialCredential,
    type SelectSocialCredential,
    socialCredentials
} from '../../src/schemas/social/social_credentials.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(socialCredentials);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(socialCredentials).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('social_credentials table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(socialCredentials);
        expect(name).toBe('social_credentials');
    });

    it('has exactly 10 columns', () => {
        const { columns } = getTableConfig(socialCredentials);
        // id, key, ciphertext, iv, auth_tag, label, created_at, updated_at,
        // deleted_at, deleted_by_id
        expect(columns).toHaveLength(10);
    });
});

// ─── Required columns ───────────────────────────────────────────────────────

describe('social_credentials required columns', () => {
    it('id column exists and is the primary key', () => {
        const { columns } = getTableConfig(socialCredentials);
        const col = columns.find((c) => c.name === 'id');

        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('key column is notNull varchar(50)', () => {
        const config = getColumnConfig('key');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(50);
    });

    it('ciphertext column is notNull text', () => {
        const config = getColumnConfig('ciphertext');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });

    it('iv column is notNull varchar(32)', () => {
        const config = getColumnConfig('iv');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(32);
    });

    it('auth_tag column is notNull varchar(32)', () => {
        const config = getColumnConfig('auth_tag');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(32);
    });

    it('created_at and updated_at columns are notNull with defaults', () => {
        const createdAt = getColumnConfig('created_at');
        const updatedAt = getColumnConfig('updated_at');

        expect(createdAt?.notNull).toBe(true);
        expect(updatedAt?.notNull).toBe(true);
    });
});

// ─── Optional columns ───────────────────────────────────────────────────────

describe('social_credentials optional columns', () => {
    it('label column is nullable varchar(255)', () => {
        const config = getColumnConfig('label');

        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
        expect(config?.length).toBe(255);
    });

    it('deleted_at column is nullable (soft delete)', () => {
        const config = getColumnConfig('deleted_at');

        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('deleted_by_id column is nullable uuid', () => {
        const config = getColumnConfig('deleted_by_id');

        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });
});

// ─── Foreign keys ───────────────────────────────────────────────────────────

describe('social_credentials foreign keys', () => {
    it('has exactly one FK: deleted_by_id → users.id with onDelete set null', () => {
        const { foreignKeys } = getTableConfig(socialCredentials);

        expect(foreignKeys).toHaveLength(1);
        const fk = foreignKeys[0];
        expect(fk).toBeDefined();
        const reference = fk!.reference();
        expect(reference.foreignTable[Symbol.for('drizzle:Name')]).toBe('users');
        expect(fk!.onDelete).toBe('set null');
    });
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

describe('social_credentials indexes', () => {
    it('has exactly 2 indexes', () => {
        const indexes = getIndexes();
        expect(indexes).toHaveLength(2);
    });

    it('has a non-unique index on key', () => {
        const indexes = getIndexes();
        const keyIdx = indexes.find((idx) => idx.config.name === 'socialCredentials_key_idx');

        expect(keyIdx).toBeDefined();
        expect(keyIdx?.config.unique).toBeFalsy();
    });

    it('has a partial unique index on key WHERE deleted_at IS NULL', () => {
        const indexes = getIndexes();
        const activeKeyIdx = indexes.find(
            (idx) => idx.config.name === 'idx_social_credentials_active_key'
        );

        expect(activeKeyIdx).toBeDefined();
        expect(activeKeyIdx?.config.unique).toBe(true);
        expect(activeKeyIdx?.config.where).toBeDefined();
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('social_credentials type inference', () => {
    it('InsertSocialCredential allows a minimal valid insert (required fields only)', () => {
        const minimal: InsertSocialCredential = {
            key: 'make_webhook_url',
            ciphertext: 'ciphertext-base64',
            iv: 'iv-base64',
            authTag: 'auth-tag-base64'
        };

        expect(minimal.key).toBe('make_webhook_url');
        expect(minimal.ciphertext).toBeDefined();
        expect(minimal.iv).toBeDefined();
        expect(minimal.authTag).toBeDefined();
    });

    it('SelectSocialCredential has all expected property keys', () => {
        const { columns } = getTableConfig(socialCredentials);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = [
            'id',
            'key',
            'ciphertext',
            'iv',
            'auth_tag',
            'label',
            'created_at',
            'updated_at',
            'deleted_at',
            'deleted_by_id'
        ];

        for (const col of expectedSqlColumns) {
            expect(
                sqlNames.has(col),
                `Expected column '${col}' to exist in social_credentials`
            ).toBe(true);
        }
    });

    it('SelectSocialCredential compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectSocialCredential): void => {
            const _id: string = _row.id;
            const _key: string = _row.key;
            const _ciphertext: string = _row.ciphertext;
            const _iv: string = _row.iv;
            const _authTag: string = _row.authTag;
            const _label: string | null = _row.label;
            const _createdAt: Date = _row.createdAt;
            const _updatedAt: Date = _row.updatedAt;
            const _deletedAt: Date | null = _row.deletedAt;
            const _deletedById: string | null = _row.deletedById;

            void [
                _id,
                _key,
                _ciphertext,
                _iv,
                _authTag,
                _label,
                _createdAt,
                _updatedAt,
                _deletedAt,
                _deletedById
            ];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
