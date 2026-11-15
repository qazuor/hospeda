import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Better Auth `oauthProvider()` client-assertion replay guard (HOS-2184).
 *
 * Remembers the `jti` of each `private_key_jwt` client assertion until it
 * expires, so an assertion cannot be replayed. Columns mirror the plugin's
 * `oauthClientAssertion` model exactly.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const oauthClientAssertions = pgTable('oauth_client_assertion', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

/** Insert shape for an OAuth client-assertion replay row. */
export type InsertOauthClientAssertion = typeof oauthClientAssertions.$inferInsert;
/** Select shape for an OAuth client-assertion replay row. */
export type SelectOauthClientAssertion = typeof oauthClientAssertions.$inferSelect;
