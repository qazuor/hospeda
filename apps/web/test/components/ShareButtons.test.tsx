/**
 * @file ShareButtons.test.tsx
 * @description Unit tests for the ShareButtons React island.
 * Covers: render, popover open/close, copy-to-clipboard, WhatsApp href assertion.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareButtons } from '../../src/components/ShareButtons.client';
import { addToast } from '../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('../../src/components/ShareButtons.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    ShareIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="share-icon"
            width={size}
        />
    ),
    FacebookIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="facebook-icon"
            width={size}
        />
    ),
    WhatsappIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="whatsapp-icon"
            width={size}
        />
    ),
    CopyIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="copy-icon"
            width={size}
        />
    ),
    CloseIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="close-icon"
            width={size}
        />
    )
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
    url: 'https://hospeda.com.ar/es/alojamientos/cabana-del-rio/',
    title: 'Cabaña del Río',
    locale: 'es' as const
};

function renderShareButtons(props: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <ShareButtons
            {...DEFAULT_PROPS}
            {...props}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShareButtons', () => {
    beforeEach(() => {
        // Ensure Web Share API is NOT available by default (desktop scenario)
        Object.defineProperty(navigator, 'share', {
            value: undefined,
            writable: true,
            configurable: true
        });

        // Mock clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: vi.fn().mockResolvedValue(undefined)
            },
            writable: true,
            configurable: true
        });

        // Ensure desktop viewport (popover mode)
        Object.defineProperty(window, 'innerWidth', {
            value: 1280,
            writable: true,
            configurable: true
        });
    });

    describe('Initial render', () => {
        it('renders the trigger button', () => {
            renderShareButtons();
            expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
        });

        it('does not show the popover initially', () => {
            renderShareButtons();
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('renders the share icon inside the trigger', () => {
            renderShareButtons();
            expect(screen.getByTestId('share-icon')).toBeInTheDocument();
        });
    });

    describe('Popover behavior (desktop)', () => {
        it('opens the popover when the trigger is clicked', () => {
            renderShareButtons();
            const trigger = screen.getByRole('button', { name: /compartir/i });
            fireEvent.click(trigger);
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('shows all 5 share actions in the popover', () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            expect(screen.getByText('WhatsApp')).toBeInTheDocument();
            expect(screen.getByText('Facebook')).toBeInTheDocument();
            expect(screen.getByText('X')).toBeInTheDocument();
            expect(screen.getByText('Telegram')).toBeInTheDocument();
            // "Copiar enlace" is the copy button label (from fallback)
            expect(screen.getByText(/copiar enlace/i)).toBeInTheDocument();
        });

        it('closes the popover when the close button is clicked', () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
            expect(screen.getByRole('menu')).toBeInTheDocument();

            const closeBtn = screen.getByRole('button', { name: /cerrar/i });
            fireEvent.click(closeBtn);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('closes the popover when Escape is pressed', () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
            expect(screen.getByRole('menu')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('sets aria-expanded=true on trigger when popover is open', () => {
            renderShareButtons();
            const trigger = screen.getByRole('button', { name: /compartir/i });
            fireEvent.click(trigger);
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });

        it('sets aria-expanded=false on trigger when popover is closed', () => {
            renderShareButtons();
            const trigger = screen.getByRole('button', { name: /compartir/i });
            expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });
    });

    describe('WhatsApp link', () => {
        it('builds the correct WhatsApp href', () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            const whatsappLink = screen.getByText('WhatsApp').closest('a');
            expect(whatsappLink).not.toBeNull();

            const href = whatsappLink?.getAttribute('href') ?? '';
            expect(href).toContain('https://wa.me/?text=');
            expect(href).toContain(encodeURIComponent(DEFAULT_PROPS.title));
            expect(href).toContain(encodeURIComponent(DEFAULT_PROPS.url));
        });

        it('opens WhatsApp link in a new tab', () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            const whatsappLink = screen.getByText('WhatsApp').closest('a');
            expect(whatsappLink).toHaveAttribute('target', '_blank');
            expect(whatsappLink).toHaveAttribute('rel', 'noopener noreferrer');
        });
    });

    describe('Facebook link', () => {
        it('builds the correct Facebook href', () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            const fbLink = screen.getByText('Facebook').closest('a');
            expect(fbLink?.getAttribute('href')).toContain('facebook.com/sharer/sharer.php');
            expect(fbLink?.getAttribute('href')).toContain(encodeURIComponent(DEFAULT_PROPS.url));
        });
    });

    describe('Copy URL', () => {
        it('calls navigator.clipboard.writeText with the url', async () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            // The copy item has role="menuitem" (overrides native button role)
            const copyBtn = screen.getByRole('menuitem', { name: /copiar enlace/i });
            fireEvent.click(copyBtn);

            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(DEFAULT_PROPS.url);
            });

            await waitFor(() => {
                expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
            });
        });

        it('closes the popover after copying', async () => {
            renderShareButtons();
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
            expect(screen.getByRole('menu')).toBeInTheDocument();

            // The copy item has role="menuitem" (overrides native button role)
            const copyBtn = screen.getByRole('menuitem', { name: /copiar enlace/i });
            fireEvent.click(copyBtn);

            await waitFor(() => {
                expect(screen.queryByRole('menu')).not.toBeInTheDocument();
            });
        });
    });

    describe('Web Share API (mobile)', () => {
        it('calls navigator.share when Web Share API is available and viewport is mobile', async () => {
            const mockShare = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'share', {
                value: mockShare,
                writable: true,
                configurable: true
            });
            Object.defineProperty(window, 'innerWidth', {
                value: 480,
                writable: true,
                configurable: true
            });

            renderShareButtons();
            const trigger = screen.getByRole('button', { name: /compartir/i });
            fireEvent.click(trigger);

            await waitFor(() => {
                expect(mockShare).toHaveBeenCalledWith({
                    url: DEFAULT_PROPS.url,
                    title: DEFAULT_PROPS.title
                });
            });

            // Popover should NOT open
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });
});
