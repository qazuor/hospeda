/**
 * @file LocationExceptionRequestsPage.test.tsx
 * Admin queue (HOS-2192): rows, the approve dialog preloaded with the owner's
 * reason and sending the EDITED one, the reject dialog refusing a short reason,
 * and the 409 messages.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationExceptionRequestsPage } from '../LocationExceptionRequestsPage';

const mocks = vi.hoisted(() => ({
    mutateAsync: vi.fn(),
    addToast: vi.fn(),
    error: { status: undefined as number | undefined, reason: undefined as string | undefined },
    queryArgs: vi.fn(),
    targets: { value: false }
}));

vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
        locale: 'es'
    })
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock('../hooks', async () => {
    const actual = await vi.importActual<typeof import('../hooks')>('../hooks');
    return {
        ...actual,
        readLocationExceptionError: () => ({
            status: mocks.error.status,
            reason: mocks.error.reason,
            existingListingId: undefined
        }),
        useDecideLocationExceptionRequestMutation: () => ({
            mutateAsync: mocks.mutateAsync,
            isPending: false
        }),
        useLocationExceptionRequestsQuery: (args: unknown) => {
            mocks.queryArgs(args);
            return {
                isLoading: false,
                isError: false,
                data: {
                    total: 1,
                    page: 1,
                    pageSize: 20,
                    items: [
                        {
                            requestId: '11111111-1111-4111-8111-111111111111',
                            status: 'PENDING',
                            listing: {
                                id: 'aaaaaaaa-0000-4000-8000-000000000001',
                                name: 'Cabana Sol'
                            },
                            owner: { id: 'o1', name: 'Ana Duena', email: 'ana@example.com' },
                            address: {
                                street: 'Mitre',
                                number: '10',
                                floor: '2',
                                apartment: 'B',
                                destinationId: null
                            },
                            collidingListings: [
                                { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Cabana Luna' }
                            ],
                            reason: 'Somos un complejo de cabanas',
                            decisionReason: null,
                            targetsNewAddress: mocks.targets.value,
                            requestedAt: '2026-11-01T10:00:00.000Z'
                        }
                    ]
                }
            };
        }
    };
});

const KEY = 'admin-pages.locationExceptionRequests';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.error.status = undefined;
    mocks.error.reason = undefined;
    mocks.targets.value = false;
    mocks.mutateAsync.mockResolvedValue({});
});

describe('LocationExceptionRequestsPage', () => {
    it('lists the row with listing link, owner, address and colliding listing, PENDING by default', () => {
        render(<LocationExceptionRequestsPage />);

        expect(screen.getByText('Cabana Sol').closest('a')).toHaveAttribute(
            'href',
            '/accommodations/aaaaaaaa-0000-4000-8000-000000000001'
        );
        expect(screen.getByText('Ana Duena')).toBeInTheDocument();
        expect(screen.getByText('ana@example.com')).toBeInTheDocument();
        expect(screen.getByText('Cabana Luna').closest('a')).toHaveAttribute(
            'href',
            '/accommodations/bbbbbbbb-0000-4000-8000-000000000002'
        );
        expect(screen.getByText(/"street":"Mitre"/)).toBeInTheDocument();
        expect(mocks.queryArgs).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'PENDING', vertical: 'accommodations', page: 1 })
        );
    });

    it('marks a move request with the badge and says so in the approve dialog', () => {
        mocks.targets.value = true;
        render(<LocationExceptionRequestsPage />);
        expect(screen.getByTestId('targets-new-address')).toHaveTextContent(
            `${KEY}.targetsNewAddress`
        );
        fireEvent.click(screen.getByText(`${KEY}.approve`));
        expect(
            screen.getByText(new RegExp(`${KEY}.approveDialog.movesNotice`))
        ).toBeInTheDocument();
    });

    it('shows no badge and no move notice for a request about the saved address', () => {
        render(<LocationExceptionRequestsPage />);
        expect(screen.queryByTestId('targets-new-address')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText(`${KEY}.approve`));
        expect(screen.queryByText(/movesNotice/)).not.toBeInTheDocument();
    });

    it('switches the vertical and links to venues', () => {
        render(<LocationExceptionRequestsPage />);
        fireEvent.click(screen.getByText(`${KEY}.verticals.venues`));
        expect(screen.getByText('Cabana Sol').closest('a')).toHaveAttribute(
            'href',
            '/venues/aaaaaaaa-0000-4000-8000-000000000001'
        );
    });

    it('preloads the owner reason on approve and sends the EDITED reason', async () => {
        render(<LocationExceptionRequestsPage />);
        fireEvent.click(screen.getByText(`${KEY}.approve`));
        const field = screen.getByLabelText(`${KEY}.approveDialog.reasonLabel`);
        expect(field).toHaveValue('Somos un complejo de cabanas');

        fireEvent.change(field, { target: { value: '  Motivo editado por el admin  ' } });
        fireEvent.click(screen.getByText(`${KEY}.approveDialog.confirm`));

        await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
            vertical: 'accommodations',
            requestId: '11111111-1111-4111-8111-111111111111',
            decision: 'approve',
            reason: 'Motivo editado por el admin'
        });
    });

    it('refuses an edited approve reason shorter than 10 characters', async () => {
        render(<LocationExceptionRequestsPage />);
        fireEvent.click(screen.getByText(`${KEY}.approve`));
        fireEvent.change(screen.getByLabelText(`${KEY}.approveDialog.reasonLabel`), {
            target: { value: 'corto' }
        });
        fireEvent.click(screen.getByText(`${KEY}.approveDialog.confirm`));
        expect(await screen.findByText(`${KEY}.reasonInvalid`)).toBeInTheDocument();
        expect(mocks.mutateAsync).not.toHaveBeenCalled();
    });

    it('requires a reason of 10 characters to reject, then sends it', async () => {
        render(<LocationExceptionRequestsPage />);
        fireEvent.click(screen.getByText(`${KEY}.reject`));
        const field = screen.getByLabelText(`${KEY}.rejectDialog.reasonLabel`);
        expect(field).toHaveValue('');

        fireEvent.click(screen.getByText(`${KEY}.rejectDialog.confirm`));
        expect(await screen.findByText(`${KEY}.reasonInvalid`)).toBeInTheDocument();
        expect(mocks.mutateAsync).not.toHaveBeenCalled();

        fireEvent.change(field, { target: { value: 'short' } });
        fireEvent.click(screen.getByText(`${KEY}.rejectDialog.confirm`));
        await screen.findByText(`${KEY}.reasonInvalid`);
        expect(mocks.mutateAsync).not.toHaveBeenCalled();

        fireEvent.change(field, { target: { value: 'No corresponde la excepcion' } });
        fireEvent.click(screen.getByText(`${KEY}.rejectDialog.confirm`));
        await waitFor(() =>
            expect(mocks.mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    decision: 'reject',
                    reason: 'No corresponde la excepcion'
                })
            )
        );
    });

    it.each([
        ['LOCATION_EXCEPTION_REQUEST_NOT_PENDING', 'conflict.notPending'],
        ['LOCATION_EXCEPTION_REQUEST_STALE', 'conflict.stale'],
        ['LOCATION_EXCEPTION_NOT_NEEDED', 'conflict.notNeeded']
    ])('shows the clear message for the 409 %s', async (reason, messageKey) => {
        mocks.error.status = 409;
        mocks.error.reason = reason;
        mocks.mutateAsync.mockRejectedValue(new Error('409'));
        render(<LocationExceptionRequestsPage />);
        fireEvent.click(screen.getByText(`${KEY}.approve`));
        fireEvent.click(screen.getByText(`${KEY}.approveDialog.confirm`));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(`${KEY}.${messageKey}`);
    });
});
