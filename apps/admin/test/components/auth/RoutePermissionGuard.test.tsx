/**
 * Tests for RoutePermissionGuard component
 *
 * Verifies that RoutePermissionGuard correctly:
 * 1. Renders children when user has the required permission
 * 2. Returns null and navigates away when user lacks permission
 * 3. Returns null while permissions are loading (empty array)
 * 4. Respects a custom redirectTo prop
 * 5. Applies OR logic by default
 * 6. Applies AND logic when requireAll=true
 *
 * @module RoutePermissionGuard.test
 */

import { RoutePermissionGuard } from '@/components/auth/RoutePermissionGuard';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: vi.fn()
}));

// useTranslations is used inside RoutePermissionGuard
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es'
    })
}));

const mockUseUserPermissions = vi.mocked(useUserPermissions);
// useNavigate is already mocked in setup.tsx; capture the navigate fn per-test
const mockNavigate = vi.fn();

// Override the global setup.tsx mock to return our controllable navigate fn
vi.mock('@tanstack/react-router', async (importOriginal) => {
    const original = await importOriginal<typeof import('@tanstack/react-router')>();
    return {
        ...original,
        useNavigate: vi.fn(() => mockNavigate),
        Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
            <a
                href={to}
                {...props}
            >
                {children}
            </a>
        )
    };
});

const mockUseNavigate = vi.mocked(useNavigate);

describe('RoutePermissionGuard', () => {
    describe('when user has the required permission', () => {
        it('renders children', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_CREATE]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            render(
                <RoutePermissionGuard permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
                    <span>Protected page content</span>
                </RoutePermissionGuard>
            );

            // Assert
            expect(screen.getByText('Protected page content')).toBeInTheDocument();
        });
    });

    describe('when permissions are still loading (empty array)', () => {
        it('returns null without navigating', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            const { container } = render(
                <RoutePermissionGuard permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
                    <span>Loading guard content</span>
                </RoutePermissionGuard>
            );

            // Assert - nothing is rendered
            expect(screen.queryByText('Loading guard content')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
            // navigate should NOT have been called because we treat empty as loading
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('when user lacks the required permission', () => {
        it('returns null and navigates to /dashboard by default', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_ALL]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            const { container } = render(
                <RoutePermissionGuard permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
                    <span>Should not appear</span>
                </RoutePermissionGuard>
            );

            // Assert
            expect(screen.queryByText('Should not appear')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
            expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' });
        });

        it('navigates to a custom redirectTo path when provided', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_ALL]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            render(
                <RoutePermissionGuard
                    permissions={[PermissionEnum.ACCOMMODATION_CREATE]}
                    redirectTo="/access-denied"
                >
                    <span>Should not appear</span>
                </RoutePermissionGuard>
            );

            // Assert
            expect(mockNavigate).toHaveBeenCalledWith({ to: '/access-denied' });
        });
    });

    describe('OR logic (default)', () => {
        it('renders children when user has at least one of the required permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_UPDATE_ANY]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            render(
                <RoutePermissionGuard
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                >
                    <span>OR logic content</span>
                </RoutePermissionGuard>
            );

            // Assert
            expect(screen.getByText('OR logic content')).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('AND logic (requireAll=true)', () => {
        it('renders children when user has ALL required permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            render(
                <RoutePermissionGuard
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                    requireAll
                >
                    <span>AND logic content</span>
                </RoutePermissionGuard>
            );

            // Assert
            expect(screen.getByText('AND logic content')).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('navigates away when user is missing one of the required permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_CREATE]);
            mockUseNavigate.mockReturnValue(mockNavigate);

            // Act
            const { container } = render(
                <RoutePermissionGuard
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                    requireAll
                >
                    <span>AND requires all</span>
                </RoutePermissionGuard>
            );

            // Assert
            expect(screen.queryByText('AND requires all')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
            expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' });
        });
    });
});
