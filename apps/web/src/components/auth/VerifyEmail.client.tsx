/**
 * React island wrapper for the VerifyEmail component from @repo/auth-ui.
 *
 * Connects the auth-ui VerifyEmail with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module VerifyEmail.client
 */

import { VerifyEmail } from '@repo/auth-ui';
import { verifyEmail } from '../../lib/auth-client';

/**
 * Props for the VerifyEmailClient component
 */
export interface VerifyEmailClientProps {
    /** Verification token from the URL */
    readonly token: string;
    /** URL to redirect after successful verification */
    readonly redirectTo: string;
}

/**
 * VerifyEmailClient wraps the auth-ui VerifyEmail with the web app's auth client.
 */
export function VerifyEmailClient({ token, redirectTo }: VerifyEmailClientProps) {
    const handleVerifyEmail = async ({ token: verifyToken }: { token: string }) => {
        const result = await verifyEmail({ token: verifyToken });
        return result;
    };

    return (
        <VerifyEmail
            token={token}
            onVerifyEmail={handleVerifyEmail}
            redirectTo={redirectTo}
        />
    );
}
