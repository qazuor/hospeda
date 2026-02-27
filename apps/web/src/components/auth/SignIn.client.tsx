/**
 * React island wrapper for the SignInForm component from @repo/auth-ui.
 *
 * Connects the auth-ui SignInForm with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module SignIn.client
 */

import { SignInForm } from '@repo/auth-ui';
import { signIn } from '../../lib/auth-client';

/**
 * Props for the SignInClient component
 */
export interface SignInClientProps {
    /** URL to redirect after successful sign-in */
    readonly redirectTo: string;
    /** Whether to show OAuth buttons (Google, Facebook) */
    readonly showOAuth?: boolean;
}

/**
 * SignInClient wraps the auth-ui SignInForm with the web app's auth client.
 */
export function SignInClient({ redirectTo, showOAuth = true }: SignInClientProps) {
    return (
        <SignInForm
            signIn={signIn}
            redirectTo={redirectTo}
            showOAuth={showOAuth}
        />
    );
}
