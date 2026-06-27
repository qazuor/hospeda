import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

// ============================================================================
// SPEC-253 COMMERCE permissions and COMMERCE category
// (Replaces SPEC-239 test — 10 per-section perms removed, COMMERCE_EDIT_OWN added)
// ============================================================================

describe('SPEC-253 COMMERCE permissions', () => {
    it('should have COMMERCE category in PermissionCategoryEnum', () => {
        expect(PermissionCategoryEnum.COMMERCE).toBe('COMMERCE');
    });

    describe('owner write permission (single, SPEC-253 D2=b)', () => {
        it('should have COMMERCE_EDIT_OWN with correct value', () => {
            expect(PermissionEnum.COMMERCE_EDIT_OWN).toBe('commerce.editOwn');
        });
    });

    describe('admin-level permissions (5)', () => {
        it('should have COMMERCE_CREATE', () => {
            expect(PermissionEnum.COMMERCE_CREATE).toBe('commerce.create');
        });

        it('should have COMMERCE_VIEW_ALL', () => {
            expect(PermissionEnum.COMMERCE_VIEW_ALL).toBe('commerce.viewAll');
        });

        it('should have COMMERCE_EDIT_ALL', () => {
            expect(PermissionEnum.COMMERCE_EDIT_ALL).toBe('commerce.editAll');
        });

        it('should have COMMERCE_DELETE', () => {
            expect(PermissionEnum.COMMERCE_DELETE).toBe('commerce.delete');
        });

        it('should have COMMERCE_MODERATE_REVIEW', () => {
            expect(PermissionEnum.COMMERCE_MODERATE_REVIEW).toBe('commerce.moderateReview');
        });
    });

    it('should have exactly 6 COMMERCE entries (COMMERCE_EDIT_OWN + 5 admin)', () => {
        // Arrange
        const commercePerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('commerce.')
        );
        // Assert: 1 owner (COMMERCE_EDIT_OWN) + 5 admin-level = 6 total
        // (was 15 in SPEC-239: 10 per-section + 5 admin; collapsed in SPEC-253 D2=b)
        expect(commercePerms).toHaveLength(6);
    });

    it('should NOT contain any of the removed per-section COMMERCE_*_EDIT_OWN perms', () => {
        const removedValues = [
            'commerce.schedule.editOwn',
            'commerce.contact.editOwn',
            'commerce.social.editOwn',
            'commerce.media.editOwn',
            'commerce.menu.editOwn',
            'commerce.priceRange.editOwn',
            'commerce.richDescription.editOwn',
            'commerce.amenities.editOwn',
            'commerce.features.editOwn',
            'commerce.faqs.editOwn'
        ];
        const allValues = Object.values(PermissionEnum);
        for (const removed of removedValues) {
            expect(allValues).not.toContain(removed);
        }
    });

    it('owner with COMMERCE_EDIT_OWN can gate on the single permission (AC-2)', () => {
        // The value must be distinct from any admin perm to ensure correct gating.
        expect(PermissionEnum.COMMERCE_EDIT_OWN).not.toBe(PermissionEnum.COMMERCE_EDIT_ALL);
        expect(PermissionEnum.COMMERCE_EDIT_OWN).not.toBe(PermissionEnum.COMMERCE_CREATE);
    });
});
