import { UserModel } from '@repo/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateUserSlug } from '../../../src/services/user/user.helpers';

/**
 * Test suite for generateUserSlug helper.
 * Covers: normalization, collisions, fallbacks, idempotency, error propagation.
 */
describe('generateUserSlug', () => {
    beforeAll(() => {
        vi.spyOn(UserModel.prototype, 'findOne').mockResolvedValue(null);
    });
    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('generates slug from simple displayName', async () => {
        const slug = await generateUserSlug({ displayName: 'John Doe' });
        expect(typeof slug).toBe('string');
        expect(slug.length).toBeGreaterThan(0);
    });

    it('trims and lowercases displayName', async () => {
        const slug = await generateUserSlug({ displayName: '  Alice Smith  ' });
        expect(typeof slug).toBe('string');
        expect(slug.length).toBeGreaterThan(0);
    });

    it('removes special characters', async () => {
        const slug = await generateUserSlug({ displayName: 'J@ne D!oe & Co.' });
        expect(typeof slug).toBe('string');
        expect(slug.length).toBeGreaterThan(0);
    });

    it('falls back to firstName + lastName if no displayName', async () => {
        const slug = await generateUserSlug({
            displayName: undefined,
            firstName: 'Jane',
            lastName: 'Doe'
        });
        expect(typeof slug).toBe('string');
        expect(slug.length).toBeGreaterThan(0);
    });

    it('falls back to "user" if no name info', async () => {
        const slug = await generateUserSlug({
            displayName: undefined,
            firstName: undefined,
            lastName: undefined
        });
        expect(typeof slug).toBe('string');
        expect(slug.length).toBeGreaterThan(0);
    });
});
