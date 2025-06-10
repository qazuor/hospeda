import { LifecycleStatusEnum, ModerationStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { DestinationService } from '../../../services/destination/destination.service';
import {
    getMockDestination,
    getMockDestinationId,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../../mockData';
import { expectInfoLog } from '../../utils/logAssertions';

vi.mock('../../../utils/logger');
vi.mock('../../../models/destination/destination.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        DestinationModel: {
            ...((actual as Record<string, unknown>).DestinationModel ?? {}),
            list: vi.fn()
        }
    };
});

describe('destination.service.list', () => {
    const publicUser = { ...getMockPublicUser(), permissions: [] };
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const publicDestination = getMockDestination({
        id: destinationId,
        name: 'Public Destination',
        visibility: VisibilityEnum.PUBLIC
    });
    const privateDestination = getMockDestination({
        id: destinationId,
        name: 'Private Destination',
        visibility: VisibilityEnum.PRIVATE
    });
    const draftDestination = getMockDestination({
        id: destinationId,
        name: 'Draft Destination',
        visibility: VisibilityEnum.DRAFT
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return only PUBLIC destinations for public user', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([
            publicDestination,
            privateDestination,
            draftDestination
        ]);
        const result = await DestinationService.list({ limit: 10, offset: 0 }, publicUser);
        expect(result.destinations).toEqual([publicDestination]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: publicUser }, 'list:start');
        expectInfoLog({ result: { destinations: [publicDestination] } }, 'list:end');
    });

    it('should return all destinations for admin', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([
            publicDestination,
            privateDestination,
            draftDestination
        ]);
        const result = await DestinationService.list({ limit: 10, offset: 0 }, admin);
        expect(result.destinations).toEqual([
            publicDestination,
            privateDestination,
            draftDestination
        ]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: admin }, 'list:start');
        expectInfoLog(
            { result: { destinations: [publicDestination, privateDestination, draftDestination] } },
            'list:end'
        );
    });

    it('should return destinations matching visibility filter', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([privateDestination]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, visibility: VisibilityEnum.PRIVATE },
            admin
        );
        expect(result.destinations).toEqual([privateDestination]);
        expectInfoLog(
            { input: { limit: 10, offset: 0, visibility: VisibilityEnum.PRIVATE }, actor: admin },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [privateDestination] } }, 'list:end');
    });

    it('should return null for all destinations if user is disabled', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([publicDestination, privateDestination]);
        const result = await DestinationService.list({ limit: 10, offset: 0 }, disabledUser);
        expect(result.destinations).toEqual([]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: disabledUser }, 'list:start');
        expectInfoLog({ result: { destinations: [] } }, 'list:end');
    });

    it('should handle empty result', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([]);
        const result = await DestinationService.list({ limit: 10, offset: 0 }, admin);
        expect(result.destinations).toEqual([]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: admin }, 'list:start');
        expectInfoLog({ result: { destinations: [] } }, 'list:end');
    });

    it('should return only featured destinations when isFeatured filter is true', async () => {
        const featuredDestination = getMockDestination({
            id: destinationId,
            name: 'Featured Destination',
            isFeatured: true,
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([featuredDestination]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, isFeatured: true },
            admin
        );
        expect(result.destinations).toEqual([featuredDestination]);
        expectInfoLog(
            { input: { limit: 10, offset: 0, isFeatured: true }, actor: admin },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [featuredDestination] } }, 'list:end');
    });

    it('should return only destinations matching lifecycle filter', async () => {
        const archivedDestination = getMockDestination({
            id: destinationId,
            name: 'Archived Destination',
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([archivedDestination]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, lifecycle: LifecycleStatusEnum.ARCHIVED },
            admin
        );
        expect(result.destinations).toEqual([archivedDestination]);
        expectInfoLog(
            {
                input: { limit: 10, offset: 0, lifecycle: LifecycleStatusEnum.ARCHIVED },
                actor: admin
            },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [archivedDestination] } }, 'list:end');
    });

    it('should return only destinations matching moderationState filter', async () => {
        const reviewedDestination = getMockDestination({
            id: destinationId,
            name: 'Reviewed Destination',
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([reviewedDestination]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, moderationState: ModerationStatusEnum.APPROVED },
            admin
        );
        expect(result.destinations).toEqual([reviewedDestination]);
        expectInfoLog(
            {
                input: { limit: 10, offset: 0, moderationState: ModerationStatusEnum.APPROVED },
                actor: admin
            },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [reviewedDestination] } }, 'list:end');
    });

    it('should return only destinations matching deletedAt filter', async () => {
        const deletedDate = new Date('2024-01-01T00:00:00.000Z');
        const deletedDestination = getMockDestination({
            id: destinationId,
            name: 'Deleted Destination',
            deletedAt: deletedDate,
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([deletedDestination]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, deletedAt: deletedDate.toISOString() },
            admin
        );
        expect(result.destinations).toEqual([deletedDestination]);
        expectInfoLog(
            { input: { limit: 10, offset: 0, deletedAt: deletedDate.toISOString() }, actor: admin },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [deletedDestination] } }, 'list:end');
    });

    it('should return destinations ordered by name asc', async () => {
        const destA = getMockDestination({
            id: getMockDestinationId(),
            name: 'A',
            visibility: VisibilityEnum.PUBLIC
        });
        const destB = getMockDestination({
            id: getMockDestinationId(),
            name: 'B',
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([destA, destB]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, orderBy: 'name', order: 'asc' },
            admin
        );
        expect(result.destinations).toEqual([destA, destB]);
        expectInfoLog(
            { input: { limit: 10, offset: 0, orderBy: 'name', order: 'asc' }, actor: admin },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [destA, destB] } }, 'list:end');
    });

    it('should return destinations ordered by name desc', async () => {
        const destA = getMockDestination({
            id: getMockDestinationId(),
            name: 'A',
            visibility: VisibilityEnum.PUBLIC
        });
        const destB = getMockDestination({
            id: getMockDestinationId(),
            name: 'B',
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([destB, destA]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, orderBy: 'name', order: 'desc' },
            admin
        );
        expect(result.destinations).toEqual([destB, destA]);
        expectInfoLog(
            { input: { limit: 10, offset: 0, orderBy: 'name', order: 'desc' }, actor: admin },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [destB, destA] } }, 'list:end');
    });

    it('should return destinations ordered by reviewsCount desc', async () => {
        const dest1 = getMockDestination({
            id: getMockDestinationId(),
            name: 'One',
            reviewsCount: 1,
            visibility: VisibilityEnum.PUBLIC
        });
        const dest2 = getMockDestination({
            id: getMockDestinationId(),
            name: 'Two',
            reviewsCount: 2,
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([dest2, dest1]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, orderBy: 'reviewsCount', order: 'desc' },
            admin
        );
        expect(result.destinations).toEqual([dest2, dest1]);
        expectInfoLog(
            {
                input: { limit: 10, offset: 0, orderBy: 'reviewsCount', order: 'desc' },
                actor: admin
            },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [dest2, dest1] } }, 'list:end');
    });

    it('should return empty if all destinations are filtered by permissions', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([privateDestination]);
        const result = await DestinationService.list({ limit: 10, offset: 0 }, publicUser);
        expect(result.destinations).toEqual([]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: publicUser }, 'list:start');
        expectInfoLog({ result: { destinations: [] } }, 'list:end');
    });

    it('should return correct destinations for combined filters and order', async () => {
        const featuredDestination = getMockDestination({
            id: getMockDestinationId(),
            name: 'Featured',
            isFeatured: true,
            reviewsCount: 5,
            visibility: VisibilityEnum.PUBLIC
        });
        (DestinationModel.list as Mock).mockResolvedValue([featuredDestination]);
        const result = await DestinationService.list(
            { limit: 10, offset: 0, isFeatured: true, orderBy: 'reviewsCount', order: 'desc' },
            admin
        );
        expect(result.destinations).toEqual([featuredDestination]);
        expectInfoLog(
            {
                input: {
                    limit: 10,
                    offset: 0,
                    isFeatured: true,
                    orderBy: 'reviewsCount',
                    order: 'desc'
                },
                actor: admin
            },
            'list:start'
        );
        expectInfoLog({ result: { destinations: [featuredDestination] } }, 'list:end');
    });

    // Puedes agregar más tests para filtros, orden, edge-cases, etc.
});
