/**
 * RTL tests for OverrideRow + RolePermissionBadge (SPEC-170 / T-026).
 *
 * `useTranslations` is mocked to an identity (`t: (key) => key`) following the
 * admin component-test convention, so assertions target the translation KEYS
 * (the `admin-pages` namespace is not loaded in the jsdom i18n bundle).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es',
        tPlural: (key: string) => key
    })
}));

import { OverrideRow } from '@/features/users/components/permissions/OverrideRow';
import { RolePermissionBadge } from '@/features/users/components/permissions/RolePermissionBadge';
import { PermissionEffectEnum, PermissionEnum } from '@repo/schemas';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../helpers/render-with-providers';

const K = 'admin-pages.access.users.permissions';
const REMOVE_LABEL = `${K}.removeOverride`;

describe('RolePermissionBadge', () => {
    it('renders the permission with an inherited label', () => {
        renderWithProviders(<RolePermissionBadge permission={PermissionEnum.POST_CREATE} />);

        expect(screen.getByText(PermissionEnum.POST_CREATE)).toBeInTheDocument();
        expect(screen.getByText(`${K}.inheritedFromRole`)).toBeInTheDocument();
    });
});

describe('OverrideRow', () => {
    it('renders a grant override with the granted badge', () => {
        renderWithProviders(
            <OverrideRow
                permission={PermissionEnum.POST_CREATE}
                effect={PermissionEffectEnum.GRANT}
                onRemove={vi.fn()}
            />
        );

        expect(screen.getByText(PermissionEnum.POST_CREATE)).toBeInTheDocument();
        expect(screen.getByText(`${K}.effectGrant`)).toBeInTheDocument();
    });

    it('renders a deny override with the denied badge', () => {
        renderWithProviders(
            <OverrideRow
                permission={PermissionEnum.USER_DELETE}
                effect={PermissionEffectEnum.DENY}
                onRemove={vi.fn()}
            />
        );

        expect(screen.getByText(`${K}.effectDeny`)).toBeInTheDocument();
    });

    it('calls onRemove only after confirming in the dialog', async () => {
        const onRemove = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(
            <OverrideRow
                permission={PermissionEnum.POST_CREATE}
                effect={PermissionEffectEnum.GRANT}
                onRemove={onRemove}
            />
        );

        await user.click(screen.getByRole('button', { name: REMOVE_LABEL }));
        expect(onRemove).not.toHaveBeenCalled();

        const dialog = await screen.findByRole('alertdialog');
        await user.click(within(dialog).getByRole('button', { name: REMOVE_LABEL }));

        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('disables the remove trigger while removing', () => {
        renderWithProviders(
            <OverrideRow
                permission={PermissionEnum.POST_CREATE}
                effect={PermissionEffectEnum.GRANT}
                onRemove={vi.fn()}
                isRemoving
            />
        );

        expect(screen.getByRole('button', { name: REMOVE_LABEL })).toBeDisabled();
    });
});
