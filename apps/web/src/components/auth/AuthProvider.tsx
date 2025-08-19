import type { ReactNode } from 'react';

// Global flag to track if a ClerkProvider already exists
let hasClerkProvider = false;

/**
 * AuthProvider
 * Ensures only one ClerkProvider instance exists in the entire app.
 * Uses a global flag to prevent multiple providers.
 */
export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

    if (!publishableKey) {
        return <>{children}</>;
    }

    // If a provider already exists, just render children
    if (hasClerkProvider) {
        return <>{children}</>;
    }

    // Mark that we have a provider
    hasClerkProvider = true;

    // Dynamic import to avoid TypeScript conflicts
    const { ClerkProvider } = require('@clerk/clerk-react');

    return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
};
