// @vitest-environment jsdom

import type { AdminPartnerApplicationPanelItem } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PartnerApplicationPanelScreen } from '../PartnerApplicationPanelScreen';

const mocks = vi.hoisted(() => ({ query: vi.fn(), cancelWait: vi.fn() }));
vi.mock('@/features/partner-applications/hooks/usePartnerApplicationPanel', () => ({
    usePartnerApplicationPanel: mocks.query
}));
vi.mock('@/features/partner-applications/hooks/usePartnerApplicationActions', () => ({
    usePartnerApplicationActions: () => ({
        approve: { mutateAsync: vi.fn(), isPending: false },
        reject: { mutateAsync: vi.fn(), isPending: false },
        cancelWait: { mutateAsync: mocks.cancelWait, isPending: false }
    })
}));
vi.mock('@/hooks/use-user-permissions', () => ({ useHasPermission: () => false }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string) =>
            ({
                'admin-entities.partnerApplicationPanel.pending': 'Pendientes',
                'admin-entities.partnerApplicationPanel.approvedUnclaimed':
                    'Aprobadas sin reclamar',
                'admin-entities.partnerApplicationPanel.rejectedWaiting': 'Rechazadas con espera'
            })[key] ?? key
    })
}));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: ReactNode }) => <a href="/partners/test">{children}</a>
}));

const oldId = '00000000-0000-4000-8000-000000000001';
const newId = '00000000-0000-4000-8000-000000000002';
const item = (id: string, email: string, overdue: boolean): AdminPartnerApplicationPanelItem => ({
    id,
    email,
    status: 'PENDING',
    createdAt: '2026-10-20T12:00:00.000Z',
    resolvedAt: null,
    overdue,
    waitEndsAt: null,
    partner: null
});
const response = (items: AdminPartnerApplicationPanelItem[]) => ({
    items,
    pagination: {
        page: 1,
        pageSize: 50,
        total: items.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
    }
});

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <PartnerApplicationPanelScreen />
        </QueryClientProvider>
    );
}

describe('PartnerApplicationPanelScreen', () => {
    beforeEach(() => {
        mocks.cancelWait.mockReset().mockResolvedValue(undefined);
        mocks.query.mockReturnValue({
            isPending: false,
            isError: false,
            data: response([
                item(oldId, 'old@example.test', true),
                item(newId, 'new@example.test', false)
            ])
        });
    });
    afterEach(cleanup);

    it('renders the view labels from their existing translation keys', () => {
        renderScreen();

        expect(screen.getByRole('tab', { name: 'Pendientes' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Aprobadas sin reclamar' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Rechazadas con espera' })).toBeInTheDocument();
    });

    it('marks only the overdue pending row', () => {
        renderScreen();
        const oldRow = screen.getByTestId(`partner-application-row-${oldId}`);
        expect(
            within(oldRow).getByTestId(`partner-application-overdue-${oldId}`)
        ).toBeInTheDocument();
        const newRow = screen.getByTestId(`partner-application-row-${newId}`);
        expect(
            within(newRow).queryByTestId(`partner-application-overdue-${newId}`)
        ).not.toBeInTheDocument();
    });

    it('shows the actions for each view and submits cancel wait with its exact input', async () => {
        renderScreen();
        const pendingTable = screen.getByTestId('partner-application-panel-table');
        expect(
            within(pendingTable).getAllByRole('button', {
                name: 'admin-entities.partnerApplicationPanel.actions.approve'
            })
        ).toHaveLength(2);
        expect(
            within(pendingTable).getAllByRole('button', {
                name: 'admin-entities.partnerApplicationPanel.actions.reject'
            })
        ).toHaveLength(2);
        fireEvent.click(screen.getByRole('tab', { name: 'Aprobadas sin reclamar' }));
        const approvedRow = screen.getByTestId(`partner-application-row-${oldId}`);
        expect(within(approvedRow).queryByRole('button')).not.toBeInTheDocument();
        expect(within(approvedRow).getAllByRole('cell')).toHaveLength(4);
        expect(
            within(screen.getByTestId('partner-application-panel-table')).queryByRole(
                'columnheader',
                { name: 'admin-entities.partnerApplicationPanel.columns.actions' }
            )
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Rechazadas con espera' }));
        const rejectedRow = screen.getByTestId(`partner-application-row-${oldId}`);
        const cancel = within(rejectedRow).getByRole('button', {
            name: 'admin-entities.partnerApplicationPanel.actions.cancelWait'
        });
        fireEvent.click(cancel);
        const confirm = screen.getByRole('button', {
            name: 'admin-entities.partnerApplicationPanel.dialogs.cancelWait.confirm'
        });
        expect(confirm).toBeDisabled();
        fireEvent.change(
            screen.getByLabelText('admin-entities.partnerApplicationPanel.dialogs.reason'),
            { target: { value: 'Review complete' } }
        );
        await waitFor(() => expect(confirm).toBeEnabled());
        fireEvent.click(confirm);
        await waitFor(() =>
            expect(mocks.cancelWait).toHaveBeenCalledWith({ id: oldId, reason: 'Review complete' })
        );
    });

    it('keeps the cancel dialog open and shows API failures as an alert', async () => {
        mocks.cancelWait.mockRejectedValueOnce(new Error('Request failed'));
        renderScreen();
        fireEvent.click(screen.getByRole('tab', { name: 'Rechazadas con espera' }));
        const row = screen.getByTestId(`partner-application-row-${oldId}`);
        fireEvent.click(
            within(row).getByRole('button', {
                name: 'admin-entities.partnerApplicationPanel.actions.cancelWait'
            })
        );
        fireEvent.change(
            screen.getByLabelText('admin-entities.partnerApplicationPanel.dialogs.reason'),
            { target: { value: 'Valid reason' } }
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'admin-entities.partnerApplicationPanel.dialogs.cancelWait.confirm'
            })
        );
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.getByTestId('partner-application-action-dialog')).toBeInTheDocument();
    });
});
