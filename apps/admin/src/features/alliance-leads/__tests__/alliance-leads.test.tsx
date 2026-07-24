// @vitest-environment jsdom
/**
 * Alliance Leads Inbox — unit tests (HOS-277 §6.4).
 *
 * Covers:
 *  - Inbox renders a list of leads from the mocked query.
 *  - Kind column renders and the kind filter selector is present.
 *  - Handle dialog submit calls the mark-handled mutation with the correct body.
 *  - No "Approve & provision" / "Provision owner" action exists (HOS-277 NG-1).
 *
 * All network calls are mocked via `vi.mock('@/lib/api/client')`.
 * No real API is hit.
 */

import type { AllianceLead } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { AllianceLeadInbox } from '../components/AllianceLeadInbox';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

// Stub useTranslations — returns key as label so assertions are stable.
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, string>) => {
            if (!params) return key;
            return Object.entries(params).reduce((str, [k, v]) => str.replace(`{{${k}}}`, v), key);
        }
    })
}));

// Stub useToast to capture addToast calls.
const mockAddToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_LEAD_PENDING: AllianceLead = {
    id: 'lead-uuid-001',
    kind: 'partner',
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: null,
    message: 'Nombre del negocio: Acme SA\n\nMensaje:\nQueremos ser partners.',
    status: 'pending',
    adminNote: null,
    createdAt: new Date('2024-03-15T10:00:00.000Z'),
    updatedAt: new Date('2024-03-15T10:00:00.000Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

const MOCK_LEAD_APPROVED: AllianceLead = {
    ...MOCK_LEAD_PENDING,
    id: 'lead-uuid-002',
    kind: 'sponsor',
    contactName: 'María García',
    email: 'maria@example.com',
    status: 'approved'
};

const MOCK_PAGE_RESPONSE = {
    data: {
        success: true,
        data: {
            items: [MOCK_LEAD_PENDING, MOCK_LEAD_APPROVED],
            pagination: { total: 2, page: 1, pageSize: 20, totalPages: 1 }
        }
    },
    status: 200
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates an isolated QueryClient wrapper with retries disabled. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

/** Renders `AllianceLeadInbox` inside the QueryClientProvider wrapper. */
function renderInbox() {
    return render(React.createElement(AllianceLeadInbox), { wrapper: createWrapper() });
}

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: inbox renders the lead list
// ---------------------------------------------------------------------------

describe('AllianceLeadInbox — renders lead list', () => {
    it('renders contact names for fetched leads', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
            expect(screen.getByText('María García')).toBeInTheDocument();
        });
    });

    it('renders email addresses for each lead', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('juan@example.com')).toBeInTheDocument();
        });
    });

    it('renders the kind label for each lead', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.allianceLeads.kind.partner')
            ).toBeInTheDocument();
            expect(
                screen.getByText('admin-entities.allianceLeads.kind.sponsor')
            ).toBeInTheDocument();
        });
    });

    it('calls the list API with default page=1 params', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: expect.stringContaining('/api/v1/admin/alliance/leads')
                })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: kind + status filters
// ---------------------------------------------------------------------------

describe('AllianceLeadInbox — filters', () => {
    it('re-fetches with the selected kind when the kind filter changes', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const kindSelect = screen.getByLabelText(
            'admin-entities.allianceLeads.filter.kindLabel'
        ) as HTMLSelectElement;
        fireEvent.change(kindSelect, { target: { value: 'sponsor' } });

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: expect.stringContaining('kind=sponsor')
                })
            );
        });
    });

    it('re-fetches with the selected status when the status filter changes', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const statusSelect = screen.getByLabelText(
            'admin-entities.allianceLeads.filter.statusLabel'
        ) as HTMLSelectElement;
        fireEvent.change(statusSelect, { target: { value: 'approved' } });

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: expect.stringContaining('status=approved')
                })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: handle dialog submit
// ---------------------------------------------------------------------------

describe('AllianceLeadInbox — handle dialog', () => {
    it('calls mark-handled mutation with approved status when user clicks Confirm', async () => {
        mockedFetchApi
            // First call → list query
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE)
            // Second call → mark-handled POST
            .mockResolvedValueOnce({
                data: { success: true, data: { ...MOCK_LEAD_PENDING, status: 'approved' } },
                status: 200
            })
            // Third call → list invalidation re-fetch
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE);

        renderInbox();

        // Wait for table to render
        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        // Click the first "Handle" button (for MOCK_LEAD_PENDING)
        const handleButtons = screen.getAllByText('admin-entities.allianceLeads.actions.handle');
        fireEvent.click(handleButtons[0]);

        // Dialog appears
        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.allianceLeads.handle.title')
            ).toBeInTheDocument();
        });

        // Submit (default radio is "approved")
        const submitBtn = screen.getByText('admin-entities.allianceLeads.handle.submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/alliance/leads/${MOCK_LEAD_PENDING.id}/mark-handled`,
                    method: 'POST',
                    body: expect.objectContaining({ status: 'approved' })
                })
            );
        });
    });

    it('calls mark-handled with rejected status when user selects Reject', async () => {
        mockedFetchApi
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE)
            .mockResolvedValueOnce({
                data: { success: true, data: { ...MOCK_LEAD_PENDING, status: 'rejected' } },
                status: 200
            })
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const handleButtons = screen.getAllByText('admin-entities.allianceLeads.actions.handle');
        fireEvent.click(handleButtons[0]);

        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.allianceLeads.handle.title')
            ).toBeInTheDocument();
        });

        // Select "Reject" radio
        const rejectRadio = screen.getByDisplayValue('rejected');
        fireEvent.click(rejectRadio);

        const submitBtn = screen.getByText('admin-entities.allianceLeads.handle.submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/alliance/leads/${MOCK_LEAD_PENDING.id}/mark-handled`,
                    method: 'POST',
                    body: expect.objectContaining({ status: 'rejected' })
                })
            );
        });
    });

    it('includes the admin note in the mark-handled payload when provided', async () => {
        mockedFetchApi
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE)
            .mockResolvedValueOnce({
                data: { success: true, data: { ...MOCK_LEAD_PENDING, status: 'approved' } },
                status: 200
            })
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const handleButtons = screen.getAllByText('admin-entities.allianceLeads.actions.handle');
        fireEvent.click(handleButtons[0]);

        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.allianceLeads.handle.title')
            ).toBeInTheDocument();
        });

        const noteInput = screen.getByLabelText('admin-entities.allianceLeads.handle.noteLabel');
        fireEvent.change(noteInput, { target: { value: 'Looks like a solid partner.' } });

        const submitBtn = screen.getByText('admin-entities.allianceLeads.handle.submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/alliance/leads/${MOCK_LEAD_PENDING.id}/mark-handled`,
                    method: 'POST',
                    body: expect.objectContaining({
                        status: 'approved',
                        adminNote: 'Looks like a solid partner.'
                    })
                })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: NO auto-provisioning action (HOS-277 NG-1)
// ---------------------------------------------------------------------------

describe('AllianceLeadInbox — no auto-provisioning action', () => {
    it('never renders an "approve & provision" or "provision owner" button', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        expect(screen.queryByText(/approve.*provision/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/provision.*owner/i)).not.toBeInTheDocument();
        expect(mockedFetchApi).not.toHaveBeenCalledWith(
            expect.objectContaining({
                path: expect.stringContaining('provision')
            })
        );
    });
});
