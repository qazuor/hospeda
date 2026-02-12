/**
 * Supported primary authentication providers for user accounts.
 *
 * With the migration to Better Auth, BETTER_AUTH is the default provider.
 * CLERK is retained for backward compatibility with existing database records.
 * AUTH0 is retained for potential future use.
 */
export enum AuthProviderEnum {
    BETTER_AUTH = 'BETTER_AUTH',
    /** @deprecated Legacy provider. Retained for existing DB records. */
    CLERK = 'CLERK',
    AUTH0 = 'AUTH0',
    CUSTOM = 'CUSTOM'
}
