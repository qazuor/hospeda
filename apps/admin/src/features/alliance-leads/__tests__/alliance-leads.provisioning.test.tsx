// @vitest-environment jsdom
/**
 * Alliance leads: provisioning notice and retry (HOS-2339).
 *
 * Covers the toast chosen from the `mark-handled` outcome, the categories block
 * of the handle dialog, the persistent badge and the retry button.
 * Network is mocked through `vi.mock('@/lib/api/client')`.
 */

import { type AllianceLead, PermissionEnum } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { AllianceLeadInbox } from '../components/AllianceLeadInbox';
import { needsProvider } from '../components/AllianceLeadProvisioningBadge';
import { resolveApprovalToast, resolveRetryToast } from '../provisioning-toast';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));
const mockAddToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ addToast: mockAddToast }) }));
let mockPermissions: PermissionEnum[] = [];
vi.mock('@/hooks/use-user-permissions', () => ({
    useHasPermission: (p: PermissionEnum) => mockPermissions.includes(p)
}));

const mockedFetchApi = vi.mocked(fetchApi);
const K = 'admin-entities.allianceLeads';
const HOST_TRADE_ID = '33333333-3333-4333-a333-333333333333';

const baseLead: AllianceLead = {
    id: 'lead-provider-1',
    kind: 'service_provider',
    contactName: 'Ana Plomera',
    email: 'ana@example.com',
    phone: null,
    message: 'Quiero sumarme.',
    status: 'pending',
    adminNote: null,
    categorySlugs: ['plomeria', 'gas', 'viejo', 'borrada'],
    provisionedHostTradeId: null,
    createdAt: new Date('2024-03-15T10:00:00.000Z'),
    updatedAt: new Date('2024-03-15T10:00:00.000Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};
const lead = (o: Partial<AllianceLead> = {}): AllianceLead => ({ ...baseLead, ...o });

const catalogRow = (slug: string, extra: Record<string, unknown> = {}) => ({
    id: `id-${slug}`,
    slug,
    nameI18n: { es: `Nombre ${slug}`, en: slug, pt: slug },
    lifecycleState: 'ACTIVE',
    deletedAt: null,
    ...extra
});

const CATALOG_RESPONSE = {
    data: {
        success: true,
        data: {
            items: [
                catalogRow('plomeria'),
                catalogRow('gas', { lifecycleState: 'INACTIVE' }),
                catalogRow('borrada', { deletedAt: '2024-01-01T00:00:00.000Z' })
            ],
            pagination: { totalPages: 1 }
        }
    },
    status: 200
};

const page = (items: AllianceLead[]) => ({
    data: {
        success: true,
        data: { items, pagination: { total: items.length, page: 1, pageSize: 20, totalPages: 1 } }
    },
    status: 200
});

type Routes = {
    list: AllianceLead[];
    catalog?: unknown;
    markHandled?: unknown;
    provision?: unknown;
};

/** Routes `fetchApi` by path so call order never matters. */
function route(r: Routes) {
    mockedFetchApi.mockImplementation((async (opts: { path: string }) => {
        if (opts.path.includes('/host-trade-categories')) {
            if (r.catalog instanceof Error) throw r.catalog;
            return r.catalog ?? CATALOG_RESPONSE;
        }
        if (opts.path.endsWith('/mark-handled')) return r.markHandled;
        if (opts.path.endsWith('/provision')) {
            if (r.provision instanceof Error) throw r.provision;
            return r.provision;
        }
        return page(r.list);
    }) as never);
}

function renderInbox() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            React.createElement(AllianceLeadInbox)
        )
    );
}

const wrap = (data: unknown) => ({ data: { success: true, data }, status: 200 });

beforeEach(() => {
    mockPermissions = [PermissionEnum.ALLIANCE_LEAD_MANAGE];
});
afterEach(() => {
    vi.clearAllMocks();
});

describe('needsProvider', () => {
    it.each([
        [{ status: 'approved', kind: 'service_provider', provisionedHostTradeId: null }, true],
        [{ status: 'approved', kind: 'service_provider', provisionedHostTradeId: undefined }, true],
        [
            { status: 'approved', kind: 'service_provider', provisionedHostTradeId: HOST_TRADE_ID },
            false
        ],
        [{ status: 'rejected', kind: 'service_provider', provisionedHostTradeId: null }, false],
        [{ status: 'pending', kind: 'service_provider', provisionedHostTradeId: null }, false],
        [{ status: 'approved', kind: 'partner', provisionedHostTradeId: null }, false],
        [{ status: 'approved', kind: 'sponsor', provisionedHostTradeId: null }, false]
    ] as const)('%j -> %s', (input, expected) => {
        expect(needsProvider(input)).toBe(expected);
    });
});

describe('toast resolution', () => {
    it('AC-1.2/1.3 warns for no-active-category and legacy', () => {
        expect(
            resolveApprovalToast({
                provisioning: { provisioned: false, reason: 'no-active-category' }
            })
        ).toEqual({ variant: 'warning', messageKey: `${K}.handle.warningNoActiveCategory` });
        expect(
            resolveApprovalToast({
                provisioning: { provisioned: false, reason: 'legacy-lead-without-typed-fields' }
            })
        ).toEqual({ variant: 'warning', messageKey: `${K}.handle.warningLegacy` });
    });

    it('AC-1.1/1.4/1.5 keeps the success toast otherwise', () => {
        const success = { variant: 'success', messageKey: `${K}.handle.successApproved` };
        expect(
            resolveApprovalToast({
                provisioning: { provisioned: true, hostTradeId: HOST_TRADE_ID }
            })
        ).toEqual(success);
        expect(
            resolveApprovalToast({
                provisioning: {
                    provisioned: false,
                    reason: 'already-provisioned',
                    hostTradeId: HOST_TRADE_ID
                }
            })
        ).toEqual(success);
        expect(resolveApprovalToast({ provisioning: undefined })).toEqual(success);
    });

    it('retry: success, already exists (info) and still-skipped (warning)', () => {
        expect(
            resolveRetryToast({ provisioning: { provisioned: true, hostTradeId: HOST_TRADE_ID } })
        ).toEqual({ variant: 'success', messageKey: `${K}.provision.success` });
        expect(
            resolveRetryToast({
                provisioning: {
                    provisioned: false,
                    reason: 'already-provisioned',
                    hostTradeId: HOST_TRADE_ID
                }
            })
        ).toEqual({ variant: 'info', messageKey: `${K}.provision.alreadyExists` });
        expect(
            resolveRetryToast({
                provisioning: { provisioned: false, reason: 'no-active-category' }
            })
        ).toEqual({ variant: 'warning', messageKey: `${K}.handle.warningNoActiveCategory` });
    });
});

async function openHandleDialog() {
    await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
    fireEvent.click(screen.getAllByText(`${K}.actions.handle`)[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText(`${K}.handle.title`)).toBeInTheDocument());
}

describe('HandleDialog toast from the mark-handled outcome', () => {
    it('AC-1.2 shows the warning toast and not the success toast', async () => {
        route({
            list: [lead()],
            markHandled: wrap({
                ...lead({ status: 'approved' }),
                provisioning: { provisioned: false, reason: 'no-active-category' }
            })
        });
        renderInbox();
        await openHandleDialog();
        fireEvent.click(screen.getByText(`${K}.handle.submit`));
        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(mockAddToast).toHaveBeenCalledWith({
            variant: 'warning',
            message: `${K}.handle.warningNoActiveCategory`
        });
        expect(mockAddToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ message: `${K}.handle.successApproved` })
        );
    });

    it('AC-1.1 shows the success toast when provisioned', async () => {
        route({
            list: [lead()],
            markHandled: wrap({
                ...lead({ status: 'approved' }),
                provisioning: { provisioned: true, hostTradeId: HOST_TRADE_ID }
            })
        });
        renderInbox();
        await openHandleDialog();
        fireEvent.click(screen.getByText(`${K}.handle.submit`));
        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith({
                variant: 'success',
                message: `${K}.handle.successApproved`
            })
        );
    });
});

describe('HandleDialog categories block', () => {
    it('AC-2.1/2.2/2.3 resolves names and marks inactive, deleted and missing', async () => {
        route({ list: [lead()] });
        renderInbox();
        await openHandleDialog();
        await waitFor(() => expect(screen.getByText('Nombre plomeria')).toBeInTheDocument());
        expect(screen.getByText('Nombre gas')).toBeInTheDocument();
        expect(screen.getByText(`${K}.handle.categoryState.inactive`)).toBeInTheDocument();
        expect(screen.getByText('Nombre borrada')).toBeInTheDocument();
        expect(screen.getByText(`${K}.handle.categoryState.deleted`)).toBeInTheDocument();
        expect(screen.getByText('viejo')).toBeInTheDocument();
        expect(screen.getByText(`${K}.handle.categoryState.missing`)).toBeInTheDocument();
        expect(screen.getByText(`${K}.handle.categoriesNote`)).toBeInTheDocument();
        expect(mockedFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('includeDeleted=true') })
        );
    });

    it('AC-2.3 omits the note when every chosen category is active', async () => {
        route({ list: [lead({ categorySlugs: ['plomeria'] })] });
        renderInbox();
        await openHandleDialog();
        await waitFor(() => expect(screen.getByText('Nombre plomeria')).toBeInTheDocument());
        expect(screen.queryByText(`${K}.handle.categoriesNote`)).not.toBeInTheDocument();
    });

    it('AC-2.4 falls back to raw slugs without markers or banner on 403', async () => {
        route({
            list: [lead()],
            catalog: new ApiError('Forbidden', { status: 403 })
        });
        renderInbox();
        await openHandleDialog();
        await waitFor(() => expect(screen.getByText('plomeria')).toBeInTheDocument());
        expect(screen.queryByText(`${K}.handle.categoryState.inactive`)).not.toBeInTheDocument();
        expect(screen.queryByText(`${K}.handle.catalogUnavailable`)).not.toBeInTheDocument();
    });

    it('AC-2.5 shows a skeleton while loading and keeps the controls usable', async () => {
        mockedFetchApi.mockImplementation((async (opts: { path: string }) => {
            if (opts.path.includes('/host-trade-categories')) return new Promise(() => undefined);
            return page([lead()]);
        }) as never);
        renderInbox();
        await openHandleDialog();
        expect(screen.getByTestId('lead-categories-skeleton')).toBeInTheDocument();
        expect(screen.getByText(`${K}.handle.submit`)).not.toBeDisabled();
    });

    it('AC-2.5 shows raw slugs and a muted line on another failure', async () => {
        route({ list: [lead()], catalog: new Error('boom') });
        renderInbox();
        await openHandleDialog();
        await waitFor(() =>
            expect(screen.getByText(`${K}.handle.catalogUnavailable`)).toBeInTheDocument()
        );
        expect(screen.getByText('plomeria')).toBeInTheDocument();
        expect(screen.getByText(`${K}.handle.submit`)).not.toBeDisabled();
    });

    it.each([
        ['another kind', { kind: 'partner' as const }],
        ['null slugs', { categorySlugs: null }],
        ['empty slugs', { categorySlugs: [] }]
    ])('AC-2.6 renders no block for %s', async (_name, override) => {
        route({ list: [lead(override)] });
        renderInbox();
        await openHandleDialog();
        expect(screen.queryByTestId('lead-categories-block')).not.toBeInTheDocument();
        expect(mockedFetchApi).not.toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining('/host-trade-categories') })
        );
    });
});

describe('persistent badge and retry button', () => {
    const approvedNoProvider = lead({ status: 'approved' });

    it('AC-3.1 shows the badge and the button for an approved provider without a listing', async () => {
        route({ list: [approvedNoProvider] });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        expect(screen.getByTestId('provider-not-created-badge')).toHaveTextContent(
            `${K}.badge.providerNotCreated`
        );
        expect(screen.getByText(`${K}.actions.createProvider`)).toBeInTheDocument();
    });

    it.each([
        ['provisioned', lead({ status: 'approved', provisionedHostTradeId: HOST_TRADE_ID })],
        ['rejected', lead({ status: 'rejected' })],
        ['pending', lead({ status: 'pending' })],
        ['partner', lead({ status: 'approved', kind: 'partner' })]
    ])('AC-3.2 shows neither badge nor button for a %s row', async (_n, row) => {
        route({ list: [row] });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        expect(screen.queryByTestId('provider-not-created-badge')).not.toBeInTheDocument();
        expect(screen.queryByText(`${K}.actions.createProvider`)).not.toBeInTheDocument();
    });

    it('AC-3.4 hides the button without ALLIANCE_LEAD_MANAGE', async () => {
        mockPermissions = [PermissionEnum.ALLIANCE_LEAD_VIEW_ALL];
        route({ list: [approvedNoProvider] });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        expect(screen.queryByText(`${K}.actions.createProvider`)).not.toBeInTheDocument();
    });

    it('AC-4.1 retry posts to /provision and shows the success toast', async () => {
        route({
            list: [approvedNoProvider],
            provision: wrap({
                ...approvedNoProvider,
                provisionedHostTradeId: HOST_TRADE_ID,
                provisioning: { provisioned: true, hostTradeId: HOST_TRADE_ID }
            })
        });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        fireEvent.click(screen.getByText(`${K}.actions.createProvider`));
        await waitFor(() =>
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/alliance/leads/${approvedNoProvider.id}/provision`,
                    method: 'POST'
                })
            )
        );
        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith({
                variant: 'success',
                message: `${K}.provision.success`
            })
        );
    });

    it('AC-4.2 still no category keeps the warning toast', async () => {
        route({
            list: [approvedNoProvider],
            provision: wrap({
                ...approvedNoProvider,
                provisioning: { provisioned: false, reason: 'no-active-category' }
            })
        });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        fireEvent.click(screen.getByText(`${K}.actions.createProvider`));
        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith({
                variant: 'warning',
                message: `${K}.handle.warningNoActiveCategory`
            })
        );
    });

    it('AC-4.3 already provisioned shows the info toast', async () => {
        route({
            list: [approvedNoProvider],
            provision: wrap({
                ...approvedNoProvider,
                provisioning: {
                    provisioned: false,
                    reason: 'already-provisioned',
                    hostTradeId: HOST_TRADE_ID
                }
            })
        });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        fireEvent.click(screen.getByText(`${K}.actions.createProvider`));
        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith({
                variant: 'info',
                message: `${K}.provision.alreadyExists`
            })
        );
    });

    it('AC-4.7 disables the button while in flight', async () => {
        mockedFetchApi.mockImplementation((async (opts: { path: string }) => {
            if (opts.path.endsWith('/provision')) return new Promise(() => undefined);
            return page([approvedNoProvider]);
        }) as never);
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        fireEvent.click(screen.getByText(`${K}.actions.createProvider`));
        const busy = await screen.findByText(`${K}.actions.creatingProvider`);
        expect(busy.closest('button')).toBeDisabled();
    });

    it('AC-4.7 a failure shows an error toast and leaves the badge in place', async () => {
        route({ list: [approvedNoProvider], provision: new Error('network') });
        renderInbox();
        await waitFor(() => expect(screen.getByText('Ana Plomera')).toBeInTheDocument());
        fireEvent.click(screen.getByText(`${K}.actions.createProvider`));
        await waitFor(() =>
            expect(mockAddToast).toHaveBeenCalledWith({
                variant: 'error',
                message: `${K}.provision.error`
            })
        );
        expect(screen.getByTestId('provider-not-created-badge')).toBeInTheDocument();
    });
});
