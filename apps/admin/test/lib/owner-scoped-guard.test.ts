/**
 * Unit tests for `decideOwnerScopedRedirect`.
 *
 * SPEC-169 T-022 — covers all four D5 branches without spinning up
 * TanStack Router or mocking `redirect()`.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { decideOwnerScopedRedirect } from '../../src/lib/owner-scoped-guard';

const VIEW_OWN = PermissionEnum.ACCOMMODATION_VIEW_OWN;
const VIEW_ALL = PermissionEnum.ACCOMMODATION_VIEW_ALL;

describe('decideOwnerScopedRedirect', () => {
    it('returns /me/accommodations when actor has VIEW_OWN but not VIEW_ALL', () => {
        // Arrange
        const permissions = [VIEW_OWN, PermissionEnum.ACCESS_PANEL_ADMIN];

        // Act
        const result = decideOwnerScopedRedirect({ permissions });

        // Assert
        expect(result).toBe('/me/accommodations');
    });

    it('returns null when actor has VIEW_ALL (staff — no redirect)', () => {
        // Arrange
        const permissions = [VIEW_ALL, PermissionEnum.ACCESS_PANEL_ADMIN];

        // Act
        const result = decideOwnerScopedRedirect({ permissions });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null when actor has neither VIEW_OWN nor VIEW_ALL', () => {
        // Arrange — e.g. EDITOR with no accommodation permissions
        const permissions = [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.POST_VIEW_ALL,
            PermissionEnum.POST_VIEW_PRIVATE
        ];

        // Act
        const result = decideOwnerScopedRedirect({ permissions });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null when actor has BOTH VIEW_OWN and VIEW_ALL (VIEW_ALL wins)', () => {
        // Arrange — unusual but defensive
        const permissions = [VIEW_OWN, VIEW_ALL, PermissionEnum.ACCESS_PANEL_ADMIN];

        // Act
        const result = decideOwnerScopedRedirect({ permissions });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null for an empty permissions array', () => {
        // Arrange
        const permissions: string[] = [];

        // Act
        const result = decideOwnerScopedRedirect({ permissions });

        // Assert
        expect(result).toBeNull();
    });

    it('returns /me/accommodations for a HOST with only VIEW_OWN and panel access', () => {
        // Arrange — realistic HOST permission set post SPEC-169 seed fix
        const permissions = [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            VIEW_OWN,
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_UPDATE_OWN
        ];

        // Act
        const result = decideOwnerScopedRedirect({ permissions });

        // Assert
        expect(result).toBe('/me/accommodations');
    });
});
