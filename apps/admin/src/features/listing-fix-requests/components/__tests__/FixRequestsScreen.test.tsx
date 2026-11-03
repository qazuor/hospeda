// @vitest-environment jsdom
import es from '@repo/i18n/locales/es/admin-entities.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FixRequestsScreen } from '../FixRequestsScreen';

const fetchApi = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ fetchApi }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({
        to,
        params,
        children
    }: {
        to: string;
        params: { id: string };
        children: ReactNode;
    }) => <a href={to.replace('$id', params.id)}>{children}</a>
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        locale: 'es-AR',
        t: (key: string, params?: Record<string, unknown>) => {
            const value = key
                .split('.')
                .slice(1)
                .reduce((node: any, part) => node?.[part], es) as string;
            return Object.entries(params ?? {}).reduce(
                (result, [name, item]) => result.replaceAll(`{${name}}`, String(item)),
                value
            );
        },
        tPlural: (key: string, count: number) => {
            const parts = key.split('.').slice(1);
            const leaf = parts.pop();
            const parent = parts.reduce((node: any, part) => node?.[part], es) as Record<
                string,
                string
            >;
            return parent[`${leaf}_${count === 1 ? 'one' : 'other'}`].replace(
                '{{count}}',
                String(count)
            );
        }
    })
}));
vi.mock('@/features/listing/components/ListingModerationActions', () => ({
    ListingModerationActions: () => <div />
}));

const items = [
    {
        fixRequestId: '00000000-0000-4000-8000-000000000001',
        vertical: 'accommodation',
        listingId: '10000000-0000-4000-8000-000000000001',
        listingName: 'Hostería Sol',
        listingSlug: 'hosteria-sol',
        publicationStatus: 'PUBLISHED',
        reason: 'Fotos',
        suggestedDate: '2026-10-20',
        overdue: true,
        ageDays: 0,
        openedAt: '2026-11-02T12:00:00.000Z',
        ownerReportedFixedAt: '2026-11-01T12:00:00.000Z'
    },
    {
        fixRequestId: '00000000-0000-4000-8000-000000000002',
        vertical: 'venue',
        listingId: '10000000-0000-4000-8000-000000000002',
        listingName: 'Sala Norte',
        listingSlug: 'sala-norte',
        publicationStatus: 'PUBLISHED',
        reason: 'Descripción',
        suggestedDate: null,
        overdue: false,
        ageDays: 1,
        openedAt: '2026-11-01T12:00:00.000Z',
        ownerReportedFixedAt: null
    },
    {
        fixRequestId: '00000000-0000-4000-8000-000000000003',
        vertical: 'experience',
        listingId: '10000000-0000-4000-8000-000000000003',
        listingName: 'Paseo Sur',
        listingSlug: 'paseo-sur',
        publicationStatus: 'PUBLISHED',
        reason: 'Precio',
        suggestedDate: '2026-11-10',
        overdue: false,
        ageDays: 5,
        openedAt: '2026-10-28T12:00:00.000Z',
        ownerReportedFixedAt: null
    }
];

function renderScreen() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <FixRequestsScreen />
        </QueryClientProvider>
    );
}

describe('TEST:1704:5 AC:1704:6 pending requests table', () => {
    beforeEach(() =>
        fetchApi.mockResolvedValue({
            data: {
                data: {
                    items,
                    pagination: {
                        page: 1,
                        pageSize: 50,
                        total: 3,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                }
            }
        })
    );

    it('renders each vertical, listing, reason, age and owner report within its API row', async () => {
        renderScreen();
        const first = within(await screen.findByTestId(`fix-request-row-${items[0].fixRequestId}`));
        expect(first.getByText('Hostería Sol')).toHaveAttribute(
            'href',
            '/accommodations/10000000-0000-4000-8000-000000000001'
        );
        expect(first.getByText('Alojamiento')).toBeInTheDocument();
        expect(first.getByText('Fotos')).toBeInTheDocument();
        expect(first.getByText('hoy')).toBeInTheDocument();
        expect(first.getByText(/Avisó el/)).toBeInTheDocument();
        const venue = within(screen.getByTestId(`fix-request-row-${items[1].fixRequestId}`));
        expect(venue.getByText('Sala Norte')).toHaveAttribute(
            'href',
            '/venues/10000000-0000-4000-8000-000000000002'
        );
        expect(venue.getByText('hace 1 día')).toBeInTheDocument();
        expect(venue.getByText('Sin aviso')).toBeInTheDocument();
        const experience = within(screen.getByTestId(`fix-request-row-${items[2].fixRequestId}`));
        expect(experience.getByText('Paseo Sur')).toHaveAttribute(
            'href',
            '/experiences/10000000-0000-4000-8000-000000000003'
        );
        expect(experience.getByText('hace 5 días')).toBeInTheDocument();
    });

    it('shows suggested date before the overdue marker, and no overdue marker on an in-date request', async () => {
        renderScreen();
        const row = within(await screen.findByTestId(`fix-request-row-${items[0].fixRequestId}`));
        expect(row.getByText('20 de oct de 2026')).toBeInTheDocument();
        expect(row.getByText('Vencida')).toBeInTheDocument();
        const current = within(screen.getByTestId(`fix-request-row-${items[2].fixRequestId}`));
        expect(current.getByText('10 de nov de 2026')).toBeInTheDocument();
        expect(current.queryByText('Vencida')).not.toBeInTheDocument();
    });

    it('renders the empty message and an alert on API error', async () => {
        fetchApi.mockResolvedValueOnce({
            data: {
                data: {
                    items: [],
                    pagination: {
                        page: 1,
                        pageSize: 50,
                        total: 0,
                        totalPages: 0,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                }
            }
        });
        renderScreen();
        expect(await screen.findByText(es.fixRequestList.empty)).toBeInTheDocument();
        cleanup();
        fetchApi.mockRejectedValueOnce(new Error('Request failed'));
        renderScreen();
        expect(await screen.findByRole('alert')).toHaveTextContent(es.fixRequestList.error);
    });

    it('sends the selected vertical as an exact filter parameter', async () => {
        renderScreen();
        await screen.findByTestId('fix-requests-table');
        fireEvent.change(screen.getByLabelText(es.fixRequestList.filters.vertical), {
            target: { value: 'venue' }
        });
        await waitFor(() =>
            expect(fetchApi).toHaveBeenLastCalledWith({
                path: '/api/v1/admin/listing-fix-requests?page=1&pageSize=50&vertical=venue',
                method: 'GET'
            })
        );
    });

    it('requests the next page and resets to page one when a filter changes', async () => {
        fetchApi.mockResolvedValue({
            data: {
                data: {
                    items,
                    pagination: {
                        page: 1,
                        pageSize: 50,
                        total: 60,
                        totalPages: 2,
                        hasNextPage: true,
                        hasPreviousPage: false
                    }
                }
            }
        });
        renderScreen();
        await screen.findByTestId('fix-requests-table');
        fireEvent.click(screen.getByRole('button', { name: es.fixRequestList.next }));
        await waitFor(() =>
            expect(fetchApi).toHaveBeenLastCalledWith({
                path: '/api/v1/admin/listing-fix-requests?page=2&pageSize=50',
                method: 'GET'
            })
        );
        await screen.findByTestId('fix-requests-table');
        fireEvent.change(screen.getByLabelText(es.fixRequestList.filters.vertical), {
            target: { value: 'venue' }
        });
        await waitFor(() =>
            expect(fetchApi).toHaveBeenLastCalledWith({
                path: '/api/v1/admin/listing-fix-requests?page=1&pageSize=50&vertical=venue',
                method: 'GET'
            })
        );
    });
});
