import { describe, it } from 'vitest';

/**
 * AmenityType does not have a 'visibility' property, so updateVisibility is not supported.
 * This test is intentionally skipped.
 */
describe.skip('AmenityService.updateVisibility', () => {
    it('should be skipped because AmenityType has no visibility', () => {
        // Not applicable
    });
});
