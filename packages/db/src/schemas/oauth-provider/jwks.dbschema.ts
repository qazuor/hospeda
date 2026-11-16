import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Better Auth `jwt()` plugin signing keys (HOS-2184).
 *
 * Holds the key pairs that sign the OAuth access tokens of the MCP
 * authorization server; their public halves are served at `/api/auth/jwks`.
 * `privateKey` is stored encrypted by the plugin. Columns mirror the plugin's
 * `jwks` model exactly (Better Auth validates the Drizzle schema at runtime).
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const jwks = pgTable('jwks', {
    id: text('id').primaryKey(),
    publicKey: text('public_key').notNull(),
    privateKey: text('private_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    alg: text('alg'),
    crv: text('crv')
});

/** Insert shape for a JWKS key row. */
export type InsertJwks = typeof jwks.$inferInsert;
/** Select shape for a JWKS key row. */
export type SelectJwks = typeof jwks.$inferSelect;
