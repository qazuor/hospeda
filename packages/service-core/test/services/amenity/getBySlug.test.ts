import { describe, it } from 'vitest';

/**
 * AmenityType does not have a 'slug' property, so getBySlug is not supported.
 * This test is intentionally skipped.
 */
describe.skip('AmenityService.getBySlug', () => {
    it('should be skipped because AmenityType has no slug', () => {
        // Not applicable
    });
});
