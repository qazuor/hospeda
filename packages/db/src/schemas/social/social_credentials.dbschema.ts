import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Encrypted social automation credential vault (HOS-64 / SPEC-297a G-4).
 *
 * Stores AES-256-GCM-encrypted secrets for the social publishing pipeline
 * (Make.com webhook URL/API key, the inbound AI social key, the operator
 * PIN). The plaintext secret NEVER appears in this table — only ciphertext
 * + IV + GCM auth tag. Mirrors `ai_provider_credentials` (SPEC-173 T-005)
 * file-for-file, replacing `providerId` with `key`.
 *
 * Encryption/decryption is the exclusive responsibility of `apps/api` (the
 * only consumer that holds the master key `HOSPEDA_SOCIAL_VAULT_MASTER_KEY`,
 * kept separate from the AI vault's master key — see `secret-vault-crypto.ts`).
 *
 * The `key` column stores one of: `make_webhook_url` | `make_api_key` |
 * `ai_social_key` | `operator_pin`. Varchar instead of a pgEnum, consistent
 * with the repo convention (pgEnum is reserved for TS enums in
 * `@repo/schemas`; these are validated in the service layer).
 */
export const socialCredentials = pgTable(
    'social_credentials',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * Credential identifier.
         * Values: `make_webhook_url` | `make_api_key` | `ai_social_key` | `operator_pin`.
         *
         * A single key may have multiple rows over time (rotation history);
         * the active credential is selected by the application layer.
         */
        key: varchar('key', { length: 50 }).notNull(),

        /**
         * AES-256-GCM ciphertext (base64-encoded).
         * Contains the encrypted secret value.
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
         * Human-readable label for the credential (e.g. "Production Make.com webhook").
         * Optional; for operator reference only.
         */
        label: varchar('label', { length: 255 }),

        // ---- Timestamps ----
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

        // ---- Soft delete ----
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Fast lookup: list/select credentials for a specific key.
         * Used by the vault resolver when a caller requests a credential.
         */
        socialCredentials_key_idx: index('socialCredentials_key_idx').on(table.key),
        /**
         * Partial unique index: enforces ONE active credential per key.
         * Soft-deleted rows (deleted_at IS NOT NULL) are excluded from the
         * constraint so multiple generations of rotated/deleted secrets can
         * coexist in the audit trail without violating uniqueness.
         *
         * Race-safe: concurrent inserts for the same key and null deleted_at
         * will see a unique-violation (Postgres error 23505) which the service
         * maps to VALIDATION_ERROR.
         */
        socialCredentials_active_key_uniq: uniqueIndex('idx_social_credentials_active_key')
            .on(table.key)
            .where(sql`deleted_at IS NULL`)
    })
);

/** Drizzle relations for `social_credentials`. */
export const socialCredentialsRelations = relations(socialCredentials, ({ one }) => ({
    deletedBy: one(users, {
        fields: [socialCredentials.deletedById],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertSocialCredential = typeof socialCredentials.$inferInsert;
export type SelectSocialCredential = typeof socialCredentials.$inferSelect;
