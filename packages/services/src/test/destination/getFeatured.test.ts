import { DestinationModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../destination/destination.service';
import { getMockDestination, getMockDestinationId } from '../factories/destinationFactory';
import { getMockPublicUser, getMockUser, getMockUserId } from '../factories/userFactory';
import { expectInfoLog } from '../utils/log-assertions';

describe('destination.service.getFeatured', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const publicUser = getMockPublicUser();
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const featuredPublic = getMockDestination({
        id: destinationId,
        isFeatured: true,
        visibility: VisibilityEnum.PUBLIC
    });
    const featuredPrivate = getMockDestination({
        id: 'dest-priv' as typeof destinationId,
        isFeatured: true,
        visibility: VisibilityEnum.PRIVATE
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return only featured and accessible destinations for admin', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([featuredPublic, featuredPrivate]);
        const result = await DestinationService.getFeatured({ limit: 10, offset: 0 }, admin);
        expect(result.destinations).toEqual([featuredPublic, featuredPrivate]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: admin }, 'getFeatured:start');
        expectInfoLog(
            { result: { destinations: [featuredPublic, featuredPrivate] } },
            'getFeatured:end'
        );
    });

    it('should return only public featured destinations for public user', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([featuredPublic, featuredPrivate]);
        const result = await DestinationService.getFeatured({ limit: 10, offset: 0 }, publicUser);
        expect(result.destinations).toEqual([featuredPublic]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: publicUser }, 'getFeatured:start');
        expectInfoLog({ result: { destinations: [featuredPublic] } }, 'getFeatured:end');
    });

    it('should return empty array if user is disabled', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([featuredPublic, featuredPrivate]);
        const result = await DestinationService.getFeatured({ limit: 10, offset: 0 }, disabledUser);
        expect(result.destinations).toEqual([]);
        expectInfoLog(
            { input: { limit: 10, offset: 0 }, actor: disabledUser },
            'getFeatured:start'
        );
        expectInfoLog({ result: { destinations: [] } }, 'getFeatured:end');
    });

    it('should return empty array if no featured destinations', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([]);
        const result = await DestinationService.getFeatured({ limit: 10, offset: 0 }, admin);
        expect(result.destinations).toEqual([]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: admin }, 'getFeatured:start');
        expectInfoLog({ result: { destinations: [] } }, 'getFeatured:end');
    });
});
