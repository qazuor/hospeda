// @vitest-environment jsdom

import { PermissionEnum } from '@repo/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccommodationListQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import type { AccommodationCore } from '@/features/accommodations/schemas/accommodation-client.schema';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { UserAccommodationsCard } from '../UserAccommodationsCard';

vi.mock('@/features/accommodations/hooks/useAccommodationQuery', () => ({
    useAccommodationListQuery: vi.fn()
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: vi.fn()
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: vi.fn()
}));

type AccommodationListQueryResult = ReturnType<typeof useAccommodationListQuery>;

const mockedUseAccommodationListQuery = vi.mocked(useAccommodationListQuery);
const mockedUseUserPermissions = vi.mocked(useUserPermissions);
const mockedUseAuthContext = vi.mocked(useAuthContext);

function createAccommodation(overrides: Partial<AccommodationCore> = {}): AccommodationCore {
    return {
        id: 'acc-1',
        name: 'Hotel del Río',
        slug: 'hotel-del-rio',
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        cityDestination: {
            id: 'dest-1',
            name: 'Concepción del Uruguay',
            slug: 'concepcion-del-uruguay'
        },
        ...overrides
    } as unknown as AccommodationCore;
}

function createQueryResult(
    overrides: Partial<AccommodationListQueryResult> = {}
): AccommodationListQueryResult {
    return {
        data: {
            accommodations: [],
            total: 0,
            page: 1,
            limit: 100
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        ...overrides
    } as unknown as AccommodationListQueryResult;
}

describe('UserAccommodationsCard', () => {
    beforeEach(() => {
        mockedUseAuthContext.mockReturnValue({
            user: {
                id: 'staff-user',
                role: 'ADMIN',
                name: 'Staff User',
                email: 'staff@example.com'
            },
            isAuthenticated: true,
            isLoading: false
        } as unknown as ReturnType<typeof useAuthContext>);
    });

    it('renders the user accommodations list and edit actions for staff', () => {
        mockedUseUserPermissions.mockReturnValue([
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]);
        mockedUseAccommodationListQuery.mockReturnValue(
            createQueryResult({
                data: {
                    accommodations: [createAccommodation()],
                    total: 1,
                    page: 1,
                    limit: 100
                }
            })
        );

        render(<UserAccommodationsCard userId="owner-1" />);

        expect(
            screen.getByText('admin-pages.access.users.accommodations.title')
        ).toBeInTheDocument();
        expect(screen.getByText('Hotel del Río')).toBeInTheDocument();
        expect(screen.getByText('Concepción del Uruguay')).toBeInTheDocument();
        expect(screen.getByText('admin-common.entityPage.actions.view')).toBeInTheDocument();
        expect(screen.getByText('admin-common.entityPage.actions.edit')).toBeInTheDocument();

        expect(mockedUseAccommodationListQuery).toHaveBeenCalledWith(
            {
                ownerId: 'owner-1',
                pageSize: 100,
                sort: 'name:asc'
            },
            { enabled: true }
        );
    });

    it('renders the empty state when the user has no accommodations', () => {
        mockedUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_ALL]);
        mockedUseAccommodationListQuery.mockReturnValue(createQueryResult());

        render(<UserAccommodationsCard userId="owner-1" />);

        expect(
            screen.getByText('admin-pages.access.users.accommodations.empty')
        ).toBeInTheDocument();
    });

    it('shows the retry action when loading the accommodations fails', () => {
        const refetch = vi.fn();

        mockedUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_ALL]);
        mockedUseAccommodationListQuery.mockReturnValue(
            createQueryResult({
                isError: true,
                refetch
            })
        );

        render(<UserAccommodationsCard userId="owner-1" />);

        fireEvent.click(screen.getByText('admin-common.actions.tryAgain'));

        expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("keeps the section hidden when the actor cannot view that owner's accommodations", () => {
        mockedUseUserPermissions.mockReturnValue([PermissionEnum.ACCOMMODATION_VIEW_OWN]);
        mockedUseAccommodationListQuery.mockReturnValue(createQueryResult());

        render(<UserAccommodationsCard userId="another-owner" />);

        expect(
            screen.queryByText('admin-pages.access.users.accommodations.title')
        ).not.toBeInTheDocument();
        expect(mockedUseAccommodationListQuery).toHaveBeenCalledWith(
            {
                ownerId: 'another-owner',
                pageSize: 100,
                sort: 'name:asc'
            },
            { enabled: false }
        );
    });
});
