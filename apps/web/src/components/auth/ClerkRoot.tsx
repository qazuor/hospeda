/**
 * Auth root provider for the web application.
 *
 * With Better Auth, no explicit provider wrapper is needed since
 * authentication is cookie-based. This component is kept as a
 * pass-through for backward compatibility with existing layouts.
 */

import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

/**
 * AuthRoot wraps children without any auth provider.
 * Better Auth uses cookies, so no client-side provider is needed.
 */
export const ClerkRoot = ({ children }: Props): JSX.Element => {
    return <>{children}</>;
};
