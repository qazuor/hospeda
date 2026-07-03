import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Encrypted OAuth credential vault for third-party integrations (HOS-45 T-002).
 *
 * Stores AES-256-GCM-encrypted OAuth access/refresh token pairs for external
 * providers (starting with MercadoLibre — SPEC-278). The plaintext tokens
 * NEVER appear in this table — only ciphertext + IV + GCM auth tag, one set
 * per secret.
 *
 * This table mirrors the shape and conventions of `ai_provider_credentials`
 * (the AI credential vault), with two structural differences:
 *
 * 1. **Two secrets instead of one.** OAuth requires both an access token
 *    (short-lived, used on every call) and a refresh token (long-lived,
 *    used to rotate the access token). Each secret gets its own
 *    ciphertext/iv/authTag triplet, encrypted and decrypted independently.
 * 2. **No rotation-history requirement.** Unlike the AI vault (which keeps
 *    soft-deleted generations around for key-rotation audit trails), this
 *    table always has exactly one live row per provider: refreshing a token
 *    is an in-place `UPDATE`, not an insert-then-soft-delete-old-row cycle.
 *    The `deletedAt` column exists purely for `BaseModel`/soft-delete
 *    convention consistency — it is not expected to accumulate history in
 *    practice.
 *
 * Encryption/decryption is the exclusive responsibility of the consuming
 * service layer (the holder of the master key). This schema only declares
 * storage — it has no knowledge of the encryption scheme beyond column
 * sizing (base64-encoded IV/auth-tag lengths match AES-256-GCM).
 *
 * The `provider` column is intentionally provider-agnostic: MercadoLibre is
 * the first consumer, but any future OAuth-based integration (other
 * marketplaces, external APIs) can reuse this same table by inserting a new
 * `provider` value — no schema change required.
 */
export const externalOauthCredentials = pgTable(
    'external_oauth_credentials',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * Provider identifier (e.g. `mercadolibre`).
         * Provider-agnostic by design: any future OAuth integration can
         * reuse this table by using a new value here.
         */
        provider: varchar('provider', { length: 50 }).notNull(),

        /**
         * AES-256-GCM ciphertext (base64-encoded) of the OAuth access token.
         */
        accessTokenCiphertext: text('access_token_ciphertext').notNull(),

        /**
         * AES-256-GCM initialisation vector (base64-encoded, 12 bytes / 96 bits)
         * for the access token. Unique per encryption operation — never reused.
         */
        accessTokenIv: varchar('access_token_iv', { length: 32 }).notNull(),

        /**
         * AES-256-GCM authentication tag (base64-encoded, 16 bytes) for the
         * access token. Used to verify ciphertext integrity and authenticity
         * on decrypt.
         */
        accessTokenAuthTag: varchar('access_token_auth_tag', { length: 32 }).notNull(),

        /**
         * AES-256-GCM ciphertext (base64-encoded) of the OAuth refresh token.
         */
        refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),

        /**
         * AES-256-GCM initialisation vector (base64-encoded, 12 bytes / 96 bits)
         * for the refresh token. Unique per encryption operation — never reused.
         */
        refreshTokenIv: varchar('refresh_token_iv', { length: 32 }).notNull(),

        /**
         * AES-256-GCM authentication tag (base64-encoded, 16 bytes) for the
         * refresh token. Used to verify ciphertext integrity and authenticity
         * on decrypt.
         */
        refreshTokenAuthTag: varchar('refresh_token_auth_tag', { length: 32 }).notNull(),

        /**
         * Access token expiry timestamp, as reported by the provider's OAuth
         * token response (e.g. `expires_in` seconds converted to an absolute
         * timestamp). Used by the refresh scheduler to decide when to rotate.
         */
        expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

        // ---- Timestamps ----
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

        // ---- Soft delete ----
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /**
         * Partial unique index: enforces ONE active credential row per
         * provider. Soft-deleted rows (deleted_at IS NOT NULL) are excluded
         * so a provider's credentials can be replaced without a unique
         * violation, mirroring `aiProviderCredentials_active_provider_uniq`.
         *
         * Race-safe: concurrent inserts for the same provider and null
         * deleted_at will see a unique-violation (Postgres error 23505),
         * which the service layer maps to VALIDATION_ERROR.
         */
        externalOauthCredentials_active_provider_uniq: uniqueIndex(
            'idx_external_oauth_credentials_active_provider'
        )
            .on(table.provider)
            .where(sql`deleted_at IS NULL`)
    })
);

/** Type inference helpers. */
export type InsertExternalOauthCredential = typeof externalOauthCredentials.$inferInsert;
export type SelectExternalOauthCredential = typeof externalOauthCredentials.$inferSelect;
