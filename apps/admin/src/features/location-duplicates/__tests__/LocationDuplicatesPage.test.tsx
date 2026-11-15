/**
 * @file LocationDuplicatesPage.test.tsx
 * Repeated-address report (HOS-1810): path builder and the exception dialog,
 * which must refuse a short reason and send the trimmed one.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLocationDuplicatesPath } from '../hooks';
import { LocationDuplicatesPage } from '../LocationDuplicatesPage';

const mocks = vi.hoisted(() => ({
    mutate: vi.fn(),
    addToast: vi.fn()
}));

vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('../hooks', async () => {
    const actual = await vi.importActual<typeof import('../hooks')>('../hooks');
    return {
        ...actual,
        useGrantLocationExceptionMutation: () => ({ mutate: mocks.mutate, isPending: false }),
        useLocationDuplicatesQuery: ({ vertical }: { vertical: string }) => ({
            isLoading: false,
            isError: false,
            data:
                vertical === 'venues'
                    ? {
                          total: 1,
                          page: 1,
                          pageSize: 20,
                          items: [
                              {
                                  locationKey: 'mitre|10|dest',
                                  ownerCount: 2,
                                  sameOwner: false,
                                  listings: [
                                      { id: 'aaaaaaaa-0000-4000-8000-000000000001', ownerId: 'o1' },
                                      { id: 'bbbbbbbb-0000-4000-8000-000000000002', ownerId: 'o2' }
                                  ]
                              }
                          ]
                      }
                    : { total: 0, page: 1, pageSize: 20, items: [] }
        })
    };
});

beforeEach(() => vi.clearAllMocks());

describe('buildLocationDuplicatesPath', () => {
    it('builds the report and the exception paths per vertical', () => {
        expect(buildLocationDuplicatesPath({ vertical: 'venues' })).toBe(
            '/api/v1/admin/venues/location-duplicates'
        );
        expect(buildLocationDuplicatesPath({ vertical: 'accommodations', id: 'x' })).toBe(
            '/api/v1/admin/accommodations/x/location-exception'
        );
    });
});

describe('LocationDuplicatesPage', () => {
    it('lists groups with the owner flag and an empty state for the other vertical', () => {
        render(<LocationDuplicatesPage />);
        expect(screen.getByText('mitre|10|dest')).toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.locationDuplicates.differentOwners')
        ).toBeInTheDocument();
        expect(screen.getByText('admin-pages.locationDuplicates.empty')).toBeInTheDocument();
    });

    it('refuses a short reason and sends the trimmed reason of a valid one', () => {
        render(<LocationDuplicatesPage />);
        fireEvent.click(
            screen.getAllByText('admin-pages.locationDuplicates.grantException')[0] as HTMLElement
        );
        const confirm = screen.getByText('admin-pages.locationDuplicates.dialog.confirm');
        const field = screen.getByLabelText('admin-pages.locationDuplicates.dialog.reasonLabel');

        fireEvent.change(field, { target: { value: 'short' } });
        expect(confirm).toBeDisabled();

        fireEvent.change(field, { target: { value: '  Food court with three venues  ' } });
        expect(confirm).not.toBeDisabled();
        fireEvent.click(confirm);
        expect(mocks.mutate).toHaveBeenCalledWith(
            {
                vertical: 'venues',
                id: 'aaaaaaaa-0000-4000-8000-000000000001',
                reason: 'Food court with three venues'
            },
            expect.any(Object)
        );
    });
});
