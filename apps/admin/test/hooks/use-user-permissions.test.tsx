/**
 * Tests for useUserPermissions hooks
 *
 * Verifies that the permission hooks correctly:
 * 1. Read permissions from AuthContext via useAuthContext
 * 2. Return empty arrays when user is null or permissions undefined
 * 3. Provide accurate boolean checks for single and multiple permissions
 *
 * @module use-user-permissions.test
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock must be declared before importing the module under test
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: vi.fn()
}));

import { useAuthContext } from '@/hooks/use-auth-context';
import {
    useHasAllPermissions,
    useHasAnyPermission,
    useHasPermission,
    useUserPermissions
} from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';

const mockUseAuthContext = vi.mocked(useAuthContext);

/**
 * Builds a minimal AuthContextValue for use in mocks.
 * Pass permissions=null to simulate a null user (unauthenticated).
 */
function buildAuthContext(permissions: string[] | null) {
    if (permissions === null) {
        return {
            isLoading: false,
            isAuthenticated: false,
            user: null,
            error: null,
            refreshSession: vi.fn(),
            clearSession: vi.fn(),
            signOut: vi.fn()
        };
    }

    return {
        isLoading: false,
        isAuthenticated: true,
        user: {
            id: 'user-1',
            role: 'admin',
            permissions
        },
        error: null,
        refreshSession: vi.fn(),
        clearSession: vi.fn(),
        signOut: vi.fn()
    };
}

describe('useUserPermissions', () => {
    describe('when user is null', () => {
        it('returns an empty array', () => {
            // Arrange
            mockUseAuthContext.mockReturnValue(
                buildAuthContext(null) as ReturnType<typeof useAuthContext>
            );

            // Act
            const { result } = renderHook(() => useUserPermissions());

            // Assert
            expect(result.current).toEqual([]);
        });
    });

    describe('when user.permissions is undefined', () => {
        it('returns an empty array', () => {
            // Arrange - authenticated user but permissions not set (undefined via cast)
            mockUseAuthContext.mockReturnValue({
                isLoading: false,
                isAuthenticated: true,
                user: { id: 'user-1', role: 'admin' } as unknown as ReturnType<
                    typeof useAuthContext
                >['user'],
                error: null,
                refreshSession: vi.fn(),
                clearSession: vi.fn(),
                signOut: vi.fn()
            } as ReturnType<typeof useAuthContext>);

            // Act
            const { result } = renderHook(() => useUserPermissions());

            // Assert
            expect(result.current).toEqual([]);
        });
    });

    describe('when user has permissions', () => {
        it('returns the permissions array from auth context', () => {
            // Arrange
            const permissions = [
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ];
            mockUseAuthContext.mockReturnValue(
                buildAuthContext(permissions) as ReturnType<typeof useAuthContext>
            );

            // Act
            const { result } = renderHook(() => useUserPermissions());

            // Assert
            expect(result.current).toEqual(permissions);
        });
    });
});

describe('useHasPermission', () => {
    describe('when user has the permission', () => {
        it('returns true', () => {
            // Arrange
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_CREATE]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() =>
                useHasPermission(PermissionEnum.ACCOMMODATION_CREATE)
            );

            // Assert
            expect(result.current).toBe(true);
        });
    });

    describe('when user does not have the permission', () => {
        it('returns false', () => {
            // Arrange - user has VIEW_ALL but not CREATE
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_VIEW_ALL]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() =>
                useHasPermission(PermissionEnum.ACCOMMODATION_CREATE)
            );

            // Assert
            expect(result.current).toBe(false);
        });
    });

    describe('when user has no permissions at all', () => {
        it('returns false', () => {
            // Arrange - authenticated but empty permissions
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([]) as ReturnType<typeof useAuthContext>
            );

            // Act
            const { result } = renderHook(() =>
                useHasPermission(PermissionEnum.ACCOMMODATION_CREATE)
            );

            // Assert
            expect(result.current).toBe(false);
        });
    });
});

describe('useHasAnyPermission', () => {
    describe('when user has at least one of the required permissions', () => {
        it('returns true', () => {
            // Arrange - user has VIEW_ALL which is one of the checked permissions
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_VIEW_ALL]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() =>
                useHasAnyPermission([
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_VIEW_ALL
                ])
            );

            // Assert
            expect(result.current).toBe(true);
        });
    });

    describe('when user has none of the required permissions', () => {
        it('returns false', () => {
            // Arrange - user only has VIEW_ALL, but we check CREATE and UPDATE_ANY
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_VIEW_ALL]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() =>
                useHasAnyPermission([
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ])
            );

            // Assert
            expect(result.current).toBe(false);
        });
    });

    describe('when permissions list to check is empty', () => {
        it('returns false (no permission is satisfied)', () => {
            // Arrange
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_VIEW_ALL]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() => useHasAnyPermission([]));

            // Assert
            expect(result.current).toBe(false);
        });
    });
});

describe('useHasAllPermissions', () => {
    describe('when user has all required permissions', () => {
        it('returns true', () => {
            // Arrange
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]) as ReturnType<typeof useAuthContext>
            );

            // Act
            const { result } = renderHook(() =>
                useHasAllPermissions([
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_VIEW_ALL
                ])
            );

            // Assert
            expect(result.current).toBe(true);
        });
    });

    describe('when user is missing at least one required permission', () => {
        it('returns false', () => {
            // Arrange - user only has CREATE, missing UPDATE_ANY
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_CREATE]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() =>
                useHasAllPermissions([
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ])
            );

            // Assert
            expect(result.current).toBe(false);
        });
    });

    describe('when permissions list to check is empty', () => {
        it('returns true (vacuous truth: every() on empty array)', () => {
            // Arrange
            mockUseAuthContext.mockReturnValue(
                buildAuthContext([PermissionEnum.ACCOMMODATION_VIEW_ALL]) as ReturnType<
                    typeof useAuthContext
                >
            );

            // Act
            const { result } = renderHook(() => useHasAllPermissions([]));

            // Assert
            expect(result.current).toBe(true);
        });
    });
});
