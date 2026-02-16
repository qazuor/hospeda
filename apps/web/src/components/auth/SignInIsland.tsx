/**
 * React island wrapper for the SignInForm component from @repo/auth-ui.
 *
 * Connects the auth-ui SignInForm with the web app's Better Auth client.
 * Used in Astro pages with `client:load` for immediate interactivity.
 *
 * @module SignInIsland
 */

import { SignInForm } from '@repo/auth-ui';
import { signIn } from '../../lib/auth-client';

/**
 * Props for the SignInIsland component
 */
export interface SignInIslandProps {
    /** URL to redirect after successful sign-in */
    readonly redirectTo: string;
    /** Whether to show OAuth buttons (Google, Facebook) */
    readonly showOAuth?: boolean;
}

/**
 * SignInIsland wraps the auth-ui SignInForm with the web app's auth client.
 */
export function SignInIsland({ redirectTo, showOAuth = true }: SignInIslandProps) {
    return (
        <SignInForm
            signIn={signIn}
            redirectTo={redirectTo}
            showOAuth={showOAuth}
        />
    );
}
