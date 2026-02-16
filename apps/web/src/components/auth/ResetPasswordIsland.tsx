/**
 * React island wrapper for the ResetPasswordForm component from @repo/auth-ui.
 *
 * Connects the auth-ui ResetPasswordForm with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module ResetPasswordIsland
 */

import { ResetPasswordForm } from '@repo/auth-ui';
import { resetPassword } from '../../lib/auth-client';

/**
 * Props for the ResetPasswordIsland component
 */
export interface ResetPasswordIslandProps {
    /** Token from the password reset URL */
    readonly token: string;
    /** URL for the sign-in page link */
    readonly signInUrl: string;
}

/**
 * ResetPasswordIsland wraps the auth-ui ResetPasswordForm with the web app's auth client.
 */
export function ResetPasswordIsland({ token, signInUrl }: ResetPasswordIslandProps) {
    const handleResetPassword = async ({
        newPassword,
        token: resetToken
    }: { newPassword: string; token: string }) => {
        const result = await resetPassword({ newPassword, token: resetToken });
        return result;
    };

    return (
        <ResetPasswordForm
            token={token}
            onResetPassword={handleResetPassword}
            signInUrl={signInUrl}
        />
    );
}
