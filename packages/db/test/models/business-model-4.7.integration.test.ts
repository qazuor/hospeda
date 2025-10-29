import { describe, expect, it } from 'vitest';
import { FeaturedAccommodationModel } from '../../src/models/featuredAccommodation.model';
import { SponsorshipModel } from '../../src/models/sponsorship.model';

describe('Business Model Stage 4.7 - Integration Test', () => {
    describe('Models Export Validation', () => {
        it('should create SponsorshipModel instance', () => {
            const sponsorshipModel = new SponsorshipModel();
            expect(sponsorshipModel).toBeDefined();
            expect(sponsorshipModel).toBeInstanceOf(SponsorshipModel);
        });

        it('should create FeaturedAccommodationModel instance', () => {
            const featuredModel = new FeaturedAccommodationModel();
            expect(featuredModel).toBeDefined();
            expect(featuredModel).toBeInstanceOf(FeaturedAccommodationModel);
        });

        it('should have all required SponsorshipModel methods', () => {
            const model = new SponsorshipModel();

            // Business methods
            expect(typeof model.sponsorPost).toBe('function');
            expect(typeof model.sponsorEvent).toBe('function');
            expect(typeof model.isActive).toBe('function');

            // Analytics methods
            expect(typeof model.calculateCost).toBe('function');
            expect(typeof model.getVisibilityStats).toBe('function');
            expect(typeof model.getImpressions).toBe('function');
            expect(typeof model.getClicks).toBe('function');
            expect(typeof model.calculateROI).toBe('function');

            // Management methods
            expect(typeof model.activate).toBe('function');
            expect(typeof model.pause).toBe('function');
            expect(typeof model.expire).toBe('function');
            expect(typeof model.cancel).toBe('function');

            // Query methods
            expect(typeof model.findActive).toBe('function');
            expect(typeof model.findByClient).toBe('function');
            expect(typeof model.findByEntity).toBe('function');
            expect(typeof model.withTarget).toBe('function');
        });

        it('should have all required FeaturedAccommodationModel methods', () => {
            const model = new FeaturedAccommodationModel();

            // Business methods
            expect(typeof model.featureOnHome).toBe('function');
            expect(typeof model.featureInDestination).toBe('function');
            expect(typeof model.featureInSearch).toBe('function');
            expect(typeof model.isActive).toBe('function');

            // Analytics methods
            expect(typeof model.calculateVisibility).toBe('function');
            expect(typeof model.getPlacementStats).toBe('function');
            expect(typeof model.getPriority).toBe('function');
            expect(typeof model.updatePriority).toBe('function');
            expect(typeof model.resolvePriorityConflicts).toBe('function');

            // Query methods
            expect(typeof model.findByType).toBe('function');
            expect(typeof model.findByAccommodation).toBe('function');
            expect(typeof model.findActive).toBe('function');
            expect(typeof model.withAccommodation).toBe('function');
        });
    });
});
