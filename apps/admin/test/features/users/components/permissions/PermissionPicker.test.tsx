/**
 * RTL tests for PermissionPicker (SPEC-170 / T-027).
 *
 * `useTranslations` is mocked to identity so assertions target translation keys.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es',
        tPlural: (key: string) => key
    })
}));

import { PermissionPicker } from '@/features/users/components/permissions/PermissionPicker';
import { PermissionEnum } from '@repo/schemas';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../helpers/render-with-providers';

const K = 'admin-pages.access.users.permissions';

/** Locates the CommandItem row that displays the given permission value. */
const rowOf = (permission: string): HTMLElement => {
    const label = screen.getByText(permission);
    const item = label.closest('[cmdk-item]') ?? label.parentElement?.parentElement;
    if (!item) throw new Error(`row not found for ${permission}`);
    return item as HTMLElement;
};

const renderPicker = (onAssign = vi.fn()) => {
    renderWithProviders(
        <PermissionPicker
            fromRole={[PermissionEnum.POST_UPDATE]}
            grantOverrides={[PermissionEnum.POST_DELETE]}
            denyOverrides={[PermissionEnum.USER_DELETE]}
            onAssign={onAssign}
        />
    );
    return { onAssign };
};

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: `${K}.addOverride` }));
    // Wait for the dialog content (command input) to mount.
    await screen.findByPlaceholderText(`${K}.searchPermissions`);
};

// The dialog mounts a cmdk CommandList over the full PermissionEnum set (~333
// items), so each `userEvent` interaction re-runs cmdk scoring and is genuinely
// heavy to render. It clears 5s locally, but the self-hosted CI runner (single
// job, loaded) pushes these past the 5s default and they time out. Raise the
// per-suite timeout to give the heavy render headroom on a slow runner.
describe('PermissionPicker', () => {
    it('opens the dialog from the trigger', async () => {
        const user = userEvent.setup();
        renderPicker();

        expect(screen.queryByPlaceholderText(`${K}.searchPermissions`)).not.toBeInTheDocument();
        await openPicker(user);
        expect(screen.getByPlaceholderText(`${K}.searchPermissions`)).toBeInTheDocument();
    });

    it('grants a grantable permission (effect=grant)', async () => {
        const user = userEvent.setup();
        const { onAssign } = renderPicker();
        await openPicker(user);

        const row = rowOf(PermissionEnum.POST_CREATE);
        await user.click(within(row).getByRole('button', { name: `${K}.grantPermission` }));

        expect(onAssign).toHaveBeenCalledWith({
            permission: PermissionEnum.POST_CREATE,
            effect: 'grant'
        });
    });

    it('denies a role-inherited permission (effect=deny)', async () => {
        const user = userEvent.setup();
        const { onAssign } = renderPicker();
        await openPicker(user);

        const row = rowOf(PermissionEnum.POST_UPDATE);
        await user.click(within(row).getByRole('button', { name: `${K}.denyPermission` }));

        expect(onAssign).toHaveBeenCalledWith({
            permission: PermissionEnum.POST_UPDATE,
            effect: 'deny'
        });
    });

    it('shows existing grant/deny overrides as non-actionable badges', async () => {
        const user = userEvent.setup();
        renderPicker();
        await openPicker(user);

        const grantRow = rowOf(PermissionEnum.POST_DELETE);
        expect(within(grantRow).getByText(`${K}.effectGrant`)).toBeInTheDocument();
        expect(
            within(grantRow).queryByRole('button', { name: `${K}.grantPermission` })
        ).not.toBeInTheDocument();

        const denyRow = rowOf(PermissionEnum.USER_DELETE);
        expect(within(denyRow).getByText(`${K}.effectDeny`)).toBeInTheDocument();
    });

    it('flags broad/sensitive permissions with a warning', async () => {
        const user = userEvent.setup();
        renderPicker();
        await openPicker(user);

        // SENSITIVE_RE matches *.hardDelete / *.viewAll / *.readAll — at least one exists.
        expect(screen.getAllByLabelText(`${K}.sensitivePermissionWarning`).length).toBeGreaterThan(
            0
        );
    });
}, 20000);
