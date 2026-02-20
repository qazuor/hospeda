/**
 * Tests for PermissionGate component
 *
 * Verifies that PermissionGate correctly:
 * 1. Renders children when user has required permission (OR mode)
 * 2. Renders nothing when user lacks all permissions
 * 3. Renders fallback content when provided and user lacks permission
 * 4. Supports requireAll=true (AND logic) for strict permission checks
 * 5. Always renders when permissions array is empty
 *
 * @module PermissionGate.test
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: vi.fn()
}));

const mockUseUserPermissions = vi.mocked(useUserPermissions);

describe('PermissionGate', () => {
    describe('OR logic (default)', () => {
        it('renders children when user has the required permission', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_CREATE]);

            // Act
            render(
                <PermissionGate permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
                    <span>Protected content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.getByText('Protected content')).toBeInTheDocument();
        });

        it('renders children when user has at least one of the required permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_ALL]);

            // Act
            render(
                <PermissionGate
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_VIEW_ALL
                    ]}
                >
                    <span>Accessible content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.getByText('Accessible content')).toBeInTheDocument();
        });

        it('renders nothing when user lacks all required permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_ALL]);

            // Act
            render(
                <PermissionGate permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
                    <span>Hidden content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
        });

        it('renders fallback when provided and user lacks permission', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([]);

            // Act
            render(
                <PermissionGate
                    permissions={[PermissionEnum.ACCOMMODATION_CREATE]}
                    fallback={<span>No access</span>}
                >
                    <span>Hidden content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
            expect(screen.getByText('No access')).toBeInTheDocument();
        });

        it('renders null (no fallback) when user lacks permission and no fallback provided', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([]);

            // Act
            const { container } = render(
                <PermissionGate permissions={[PermissionEnum.ACCOMMODATION_CREATE]}>
                    <span>Hidden content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('AND logic (requireAll=true)', () => {
        it('renders children when user has ALL required permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([
                PermissionEnum.ACCOMMODATION_CREATE,
                PermissionEnum.ACCOMMODATION_UPDATE_ANY
            ]);

            // Act
            render(
                <PermissionGate
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                    requireAll
                >
                    <span>Full access content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.getByText('Full access content')).toBeInTheDocument();
        });

        it('renders nothing when user is missing at least one required permission', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_CREATE]);

            // Act
            render(
                <PermissionGate
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                    requireAll
                >
                    <span>Restricted content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.queryByText('Restricted content')).not.toBeInTheDocument();
        });

        it('renders fallback when requireAll=true and user is missing a permission', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_CREATE]);

            // Act
            render(
                <PermissionGate
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                    requireAll
                    fallback={<span>Insufficient permissions</span>}
                >
                    <span>Restricted content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.queryByText('Restricted content')).not.toBeInTheDocument();
            expect(screen.getByText('Insufficient permissions')).toBeInTheDocument();
        });
    });

    describe('empty permissions array', () => {
        it('renders children when permissions array is empty (no restrictions)', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([]);

            // Act
            render(
                <PermissionGate permissions={[]}>
                    <span>Always visible content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.getByText('Always visible content')).toBeInTheDocument();
        });

        it('renders children even when user has no permissions and array is empty', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([]);

            // Act
            render(
                <PermissionGate
                    permissions={[]}
                    requireAll
                >
                    <span>Unrestricted content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.getByText('Unrestricted content')).toBeInTheDocument();
        });
    });

    describe('requireAll=false (explicit default)', () => {
        it('renders children when user has any one of the listed permissions', () => {
            // Arrange
            mockUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_UPDATE_ANY]);

            // Act
            render(
                <PermissionGate
                    permissions={[
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.ACCOMMODATION_UPDATE_ANY
                    ]}
                    requireAll={false}
                >
                    <span>Partial access content</span>
                </PermissionGate>
            );

            // Assert
            expect(screen.getByText('Partial access content')).toBeInTheDocument();
        });
    });
});
