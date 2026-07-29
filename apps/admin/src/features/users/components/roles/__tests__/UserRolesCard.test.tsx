// @vitest-environment jsdom
/**
 * UserRolesCard — component tests (HOS-296 AC-10).
 *
 * What is worth pinning here is the part the retired single-`SELECT` could
 * never do:
 *
 *  - It renders the FULL role set, not one value, and shows each hat's
 *    provenance — when it was granted and by whom (§6.5 / §8, the R-1
 *    mitigation). An automatic grant must read differently from an operator's.
 *  - Granting is ADDITIVE: the POST body carries only the new role, so nothing
 *    in this component can express "replace the user's role".
 *  - The last hat cannot be revoked (AC-5) — the control is disabled rather
 *    than letting the operator discover the rule through a failed request.
 *  - Already-held roles are not offered again, and `SYSTEM`/`GUEST` are never
 *    offered at all.
 *
 * Network is mocked at `@/lib/api/client`. Radix's `Select` is stubbed with a
 * plain `<select>`: its pointer-event machinery does not work under jsdom and
 * this test only needs the chosen value to reach the POST body.
 */

import { LAST_ROLE_REVOKE_REASON, type UserRoleGrantsResponse } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { UserRolesCard } from '../UserRolesCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

vi.mock('@/components/ui/select', () => ({
    Select: ({
        value,
        onValueChange,
        disabled,
        children
    }: {
        readonly value: string;
        readonly onValueChange: (value: string) => void;
        readonly disabled?: boolean;
        readonly children: React.ReactNode;
    }) => (
        <select
            data-testid="role-select-stub"
            value={value}
            disabled={disabled}
            onChange={(event) => onValueChange(event.target.value)}
        >
            <option value="">-- select --</option>
            {children}
        </select>
    ),
    SelectTrigger: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    SelectItem: ({
        value,
        children
    }: {
        readonly value: string;
        readonly children: React.ReactNode;
    }) => <option value={value}>{children}</option>
}));

// The confirmation dialog is Radix and does not open under jsdom without
// pointer events; render the trigger and the action inline so the revoke path
// is reachable. The dialog's own behaviour is Radix's concern, not ours.
vi.mock('@/components/ui/alert-dialog', () => ({
    AlertDialog: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTrigger: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    AlertDialogContent: ({ children }: { readonly children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    AlertDialogHeader: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    AlertDialogFooter: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    AlertDialogTitle: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
    AlertDialogDescription: ({ children }: { readonly children: React.ReactNode }) => (
        <>{children}</>
    ),
    AlertDialogCancel: ({ children }: { readonly children: React.ReactNode }) => (
        <button type="button">{children}</button>
    ),
    AlertDialogAction: ({
        children,
        onClick
    }: {
        readonly children: React.ReactNode;
        readonly onClick?: () => void;
    }) => (
        <button
            type="button"
            data-testid="confirm-revoke"
            onClick={onClick}
        >
            {children}
        </button>
    )
}));

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

const TWO_HATS: UserRoleGrantsResponse = {
    userId: USER_ID,
    roles: [
        {
            role: 'USER',
            grantedAt: new Date('2026-01-05T10:00:00.000Z'),
            grantedBy: null,
            grantedByName: null,
            grantReason: 'signup'
        },
        {
            role: 'HOST',
            grantedAt: new Date('2026-03-01T12:00:00.000Z'),
            grantedBy: ADMIN_ID,
            grantedByName: 'Ada Admin',
            grantReason: 'accommodation_activated'
        }
    ]
} as UserRoleGrantsResponse;

const ONE_HAT: UserRoleGrantsResponse = {
    userId: USER_ID,
    roles: [TWO_HATS.roles[0]]
} as UserRoleGrantsResponse;

const renderCard = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <UserRolesCard userId={USER_ID} />
        </QueryClientProvider>
    );
};

/** Stubs the GET, leaving mutations to be configured per test. */
const stubRoles = (payload: UserRoleGrantsResponse): void => {
    mockedFetchApi.mockImplementation(async (args: unknown) => {
        const { method } = (args ?? {}) as { method?: string };
        if (!method || method === 'GET') {
            return { data: { success: true, data: payload } } as never;
        }
        return {
            data: {
                success: true,
                data: { userId: USER_ID, role: 'SPONSOR', roles: ['USER', 'HOST', 'SPONSOR'] }
            }
        } as never;
    });
};

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserRolesCard (HOS-296)', () => {
    it('renders EVERY held role, not a single value', async () => {
        stubRoles(TWO_HATS);
        renderCard();

        await waitFor(() => {
            expect(screen.getByText('admin-pages.access.roles.catalog.USER.name')).toBeTruthy();
        });
        expect(screen.getByText('admin-pages.access.roles.catalog.HOST.name')).toBeTruthy();
    });

    it('shows the provenance of each hat, distinguishing automatic from operator grants', async () => {
        stubRoles(TWO_HATS);
        const { container } = renderCard();

        await waitFor(() => {
            expect(screen.getByText('admin-pages.access.roles.catalog.HOST.name')).toBeTruthy();
        });

        // The operator-granted hat names the granter…
        expect(container.textContent).toContain('Ada Admin');
        // …and the automatic one falls back to the "system" label instead of a
        // bare UUID or an empty string.
        expect(container.textContent).toContain('admin-pages.access.users.roles.grantedBySystem');
        // The reason is what explains an accumulated set after the fact (R-1).
        expect(container.textContent).toContain('accommodation_activated');
        expect(container.textContent).toContain('signup');
    });

    it('never offers a role the user already holds, nor SYSTEM/GUEST', async () => {
        stubRoles(TWO_HATS);
        renderCard();

        const select = (await screen.findByTestId('role-select-stub')) as HTMLSelectElement;
        const offered = Array.from(select.options)
            .map((option) => option.value)
            .filter(Boolean);

        expect(offered).not.toContain('USER');
        expect(offered).not.toContain('HOST');
        expect(offered).not.toContain('SYSTEM');
        expect(offered).not.toContain('GUEST');
        expect(offered).toContain('SPONSOR');
        expect(offered).toContain('COMMERCE_OWNER');
    });

    it('grants ADDITIVELY — the POST body carries only the new role', async () => {
        stubRoles(TWO_HATS);
        renderCard();

        const select = (await screen.findByTestId('role-select-stub')) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'SPONSOR' } });
        fireEvent.click(screen.getByText('admin-pages.access.users.roles.grantRole'));

        await waitFor(() => {
            expect(
                mockedFetchApi.mock.calls.some(
                    ([args]) => (args as { method?: string }).method === 'POST'
                )
            ).toBe(true);
        });

        const post = mockedFetchApi.mock.calls
            .map(([args]) => args as { method?: string; path: string; body?: unknown })
            .find((args) => args.method === 'POST');

        expect(post?.path).toBe(`/api/v1/admin/users/${USER_ID}/roles`);
        // No "roles: [...]" replacement payload, and no other hat mentioned.
        expect(post?.body).toEqual({ role: 'SPONSOR' });
    });

    it('sends the operator reason to the audit trail when one is typed', async () => {
        stubRoles(TWO_HATS);
        renderCard();

        const select = (await screen.findByTestId('role-select-stub')) as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'SPONSOR' } });
        fireEvent.change(
            screen.getByLabelText('admin-pages.access.users.roles.reasonPlaceholder'),
            { target: { value: 'sponsors the summer campaign' } }
        );
        fireEvent.click(screen.getByText('admin-pages.access.users.roles.grantRole'));

        await waitFor(() => {
            const post = mockedFetchApi.mock.calls
                .map(([args]) => args as { method?: string; body?: unknown })
                .find((args) => args.method === 'POST');
            expect(post?.body).toEqual({
                role: 'SPONSOR',
                reason: 'sponsors the summer campaign'
            });
        });
    });

    it('revokes through DELETE on the role-scoped path', async () => {
        stubRoles(TWO_HATS);
        renderCard();

        await waitFor(() => {
            expect(screen.getAllByTestId('confirm-revoke').length).toBe(2);
        });

        // Second row is HOST (roles come back oldest-grant-first).
        fireEvent.click(screen.getAllByTestId('confirm-revoke')[1] as HTMLElement);

        await waitFor(() => {
            const del = mockedFetchApi.mock.calls
                .map(([args]) => args as { method?: string; path: string })
                .find((args) => args.method === 'DELETE');
            expect(del?.path).toBe(`/api/v1/admin/users/${USER_ID}/roles/HOST`);
        });
    });

    it('translates the last-role refusal instead of echoing the raw message with its UUID', async () => {
        // Arrange — the API answers 400 with the machine-readable reason. The
        // message is the server's own English text and embeds the subject id;
        // it must reach the logger, never the toast.
        const rawMessage = `Cannot revoke role 'HOST': it is the last role held by user '${USER_ID}'.`;
        mockedFetchApi.mockImplementation(async (args: unknown) => {
            const { method } = (args ?? {}) as { method?: string };
            if (!method || method === 'GET') {
                return { data: { success: true, data: TWO_HATS } } as never;
            }
            throw new ApiError(rawMessage, {
                status: 400,
                code: 'VALIDATION_ERROR',
                body: {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: rawMessage,
                        reason: LAST_ROLE_REVOKE_REASON
                    }
                },
                url: '/api/v1/admin/users/x/roles/HOST',
                method: 'DELETE'
            });
        });
        renderCard();

        await waitFor(() => {
            expect(screen.getAllByTestId('confirm-revoke').length).toBe(2);
        });

        // Act
        fireEvent.click(screen.getAllByTestId('confirm-revoke')[1] as HTMLElement);

        // Assert
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalled();
        });
        const toast = mockAddToast.mock.calls.at(-1)?.[0] as { message?: string };
        expect(toast?.message).toBe('admin-pages.access.users.roles.cannotRevokeLast');
        expect(toast?.message).not.toContain(USER_ID);
    });

    it('disables revoke when only one hat is left (AC-5)', async () => {
        stubRoles(ONE_HAT);
        const { container } = renderCard();

        await waitFor(() => {
            expect(screen.getByText('admin-pages.access.roles.catalog.USER.name')).toBeTruthy();
        });

        const revokeButton = screen.getByLabelText('admin-pages.access.users.roles.revokeRole');
        expect((revokeButton as HTMLButtonElement).disabled).toBe(true);
        // …and the reason is stated, not left for the operator to guess.
        expect(container.textContent).toContain('admin-pages.access.users.roles.cannotRevokeLast');
    });
});
