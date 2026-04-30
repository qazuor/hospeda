// @vitest-environment jsdom
/**
 * Tests for DeleteOwnTagDialog component.
 *
 * Covers:
 * - Dialog shows impact count fetched from API (AC-003-04)
 * - Confirm button calls onConfirm (AC-003-04)
 * - Cancel button closes dialog without calling onConfirm (AC-003-04)
 * - Confirm button disabled while isDeleting is true
 * - Cancel button disabled while isDeleting is true
 * - Tag name shown in confirmation message
 *
 * Uses MSW to mock `/api/v1/admin/tags/own/:id/impact` responses.
 * TanStack Query is wrapped with a fresh QueryClient per test.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../../test/mocks/server';
import { DeleteOwnTagDialog } from '../DeleteOwnTagDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
}

function Wrapper({ children }: { readonly children: ReactNode }) {
    const qc = makeQueryClient();
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const API_BASE = 'http://localhost:3001/api/v1';

const mockImpactResponse = (count: number) => ({
    success: true,
    data: { count }
});

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const TAG_ID = '00000000-0000-0000-0000-000000000002';
const TAG_NAME = 'Revisar después';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeleteOwnTagDialog', () => {
    /**
     * AC-003-04: Dialog shows impact count from API.
     */
    it('shows the impact count from the API once loaded', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(5))
            )
        );

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('5 entidades');
        });
    });

    /**
     * Singular "entidad" when impact count is 1.
     */
    it('uses singular "entidad" when impact count is 1', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(1))
            )
        );

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('1 entidad');
        });
    });

    /**
     * Impact count 0 (tag not applied anywhere).
     */
    it('shows 0 entidades when tag is unused', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(0))
            )
        );

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('0 entidades');
        });
    });

    /**
     * AC-003-04: Confirm button calls onConfirm.
     */
    it('calls onConfirm when confirm button is clicked', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(3))
            )
        );

        const onConfirm = vi.fn();
        const user = userEvent.setup();

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={onConfirm}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('confirm-button'));

        expect(onConfirm).toHaveBeenCalledOnce();
    });

    /**
     * AC-003-04: Cancel does not call onConfirm.
     */
    it('calls onOpenChange(false) and NOT onConfirm when cancel is clicked', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(2))
            )
        );

        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        const user = userEvent.setup();

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={onOpenChange}
                    onConfirm={onConfirm}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('cancel-button'));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    /**
     * Confirm button disabled while isDeleting is true.
     */
    it('disables the confirm button when isDeleting is true', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(1))
            )
        );

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={true}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('confirm-button')).toBeDisabled();
        });
    });

    /**
     * Cancel button disabled while isDeleting is true.
     */
    it('disables the cancel button when isDeleting is true', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(0))
            )
        );

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName={TAG_NAME}
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={true}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('cancel-button')).toBeDisabled();
        });
    });

    /**
     * Tag name appears in the dialog message.
     */
    it('displays the tag name in the confirmation message', async () => {
        server.use(
            http.get(`${API_BASE}/admin/tags/own/${TAG_ID}/impact`, () =>
                HttpResponse.json(mockImpactResponse(0))
            )
        );

        render(
            <Wrapper>
                <DeleteOwnTagDialog
                    tagId={TAG_ID}
                    tagName="VIP Cliente"
                    open={true}
                    onOpenChange={vi.fn()}
                    onConfirm={vi.fn()}
                    isDeleting={false}
                    trigger={<button type="button">Eliminar</button>}
                />
            </Wrapper>
        );

        await waitFor(() => {
            expect(screen.getByTestId('impact-message')).toHaveTextContent('VIP Cliente');
        });
    });
});
