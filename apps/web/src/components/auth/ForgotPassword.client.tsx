/**
 * React island wrapper for the ForgotPasswordForm component from @repo/auth-ui.
 *
 * Connects the auth-ui ForgotPasswordForm with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module ForgotPassword.client
 */

import { ForgotPasswordForm } from '@repo/auth-ui';
import { forgetPassword } from '../../lib/auth-client';

/**
 * Props for the ForgotPasswordClient component
 */
export interface ForgotPasswordClientProps {
    /** URL for the reset password page (included in the reset email) */
    readonly resetPasswordUrl: string;
    /** URL for the sign-in page link */
    readonly signInUrl: string;
}

/**
 * ForgotPasswordClient wraps the auth-ui ForgotPasswordForm with the web app's auth client.
 */
export function ForgotPasswordClient({ resetPasswordUrl, signInUrl }: ForgotPasswordClientProps) {
    const handleForgotPassword = async ({
        email,
        redirectTo
    }: { email: string; redirectTo: string }) => {
        const result = await forgetPassword({ email, redirectTo });
        return result;
    };

    return (
        <ForgotPasswordForm
            onForgotPassword={handleForgotPassword}
            redirectTo={resetPasswordUrl}
            signInUrl={signInUrl}
        />
    );
}
