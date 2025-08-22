import { UserMenu } from '@repo/auth-ui';

/**
 * Header user component using @repo/auth-ui components
 * Provides consistent authentication UI across all applications
 */
export default function HeaderUser() {
    // Use the UserMenu component from auth-ui for consistency
    return <UserMenu apiBaseUrl={window.location.origin} />;
}
