/**
 * Authentication context for the admin application.
 *
 * Provides centralized auth state using Better Auth's useSession hook,
 * enriched with user role and permissions from the API. Replaces the
 * previous Clerk-based auth context.
 *
 * @module auth-context
 */

import { fetchApi } from '@/lib/api/client';
import { signOut as authSignOut, useSession } from '@/lib/auth-client';
import { type ReactNode, createContext, useCallback, useEffect, useState } from 'react';
import { adminLogger } from '../utils/logger';

/**
 * User session data stored in context and session storage
 */
interface UserSession {
    id: string;
    role: string;
    permissions: string[];
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
export interface AuthContextValue extends AuthState {
    refreshSession: () => Promise<void>;
    clearSession: () => void;
    signOut: () => Promise<void>;
}

const HospedaAuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session storage keys
 */
const SESSION_KEYS = {
    USER: 'hospeda_user_session',
    TIMESTAMP: 'hospeda_session_timestamp'
} as const;

/**
 * Session TTL (5 minutes)
 */
const SESSION_TTL = 5 * 60 * 1000;

/**
 * Get session from storage
 */
function getStoredSession(): { user: UserSession | null; isValid: boolean } {
    if (typeof window === 'undefined') {
        return { user: null, isValid: false };
    }

    try {
        const userStr = sessionStorage.getItem(SESSION_KEYS.USER);
        const timestampStr = sessionStorage.getItem(SESSION_KEYS.TIMESTAMP);

        if (!userStr || !timestampStr) {
            return { user: null, isValid: false };
        }

        const timestamp = Number.parseInt(timestampStr, 10);
        const isValid = Date.now() - timestamp < SESSION_TTL;

        if (!isValid) {
            clearStoredSession();
            return { user: null, isValid: false };
        }

        const user = JSON.parse(userStr) as UserSession;
        return { user, isValid: true };
    } catch (error) {
        adminLogger.warn('Failed to parse stored session', error);
        clearStoredSession();
        return { user: null, isValid: false };
    }
}

/**
 * Store session in storage
 */
function storeSession(user: UserSession): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
        sessionStorage.setItem(SESSION_KEYS.TIMESTAMP, Date.now().toString());
    } catch (error) {
        adminLogger.warn('Failed to store session', error);
    }
}

/**
 * Clear stored session
 */
function clearStoredSession(): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        sessionStorage.removeItem(SESSION_KEYS.USER);
        sessionStorage.removeItem(SESSION_KEYS.TIMESTAMP);
    } catch (error) {
        adminLogger.warn('Failed to clear stored session', error);
    }
}

/**
 * Fetch user session enrichment from API (roles, permissions)
 */
async function fetchUserSession(): Promise<UserSession | null> {
    try {
        adminLogger.debug('Fetching user session from API...');
        const response = await fetchApi<unknown>({
            path: '/api/v1/public/auth/me',
            method: 'GET'
        });

        if (response.status < 200 || response.status >= 300) {
            return null;
        }

        interface AuthMeResponse {
            success: boolean;
            data?: {
                isAuthenticated: boolean;
                actor?: {
                    id: string;
                    role: string;
                    permissions?: string[];
                };
            };
        }
        const responseData = response.data as AuthMeResponse;

        if (
            responseData?.success &&
            responseData?.data?.isAuthenticated &&
            responseData?.data?.actor
        ) {
            const actor = responseData.data.actor;
            return {
                id: actor.id,
                role: actor.role,
                permissions: actor.permissions || []
            };
        }

        return null;
    } catch (error) {
        adminLogger.error(
            'Error fetching user session',
            error instanceof Error ? error.message : String(error)
        );
        return null;
    }
}

/**
 * AuthProvider component
 *
 * Uses Better Auth's useSession hook for authentication state,
 * enriched with role/permissions from the API.
 */
interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { data: session, isPending: isSessionLoading } = useSession();

    const [authState, setAuthState] = useState<AuthState>(() => {
        if (typeof window === 'undefined') {
            return {
                isLoading: true,
                isAuthenticated: false,
                user: null,
                error: null
            };
        }

        const stored = getStoredSession();
        return {
            isLoading: true,
            isAuthenticated: stored.isValid && !!stored.user,
            user: stored.user,
            error: null
        };
    });

    /**
     * Refresh session from API
     */
    const refreshSession = useCallback(async (): Promise<void> => {
        try {
            setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

            const user = await fetchUserSession();

            if (user && session?.user) {
                const enrichedUser: UserSession = {
                    ...user,
                    displayName: session.user.name || user.displayName,
                    email: session.user.email || user.email,
                    avatar: session.user.image || user.avatar
                };

                storeSession(enrichedUser);
                setAuthState({
                    isLoading: false,
                    isAuthenticated: true,
                    user: enrichedUser,
                    error: null
                });
            } else {
                clearStoredSession();
                setAuthState({
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    error: null
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setAuthState((prev) => ({
                ...prev,
                isLoading: false,
                error: errorMessage
            }));
        }
    }, [session]);

    /**
     * Clear session
     */
    const clearSession = useCallback((): void => {
        clearStoredSession();
        setAuthState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: null
        });
    }, []);

    /**
     * Sign out
     */
    const handleSignOut = async (): Promise<void> => {
        try {
            clearSession();
            await authSignOut();
        } catch (error) {
            adminLogger.error('Sign out error', error);
        }
    };

    /**
     * Sync with Better Auth session state
     */
    useEffect(() => {
        if (isSessionLoading) return;

        const isSignedIn = !!session?.user;

        if (isSignedIn && !authState.user) {
            const stored = getStoredSession();
            if (stored.isValid && stored.user) {
                setAuthState((prev) => ({
                    ...prev,
                    isLoading: false,
                    isAuthenticated: true,
                    user: stored.user
                }));
            } else {
                refreshSession();
            }
        } else if (!isSignedIn && authState.isAuthenticated) {
            clearSession();
        } else {
            setAuthState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [
        isSessionLoading,
        session,
        authState.user,
        authState.isAuthenticated,
        clearSession,
        refreshSession
    ]);

    /**
     * Handle session expiration
     */
    useEffect(() => {
        if (!authState.isAuthenticated) return;

        const checkSessionExpiration = () => {
            const stored = getStoredSession();
            if (!stored.isValid && authState.isAuthenticated) {
                refreshSession();
            }
        };

        const interval = setInterval(checkSessionExpiration, 60 * 1000);
        return () => clearInterval(interval);
    }, [authState.isAuthenticated, refreshSession]);

    const contextValue: AuthContextValue = {
        ...authState,
        refreshSession,
        clearSession,
        signOut: handleSignOut
    };

    return (
        <HospedaAuthContext.Provider value={contextValue}>{children}</HospedaAuthContext.Provider>
    );
}

export { HospedaAuthContext as AuthContext };
