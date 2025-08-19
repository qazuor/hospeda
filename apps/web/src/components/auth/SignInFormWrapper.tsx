import { ClerkProvider } from '@clerk/clerk-react';
import { SignInForm } from '@repo/auth-ui';
import { AuthProvider, useAuthContext } from '../../contexts/auth-context';

interface Props {
    apiBaseUrl?: string;
    redirectTo?: string;
}

/**
 * SignInFormContent
 * The actual form content that uses AuthContext for session management
 */
const SignInFormContent = ({ apiBaseUrl, redirectTo }: Props): JSX.Element => {
    const authContext = useAuthContext();

    return (
        <SignInForm
            apiBaseUrl={apiBaseUrl}
            redirectTo={redirectTo}
            refreshAuthContext={authContext.refreshSession}
        />
    );
};

/**
 * SignInFormWrapper
 * Self-contained sign-in form with its own auth providers
 * This allows the form to work independently without affecting page prerendering
 */
export const SignInFormWrapper = ({ apiBaseUrl, redirectTo }: Props): JSX.Element | null => {
    const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

    if (!publishableKey) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-600 text-sm">
                    Clerk configuration missing. Please check your environment variables.
                </p>
            </div>
        );
    }

    // biome-ignore lint/suspicious/noExplicitAny: clerk type compatibility issue
    const ClerkProviderComponent = ClerkProvider as any;
    return (
        <ClerkProviderComponent publishableKey={publishableKey}>
            <AuthProvider>
                <SignInFormContent
                    apiBaseUrl={apiBaseUrl}
                    redirectTo={redirectTo}
                />
            </AuthProvider>
        </ClerkProviderComponent>
    );
};
