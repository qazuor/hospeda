import { describe, expect, it } from 'vitest';
import {
    ListingStatusEnum,
    ListingStatusSchema,
    NotificationTypeEnum,
    NotificationTypeSchema,
    ProfessionalServiceCategoryEnum,
    ProfessionalServiceCategorySchema,
    ServiceOrderStatusEnum,
    ServiceOrderStatusSchema
} from '../../src/enums';

describe('Services and Listings Enums Integration', () => {
    describe('enums can be imported from main index', () => {
        it('should import ProfessionalServiceCategoryEnum', () => {
            expect(ProfessionalServiceCategoryEnum.PHOTO).toBe('PHOTO');
            expect(ProfessionalServiceCategoryEnum.COPYWRITING).toBe('COPYWRITING');
            expect(ProfessionalServiceCategoryEnum.SEO).toBe('SEO');
            expect(ProfessionalServiceCategoryEnum.DESIGN).toBe('DESIGN');
            expect(ProfessionalServiceCategoryEnum.MAINTENANCE).toBe('MAINTENANCE');
            expect(ProfessionalServiceCategoryEnum.TOUR).toBe('TOUR');
            expect(ProfessionalServiceCategoryEnum.BIKE_RENTAL).toBe('BIKE_RENTAL');
            expect(ProfessionalServiceCategoryEnum.OTHER).toBe('OTHER');
        });

        it('should import ServiceOrderStatusEnum', () => {
            expect(ServiceOrderStatusEnum.PENDING).toBe('PENDING');
            expect(ServiceOrderStatusEnum.IN_PROGRESS).toBe('IN_PROGRESS');
            expect(ServiceOrderStatusEnum.COMPLETED).toBe('COMPLETED');
            expect(ServiceOrderStatusEnum.CANCELLED).toBe('CANCELLED');
            expect(ServiceOrderStatusEnum.REFUNDED).toBe('REFUNDED');
        });

        it('should import ListingStatusEnum', () => {
            expect(ListingStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(ListingStatusEnum.PAUSED).toBe('PAUSED');
            expect(ListingStatusEnum.ARCHIVED).toBe('ARCHIVED');
            expect(ListingStatusEnum.TRIAL).toBe('TRIAL');
        });

        it('should import NotificationTypeEnum', () => {
            expect(NotificationTypeEnum.TRIAL_EXPIRING).toBe('TRIAL_EXPIRING');
            expect(NotificationTypeEnum.PAYMENT_SUCCESS).toBe('PAYMENT_SUCCESS');
            expect(NotificationTypeEnum.SERVICE_ORDER_UPDATE).toBe('SERVICE_ORDER_UPDATE');
            expect(NotificationTypeEnum.LISTING_APPROVED).toBe('LISTING_APPROVED');
            expect(NotificationTypeEnum.CUSTOM).toBe('CUSTOM');
        });
    });

    describe('schemas can validate enum values', () => {
        it('should validate professional service categories', () => {
            const serviceCategories = [
                'PHOTO',
                'COPYWRITING',
                'SEO',
                'DESIGN',
                'MAINTENANCE',
                'TOUR',
                'BIKE_RENTAL',
                'OTHER'
            ];
            for (const category of serviceCategories) {
                expect(ProfessionalServiceCategorySchema.parse(category)).toBe(category);
            }
        });

        it('should validate service order workflow', () => {
            expect(ServiceOrderStatusSchema.parse('PENDING')).toBe('PENDING');
            expect(ServiceOrderStatusSchema.parse('IN_PROGRESS')).toBe('IN_PROGRESS');
            expect(ServiceOrderStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
            expect(ServiceOrderStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
            expect(ServiceOrderStatusSchema.parse('REFUNDED')).toBe('REFUNDED');
        });

        it('should validate listing status workflow', () => {
            expect(ListingStatusSchema.parse('TRIAL')).toBe('TRIAL');
            expect(ListingStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(ListingStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(ListingStatusSchema.parse('ARCHIVED')).toBe('ARCHIVED');
        });

        it('should validate notification types', () => {
            const businessNotifications = [
                'TRIAL_EXPIRING',
                'PAYMENT_DUE',
                'PAYMENT_SUCCESS',
                'SUBSCRIPTION_RENEWED'
            ];
            for (const notification of businessNotifications) {
                expect(NotificationTypeSchema.parse(notification)).toBe(notification);
            }
        });
    });

    describe('business logic validations', () => {
        it('should support service order workflow progression', () => {
            const orderProgression = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
            for (const status of orderProgression) {
                expect(ServiceOrderStatusSchema.parse(status)).toBe(status);
            }
        });

        it('should support listing lifecycle', () => {
            const listingLifecycle = ['TRIAL', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
            for (const status of listingLifecycle) {
                expect(ListingStatusSchema.parse(status)).toBe(status);
            }
        });

        it('should support comprehensive professional services', () => {
            expect(ProfessionalServiceCategoryEnum.PHOTO).toBe('PHOTO');
            expect(ProfessionalServiceCategoryEnum.COPYWRITING).toBe('COPYWRITING');
            expect(ProfessionalServiceCategoryEnum.SEO).toBe('SEO');
            expect(ProfessionalServiceCategoryEnum.DESIGN).toBe('DESIGN');
            expect(ProfessionalServiceCategoryEnum.MAINTENANCE).toBe('MAINTENANCE');
            expect(ProfessionalServiceCategoryEnum.TOUR).toBe('TOUR');
            expect(ProfessionalServiceCategoryEnum.BIKE_RENTAL).toBe('BIKE_RENTAL');
            expect(ProfessionalServiceCategoryEnum.OTHER).toBe('OTHER');
        });

        it('should relate service orders to notifications', () => {
            expect(ServiceOrderStatusEnum.COMPLETED).toBe('COMPLETED');
            expect(NotificationTypeEnum.SERVICE_ORDER_UPDATE).toBe('SERVICE_ORDER_UPDATE');
        });

        it('should relate listings to notifications', () => {
            expect(ListingStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(NotificationTypeEnum.LISTING_APPROVED).toBe('LISTING_APPROVED');
            expect(NotificationTypeEnum.LISTING_REJECTED).toBe('LISTING_REJECTED');
        });
    });

    describe('enum completeness', () => {
        it('should have correct number of values in each enum', () => {
            expect(Object.values(ProfessionalServiceCategoryEnum)).toHaveLength(8);
            expect(Object.values(ServiceOrderStatusEnum)).toHaveLength(5);
            expect(Object.values(ListingStatusEnum)).toHaveLength(4);
            expect(Object.values(NotificationTypeEnum)).toHaveLength(14);
        });

        it('should validate that all enum values are strings', () => {
            for (const value of Object.values(ProfessionalServiceCategoryEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(ServiceOrderStatusEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(ListingStatusEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(NotificationTypeEnum)) {
                expect(typeof value).toBe('string');
            }
        });
    });

    describe('cross-domain business scenarios', () => {
        it('should support complete service order flow with notifications', () => {
            // Service order placed for PHOTO category
            expect(ProfessionalServiceCategorySchema.parse('PHOTO')).toBe('PHOTO');
            expect(ServiceOrderStatusSchema.parse('PENDING')).toBe('PENDING');
            expect(NotificationTypeSchema.parse('SERVICE_ORDER_UPDATE')).toBe(
                'SERVICE_ORDER_UPDATE'
            );

            // Service order in progress
            expect(ServiceOrderStatusSchema.parse('IN_PROGRESS')).toBe('IN_PROGRESS');

            // Service order completed
            expect(ServiceOrderStatusSchema.parse('COMPLETED')).toBe('COMPLETED');
        });

        it('should support listing approval workflow', () => {
            // New listing starts in trial
            expect(ListingStatusSchema.parse('TRIAL')).toBe('TRIAL');

            // Listing gets approved and becomes active
            expect(ListingStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(NotificationTypeSchema.parse('LISTING_APPROVED')).toBe('LISTING_APPROVED');

            // Listing can be paused
            expect(ListingStatusSchema.parse('PAUSED')).toBe('PAUSED');

            // Listing can be archived
            expect(ListingStatusSchema.parse('ARCHIVED')).toBe('ARCHIVED');
        });

        it('should support trial expiration notifications', () => {
            expect(ListingStatusSchema.parse('TRIAL')).toBe('TRIAL');
            expect(NotificationTypeSchema.parse('TRIAL_EXPIRING')).toBe('TRIAL_EXPIRING');
            expect(NotificationTypeSchema.parse('TRIAL_EXPIRED')).toBe('TRIAL_EXPIRED');
        });
    });
});
