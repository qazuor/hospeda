/**
 * Authentication context for the web application.
 *
 * Uses Better Auth's useSession hook for session state management.
 * Provides user data, sign-out, and session refresh capabilities.
 *
 * @module auth-context
 */

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { signOut as authSignOut, useSession } from '../lib/auth-client';
import { webLogger } from '../utils/logger';

/**
 * User session data stored in context
 */
interface UserSession {
    id: string;
    displayName?: string;
    email?: string;
    avatar?: string;
}

/**
 * Authentication state
 */
interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: UserSession | null;
    error: string | null;
}

/**
 * Authentication context methods
 */
interface AuthContextValue extends AuthState {
    refreshSession: () => Promise<void>;
    clearSession: () => void;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider component using Better Auth
 */
interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { data: session, isPending } = useSession();

    const [authState, setAuthState] = useState<AuthState>({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        error: null
    });

    const refreshSession = useCallback(async (): Promise<void> => {
        // With Better Auth, refreshing means re-checking the session
        // The useSession hook handles this automatically
        setAuthState((prev) => ({ ...prev, isLoading: true }));
    }, []);

    const clearSession = useCallback((): void => {
        setAuthState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: null
        });
    }, []);

    const handleSignOut = async (): Promise<void> => {
        try {
            clearSession();
            await authSignOut();
        } catch (error) {
            webLogger.error('Sign out error', error);
        }
    };

    // Sync with Better Auth session
    useEffect(() => {
        if (isPending) return;

        if (session?.user) {
            setAuthState({
                isLoading: false,
                isAuthenticated: true,
                user: {
                    id: session.user.id,
                    displayName: session.user.name || undefined,
                    email: session.user.email || undefined,
                    avatar: session.user.image || undefined
                },
                error: null
            });
        } else {
            setAuthState({
                isLoading: false,
                isAuthenticated: false,
                user: null,
                error: null
            });
        }
    }, [isPending, session]);

    const contextValue: AuthContextValue = {
        ...authState,
        refreshSession,
        clearSession,
        signOut: handleSignOut
    };

    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuthContext(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
}
