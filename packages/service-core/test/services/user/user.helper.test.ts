// TODO [89c33cd6-8805-4a8e-9999-1cdeda65e5b3]: Move all permission-related tests to user.permissions.test.ts. Move normalizer tests to user.normalizers.test.ts. Keep only non-permission, non-normalizer helpers here.

// TODO [e511409a-d5f2-4648-a4a0-38016649f1ef]: Add generateUserSlug tests here, moved from generateSlug.test.ts. Keep only non-permission, non-normalizer helpers.

import { UserModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUserSlug } from '../../../src/services/user/user.helpers';

/**
 * Test suite for generateUserSlug helper in UserService.
 * Ensures robust, unique, and predictable slug generation for users.
 */
describe('generateUserSlug (UserService)', () => {
    let findOneMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        findOneMock = vi.fn();
        vi.spyOn(UserModel.prototype, 'findOne').mockImplementation(findOneMock);
    });

    it('generates a slug from displayName if not taken', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateUserSlug({
            displayName: 'John Doe',
            firstName: '',
            lastName: ''
        });
        expect(typeof slug).toBe('string');
        expect(slug).toMatch(/^john-doe/);
    });

    it('generates a slug from firstName + lastName if displayName is missing', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateUserSlug({
            displayName: '',
            firstName: 'Jane',
            lastName: 'Smith'
        });
        expect(slug).toMatch(/^jane-smith/);
    });

    it('appends a suffix if slug is already taken', async () => {
        findOneMock.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
        const slug = await generateUserSlug({
            displayName: 'John Doe',
            firstName: '',
            lastName: ''
        });
        expect(slug).toMatch(/^john-doe-[a-z0-9]+$/);
    });

    it('is idempotent for the same input if slug is available', async () => {
        findOneMock.mockResolvedValue(null);
        const input = { displayName: 'Unique User', firstName: '', lastName: '' };
        const slug1 = await generateUserSlug(input);
        const slug2 = await generateUserSlug(input);
        expect(slug1).toBe(slug2);
    });

    it('handles names with special characters and spaces', async () => {
        findOneMock.mockResolvedValue(null);
        const slug = await generateUserSlug({
            displayName: 'José & María! 2024',
            firstName: '',
            lastName: ''
        });
        expect(slug).toBe('jose-and-maria-2024');
    });

    it('throws if model throws', async () => {
        findOneMock.mockRejectedValue(new Error('DB error'));
        await expect(
            generateUserSlug({ displayName: 'Error Name', firstName: '', lastName: '' })
        ).rejects.toThrow('DB error');
    });
});
