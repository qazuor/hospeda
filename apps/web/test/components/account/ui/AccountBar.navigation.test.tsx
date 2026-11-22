/**
 * Regression tests for HOS-2541: a link tapped inside the mobile account drawer
 * must navigate. The drawer used to close synchronously while the shared Dialog
 * held a history entry, so its `history.go(-1)` unwind raced the ClientRouter
 * navigation and the page loaded forever. The bar now owns the entry, releases
 * it first and navigates after the unwind settles.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountBar, buildSidebarView } from '../../../../src/components/account/ui';
import { buildAccountNavModel } from '../../../../src/lib/account-nav-model';

const calls = vi.hoisted(() => ({ order: [] as string[], navigate: vi.fn(), acquire: vi.fn() }));

vi.mock('../../../../src/lib/dialog-history', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../src/lib/dialog-history')>()),
    acquireDialogHistoryEntry: (params: { onPopped: () => void }) => {
        calls.acquire(params);
        return { release: () => calls.order.push('release') };
    }
}));
vi.mock('astro:transitions/client', () => ({
    navigate: (href: string) => {
        calls.order.push('navigate');
        calls.navigate(href);
        return Promise.resolve();
    }
}));
vi.mock('../../../../src/components/shared/whats-new/WhatsNewCountPill.client', () => ({
    WhatsNewCountPill: () => null
}));
vi.mock('../../../../src/components/host/host-trades/BenefitUsagesCountPill.client', () => ({
    BenefitUsagesCountPill: () => null
}));

const view = buildSidebarView({
    model: buildAccountNavModel({
        roles: ['HOST'],
        ownsHostTradeListing: false,
        mcpEnabled: false,
        activeSection: 'editar'
    }),
    locale: 'es'
});

async function openDrawer() {
    const user = userEvent.setup();
    render(
        <AccountBar
            view={view}
            locale="es"
        />
    );
    await user.click(screen.getByRole('button', { name: /Mi cuenta/ }));
    const dialog = await screen.findByRole('dialog');
    const link = dialog.querySelector('a') as HTMLAnchorElement;
    return { user, dialog, link };
}

describe('AccountBar drawer navigation (HOS-2541)', () => {
    beforeEach(() => {
        calls.order.length = 0;
        calls.navigate.mockClear();
        calls.acquire.mockClear();
    });

    it('owns exactly one history entry while the drawer is open', async () => {
        await openDrawer();
        expect(calls.acquire).toHaveBeenCalledTimes(1);
    });

    it('releases the history entry, then navigates to the tapped link', async () => {
        const { link } = await openDrawer();
        const notPrevented = fireEvent.click(link);
        expect(notPrevented).toBe(false);
        await waitFor(() => expect(calls.navigate).toHaveBeenCalledWith(link.href));
        expect(calls.order.indexOf('release')).toBeGreaterThanOrEqual(0);
        expect(calls.order.indexOf('release')).toBeLessThan(calls.order.indexOf('navigate'));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('navigates once even when popstate fires before the timeout', async () => {
        const { link } = await openDrawer();
        fireEvent.click(link);
        window.dispatchEvent(new PopStateEvent('popstate'));
        await waitFor(() => expect(calls.navigate).toHaveBeenCalledTimes(1));
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(calls.navigate).toHaveBeenCalledTimes(1);
    });

    it('does not intercept modified clicks', async () => {
        const { link } = await openDrawer();
        const notPrevented = fireEvent.click(link, { ctrlKey: true });
        expect(notPrevented).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(calls.navigate).not.toHaveBeenCalled();
    });

    it('does not intercept target=_blank links', async () => {
        const { link } = await openDrawer();
        link.target = '_blank';
        const notPrevented = fireEvent.click(link);
        expect(notPrevented).toBe(true);
        expect(calls.navigate).not.toHaveBeenCalled();
    });
});
