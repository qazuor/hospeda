import { AuthContext, type AuthContextValue } from '@/contexts/auth-context';
import { useContext } from 'react';

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
