/**
 * HOS-64 T-005 — `social_credential_audit` table schema tests.
 *
 * Verifies the Drizzle schema definition for the append-only social
 * credential audit trail:
 *   (1) All columns exist with the correct SQL names and types.
 *   (2) No `updatedAt` / `deletedAt` — append-only by design.
 *   (3) The two declared indexes exist with the correct columns.
 *   (4) The FK to `users` exists with `onDelete: 'set null'`.
 *   (5) `$inferSelect` / `$inferInsert` type shapes match expectations.
 *
 * These are in-process schema tests — they do NOT require a running
 * PostgreSQL instance. Mirrors `ai_credential_audit` (SPEC-173 T-005).
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    type InsertSocialCredentialAudit,
    type SelectSocialCredentialAudit,
    socialCredentialAudit
} from '../../src/schemas/social/social_credential_audit.dbschema.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getColumnConfig(sqlName: string): Record<string, unknown> | undefined {
    const { columns } = getTableConfig(socialCredentialAudit);
    const col = columns.find((c) => c.name === sqlName);
    return col?.config as Record<string, unknown> | undefined;
}

function getIndexes(): ReturnType<typeof getTableConfig>['indexes'] {
    return getTableConfig(socialCredentialAudit).indexes;
}

// ─── Table meta ─────────────────────────────────────────────────────────────

describe('social_credential_audit table meta', () => {
    it('has the correct SQL table name', () => {
        const { name } = getTableConfig(socialCredentialAudit);
        expect(name).toBe('social_credential_audit');
    });

    it('has exactly 6 columns (append-only — no updatedAt/deletedAt)', () => {
        const { columns } = getTableConfig(socialCredentialAudit);
        // id, actor_id, action, key, ip_address, created_at
        expect(columns).toHaveLength(6);
    });
});

// ─── Required / optional columns ────────────────────────────────────────────

describe('social_credential_audit columns', () => {
    it('id column exists and is the primary key', () => {
        const { columns } = getTableConfig(socialCredentialAudit);
        const col = columns.find((c) => c.name === 'id');

        expect(col).toBeDefined();
        expect(col?.config?.primaryKey).toBe(true);
    });

    it('actor_id column is nullable uuid (onDelete set null preserves the row)', () => {
        const config = getColumnConfig('actor_id');

        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
    });

    it('action column is notNull varchar(20)', () => {
        const config = getColumnConfig('action');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(20);
    });

    it('key column is notNull varchar(50)', () => {
        const config = getColumnConfig('key');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
        expect(config?.length).toBe(50);
    });

    it('ip_address column is nullable varchar(45)', () => {
        const config = getColumnConfig('ip_address');

        expect(config).toBeDefined();
        expect(config?.notNull).toBeFalsy();
        expect(config?.length).toBe(45);
    });

    it('created_at column is notNull with a default', () => {
        const config = getColumnConfig('created_at');

        expect(config).toBeDefined();
        expect(config?.notNull).toBe(true);
    });
});

// ─── Append-only invariant ───────────────────────────────────────────────────

describe('social_credential_audit append-only invariant', () => {
    it('does NOT have an updated_at column', () => {
        const config = getColumnConfig('updated_at');
        expect(config).toBeUndefined();
    });

    it('does NOT have a deleted_at column', () => {
        const config = getColumnConfig('deleted_at');
        expect(config).toBeUndefined();
    });

    it('does NOT have a deleted_by_id column', () => {
        const config = getColumnConfig('deleted_by_id');
        expect(config).toBeUndefined();
    });
});

// ─── Foreign keys ───────────────────────────────────────────────────────────

describe('social_credential_audit foreign keys', () => {
    it('has exactly one FK: actor_id → users.id with onDelete set null', () => {
        const { foreignKeys } = getTableConfig(socialCredentialAudit);

        expect(foreignKeys).toHaveLength(1);
        const fk = foreignKeys[0];
        expect(fk).toBeDefined();
        const reference = fk!.reference();
        expect(reference.foreignTable[Symbol.for('drizzle:Name')]).toBe('users');
        expect(fk!.onDelete).toBe('set null');
    });
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

describe('social_credential_audit indexes', () => {
    it('has exactly 2 indexes', () => {
        const indexes = getIndexes();
        expect(indexes).toHaveLength(2);
    });

    it('has a compound index on (key, created_at desc)', () => {
        const indexes = getIndexes();
        const keyCreatedIdx = indexes.find(
            (idx) => idx.config.name === 'socialCredentialAudit_key_created_idx'
        );

        expect(keyCreatedIdx).toBeDefined();
        expect(keyCreatedIdx?.config.unique).toBeFalsy();

        const colNames =
            keyCreatedIdx?.config.columns?.flatMap(
                (col: { name?: string; columnNames?: string[] }) => col.name ?? col
            ) ?? [];
        const colString = JSON.stringify(colNames);
        expect(colString).toContain('key');
        expect(colString).toContain('created_at');
    });

    it('has a non-unique index on actor_id', () => {
        const indexes = getIndexes();
        const actorIdx = indexes.find(
            (idx) => idx.config.name === 'socialCredentialAudit_actorId_idx'
        );

        expect(actorIdx).toBeDefined();
        expect(actorIdx?.config.unique).toBeFalsy();
    });
});

// ─── Type inference ──────────────────────────────────────────────────────────

describe('social_credential_audit type inference', () => {
    it('InsertSocialCredentialAudit allows a minimal valid insert (required fields only)', () => {
        const minimal: InsertSocialCredentialAudit = {
            action: 'created',
            key: 'make_webhook_url'
        };

        expect(minimal.action).toBe('created');
        expect(minimal.key).toBe('make_webhook_url');
    });

    it('SelectSocialCredentialAudit has all expected property keys', () => {
        const { columns } = getTableConfig(socialCredentialAudit);
        const sqlNames = new Set(columns.map((c) => c.name));

        const expectedSqlColumns = ['id', 'actor_id', 'action', 'key', 'ip_address', 'created_at'];

        for (const col of expectedSqlColumns) {
            expect(
                sqlNames.has(col),
                `Expected column '${col}' to exist in social_credential_audit`
            ).toBe(true);
        }
    });

    it('SelectSocialCredentialAudit compile-time type is assignable to a structured object', () => {
        const _typeCheck = (_row: SelectSocialCredentialAudit): void => {
            const _id: string = _row.id;
            const _actorId: string | null = _row.actorId;
            const _action: string = _row.action;
            const _key: string = _row.key;
            const _ipAddress: string | null = _row.ipAddress;
            const _createdAt: Date = _row.createdAt;

            void [_id, _actorId, _action, _key, _ipAddress, _createdAt];
        };

        expect(typeof _typeCheck).toBe('function');
    });
});
