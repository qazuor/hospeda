/**
 * React island wrapper for the SignUpForm component from @repo/auth-ui.
 *
 * Connects the auth-ui SignUpForm with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module SignUp.client
 */

import { SignUpForm } from '@repo/auth-ui';
import { signIn, signUp } from '../../lib/auth-client';

/**
 * Props for the SignUpClient component
 */
export interface SignUpClientProps {
    /** URL to redirect after successful sign-up */
    readonly redirectTo: string;
    /** Whether to show OAuth buttons (Google, Facebook) */
    readonly showOAuth?: boolean;
}

/**
 * SignUpClient wraps the auth-ui SignUpForm with the web app's auth client.
 */
export function SignUpClient({ redirectTo, showOAuth = true }: SignUpClientProps) {
    return (
        <SignUpForm
            signUp={signUp}
            signIn={signIn}
            redirectTo={redirectTo}
            showOAuth={showOAuth}
        />
    );
}
