import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
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

describe('destination.service.getForHome', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const publicUser = getMockPublicUser();
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const d1 = getMockDestination({
        id: destinationId,
        averageRating: 4.8,
        accommodationsCount: 10,
        visibility: VisibilityEnum.PUBLIC
    });
    const d2 = getMockDestination({
        id: 'dest-2' as typeof destinationId,
        averageRating: 4.8,
        accommodationsCount: 5,
        visibility: VisibilityEnum.PUBLIC
    });
    const d3 = getMockDestination({
        id: 'dest-3' as typeof destinationId,
        averageRating: 4.5,
        accommodationsCount: 20,
        visibility: VisibilityEnum.PRIVATE
    });
    const d4 = getMockDestination({
        id: 'dest-4' as typeof destinationId,
        averageRating: 4.2,
        accommodationsCount: 8,
        visibility: VisibilityEnum.PUBLIC
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return destinations ordered by rating and accommodationsCount for admin', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([d4, d2, d1, d3]);
        const result = await DestinationService.getForHome({ limit: 3 }, admin);
        // d1 and d2 have same rating, d1 has more accommodations
        expect(result.destinations).toEqual([d1, d2, d3]);
        expectInfoLog({ input: { limit: 3 }, actor: admin }, 'getForHome:start');
        expectInfoLog({ result: { destinations: [d1, d2, d3] } }, 'getForHome:end');
    });

    it('should return only public destinations for public user', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([d1, d2, d3, d4]);
        const result = await DestinationService.getForHome({ limit: 2 }, publicUser);
        expect(result.destinations).toEqual([d1, d2]);
        expectInfoLog({ input: { limit: 2 }, actor: publicUser }, 'getForHome:start');
        expectInfoLog({ result: { destinations: [d1, d2] } }, 'getForHome:end');
    });

    it('should return empty array if user is disabled', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([d1, d2, d3, d4]);
        const result = await DestinationService.getForHome({ limit: 2 }, disabledUser);
        expect(result.destinations).toEqual([]);
        expectInfoLog({ input: { limit: 2 }, actor: disabledUser }, 'getForHome:start');
        expectInfoLog({ result: { destinations: [] } }, 'getForHome:end');
    });

    it('should return empty array if no destinations', async () => {
        (DestinationModel.list as Mock).mockResolvedValue([]);
        const result = await DestinationService.getForHome({ limit: 2 }, admin);
        expect(result.destinations).toEqual([]);
        expectInfoLog({ input: { limit: 2 }, actor: admin }, 'getForHome:start');
        expectInfoLog({ result: { destinations: [] } }, 'getForHome:end');
    });
});
