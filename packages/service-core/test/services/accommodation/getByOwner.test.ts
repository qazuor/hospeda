/**
 * @fileoverview
 * Test suite for the AccommodationService.getByOwner method.
 * Ensures the method throws a 'Not implemented' error as expected.
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { describe, expect, it } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';

/**
 * Test suite for the AccommodationService.getByOwner method.
 *
 * This suite verifies:
 * - The method throws a 'Not implemented' error
 *
 * The test ensures the method is not yet implemented and fails as expected.
 */
describe('AccommodationService.getByOwner', () => {
    it('should throw Not implemented error', async () => {
        const service = createServiceTestInstance(AccommodationService);
        const input: Record<string, unknown> = {};
        const actor = new ActorFactoryBuilder().host().build();
        await expect(service.getByOwner(input, actor)).rejects.toThrow('Not implemented');
    });
});
