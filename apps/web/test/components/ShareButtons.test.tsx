/**
 * @file ShareButtons.test.tsx
 * @description Unit tests for the ShareButtons React island.
 * Covers: render, popover open/close, copy-to-clipboard, WhatsApp href assertion,
 * and the per-action campaign UTMs (HOS-2359 AC-14).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    XIcon: () => <svg data-testid="x-icon" />,
    TelegramIcon: () => <svg data-testid="telegram-icon" />,
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
    locale: 'es' as const,
    campaign: 'accommodation' as 'accommodation' | 'event' | 'post'
};

/**
 * The URL each action shares (HOS-2359 AC-14): the canonical URL plus the share
 * UTMs for that action's source. Written as a literal on purpose, so the test does
 * not reuse the implementation's own helper.
 */
function sharedUrl(source: string, campaign: string = DEFAULT_PROPS.campaign): string {
    return `${DEFAULT_PROPS.url}?utm_source=${source}&utm_medium=share&utm_campaign=${campaign}`;
}

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

        it('keeps the legacy decorative X glyph in the desktop share menu', () => {
            renderShareButtons();

            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            const row = screen.getByRole('menuitem', { name: /twitter/i });
            const mark = within(row).getByText('𝕏');
            expect(mark).toHaveClass('xIcon');
            expect(mark).toHaveAttribute('aria-hidden', 'true');
            expect(within(row).queryByTestId('x-icon')).not.toBeInTheDocument();
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
            expect(href).toContain(encodeURIComponent(sharedUrl('whatsapp')));
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
            expect(fbLink?.getAttribute('href')).toContain(
                encodeURIComponent(sharedUrl('facebook'))
            );
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
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(sharedUrl('copy'));
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

    describe('Icon overlay fallback', () => {
        beforeEach(() => {
            vi.stubGlobal('innerWidth', 390);
        });

        function renderOverlay() {
            const user = userEvent.setup();
            render(
                <ShareButtons
                    {...DEFAULT_PROPS}
                    appearance="icon-overlay"
                />
            );
            const trigger = screen.getByRole('button', { name: 'Compartir' });
            trigger.focus();
            return { user, trigger };
        }

        it.each([
            { name: 'NotAllowedError', opensFallback: true },
            { name: 'AbortError', opensFallback: false }
        ])('handles native share rejection $name', async ({ name, opensFallback }) => {
            const share = vi.fn().mockRejectedValue(new DOMException('', name));
            navigator.share = share;
            const { user, trigger } = renderOverlay();

            await user.keyboard('{Enter}');

            expect(share).toHaveBeenCalledWith({
                url: sharedUrl('share'),
                title: DEFAULT_PROPS.title
            });
            if (opensFallback) {
                const fallback = await screen.findByRole('group', { name: 'Compartir' });
                expect(
                    within(fallback).getByRole('button', { name: 'Copiar enlace' })
                ).toBeEnabled();
                expect(within(fallback).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
            } else {
                expect(screen.queryByRole('group')).not.toBeInTheDocument();
                expect(trigger).toHaveFocus();
            }
        });

        it('opens a labeled popover with native controls, supports Tab, and returns focus on Escape', async () => {
            const { user, trigger } = renderOverlay();

            await user.keyboard('{Enter}');
            const popover = screen.getByRole('group', { name: 'Compartir' });
            const close = within(popover).getByRole('button', { name: 'Cerrar' });
            expect(close).toHaveFocus();
            await user.tab();

            expect(within(popover).getByRole('link', { name: /whatsapp/i })).toHaveFocus();
            expect(
                within(popover).getByRole('button', { name: 'Copiar enlace' })
            ).toBeInTheDocument();
            expect(trigger).not.toHaveAttribute('aria-haspopup', 'menu');
            await user.keyboard('{Escape}');
            expect(popover).not.toBeInTheDocument();
            expect(trigger).toHaveFocus();
        });

        it.each([
            'forward',
            'backward'
        ] as const)('dismisses without reclaiming focus when tabbing %s out of the overlay', async (direction) => {
            const user = userEvent.setup();
            render(
                <>
                    <button type="button">Previous control</button>
                    <ShareButtons
                        {...DEFAULT_PROPS}
                        appearance="icon-overlay"
                    />
                    <button type="button">Next control</button>
                </>
            );
            const trigger = screen.getByRole('button', { name: 'Compartir' });
            const backwards = direction === 'backward';
            const outside = screen.getByRole('button', {
                name: backwards ? 'Previous control' : 'Next control'
            });
            trigger.focus();
            await user.keyboard('{Enter}');
            const popover = screen.getByRole('group');
            if (backwards) {
                await user.tab({ shift: true });
                expect(trigger).toHaveFocus();
                expect(popover).toBeInTheDocument();
            } else {
                within(popover).getByRole('button', { name: 'Copiar enlace' }).focus();
            }

            await user.tab({ shift: backwards });

            expect(outside).toHaveFocus();
            expect(popover).not.toBeInTheDocument();
            await user.keyboard('{Escape}');
            expect(outside).toHaveFocus();
        });

        it('ignores Escape dispatched outside the share control while it is open', async () => {
            const { user, trigger } = renderOverlay();
            await user.keyboard('{Enter}');
            const popover = screen.getByRole('group');

            fireEvent.keyDown(document.body, { key: 'Escape' });

            expect(popover).toBeInTheDocument();
            expect(within(popover).getByRole('button', { name: 'Cerrar' })).toHaveFocus();
            expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });

        it.each([
            'Cerrar',
            'Copiar enlace',
            'Compartir en WhatsApp'
        ])('restores focus after activating %s', async (label) => {
            const { user, trigger } = renderOverlay();
            await user.keyboard('{Enter}');
            const action = screen.getByLabelText(label);
            // Test the new-tab link's handler without attempting navigation in jsdom.
            if (action instanceof HTMLAnchorElement) {
                action.addEventListener('click', (event) => event.preventDefault(), { once: true });
            }
            action.focus();

            await user.keyboard('{Enter}');

            await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
            expect(trigger).toHaveFocus();
        });

        it.each([
            {
                label: 'X',
                iconId: 'x-icon',
                prefix: 'https://twitter.com/intent/tweet?',
                source: 'x'
            },
            {
                label: 'Telegram',
                iconId: 'telegram-icon',
                prefix: 'https://t.me/share/url?',
                source: 'telegram'
            }
        ])('uses the library $label mark without changing its share URL', ({
            label,
            iconId,
            prefix,
            source
        }) => {
            const { trigger } = renderOverlay();
            fireEvent.click(trigger);

            const link = screen.getByText(label).closest('a');
            expect(link?.getAttribute('href')).toBe(
                `${prefix}url=${encodeURIComponent(sharedUrl(source))}&text=${encodeURIComponent(DEFAULT_PROPS.title)}`
            );
            expect(link).toContainElement(screen.getByTestId(iconId));
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
                    url: sharedUrl('share'),
                    title: DEFAULT_PROPS.title
                });
            });

            // Popover should NOT open
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });
});
