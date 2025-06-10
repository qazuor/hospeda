import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventModel } from '../../../models/event/event.model';
import { EventService } from '../../../services/event/event.service';
import * as permissionManager from '../../../utils/permission-manager';
import { getMockEvent, getMockPublicUser, getMockTag, getMockUser } from '../mockData';

const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
const superAdmin = getMockUser({ id: 'superadmin-1' as UserId, role: RoleEnum.SUPER_ADMIN });
const userWithPerm = getMockUser({
    id: 'user-2' as UserId,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.EVENT_CREATE]
});
const userNoPerm = getMockUser({ id: 'user-3' as UserId, role: RoleEnum.USER, permissions: [] });
const disabledUser = getMockUser({
    id: 'user-4' as UserId,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const publicActor = getMockPublicUser();

const mockTag = getMockTag();

const validInput = {
    slug: 'event-2024',
    summary: 'Annual Event',
    description: 'A great event',
    category: EventCategoryEnum.MUSIC,
    date: { start: new Date().toISOString() },
    authorId: admin.id,
    visibility: VisibilityEnum.PUBLIC,
    media: {
        featuredImage: {
            url: 'https://img.com/1.jpg',
            moderationState: ModerationStatusEnum.PENDING_REVIEW
        }
    },
    tags: [mockTag.id]
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
