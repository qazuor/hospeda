import { DestinationModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as destinationHelper from '../../destination/destination.helper';
import { DestinationService } from '../../destination/destination.service';
import { CanViewReasonEnum } from '../../utils/service-helper';
import { getMockDestination, getMockUser } from '../mockData';

// Helper to generate a valid DestinationId (cast string)
const toDestinationId = (id: string) => id as unknown as import('@repo/types').DestinationId;

// Helper to generate a list of mock destinations
const makeDestinations = (
    count: number,
    overrides: Partial<ReturnType<typeof getMockDestination>> = {}
) =>
    Array.from({ length: count }, (_, i) =>
        getMockDestination({
            id: toDestinationId(`dest-${i}`),
            name: `Destination ${i}`,
            summary: `Summary ${i}`,
            description: `Description ${i}`,
            ...overrides
        })
    );

describe('destination.service.search', () => {
    const admin = getMockUser({ role: RoleEnum.ADMIN });
    const user = getMockUser({ role: RoleEnum.USER });
    // Simula usuario deshabilitado correctamente según isUserDisabled
    const disabledUser = getMockUser({
        role: RoleEnum.USER,
        lifecycleState: LifecycleStatusEnum.INACTIVE
    });
    const baseDestinations = makeDestinations(5);

    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return filtered and ordered destinations for admin', async () => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue(baseDestinations);
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: true,
            reason: CanViewReasonEnum.HAS_PERMISSION,
            checkedPermission: undefined
        });
        const input = {
            text: 'Destination',
            limit: 3,
            offset: 0,
            orderBy: 'name' as const,
            order: 'asc' as const
        };
        const { destinations, total } = await DestinationService.search(input, admin);
        expect(destinations).toHaveLength(3);
        expect(total).toBe(5);
        expect(destinations[0]?.name).toBe('Destination 0');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'search:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'search:end');
    });

    it('should filter by averageRatingMin and averageRatingMax', async () => {
        const rated = makeDestinations(3, { averageRating: 4 });
        const lowRated = makeDestinations(2, { averageRating: 2 });
        vi.spyOn(DestinationModel, 'list').mockResolvedValue([...rated, ...lowRated]);
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: true,
            reason: CanViewReasonEnum.HAS_PERMISSION,
            checkedPermission: undefined
        });
        const input = { averageRatingMin: 3, averageRatingMax: 5, limit: 10, offset: 0 };
        const { destinations, total } = await DestinationService.search(input, admin);
        expect(
            destinations.every((d) => (d.averageRating ?? 0) >= 3 && (d.averageRating ?? 0) <= 5)
        ).toBe(true);
        expect(total).toBe(3);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'search:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'search:end');
    });

    it('should return empty if user is disabled', async () => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue(baseDestinations);
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: true,
            reason: CanViewReasonEnum.HAS_PERMISSION,
            checkedPermission: undefined
        });
        const input = { limit: 5, offset: 0 };
        const { destinations, total } = await DestinationService.search(input, disabledUser);
        expect(destinations).toHaveLength(0);
        expect(total).toBe(0);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: { destinations: [], total: 0 } }),
            'search:end'
        );
    });

    it('should filter by permissions (canView=false)', async () => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue(baseDestinations);
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: undefined
        });
        const input = { limit: 5, offset: 0 };
        const { destinations, total } = await DestinationService.search(input, user);
        expect(destinations).toHaveLength(0);
        expect(total).toBe(0);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ actor: expect.any(Object), input: expect.any(Object) }),
            'search:start'
        );
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: { destinations: [], total: 0 } }),
            'search:end'
        );
    });

    it('should paginate results', async () => {
        vi.spyOn(DestinationModel, 'list').mockResolvedValue(makeDestinations(10));
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: true,
            reason: CanViewReasonEnum.HAS_PERMISSION,
            checkedPermission: undefined
        });
        const input = { limit: 3, offset: 2, orderBy: 'name' as const, order: 'asc' as const };
        const { destinations, total } = await DestinationService.search(input, admin);
        expect(destinations).toHaveLength(3);
        expect(destinations[0]?.name).toBe('Destination 2');
        expect(total).toBe(10);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ actor: expect.any(Object), input: expect.any(Object) }),
            'search:start'
        );
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: expect.any(Object) }),
            'search:end'
        );
    });

    it('should filter by text (name, summary, description)', async () => {
        const custom = [
            getMockDestination({ name: 'Playa Dorada', summary: 'Sol', description: 'Arena' }),
            getMockDestination({ name: 'Montaña', summary: 'Nieve', description: 'Frío' })
        ];
        vi.spyOn(DestinationModel, 'list').mockResolvedValue(custom);
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: true,
            reason: CanViewReasonEnum.HAS_PERMISSION,
            checkedPermission: undefined
        });
        const input = { text: 'Playa', limit: 5, offset: 0 };
        const { destinations, total } = await DestinationService.search(input, admin);
        expect(destinations).toHaveLength(1);
        expect(destinations[0]?.name).toBe('Playa Dorada');
        expect(total).toBe(1);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ actor: expect.any(Object), input: expect.any(Object) }),
            'search:start'
        );
        expect(mockServiceLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ result: expect.any(Object) }),
            'search:end'
        );
    });
});
