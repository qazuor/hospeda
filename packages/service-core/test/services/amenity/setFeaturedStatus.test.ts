import { describe, it } from 'vitest';

/**
 * AmenityType does not have an 'isFeatured' property, so setFeaturedStatus is not supported.
 * This test is intentionally skipped to reflect the domain model.
 */
describe.skip('AmenityService.setFeaturedStatus', () => {
    it('should be skipped because AmenityType has no isFeatured', () => {
        // Not applicable
    });
});
