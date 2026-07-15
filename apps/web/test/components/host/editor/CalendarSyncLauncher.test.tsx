/**
 * @file CalendarSyncLauncher.test.tsx
 * @description Tests for the launcher that collapses the external-calendar sync
 * panel behind a button + modal dialog, with an entitlement-gated upsell
 * (HOS-175 UI changes).
 *
 * Covers:
 * - The panel is hidden by default; only the open button shows.
 * - With the entitlement: clicking opens the connect dialog + mounts the panel.
 * - Without the entitlement: clicking opens the upgrade-nudge dialog (never the
 *   connect panel), with a CTA linking to the plans page.
 * - Closing (Esc) hides the dialog again.
 * - The connect dialog auto-opens when returning from Google OAuth
 *   (?calendarSync=...) or via the broken-feed email link (#calendar-sync).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarSyncLauncher } from '@/components/host/editor/CalendarSyncLauncher.client';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockHas } = vi.hoisted(() => ({ mockHas: vi.fn() }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: mockHas,
        limit: () => -1,
        plan: null,
        isLoading: false,
        error: null
    })
}));

vi.mock('@/components/host/editor/CalendarSyncLauncher.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// The panel itself is covered by its own suite — stub it so this suite stays
// focused on the launcher's button + dialog + entitlement behaviour and never
// touches the entitlements hook or calendar-sync API.
vi.mock('@/components/host/editor/CalendarSyncPanel.client', () => ({
    CalendarSyncPanel: () => <div data-testid="sync-panel-stub">panel</div>
}));

vi.mock('@repo/icons', () => ({
    CalendarIcon: () => <svg data-testid="calendar-icon" />
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const props = { locale: 'es' as const, accommodationId: 'acc-1' };
const openButton = () => screen.getByRole('button', { name: /Conectar calendarios externos/i });

beforeEach(() => {
    mockHas.mockReturnValue(true); // entitled by default
});

afterEach(() => {
    vi.clearAllMocks();
    // Reset the URL between tests (auto-open reads search + hash on mount).
    window.history.replaceState({}, '', '/');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarSyncLauncher', () => {
    it('renders the open button and keeps the panel hidden by default', () => {
        render(<CalendarSyncLauncher {...props} />);
        expect(openButton()).toBeInTheDocument();
        expect(screen.queryByTestId('sync-panel-stub')).not.toBeInTheDocument();
    });

    it('opens the connect dialog with the panel when entitled', async () => {
        const user = userEvent.setup();
        render(<CalendarSyncLauncher {...props} />);

        await user.click(openButton());

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('sync-panel-stub')).toBeInTheDocument();
    });

    it('opens the upgrade nudge (never the panel) when NOT entitled', async () => {
        mockHas.mockReturnValue(false);
        const user = userEvent.setup();
        render(<CalendarSyncLauncher {...props} />);

        await user.click(openButton());

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        // Never mounts the connect panel for a locked plan.
        expect(screen.queryByTestId('sync-panel-stub')).not.toBeInTheDocument();
        // Shows the upgrade CTA linking to the plans page.
        const cta = screen.getByRole('link', { name: /Mejorar plan/i });
        expect(cta).toHaveAttribute('href', '/es/suscriptores/planes/');
    });

    it('closes the dialog on Escape', async () => {
        const user = userEvent.setup();
        render(<CalendarSyncLauncher {...props} />);

        await user.click(openButton());
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await waitFor(() =>
            expect(screen.queryByTestId('sync-panel-stub')).not.toBeInTheDocument()
        );
    });

    it('auto-opens the connect panel when returning from Google OAuth', async () => {
        window.history.replaceState({}, '', '/editar/?calendarSync=connected');
        render(<CalendarSyncLauncher {...props} />);
        expect(await screen.findByTestId('sync-panel-stub')).toBeInTheDocument();
    });

    it('auto-opens the connect panel via the #calendar-sync email link', async () => {
        window.history.replaceState({}, '', '/editar/#calendar-sync');
        render(<CalendarSyncLauncher {...props} />);
        expect(await screen.findByTestId('sync-panel-stub')).toBeInTheDocument();
    });
});
