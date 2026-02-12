import { AuthContext, type AuthContextValue } from '@/contexts/auth-context';
import { adminLogger } from '@/utils/logger';
import { useContext } from 'react';

/**
 * Hook to use auth context
 */
export function useAuthContext(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        // Add debug info to help identify where this is being called from
        adminLogger.error('useAuthContext called but HospedaAuthContext not found');
        adminLogger.error('Stack trace:', new Error().stack);

        // ALWAYS return a fallback context instead of throwing
        // This prevents the app from crashing during navigation
        adminLogger.warn('Returning fallback AuthContext to prevent crash');
        return {
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: null,
            refreshSession: async () => {
                adminLogger.warn('refreshSession called on fallback context');
            },
            clearSession: () => {
                adminLogger.warn('clearSession called on fallback context');
            },
            signOut: async () => {
                adminLogger.warn('signOut called on fallback context');
            }
        };
    }
    return context;
}

/**
 * Hook for checking if user has permission
 */
export function useHasPermission(permission: string): boolean {
    const { user } = useAuthContext();
    return user?.permissions?.includes(permission) ?? false;
}

/**
 * Hook for checking if user has role
 */
export function useHasRole(role: string): boolean {
    const { user } = useAuthContext();
    return user?.role === role;
}

/**
 * Hook for checking if user has any of the specified roles
 */
export function useHasAnyRole(roles: string[]): boolean {
    const { user } = useAuthContext();
    return roles.includes(user?.role ?? '');
}
