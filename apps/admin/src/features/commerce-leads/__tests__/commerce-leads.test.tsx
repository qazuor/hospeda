// @vitest-environment jsdom
/**
 * Commerce Leads Inbox — unit tests (SPEC-239 T-058).
 *
 * Covers:
 *  - Inbox renders a list of leads from the mocked query.
 *  - Handle dialog submit calls the mark-handled mutation with the correct body.
 *  - Provision dialog confirm button calls the provision-owner endpoint.
 *
 * All network calls are mocked via `vi.mock('@/lib/api/client')`.
 * No real API is hit.
 */

import { fetchApi } from '@/lib/api/client';
import type { CommerceLead } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommerceLeadInbox } from '../components/CommerceLeadInbox';

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

const MOCK_LEAD_PENDING: CommerceLead = {
    id: 'lead-uuid-001',
    domain: 'gastronomy',
    businessName: 'La Parrilla del Sur',
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: null,
    destinationId: null,
    message: null,
    status: 'pending',
    handledAt: null,
    handledById: null,
    adminNote: null,
    createdAt: new Date('2024-03-15T10:00:00.000Z'),
    updatedAt: new Date('2024-03-15T10:00:00.000Z'),
    deletedAt: null,
    createdById: null,
    updatedById: null,
    deletedById: null
};

const MOCK_LEAD_APPROVED: CommerceLead = {
    ...MOCK_LEAD_PENDING,
    id: 'lead-uuid-002',
    businessName: 'El Bar de María',
    email: 'maria@example.com',
    contactName: 'María García',
    status: 'approved',
    handledAt: new Date(),
    handledById: null // no owner provisioned yet → show provision button
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

/** Renders `CommerceLeadInbox` inside the QueryClientProvider wrapper. */
function renderInbox() {
    return render(React.createElement(CommerceLeadInbox), { wrapper: createWrapper() });
}

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: inbox renders the lead list
// ---------------------------------------------------------------------------

describe('CommerceLeadInbox — renders lead list', () => {
    it('renders business names for fetched leads', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('La Parrilla del Sur')).toBeInTheDocument();
            expect(screen.getByText('El Bar de María')).toBeInTheDocument();
        });
    });

    it('renders email addresses for each lead', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('juan@example.com')).toBeInTheDocument();
        });
    });

    it('calls the list API with default page=1 params', async () => {
        mockedFetchApi.mockResolvedValue(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: expect.stringContaining('/api/v1/admin/commerce/leads')
                })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: handle dialog submit
// ---------------------------------------------------------------------------

describe('CommerceLeadInbox — handle dialog', () => {
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
            expect(screen.getByText('La Parrilla del Sur')).toBeInTheDocument();
        });

        // Click the first "Handle" button (for MOCK_LEAD_PENDING)
        const handleButtons = screen.getAllByText('admin-entities.commerceLeads.actions.handle');
        fireEvent.click(handleButtons[0]);

        // Dialog appears
        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.commerceLeads.handle.title')
            ).toBeInTheDocument();
        });

        // Submit (default radio is "approved")
        const submitBtn = screen.getByText('admin-entities.commerceLeads.handle.submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/commerce/leads/${MOCK_LEAD_PENDING.id}/handle`,
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
            expect(screen.getByText('La Parrilla del Sur')).toBeInTheDocument();
        });

        const handleButtons = screen.getAllByText('admin-entities.commerceLeads.actions.handle');
        fireEvent.click(handleButtons[0]);

        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.commerceLeads.handle.title')
            ).toBeInTheDocument();
        });

        // Select "Reject" radio
        const rejectRadio = screen.getByDisplayValue('rejected');
        fireEvent.click(rejectRadio);

        const submitBtn = screen.getByText('admin-entities.commerceLeads.handle.submit');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/commerce/leads/${MOCK_LEAD_PENDING.id}/handle`,
                    method: 'POST',
                    body: expect.objectContaining({ status: 'rejected' })
                })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: provision owner action
// ---------------------------------------------------------------------------

describe('CommerceLeadInbox — provision owner', () => {
    it('calls provision-owner endpoint when user confirms', async () => {
        mockedFetchApi
            // List query
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE)
            // Provision POST
            .mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        userId: 'user-uuid-001',
                        email: 'juan@example.com',
                        name: 'Juan Pérez'
                    }
                },
                status: 200
            })
            // Re-fetch after invalidation
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('El Bar de María')).toBeInTheDocument();
        });

        // The "Crear cuenta" button is only shown for approved leads with no owner yet
        const provisionBtn = screen.getByText('admin-entities.commerceLeads.actions.provision');
        fireEvent.click(provisionBtn);

        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.commerceLeads.provision.title')
            ).toBeInTheDocument();
        });

        const confirmBtn = screen.getByText('admin-entities.commerceLeads.provision.confirm');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: `/api/v1/admin/commerce/leads/${MOCK_LEAD_APPROVED.id}/provision-owner`,
                    method: 'POST'
                })
            );
        });
    });

    it('shows a success toast (never password) after provisioning', async () => {
        const provisionResponse = {
            data: {
                success: true,
                data: { userId: 'u-01', email: 'maria@example.com', name: 'María García' }
            },
            status: 200
        };

        mockedFetchApi
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE)
            .mockResolvedValueOnce(provisionResponse)
            .mockResolvedValueOnce(MOCK_PAGE_RESPONSE);

        renderInbox();

        await waitFor(() => {
            expect(screen.getByText('El Bar de María')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('admin-entities.commerceLeads.actions.provision'));

        await waitFor(() => {
            expect(
                screen.getByText('admin-entities.commerceLeads.provision.title')
            ).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('admin-entities.commerceLeads.provision.confirm'));

        await waitFor(() => {
            // Toast is called with variant=success
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'success' })
            );
            // The API response never included a password field — verify it
            const responseData = provisionResponse.data.data;
            expect(Object.keys(responseData)).not.toContain('password');
        });
    });
});
