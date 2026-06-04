/**
 * Schema-level unit tests for the 8 AI DB tables (SPEC-173 T-004..T-007).
 *
 * All tests are in-process — they inspect Drizzle's `getTableConfig` metadata
 * and do NOT require a running PostgreSQL instance.
 *
 * AAA pattern (Arrange / Act / Assert):
 *   - Arrange: import the Drizzle table and call `getTableConfig`.
 *   - Act:    extract columns / indexes / foreign keys from the config.
 *   - Assert: assert presence, types, defaults, and structural invariants.
 */

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { aiConversations } from '../../src/schemas/ai/ai_conversations.dbschema.ts';
import { aiCredentialAudit } from '../../src/schemas/ai/ai_credential_audit.dbschema.ts';
import { aiMessages } from '../../src/schemas/ai/ai_messages.dbschema.ts';
import { aiPromptVersions } from '../../src/schemas/ai/ai_prompt_versions.dbschema.ts';
import { aiProviderCredentials } from '../../src/schemas/ai/ai_provider_credentials.dbschema.ts';
import { aiRequestLog } from '../../src/schemas/ai/ai_request_log.dbschema.ts';
import { aiSettings } from '../../src/schemas/ai/ai_settings.dbschema.ts';
import { aiUsage } from '../../src/schemas/ai/ai_usage.dbschema.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ColumnConfig = ReturnType<typeof getTableConfig>['columns'][number];

/**
 * Find a column by its SQL name (snake_case as declared in the schema).
 */
function col(
    table: ReturnType<typeof getTableConfig>['columns'][number]['table'],
    sqlName: string
): ColumnConfig | undefined {
    return getTableConfig(table).columns.find((c) => c.name === sqlName);
}

/**
 * Return true when a column exists in the table config.
 */
function hasCol(
    table: ReturnType<typeof getTableConfig>['columns'][number]['table'],
    sqlName: string
): boolean {
    return col(table, sqlName) !== undefined;
}

/**
 * Return all index names for a table.
 */
function indexNames(
    table: ReturnType<typeof getTableConfig>['columns'][number]['table']
): string[] {
    return getTableConfig(table).indexes.map((i) => i.config.name);
}

// ---------------------------------------------------------------------------
// ai_settings
// ---------------------------------------------------------------------------

describe('ai_settings schema', () => {
    it('should have the correct table name', () => {
        // Arrange + Act
        const config = getTableConfig(aiSettings);
        // Assert
        expect(config.name).toBe('ai_settings');
    });

    it('should have key (varchar PK), value (jsonb), updatedBy, updatedAt, createdAt columns', () => {
        // Arrange + Act
        const c = getTableConfig(aiSettings).columns;
        const sqlNames = c.map((x) => x.name);
        // Assert
        expect(sqlNames).toContain('key');
        expect(sqlNames).toContain('value');
        expect(sqlNames).toContain('updated_by');
        expect(sqlNames).toContain('updated_at');
        expect(sqlNames).toContain('created_at');
    });

    it('key column should be the primary key', () => {
        // Arrange + Act
        const keyCol = col(aiSettings, 'key');
        // Assert
        expect(keyCol?.primary).toBe(true);
    });

    it('should NOT have a deletedAt column (upsert-only, no soft-delete)', () => {
        // Arrange + Act
        const exists = hasCol(aiSettings, 'deleted_at');
        // Assert
        expect(exists).toBe(false);
    });

    it('value column should be jsonb type', () => {
        // Arrange + Act
        const valueCol = col(aiSettings, 'value');
        // Assert
        expect(valueCol?.columnType).toBe('PgJsonb');
    });
});

// ---------------------------------------------------------------------------
// ai_prompt_versions
// ---------------------------------------------------------------------------

describe('ai_prompt_versions schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiPromptVersions).name).toBe('ai_prompt_versions');
    });

    it('should have all required columns', () => {
        // Arrange
        const sqlNames = getTableConfig(aiPromptVersions).columns.map((c) => c.name);
        // Assert
        expect(sqlNames).toContain('id');
        expect(sqlNames).toContain('feature');
        expect(sqlNames).toContain('version');
        expect(sqlNames).toContain('content');
        expect(sqlNames).toContain('is_active');
        expect(sqlNames).toContain('created_by');
        expect(sqlNames).toContain('created_at');
        expect(sqlNames).toContain('updated_at');
        expect(sqlNames).toContain('deleted_at');
        expect(sqlNames).toContain('deleted_by_id');
    });

    it('is_active should default to false', () => {
        // Arrange + Act
        const isActiveCol = col(aiPromptVersions, 'is_active');
        // Assert
        expect(isActiveCol?.default).toBe(false);
    });

    it('should have (feature, is_active) and (feature, version) indexes', () => {
        // Act
        const names = indexNames(aiPromptVersions);
        // Assert
        expect(names).toContain('aiPromptVersions_feature_active_idx');
        expect(names).toContain('aiPromptVersions_feature_version_idx');
    });

    it('should have a soft-delete column (deletedAt)', () => {
        expect(hasCol(aiPromptVersions, 'deleted_at')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ai_provider_credentials
// ---------------------------------------------------------------------------

describe('ai_provider_credentials schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiProviderCredentials).name).toBe('ai_provider_credentials');
    });

    it('should have ciphertext, iv, auth_tag columns (AES-256-GCM layout)', () => {
        // Arrange
        const sqlNames = getTableConfig(aiProviderCredentials).columns.map((c) => c.name);
        // Assert — the three columns required for AES-256-GCM
        expect(sqlNames).toContain('ciphertext');
        expect(sqlNames).toContain('iv');
        expect(sqlNames).toContain('auth_tag');
    });

    it('ciphertext should be text type (unbounded length)', () => {
        // Arrange + Act
        const ciphertextCol = col(aiProviderCredentials, 'ciphertext');
        // Assert
        expect(ciphertextCol?.columnType).toBe('PgText');
    });

    it('should have a provider_id index', () => {
        const names = indexNames(aiProviderCredentials);
        expect(names).toContain('aiProviderCredentials_providerId_idx');
    });

    it('should have a soft-delete column (deletedAt)', () => {
        expect(hasCol(aiProviderCredentials, 'deleted_at')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ai_credential_audit — APPEND-ONLY, NO soft-delete
// ---------------------------------------------------------------------------

describe('ai_credential_audit schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiCredentialAudit).name).toBe('ai_credential_audit');
    });

    it('should have actor_id, action, provider_id, ip_address, created_at columns', () => {
        // Arrange
        const sqlNames = getTableConfig(aiCredentialAudit).columns.map((c) => c.name);
        // Assert
        expect(sqlNames).toContain('actor_id');
        expect(sqlNames).toContain('action');
        expect(sqlNames).toContain('provider_id');
        expect(sqlNames).toContain('ip_address');
        expect(sqlNames).toContain('created_at');
    });

    it('action values must cover created | rotated | deleted (varchar length check)', () => {
        // Arrange + Act — varchar(20) must be >= max('rotated'.length = 7)
        const actionCol = col(aiCredentialAudit, 'action');
        // Assert
        expect(actionCol?.columnType).toBe('PgVarchar');
        // The column config stores the length for varchar; assert it is at least 7
        const length = (actionCol?.config as { length?: number })?.length ?? 0;
        expect(length).toBeGreaterThanOrEqual(7);
    });

    it('should NOT have a deletedAt column (append-only security trail, Q1)', () => {
        // This is the critical invariant for the Q1 decision
        expect(hasCol(aiCredentialAudit, 'deleted_at')).toBe(false);
    });

    it('should NOT have an updatedAt column (append-only)', () => {
        expect(hasCol(aiCredentialAudit, 'updated_at')).toBe(false);
    });

    it('should have providerId and actorId indexes for audit queries', () => {
        const names = indexNames(aiCredentialAudit);
        expect(names).toContain('aiCredentialAudit_providerId_created_idx');
        expect(names).toContain('aiCredentialAudit_actorId_idx');
    });
});

// ---------------------------------------------------------------------------
// ai_usage — cost is integer centavos
// ---------------------------------------------------------------------------

describe('ai_usage schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiUsage).name).toBe('ai_usage');
    });

    it('should have all metering columns', () => {
        const sqlNames = getTableConfig(aiUsage).columns.map((c) => c.name);
        expect(sqlNames).toContain('user_id');
        expect(sqlNames).toContain('feature');
        expect(sqlNames).toContain('provider');
        expect(sqlNames).toContain('model');
        expect(sqlNames).toContain('tokens_in');
        expect(sqlNames).toContain('tokens_out');
        expect(sqlNames).toContain('cost_estimate_centavos');
        expect(sqlNames).toContain('latency_ms');
        expect(sqlNames).toContain('status');
        expect(sqlNames).toContain('created_at');
    });

    it('cost_estimate_centavos must be integer type (never float/numeric)', () => {
        // Arrange + Act
        const costCol = col(aiUsage, 'cost_estimate_centavos');
        // Assert — PgInteger (never PgNumeric / PgDoublePrecision / PgReal)
        expect(costCol?.columnType).toBe('PgInteger');
    });

    it('tokens_in and tokens_out must be integer type', () => {
        expect(col(aiUsage, 'tokens_in')?.columnType).toBe('PgInteger');
        expect(col(aiUsage, 'tokens_out')?.columnType).toBe('PgInteger');
    });

    it('latency_ms must be integer type', () => {
        expect(col(aiUsage, 'latency_ms')?.columnType).toBe('PgInteger');
    });

    it('should have reporting indexes: (userId, feature, createdAt) and (provider, feature, createdAt)', () => {
        const names = indexNames(aiUsage);
        expect(names).toContain('aiUsage_userId_feature_created_idx');
        expect(names).toContain('aiUsage_provider_feature_created_idx');
    });

    it('user_id should be nullable (deleted user rows survive anonymised, owner-approved 2026-06-04)', () => {
        // Arrange + Act
        const userIdCol = col(aiUsage, 'user_id');
        // Assert — nullable = notNull is false
        expect(userIdCol?.notNull).toBe(false);
    });

    it('should NOT have a deletedAt column (APPEND-ONLY metering table, owner-approved 2026-06-04)', () => {
        expect(hasCol(aiUsage, 'deleted_at')).toBe(false);
    });

    it('should NOT have a deletedById column (append-only — no soft-delete)', () => {
        expect(hasCol(aiUsage, 'deleted_by_id')).toBe(false);
    });

    it('should NOT have an updatedAt column (append-only — immutable rows)', () => {
        expect(hasCol(aiUsage, 'updated_at')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ai_request_log
// ---------------------------------------------------------------------------

describe('ai_request_log schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiRequestLog).name).toBe('ai_request_log');
    });

    it('should have user_id (nullable), feature, provider, request_metadata columns', () => {
        const sqlNames = getTableConfig(aiRequestLog).columns.map((c) => c.name);
        expect(sqlNames).toContain('user_id');
        expect(sqlNames).toContain('feature');
        expect(sqlNames).toContain('provider');
        expect(sqlNames).toContain('request_metadata');
    });

    it('user_id should be nullable (system calls + rejected-before-auth requests)', () => {
        const userIdCol = col(aiRequestLog, 'user_id');
        // A nullable column has notNull = false
        expect(userIdCol?.notNull).toBe(false);
    });

    it('request_metadata should be jsonb type', () => {
        const metaCol = col(aiRequestLog, 'request_metadata');
        expect(metaCol?.columnType).toBe('PgJsonb');
    });

    it('should have browse and per-user indexes', () => {
        const names = indexNames(aiRequestLog);
        expect(names).toContain('aiRequestLog_feature_created_idx');
        expect(names).toContain('aiRequestLog_userId_created_idx');
    });

    it('should NOT have a deletedAt column (APPEND-ONLY debug log, owner-approved 2026-06-04)', () => {
        expect(hasCol(aiRequestLog, 'deleted_at')).toBe(false);
    });

    it('should NOT have a deletedById column (append-only — no soft-delete)', () => {
        expect(hasCol(aiRequestLog, 'deleted_by_id')).toBe(false);
    });

    it('should NOT have an updatedAt column (append-only — immutable rows)', () => {
        expect(hasCol(aiRequestLog, 'updated_at')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// ai_conversations
// ---------------------------------------------------------------------------

describe('ai_conversations schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiConversations).name).toBe('ai_conversations');
    });

    it('should have user_id (not null), optional title and feature columns', () => {
        const sqlNames = getTableConfig(aiConversations).columns.map((c) => c.name);
        expect(sqlNames).toContain('user_id');
        expect(sqlNames).toContain('title');
        expect(sqlNames).toContain('feature');
    });

    it('user_id should be not-null (all AI requires login, §5.7)', () => {
        const userIdCol = col(aiConversations, 'user_id');
        expect(userIdCol?.notNull).toBe(true);
    });

    it('should have a (userId, createdAt) index for inbox queries', () => {
        const names = indexNames(aiConversations);
        expect(names).toContain('aiConversations_userId_created_idx');
    });

    it('should have soft-delete columns (deletedAt + deletedById)', () => {
        expect(hasCol(aiConversations, 'deleted_at')).toBe(true);
        expect(hasCol(aiConversations, 'deleted_by_id')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ai_messages — FK to ai_conversations
// ---------------------------------------------------------------------------

describe('ai_messages schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(aiMessages).name).toBe('ai_messages');
    });

    it('should have conversation_id, role, content, tokens (nullable), provider (nullable)', () => {
        const sqlNames = getTableConfig(aiMessages).columns.map((c) => c.name);
        expect(sqlNames).toContain('conversation_id');
        expect(sqlNames).toContain('role');
        expect(sqlNames).toContain('content');
        expect(sqlNames).toContain('tokens');
        expect(sqlNames).toContain('provider');
    });

    it('conversation_id should be not-null (every message belongs to a conversation)', () => {
        const convIdCol = col(aiMessages, 'conversation_id');
        expect(convIdCol?.notNull).toBe(true);
    });

    it('tokens should be nullable (not always available from provider)', () => {
        const tokensCol = col(aiMessages, 'tokens');
        expect(tokensCol?.notNull).toBe(false);
    });

    it('tokens should be integer type when present', () => {
        const tokensCol = col(aiMessages, 'tokens');
        expect(tokensCol?.columnType).toBe('PgInteger');
    });

    it('should have FK from conversation_id → ai_conversations.id', () => {
        // Arrange + Act
        const { foreignKeys } = getTableConfig(aiMessages);
        // The FK references ai_conversations table
        const fkToConversations = foreignKeys.find((fk) => {
            const refTable = fk.reference().foreignTable;
            return getTableConfig(refTable).name === 'ai_conversations';
        });
        // Assert
        expect(fkToConversations).toBeDefined();
    });

    it('FK to ai_conversations should have ON DELETE CASCADE', () => {
        const { foreignKeys } = getTableConfig(aiMessages);
        const fkToConversations = foreignKeys.find((fk) => {
            return getTableConfig(fk.reference().foreignTable).name === 'ai_conversations';
        });
        expect(fkToConversations?.onDelete).toBe('cascade');
    });

    it('should have (conversationId, createdAt) and (conversationId, role) indexes', () => {
        const names = indexNames(aiMessages);
        expect(names).toContain('aiMessages_conversationId_created_idx');
        expect(names).toContain('aiMessages_conversationId_role_idx');
    });

    it('should have soft-delete columns', () => {
        expect(hasCol(aiMessages, 'deleted_at')).toBe(true);
        expect(hasCol(aiMessages, 'deleted_by_id')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Cross-cutting: all tables with soft-delete have BOTH deletedAt + deletedById
// ---------------------------------------------------------------------------

describe('soft-delete column consistency', () => {
    // Tables that HAVE soft-delete (deletedAt + deletedById)
    const tablesWithSoftDelete = [
        { name: 'ai_prompt_versions', table: aiPromptVersions },
        { name: 'ai_provider_credentials', table: aiProviderCredentials },
        { name: 'ai_conversations', table: aiConversations },
        { name: 'ai_messages', table: aiMessages }
    ];

    for (const { name, table } of tablesWithSoftDelete) {
        it(`${name} should have both deleted_at and deleted_by_id`, () => {
            expect(hasCol(table, 'deleted_at')).toBe(true);
            expect(hasCol(table, 'deleted_by_id')).toBe(true);
        });
    }

    // Tables that are APPEND-ONLY (no soft-delete)
    it('ai_settings should have NO soft-delete (upsert-only mirror of platform_settings)', () => {
        expect(hasCol(aiSettings, 'deleted_at')).toBe(false);
        expect(hasCol(aiSettings, 'deleted_by_id')).toBe(false);
    });

    it('ai_credential_audit should have NO soft-delete (append-only security trail, Q1)', () => {
        expect(hasCol(aiCredentialAudit, 'deleted_at')).toBe(false);
        expect(hasCol(aiCredentialAudit, 'deleted_by_id')).toBe(false);
    });

    it('ai_usage should have NO soft-delete (append-only metering, owner-approved 2026-06-04)', () => {
        expect(hasCol(aiUsage, 'deleted_at')).toBe(false);
        expect(hasCol(aiUsage, 'deleted_by_id')).toBe(false);
    });

    it('ai_request_log should have NO soft-delete (append-only debug log, owner-approved 2026-06-04)', () => {
        expect(hasCol(aiRequestLog, 'deleted_at')).toBe(false);
        expect(hasCol(aiRequestLog, 'deleted_by_id')).toBe(false);
    });
});
