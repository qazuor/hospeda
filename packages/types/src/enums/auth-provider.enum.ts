/**
 * Supported primary authentication providers for user accounts.
 * This enum allows the system to remain provider-agnostic (e.g., Clerk, Auth0).
 */
export enum AuthProviderEnum {
    CLERK = 'CLERK',
    AUTH0 = 'AUTH0',
    CUSTOM = 'CUSTOM'
}
