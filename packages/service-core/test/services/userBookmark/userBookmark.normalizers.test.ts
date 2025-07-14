import type { UserId } from '@repo/types';
import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/userBookmark/userBookmark.normalizers';

const baseBookmark = {
    userId: 'user-uuid',
    entityId: 'entity-uuid',
    entityType: EntityTypeEnum.ACCOMMODATION,
    name: '  My Bookmark  ',
    description: '  Some description  '
};

const userId = 'user-uuid' as UserId;
type MockActor = { id: UserId; role: RoleEnum; permissions: PermissionEnum[] };
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
});
