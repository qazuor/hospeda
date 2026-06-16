import { describe, expect, it } from 'vitest';
import { PermissionCategoryEnum, PermissionEnum } from '../permission.enum.js';

// ============================================================================
// SPEC-239 COMMERCE permissions and COMMERCE category
// ============================================================================

describe('SPEC-239 COMMERCE permissions', () => {
    it('should have COMMERCE category in PermissionCategoryEnum', () => {
        expect(PermissionCategoryEnum.COMMERCE).toBe('COMMERCE');
    });

    describe('owner-scoped section edit permissions (10)', () => {
        it('should have COMMERCE_SCHEDULE_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN).toBe('commerce.schedule.editOwn');
        });

        it('should have COMMERCE_CONTACT_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_CONTACT_EDIT_OWN).toBe('commerce.contact.editOwn');
        });

        it('should have COMMERCE_SOCIAL_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_SOCIAL_EDIT_OWN).toBe('commerce.social.editOwn');
        });

        it('should have COMMERCE_MEDIA_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_MEDIA_EDIT_OWN).toBe('commerce.media.editOwn');
        });

        it('should have COMMERCE_MENU_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_MENU_EDIT_OWN).toBe('commerce.menu.editOwn');
        });

        it('should have COMMERCE_PRICE_RANGE_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_PRICE_RANGE_EDIT_OWN).toBe(
                'commerce.priceRange.editOwn'
            );
        });

        it('should have COMMERCE_RICH_DESCRIPTION_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_RICH_DESCRIPTION_EDIT_OWN).toBe(
                'commerce.richDescription.editOwn'
            );
        });

        it('should have COMMERCE_AMENITIES_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_AMENITIES_EDIT_OWN).toBe('commerce.amenities.editOwn');
        });

        it('should have COMMERCE_FEATURES_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_FEATURES_EDIT_OWN).toBe('commerce.features.editOwn');
        });

        it('should have COMMERCE_FAQS_EDIT_OWN', () => {
            expect(PermissionEnum.COMMERCE_FAQS_EDIT_OWN).toBe('commerce.faqs.editOwn');
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

    it('should have exactly 15 new COMMERCE entries', () => {
        // Arrange
        const commercePerms = Object.values(PermissionEnum).filter((v) =>
            v.startsWith('commerce.')
        );
        // Assert
        expect(commercePerms).toHaveLength(15);
    });
});
