import { EventModel } from '@repo/db';
import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent } from '../factories/eventFactory';
import { getMockTag, getMockTagId } from '../factories/tagFactory';
import {
    getMockAdminUser,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories/userFactory';

const user2Id = getMockUserId('user-2');
const user3Id = getMockUserId('user-3');
const user4Id = getMockUserId('user-4');
const adminId = getMockUserId('admin-1');
const superAdminId = getMockUserId('superadmin-1');
const admin = getMockAdminUser({ id: adminId });
const superAdmin = getMockUser({ id: superAdminId, role: RoleEnum.SUPER_ADMIN });
const userWithPerm = getMockUser({
    id: user2Id,
    permissions: [PermissionEnum.EVENT_CREATE]
});
const userNoPerm = getMockUser({ id: user3Id, permissions: [] });
const disabledUser = getMockUser({
    id: user4Id,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const publicActor = getMockPublicUser();

const mockTagId = getMockTagId();

const validInput = {
    slug: 'event-2024',
    summary: 'Annual Event',
    description: 'A great event',
    category: EventCategoryEnum.MUSIC,
    authorId: adminId,
    visibility: VisibilityEnum.PUBLIC,
    media: {
        featuredImage: {
            url: 'https://img.com/1.jpg',
            moderationState: ModerationStatusEnum.PENDING_REVIEW
        }
    },
    tags: [
        {
            ...getMockTag({ id: mockTagId }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdById: adminId as unknown as string,
            updatedById: adminId as unknown as string,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE as unknown as string
        }
    ],
    date: {
        start: new Date().toISOString(),
        end: new Date().toISOString()
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

describe('event.service.create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow admin to create an event', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        vi.spyOn(EventModel, 'create').mockImplementation(async (input) =>
            getMockEvent({
                ...input,
                slug: input.slug,
                summary: input.summary,
                category: input.category,
                visibility: input.visibility
            })
        );
        const result = await EventService.create(validInput, admin);
        expect(result.event.slug).toBe(validInput.slug);
        expect(result.event.summary).toBe(validInput.summary);
        expect(result.event.category).toBe(validInput.category);
        expect(result.event.visibility).toBe(validInput.visibility);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'create:end');
    });

    it('should allow superadmin to create an event', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        vi.spyOn(EventModel, 'create').mockImplementation(async (input) =>
            getMockEvent({
                ...input,
                slug: input.slug,
                summary: input.summary,
                category: input.category,
                visibility: input.visibility
            })
        );
        const result = await EventService.create(validInput, superAdmin);
        expect(result.event.slug).toBe(validInput.slug);
    });

    it('should allow user with permission to create an event', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        vi.spyOn(EventModel, 'create').mockImplementation(async (input) =>
            getMockEvent({
                ...input,
                slug: input.slug,
                summary: input.summary,
                category: input.category,
                visibility: input.visibility
            })
        );
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        const result = await EventService.create(validInput, userWithPerm);
        expect(result.event.slug).toBe(validInput.slug);
    });

    it('should not allow user without permission', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        await expect(EventService.create(validInput, userNoPerm)).rejects.toThrow(
            'Permission denied'
        );
    });

    it('should not allow disabled user', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        await expect(EventService.create(validInput, disabledUser)).rejects.toThrow(
            'User is disabled'
        );
    });

    it('should not allow public actor', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        await expect(EventService.create(validInput, publicActor)).rejects.toThrow(
            'Permission denied'
        );
    });

    it('should not allow duplicate slug', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(getMockEvent());
        await expect(EventService.create(validInput, admin)).rejects.toThrow('Slug already exists');
    });

    it('should throw on invalid input', async () => {
        await expect(EventService.create({ ...validInput, slug: '' }, admin)).rejects.toThrow();
    });

    it('should normalize moderationState in media', async () => {
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(undefined);
        vi.spyOn(EventModel, 'create').mockImplementation(async (input) => {
            expect(input.media?.featuredImage?.moderationState).toBe(
                ModerationStatusEnum.PENDING_REVIEW
            );
            return getMockEvent();
        });
        await EventService.create(validInput, admin);
    });
});
