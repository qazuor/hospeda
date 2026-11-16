/**
 * @file ListingLocationExceptionCard.test.tsx
 * The «Excepción de ubicación» block (HOS-2192): state, history, revoke with an
 * optional reason, and the REVOKE_CONFLICT link.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingLocationExceptionCard } from '../components/ListingLocationExceptionCard';

const mocks = vi.hoisted(() => ({
    mutateAsync: vi.fn(),
    addToast: vi.fn(),
    state: {} as Record<string, unknown>,
    info: {} as Record<string, unknown>
}));

vi.mock('@/components/auth/PermissionGate', () => ({
    PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>
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
        readLocationExceptionError: () => mocks.info,
        useChangeLocationExceptionMutation: () => ({
            mutateAsync: mocks.mutateAsync,
            isPending: false
        }),
        useLocationExceptionStateQuery: () => ({
            isLoading: false,
            isError: false,
            data: mocks.state
        })
    };
});

const KEY = 'admin-entities.locationException';
const LISTING = 'cccccccc-0000-4000-8000-000000000003';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.info = {};
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.state = {
        id: LISTING,
        hasException: true,
        by: 'u1',
        reason: 'Complejo de cabanas',
        at: '2026-11-01T10:00:00.000Z',
        events: [
            {
                id: 'e2',
                action: 'APPROVED',
                actorId: 'u1',
                actorName: 'Admin Uno',
                reason: 'Complejo de cabanas',
                requestId: null,
                createdAt: '2026-11-01T10:00:00.000Z'
            },
            {
                id: 'e1',
                action: 'REQUESTED',
                actorId: 'o1',
                actorName: 'Ana Duena',
                reason: 'Pedido original',
                requestId: null,
                createdAt: '2026-10-30T10:00:00.000Z'
            }
        ]
    };
});

describe('ListingLocationExceptionCard', () => {
    it('shows who, when and why, and the history newest first', () => {
        render(
            <ListingLocationExceptionCard
                vertical="venues"
                listingId={LISTING}
            />
        );
        const inForce = screen.getByTestId('location-exception-in-force');
        expect(inForce).toHaveTextContent('"name":"Admin Uno"');
        expect(inForce).toHaveTextContent('Complejo de cabanas');
        const items = screen.getByTestId('location-exception-history').querySelectorAll('li');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent(`${KEY}.actions.APPROVED`);
        expect(items[1]).toHaveTextContent(`${KEY}.actions.REQUESTED`);
    });

    it('revokes without a body reason when none is typed', async () => {
        render(
            <ListingLocationExceptionCard
                vertical="venues"
                listingId={LISTING}
            />
        );
        fireEvent.click(screen.getAllByText(`${KEY}.revoke`)[0] as HTMLElement);
        fireEvent.click(screen.getByText(`${KEY}.revokeDialog.confirm`));
        await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
            vertical: 'venues',
            listingId: LISTING,
            action: 'revoke',
            reason: undefined
        });
    });

    it('sends the typed revoke reason and refuses a typed one shorter than 10', async () => {
        render(
            <ListingLocationExceptionCard
                vertical="venues"
                listingId={LISTING}
            />
        );
        fireEvent.click(screen.getAllByText(`${KEY}.revoke`)[0] as HTMLElement);
        const field = screen.getByLabelText(`${KEY}.revokeDialog.reasonLabel`);
        fireEvent.change(field, { target: { value: 'corto' } });
        fireEvent.click(screen.getByText(`${KEY}.revokeDialog.confirm`));
        await screen.findByText(`${KEY}.reasonInvalid`);
        expect(mocks.mutateAsync).not.toHaveBeenCalled();

        fireEvent.change(field, { target: { value: 'El complejo se separo' } });
        fireEvent.click(screen.getByText(`${KEY}.revokeDialog.confirm`));
        await waitFor(() =>
            expect(mocks.mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'revoke', reason: 'El complejo se separo' })
            )
        );
    });

    it('shows the REVOKE_CONFLICT with a link to the colliding listing', async () => {
        mocks.info = {
            status: 409,
            reason: 'LOCATION_EXCEPTION_REVOKE_CONFLICT',
            existingListingId: 'dddddddd-0000-4000-8000-000000000004'
        };
        mocks.mutateAsync.mockRejectedValue(new Error('409'));
        render(
            <ListingLocationExceptionCard
                vertical="venues"
                listingId={LISTING}
            />
        );
        fireEvent.click(screen.getAllByText(`${KEY}.revoke`)[0] as HTMLElement);
        fireEvent.click(screen.getByText(`${KEY}.revokeDialog.confirm`));
        const link = await screen.findByText(`${KEY}.revokeConflictLink`);
        expect(link.closest('a')).toHaveAttribute(
            'href',
            '/venues/dddddddd-0000-4000-8000-000000000004'
        );
    });

    it('offers granting when no exception is in force', async () => {
        mocks.state = { ...mocks.state, hasException: false, by: null, reason: null, at: null };
        render(
            <ListingLocationExceptionCard
                vertical="accommodations"
                listingId={LISTING}
            />
        );
        fireEvent.click(screen.getAllByText(`${KEY}.grant`)[0] as HTMLElement);
        fireEvent.change(screen.getByLabelText(`${KEY}.grantDialog.reasonLabel`), {
            target: { value: 'Complejo de cabanas' }
        });
        fireEvent.click(screen.getByText(`${KEY}.grantDialog.confirm`));
        await waitFor(() =>
            expect(mocks.mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'grant', reason: 'Complejo de cabanas' })
            )
        );
    });
});
