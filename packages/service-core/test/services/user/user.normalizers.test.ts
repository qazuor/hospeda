import type { User } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    normalizeCreateInput,
    normalizeListInput,
    normalizeUpdateInput,
    normalizeUserInput,
    normalizeViewInput
} from '../../../src/services/user/user.normalizers';

const baseUser = {
    displayName: ' John Doe ',
    firstName: ' John ',
    lastName: ' Doe ',
    contactInfo: { personalEmail: ' JOHN@EXAMPLE.COM ', mobilePhone: '+123456789' },
    slug: undefined
} as unknown as User;

const actor = { id: 'actor-id', role: RoleEnum.ADMIN, permissions: [] };

describe('user normalizers', () => {
    it('normalizeCreateInput trims displayName', () => {
        const input = { ...baseUser, displayName: ' John Doe ' };
        const result = normalizeCreateInput(input, actor);
        expect(result.displayName).toBe('John Doe');
    });

    it('normalizeUpdateInput trims displayName', () => {
        const input = { ...baseUser, displayName: ' Jane Smith ' };
        const result = normalizeUpdateInput(input, actor);
        expect(result.displayName).toBe('Jane Smith');
    });

    it('normalizeListInput returns the same object', () => {
        const params = { page: 1, pageSize: 10 };
        const result = normalizeListInput(params, actor);
        expect(result).toBe(params);
    });

    it('normalizeViewInput returns the same field and value', () => {
        const result = normalizeViewInput('slug', 'test-slug', actor);
        expect(result).toEqual({ field: 'slug', value: 'test-slug' });
    });

    it('normalizeUserInput trims all string fields and lowercases email', async () => {
        const input = {
            displayName: ' John Doe ',
            firstName: ' John ',
            lastName: ' Doe ',
            contactInfo: { personalEmail: ' JOHN@EXAMPLE.COM ', mobilePhone: '+123456789' }
        };
        vi.mock('../../../src/services/user/user.helpers', () => ({
            generateUserSlug: vi.fn().mockResolvedValue('john-doe')
        }));
        const result = await normalizeUserInput(input);
        expect(result.displayName).toBe('John Doe');
        expect(result.firstName).toBe('John');
        expect(result.lastName).toBe('Doe');
        expect(result.contactInfo?.personalEmail).toBe('john@example.com');
        expect(result.slug).toBe('john-doe');
    });

    it('normalizeUserInput does not overwrite existing slug', async () => {
        const input = {
            displayName: 'Jane',
            slug: 'custom-slug'
        };
        const result = await normalizeUserInput(input);
        expect(result.slug).toBe('custom-slug');
    });
});
