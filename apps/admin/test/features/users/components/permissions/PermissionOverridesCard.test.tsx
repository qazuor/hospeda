import type { UserPermissionOverridesResponse } from '@repo/schemas';
/**
 * RTL tests for PermissionOverridesCard (SPEC-170 / T-028).
 *
 * The data + mutation hooks are mocked so the card's states (loading, error,
 * empty, populated) and the revoke flow can be driven deterministically.
 * `useTranslations` is mocked to identity (assertions target translation keys).
 */
import { describe, expect, it, vi } from 'vitest';

const { overrides, assignMutate, revokeMutate } = vi.hoisted(() => ({
    overrides: {
        value: { data: undefined, isLoading: false, isError: false } as {
            data: UserPermissionOverridesResponse | undefined;
            isLoading: boolean;
            isError: boolean;
        }
    },
    assignMutate: vi.fn(),
    revokeMutate: vi.fn()
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es',
        tPlural: (key: string) => key
    })
}));

vi.mock('@/features/users/hooks/useUserPermissionOverrides', () => ({
    useUserPermissionOverrides: () => overrides.value,
    useAssignUserPermission: () => ({ mutateAsync: assignMutate, isPending: false }),
    useRevokeUserPermission: () => ({ mutateAsync: revokeMutate, isPending: false })
}));

import { PermissionOverridesCard } from '@/features/users/components/permissions/PermissionOverridesCard';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach } from 'vitest';
import { renderWithProviders } from '../../../../helpers/render-with-providers';

const K = 'admin-pages.access.users.permissions';

beforeEach(() => {
    overrides.value = { data: undefined, isLoading: false, isError: false };
    assignMutate.mockReset().mockResolvedValue({ assigned: true });
    revokeMutate.mockReset().mockResolvedValue({ removed: true });
});

describe('PermissionOverridesCard', () => {
    it('renders the loading indicator while fetching', () => {
        overrides.value = { data: undefined, isLoading: true, isError: false };
        renderWithProviders(<PermissionOverridesCard userId="u1" />);

        expect(screen.getByText('…')).toBeInTheDocument();
    });

    it('renders an error message when the query fails', () => {
        overrides.value = { data: undefined, isLoading: false, isError: true };
        renderWithProviders(<PermissionOverridesCard userId="u1" />);

        expect(screen.getByText(`${K}.error`)).toBeInTheDocument();
    });

    it('renders the empty state and the picker when there are no overrides', () => {
        overrides.value = {
            data: { fromRole: [], grantOverrides: [], denyOverrides: [] },
            isLoading: false,
            isError: false
        };
        renderWithProviders(<PermissionOverridesCard userId="u1" />);

        expect(screen.getByText(`${K}.noDirectOverrides`)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: `${K}.addOverride` })).toBeInTheDocument();
    });

    it('lists grant and deny overrides', () => {
        overrides.value = {
            data: {
                fromRole: [],
                grantOverrides: ['post.create'],
                denyOverrides: ['user.delete']
            } as unknown as UserPermissionOverridesResponse,
            isLoading: false,
            isError: false
        };
        renderWithProviders(<PermissionOverridesCard userId="u1" />);

        expect(screen.getByText(`${K}.grantOverrides`)).toBeInTheDocument();
        expect(screen.getByText(`${K}.denyOverrides`)).toBeInTheDocument();
        expect(screen.getByText('post.create')).toBeInTheDocument();
        expect(screen.getByText('user.delete')).toBeInTheDocument();
    });

    it('revokes an override after confirming', async () => {
        overrides.value = {
            data: {
                fromRole: [],
                grantOverrides: ['post.create'],
                denyOverrides: []
            } as unknown as UserPermissionOverridesResponse,
            isLoading: false,
            isError: false
        };
        const user = userEvent.setup();
        renderWithProviders(<PermissionOverridesCard userId="u1" />);

        await user.click(screen.getByRole('button', { name: `${K}.removeOverride` }));
        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: `${K}.removeOverride` }));

        expect(revokeMutate).toHaveBeenCalledWith('post.create');
    });
});
