import { ClerkProvider } from '@clerk/clerk-react';
import { SimpleUserMenu } from '@repo/auth-ui';
import { AuthProvider, useAuthContext } from '../../contexts/auth-context';

import type { ReactNode } from 'react';

/**
 * UserNavContent
 * The actual navigation content that uses AuthContext
 */
const UserNavContent = (): ReactNode => {
    const authContext = useAuthContext();

    return (
        <div className="flex items-center space-x-4">
            <SimpleUserMenu
                apiBaseUrl={import.meta.env.PUBLIC_API_URL || 'http://localhost:3001'}
                redirectTo="/"
                refreshAuthContext={authContext.refreshSession}
            />
        </div>
    );
};

/**
 * UserNav
 * Self-contained auth navigation component with its own providers
 * This allows the component to work independently without affecting page prerendering
 */
export const UserNav = (): ReactNode => {
    const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

    if (!publishableKey) {
        // Fallback UI when Clerk is not configured
        return (
            <div className="flex items-center space-x-2">
                <a
                    href="/auth/signin/"
                    className="rounded-md px-3 py-2 font-medium text-gray-700 text-sm transition-colors hover:text-gray-900"
                >
                    Iniciar sesión
                </a>
                <a
                    href="/auth/signup/"
                    className="rounded-md bg-gradient-to-r from-cyan-500 to-green-500 px-4 py-2 font-medium text-sm text-white transition-all duration-200 hover:from-cyan-600 hover:to-green-600"
                >
                    Registrarse
                </a>
            </div>
        );
    }

    // biome-ignore lint/suspicious/noExplicitAny: clerk type compatibility issue
    const ClerkProviderComponent = ClerkProvider as any;
    return (
        <ClerkProviderComponent publishableKey={publishableKey}>
            <AuthProvider>
                <UserNavContent />
            </AuthProvider>
        </ClerkProviderComponent>
    );
};
