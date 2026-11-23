/**
 * @file ShareButtons.attribution.test.tsx
 * @description Unit tests for the per-action campaign UTMs of the ShareButtons
 * React island (HOS-2359 AC-14). The render and popover cases live in
 * `ShareButtons.test.tsx`.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareButtons } from '../../src/components/ShareButtons.client';

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

    describe('Campaign UTMs per action (HOS-2359 AC-14)', () => {
        it.each([
            'accommodation',
            'event',
            'post'
        ] as const)('tags every network link with its own source and campaign=%s', (campaign) => {
            // Arrange
            renderShareButtons({ campaign });

            // Act
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            // Assert
            const hrefs = screen
                .getAllByRole('menuitem')
                .map((item) => item.getAttribute('href'))
                .filter((href): href is string => href !== null);
            expect(hrefs).toHaveLength(4);
            for (const [index, source] of ['whatsapp', 'facebook', 'x', 'telegram'].entries()) {
                expect(hrefs[index]).toContain(encodeURIComponent(sharedUrl(source, campaign)));
            }
        });

        it('copies the canonical URL tagged source=copy, never the bare URL', async () => {
            renderShareButtons({ campaign: 'post' });
            fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

            fireEvent.click(screen.getByRole('menuitem', { name: /copiar enlace/i }));

            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                    sharedUrl('copy', 'post')
                );
            });
        });
    });
});
