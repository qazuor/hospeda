import { useAuth, useUser } from '@clerk/clerk-react';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * User session data stored in context and session storage
 */
interface UserSession {
    id: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    email?: string;
}

/**
 * Authentication state
 */
interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: UserSession | null;
    clerkUser: unknown; // Clerk user object
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
 * Session storage keys
 */
const SESSION_KEYS = {
    USER: 'hospeda_web_user_session',
    TIMESTAMP: 'hospeda_web_session_timestamp',
    CLERK_STATE: 'hospeda_web_clerk_state'
} as const;

/**
 * Session TTL (5 minutes)
 */
const SESSION_TTL = 5 * 60 * 1000;

/**
 * Get session from storage
 */
function getStoredSession(): { user: UserSession | null; isValid: boolean } {
    // Only access sessionStorage in the browser
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
        console.warn('Failed to parse stored session:', error);
        clearStoredSession();
        return { user: null, isValid: false };
    }
}

/**
 * Store session in storage
 */
function storeSession(user: UserSession): void {
    // Only access sessionStorage in the browser
    if (typeof window === 'undefined') {
        return;
    }

    try {
        sessionStorage.setItem(SESSION_KEYS.USER, JSON.stringify(user));
        sessionStorage.setItem(SESSION_KEYS.TIMESTAMP, Date.now().toString());
    } catch (error) {
        console.warn('Failed to store session:', error);
    }
}

/**
 * Clear stored session
 */
function clearStoredSession(): void {
    // Only access sessionStorage in the browser
    if (typeof window === 'undefined') {
        return;
    }

    try {
        sessionStorage.removeItem(SESSION_KEYS.USER);
        sessionStorage.removeItem(SESSION_KEYS.TIMESTAMP);
        sessionStorage.removeItem(SESSION_KEYS.CLERK_STATE);
    } catch (error) {
        console.warn('Failed to clear stored session:', error);
    }
}

/**
 * Fetch user session from API
 */
async function fetchUserSession(): Promise<UserSession | null> {
    try {
        // Use the API base URL from environment or default to localhost:3002
        const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3002';

        const response = await fetch(`${apiBaseUrl}/api/v1/public/auth/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Include cookies for Clerk authentication
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data?.isAuthenticated && result.data?.actor) {
            const actor = result.data.actor;
            return {
                id: actor.id,
                // Additional user data will be enriched with Clerk data
                displayName: undefined,
                firstName: undefined,
                lastName: undefined,
                avatar: undefined,
                email: undefined
            };
        }

        return null;
    } catch (_error) {
        return null;
    }
}

/**
 * AuthProvider component
 */
interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { isLoaded: clerkLoaded, isSignedIn, signOut: clerkSignOut } = useAuth();
    const { user: clerkUser } = useUser();

    // Track if we're on the client side (after hydration)
    const [isClient, setIsClient] = useState(false);

    const [authState, setAuthState] = useState<AuthState>(() => {
        // During SSR, always start with no session
        if (typeof window === 'undefined') {
            return {
                isLoading: true,
                isAuthenticated: false,
                user: null,
                clerkUser: null,
                error: null
            };
        }

        // On client, initialize with stored session if available
        const stored = getStoredSession();
        return {
            isLoading: !clerkLoaded,
            isAuthenticated: stored.isValid && !!stored.user,
            user: stored.user,
            clerkUser: null,
            error: null
        };
    });

    // Effect to handle client-side hydration
    useEffect(() => {
        if (typeof window !== 'undefined' && !isClient) {
            setIsClient(true);

            // Re-initialize state with stored session after hydration
            const stored = getStoredSession();
            setAuthState((prev) => ({
                ...prev,
                isAuthenticated: stored.isValid && !!stored.user,
                user: stored.user,
                isLoading: !clerkLoaded
            }));
        }
    }, [isClient, clerkLoaded]);

    /**
     * Refresh session from API
     */
    const refreshSession = useCallback(async (): Promise<void> => {
        try {
            setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

            const user = await fetchUserSession();

            if (user) {
                // Enrich with Clerk user data
                const enrichedUser: UserSession = {
                    ...user,
                    displayName: clerkUser?.fullName || user.displayName,
                    firstName: clerkUser?.firstName || user.firstName,
                    lastName: clerkUser?.lastName || user.lastName,
                    avatar: clerkUser?.imageUrl || user.avatar,
                    email: clerkUser?.primaryEmailAddress?.emailAddress || user.email
                };

                storeSession(enrichedUser);
                setAuthState({
                    isLoading: false,
                    isAuthenticated: true,
                    user: enrichedUser,
                    clerkUser,
                    error: null
                });
            } else {
                clearStoredSession();
                setAuthState({
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    clerkUser,
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
    }, [clerkUser]);

    /**
     * Clear session
     */
    const clearSession = useCallback((): void => {
        clearStoredSession();
        setAuthState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            clerkUser: null,
            error: null
        });
    }, []);

    /**
     * Sign out
     */
    const signOut = async (): Promise<void> => {
        try {
            // Clear local session storage
            clearSession();

            // Call backend to cleanup server-side state
            try {
                const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3002';
                await fetch(`${apiBaseUrl}/api/v1/public/auth/signout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
            } catch (cleanupError) {
                // Ignore cleanup errors - not critical for sign out
                console.debug('Server cleanup during sign out (non-critical):', cleanupError);
            }

            // Sign out from Clerk
            await clerkSignOut();
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    /**
     * Effect to sync with Clerk state
     */
    useEffect(() => {
        if (!clerkLoaded || !isClient) return;

        setAuthState((prev) => ({ ...prev, clerkUser, isLoading: false }));

        // If Clerk says user is signed in but we don't have a session, fetch it
        if (isSignedIn && !authState.isAuthenticated) {
            const stored = getStoredSession();

            if (stored.isValid) {
                // Valid stored session exists, no need to refresh
            } else {
                // Add a small delay to prevent multiple rapid calls
                const timeoutId = setTimeout(() => {
                    refreshSession();
                }, 100);
                return () => clearTimeout(timeoutId);
            }
        }

        // If Clerk says user is signed out, clear our session
        if (!isSignedIn && authState.isAuthenticated) {
            clearSession();
        }
    }, [
        clerkLoaded,
        isSignedIn,
        clerkUser,
        isClient,
        authState.isAuthenticated,
        clearSession,
        refreshSession
    ]);

    /**
     * Effect to handle session expiration
     */
    useEffect(() => {
        if (!authState.isAuthenticated) return;

        const checkSessionExpiration = () => {
            const stored = getStoredSession();
            if (!stored.isValid && authState.isAuthenticated) {
                // Session expired, refresh it
                refreshSession();
            }
        };

        // Check every minute
        const interval = setInterval(checkSessionExpiration, 60 * 1000);
        return () => clearInterval(interval);
    }, [authState.isAuthenticated, refreshSession]);

    const contextValue: AuthContextValue = {
        ...authState,
        refreshSession,
        clearSession,
        signOut
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
