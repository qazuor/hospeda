/**
 * @file CalendarSyncLauncher.test.tsx
 * @description Tests for the launcher that collapses the external-calendar sync
 * panel behind a button + modal dialog (HOS-175 UI change).
 *
 * Covers:
 * - The panel is hidden by default; only the open button shows.
 * - Clicking the button opens the dialog and mounts the panel.
 * - Closing (Esc) hides the panel again.
 * - The dialog auto-opens when returning from Google OAuth (?calendarSync=...)
 *   or via the broken-feed email link (#calendar-sync), so those flows are not
 *   lost by hiding the panel.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarSyncLauncher } from '@/components/host/editor/CalendarSyncLauncher.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/components/host/editor/CalendarSyncLauncher.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/ui/Dialog.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

// The panel itself is covered by its own suite — stub it so this suite stays
// focused on the launcher's button + dialog behaviour and never touches the
// entitlements hook or calendar-sync API.
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

afterEach(() => {
    // Reset the URL between tests (auto-open reads search + hash on mount).
    window.history.replaceState({}, '', '/');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarSyncLauncher', () => {
    it('renders the open button and keeps the panel hidden by default', () => {
        render(<CalendarSyncLauncher {...props} />);
        expect(
            screen.getByRole('button', { name: /Conectar calendarios externos/i })
        ).toBeInTheDocument();
        expect(screen.queryByTestId('sync-panel-stub')).not.toBeInTheDocument();
    });

    it('opens the dialog with the panel when the button is clicked', async () => {
        const user = userEvent.setup();
        render(<CalendarSyncLauncher {...props} />);

        await user.click(screen.getByRole('button', { name: /Conectar calendarios externos/i }));

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByTestId('sync-panel-stub')).toBeInTheDocument();
    });

    it('closes the dialog on Escape', async () => {
        const user = userEvent.setup();
        render(<CalendarSyncLauncher {...props} />);

        await user.click(screen.getByRole('button', { name: /Conectar calendarios externos/i }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await waitFor(() =>
            expect(screen.queryByTestId('sync-panel-stub')).not.toBeInTheDocument()
        );
    });

    it('auto-opens when returning from Google OAuth (?calendarSync=connected)', async () => {
        window.history.replaceState({}, '', '/editar/?calendarSync=connected');
        render(<CalendarSyncLauncher {...props} />);
        expect(await screen.findByTestId('sync-panel-stub')).toBeInTheDocument();
    });

    it('auto-opens when arriving via the #calendar-sync email link', async () => {
        window.history.replaceState({}, '', '/editar/#calendar-sync');
        render(<CalendarSyncLauncher {...props} />);
        expect(await screen.findByTestId('sync-panel-stub')).toBeInTheDocument();
    });
});
