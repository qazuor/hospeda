import { ClerkProvider } from '@clerk/clerk-react';
import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

/**
 * ClerkRoot
 * Global Clerk provider that wraps the entire app.
 * This prevents multiple ClerkProvider instances in the React tree.
 */
export const ClerkRoot = ({ children }: Props): JSX.Element => {
    const publishableKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY as string | undefined;

    if (!publishableKey) {
        return <>{children}</>;
    }

    // biome-ignore lint/suspicious/noExplicitAny: clerk type compatibility issue
    const ClerkProviderComponent = ClerkProvider as any;
    return (
        <ClerkProviderComponent publishableKey={publishableKey}>{children}</ClerkProviderComponent>
    );
};
