import { relations, sql } from 'drizzle-orm';
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Encrypted AI provider credential vault (SPEC-173 T-005).
 *
 * Stores AES-256-GCM-encrypted provider API keys. The plaintext key NEVER
 * appears in this table — only ciphertext + IV + GCM auth tag.
 *
 * Encryption/decryption is the exclusive responsibility of `apps/api`
 * (the only consumer that holds the master key `HOSPEDA_AI_VAULT_MASTER_KEY`).
 * The `@repo/ai-core` package receives the plaintext at call time by parameter
 * and never touches this table directly (§5.5, AC-4).
 *
 * The `providerId` column stores the AI provider identifier (`openai`,
 * `anthropic`, `stub`) as a varchar, matching `AiProviderId` from
 * `@repo/schemas`. See the feature comment in `ai_prompt_versions` for the
 * rationale for not using a pgEnum here.
 *
 * Decision (owner-approved 2026-06-04): varchar chosen for AI enums (consistent
 * with repo — pgEnum is reserved for TS enums in @repo/schemas; AI values are
 * z.enum). Migrating to pgEnum is a future option if these are ever promoted to
 * TS enums.
 */
export const aiProviderCredentials = pgTable(
    'ai_provider_credentials',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * Provider identifier.
         * Values: `openai` | `anthropic` | `stub`
         * (from `AiProviderIdSchema` in `@repo/schemas`).
         *
         * A single provider may have multiple credential rows (e.g. rotating
         * keys); the active credential is selected by the application layer.
         */
        providerId: varchar('provider_id', { length: 50 }).notNull(),

        /**
         * AES-256-GCM ciphertext (base64-encoded).
         * Contains the encrypted provider API key.
         */
        ciphertext: text('ciphertext').notNull(),

        /**
         * AES-256-GCM initialisation vector (base64-encoded, 12 bytes / 96 bits).
         * Unique per encryption operation — never reused.
         */
        iv: varchar('iv', { length: 32 }).notNull(),

        /**
         * AES-256-GCM authentication tag (base64-encoded, 16 bytes).
         * Used to verify ciphertext integrity and authenticity on decrypt.
         */
        authTag: varchar('auth_tag', { length: 32 }).notNull(),

        /**
         * Human-readable label for the key (e.g. "Production OpenAI key").
         * Optional; for operator reference only.
         */
        label: varchar('label', { length: 255 }),

        /**
         * Arbitrary metadata JSONB blob (e.g. expiry date, key tier).
         * Optional; not interpreted by the engine.
         */
        metadata: jsonb('metadata').$type<Record<string, unknown>>(),

        // ---- Timestamps ----
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

        // ---- Soft delete ----
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Fast lookup: list/select credentials for a specific provider.
         * Used by the vault resolver when the engine requests credentials.
         */
        aiProviderCredentials_providerId_idx: index('aiProviderCredentials_providerId_idx').on(
            table.providerId
        ),
        /**
         * Partial unique index: enforces ONE active credential per provider.
         * Soft-deleted rows (deleted_at IS NOT NULL) are excluded from the
         * constraint so multiple generations of rotated/deleted keys can coexist
         * in the audit trail without violating uniqueness.
         *
         * Race-safe: concurrent inserts for the same provider and null deleted_at
         * will see a unique-violation (Postgres error 23505) which the service
         * maps to VALIDATION_ERROR.
         */
        aiProviderCredentials_active_provider_uniq: uniqueIndex(
            'idx_ai_provider_credentials_active_provider'
        )
            .on(table.providerId)
            .where(sql`deleted_at IS NULL`)
    })
);

/** Drizzle relations for `ai_provider_credentials`. */
export const aiProviderCredentialsRelations = relations(aiProviderCredentials, ({ one }) => ({
    deletedBy: one(users, {
        fields: [aiProviderCredentials.deletedById],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertAiProviderCredential = typeof aiProviderCredentials.$inferInsert;
export type SelectAiProviderCredential = typeof aiProviderCredentials.$inferSelect;
