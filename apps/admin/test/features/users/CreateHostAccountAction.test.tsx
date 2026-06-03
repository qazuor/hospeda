/**
 * Tests for CreateHostAccountAction (SPEC-182 T-012).
 *
 * Covers the acceptance criteria:
 *  - the action is HIDDEN for actors without USER_CREATE,
 *  - it is shown (button) for actors with USER_CREATE,
 *  - the modal validates name/email/password before submitting,
 *  - a valid submit POSTs to the admin signup-as-host endpoint.
 *
 * @module test/features/users/CreateHostAccountAction
 */

import { CreateHostAccountAction } from '@/features/users/components/CreateHostAccountAction';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-user-permissions', () => ({
    useHasPermission: vi.fn()
}));

// Identity mock so assertions target translation keys (project convention).
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es',
        tPlural: (key: string) => key
    })
}));

const addToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast })
}));

vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

const mockUseHasPermission = vi.mocked(useHasPermission);
const mockFetchApi = vi.mocked(fetchApi);

const renderWithClient = (ui: ReactElement) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.clearAllMocks();
});

const K = 'admin-common.createHost';

describe('CreateHostAccountAction', () => {
    it('renders nothing when the actor lacks USER_CREATE', () => {
        mockUseHasPermission.mockReturnValue(false);

        const { container } = renderWithClient(<CreateHostAccountAction />);

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('button', { name: `${K}.trigger` })).not.toBeInTheDocument();
    });

    it('renders the trigger button when the actor has USER_CREATE', () => {
        mockUseHasPermission.mockReturnValue(true);

        renderWithClient(<CreateHostAccountAction />);

        expect(screen.getByRole('button', { name: `${K}.trigger` })).toBeInTheDocument();
    });

    it('shows validation errors and does not call the API on an empty submit', async () => {
        mockUseHasPermission.mockReturnValue(true);

        renderWithClient(<CreateHostAccountAction />);
        fireEvent.click(screen.getByRole('button', { name: `${K}.trigger` }));

        // Submit the empty form (the dialog's primary button).
        fireEvent.click(screen.getByRole('button', { name: `${K}.submit` }));

        await waitFor(() => {
            expect(screen.getByText(`${K}.nameRequired`)).toBeInTheDocument();
        });
        expect(screen.getByText(`${K}.emailInvalid`)).toBeInTheDocument();
        expect(screen.getByText(`${K}.passwordTooShort`)).toBeInTheDocument();
        expect(mockFetchApi).not.toHaveBeenCalled();
    });

    it('POSTs to the admin signup-as-host endpoint on a valid submit', async () => {
        mockUseHasPermission.mockReturnValue(true);
        mockFetchApi.mockResolvedValue({
            data: { success: true, data: { user: { id: 'u1', email: 'h@x.com', role: 'HOST' } } },
            status: 201
        } as never);

        renderWithClient(<CreateHostAccountAction />);
        fireEvent.click(screen.getByRole('button', { name: `${K}.trigger` }));

        fireEvent.change(screen.getByLabelText(`${K}.nameLabel`), {
            target: { value: 'New Host' }
        });
        fireEvent.change(screen.getByLabelText(`${K}.emailLabel`), {
            target: { value: 'host@example.com' }
        });
        fireEvent.change(screen.getByLabelText(`${K}.passwordLabel`), {
            target: { value: 'password123' }
        });

        fireEvent.click(screen.getByRole('button', { name: `${K}.submit` }));

        await waitFor(() => {
            expect(mockFetchApi).toHaveBeenCalledTimes(1);
        });
        expect(mockFetchApi).toHaveBeenCalledWith({
            path: '/api/v1/admin/auth/signup-as-host',
            method: 'POST',
            body: { name: 'New Host', email: 'host@example.com', password: 'password123' }
        });
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    });
});
