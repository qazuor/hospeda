import { RoleEnum, TagColorEnum } from '@repo/types';
import { describe, expect, it, vi } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/tag/tag.normalizers';

const actor = { id: 'actor-id', role: RoleEnum.ADMIN, permissions: [] };

describe('tag normalizers', () => {
    it('normalizeCreateInput trims name and slug', async () => {
        const input = { name: '  Tag  ', slug: '  tag-slug  ', color: TagColorEnum.BLUE };
        const result = await normalizeCreateInput(input, actor);
        expect(result.name).toBe('Tag');
        expect(result.slug).toBe('tag-slug');
    });

    it('normalizeCreateInput generates slug if not provided', async () => {
        vi.mock('../../../src/services/tag/tag.helpers', () => ({
            generateTagSlug: vi.fn().mockResolvedValue('tag-name')
        }));
        const input = { name: 'Tag Name', slug: '', color: TagColorEnum.BLUE };
        const result = await normalizeCreateInput(input, actor);
        expect(result.slug).toBe('tag-name');
    });

    it('normalizeCreateInput throws on invalid color', async () => {
        await expect(
            normalizeCreateInput(
                { name: 'Tag', slug: 'slug', color: 'INVALID' as unknown as TagColorEnum },
                actor
            )
        ).rejects.toThrow('Invalid tag color');
    });

    it('normalizeCreateInput trims optional fields', async () => {
        const input = {
            name: 'Tag',
            slug: 'slug',
            color: TagColorEnum.BLUE,
            icon: '  icon  ',
            notes: '  notes  '
        };
        const result = await normalizeCreateInput(input, actor);
        expect(result.icon).toBe('icon');
        expect(result.notes).toBe('notes');
    });

    it('normalizeUpdateInput trims all string fields', () => {
        const input = {
            name: '  Tag  ',
            slug: '  tag-slug  ',
            icon: '  icon  ',
            notes: '  notes  ',
            color: TagColorEnum.BLUE
        };
        const result = normalizeUpdateInput(input, actor);
        expect(result.name).toBe('Tag');
        expect(result.slug).toBe('tag-slug');
        expect(result.icon).toBe('icon');
        expect(result.notes).toBe('notes');
    });

    it('normalizeUpdateInput throws on invalid color', () => {
        expect(() =>
            normalizeUpdateInput({ color: 'INVALID' as unknown as TagColorEnum }, actor)
        ).toThrow('Invalid tag color');
    });
});
