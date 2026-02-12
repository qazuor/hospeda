/**
 * Auth provider for the web application.
 *
 * With Better Auth, no explicit provider is needed since
 * authentication is cookie-based. This is a pass-through wrapper
 * for backward compatibility.
 */

import type { ReactNode } from 'react';

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
    return <>{children}</>;
};
