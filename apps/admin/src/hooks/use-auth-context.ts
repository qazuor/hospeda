import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/contexts/auth-context';
import { adminLogger } from '@/utils/logger';

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
 * Hook for checking if the current user holds the given role.
 *
 * HOS-296: the user can hold multiple roles at once — this checks
 * membership in the set (`user.roles`), not equality against a single value.
 */
export function useHasRole(role: string): boolean {
    const { user } = useAuthContext();
    return user?.roles.includes(role) ?? false;
}

/**
 * Hook for checking if the current user holds ANY of the specified roles.
 *
 * HOS-296: both sides are sets now — this checks whether the two sets
 * intersect (the user holds at least one of the listed roles), not whether
 * a single scalar role appears in the list.
 */
export function useHasAnyRole(roles: string[]): boolean {
    const { user } = useAuthContext();
    const userRoles = user?.roles ?? [];
    return roles.some((r) => userRoles.includes(r));
}
