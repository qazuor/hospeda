import type { UserBookmarkListByEntityInput, UserBookmarkListByUserInput } from '@repo/schemas';
import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeListByEntityInput,
    normalizeListByUserInput,
    normalizeUpdateInput
} from '../../../src/services/userBookmark/userBookmark.normalizers';

const baseBookmark = {
    userId: 'user-uuid',
    entityId: 'entity-uuid',
    entityType: EntityTypeEnum.ACCOMMODATION,
    name: '  My Bookmark  ',
    description: '  Some description  '
};

const userId = 'user-uuid' as string;
type MockActor = { id: string; role: RoleEnum; permissions: PermissionEnum[] };
const actor: MockActor = {
    id: userId,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.USER_VIEW_PROFILE]
};

describe('userBookmark.normalizers', () => {
    it('normalizeCreateInput trims name and description', () => {
        const input = { ...baseBookmark };
        const result = normalizeCreateInput(input, actor);
        expect(result.name).toBe('My Bookmark');
        expect(result.description).toBe('Some description');
        expect(result.entityType).toBe(EntityTypeEnum.ACCOMMODATION);
    });

    it('normalizeUpdateInput trims name and description', () => {
        const input = { ...baseBookmark, name: '  Update  ', description: '  Desc  ' };
        const result = normalizeUpdateInput(input, actor);
        expect(result.name).toBe('Update');
        expect(result.description).toBe('Desc');
    });

    it('normalizeListByUserInput returns params unchanged', () => {
        const params: UserBookmarkListByUserInput = {
            userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };
        const result = normalizeListByUserInput(params, actor);
        expect(result).toEqual(params);
    });

    it('normalizeListByEntityInput returns params unchanged', () => {
        const params: UserBookmarkListByEntityInput = {
            entityId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
            entityType: EntityTypeEnum.ACCOMMODATION,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt',
            sortOrder: 'asc'
        };
        const result = normalizeListByEntityInput(params, actor);
        expect(result).toEqual(params);
    });
});
