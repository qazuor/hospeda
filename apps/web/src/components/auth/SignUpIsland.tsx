/**
 * React island wrapper for the SignUpForm component from @repo/auth-ui.
 *
 * Connects the auth-ui SignUpForm with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module SignUpIsland
 */

import { SignUpForm } from '@repo/auth-ui';
import { signIn, signUp } from '../../lib/auth-client';

/**
 * Props for the SignUpIsland component
 */
export interface SignUpIslandProps {
    /** URL to redirect after successful sign-up */
    readonly redirectTo: string;
    /** Whether to show OAuth buttons (Google, Facebook) */
    readonly showOAuth?: boolean;
}

/**
 * SignUpIsland wraps the auth-ui SignUpForm with the web app's auth client.
 */
export function SignUpIsland({ redirectTo, showOAuth = true }: SignUpIslandProps) {
    return (
        <SignUpForm
            signUp={signUp}
            signIn={signIn}
            redirectTo={redirectTo}
            showOAuth={showOAuth}
        />
    );
}
