/**
 * @file ShareButtons.analytics.test.tsx
 * @description `ShareButtons` `analytics` prop and `appearance="icon"`
 * (HOS-2579 §6.3, §6.10.4).
 *
 * - With `analytics`, every completed share emits exactly one `listing_shared`
 *   (`native`, `copy`, `network`) whose payload passes the catalog schema.
 * - A cancelled native share emits nothing.
 * - Without `analytics` (events, posts) nothing is emitted.
 * - `appearance="icon"` renders an icon-only trigger with an accessible name.
 */

import { AnalyticsEventSchemas } from '@repo/analytics';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareButtons, type ShareButtonsAnalytics } from '../../src/components/ShareButtons.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const trackEventMock = vi.fn();
vi.mock('../../src/lib/analytics/umami-client', () => ({
    trackEvent: (...args: unknown[]) => trackEventMock(...args)
}));

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

vi.mock('@repo/icons', () => {
    const icon = (id: string) => () => <svg data-testid={id} />;
    return {
        ShareIcon: icon('share-icon'),
        FacebookIcon: icon('facebook-icon'),
        WhatsappIcon: icon('whatsapp-icon'),
        XIcon: icon('x-icon'),
        TelegramIcon: icon('telegram-icon'),
        CopyIcon: icon('copy-icon'),
        CloseIcon: icon('close-icon')
    };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ANALYTICS: ShareButtonsAnalytics = {
    listingId: '550e8400-e29b-41d4-a716-446655440000',
    vertical: 'venue',
    origin: 'bar'
};

const BASE_PROPS = {
    url: 'https://hospeda.com.ar/es/comer-y-salir/bar-del-puerto/',
    title: 'Bar del Puerto',
    locale: 'es' as const,
    campaign: 'venue' as const
};

/** Expected `listing_shared` payload for a given method. */
function expectedPayload(method: 'native' | 'copy' | 'network') {
    return {
        listing_id: ANALYTICS.listingId,
        vertical: ANALYTICS.vertical,
        origin: ANALYTICS.origin,
        method,
        locale: 'es'
    };
}

/** Asserts exactly one `listing_shared` call with the given method and a schema-valid payload. */
function expectSingleShare(method: 'native' | 'copy' | 'network'): void {
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    const [name, payload] = trackEventMock.mock.calls[0] ?? [];
    expect(name).toBe('listing_shared');
    expect(payload).toStrictEqual(expectedPayload(method));
    expect(AnalyticsEventSchemas.listing_shared.safeParse(payload).success).toBe(true);
}

function setViewport({ width, share }: { width: number; share?: () => Promise<void> }): void {
    Object.defineProperty(window, 'innerWidth', {
        value: width,
        writable: true,
        configurable: true
    });
    Object.defineProperty(navigator, 'share', { value: share, writable: true, configurable: true });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShareButtons — listing_shared (HOS-2579)', () => {
    beforeEach(() => {
        trackEventMock.mockClear();
        setViewport({ width: 1280 });
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            writable: true,
            configurable: true
        });
    });

    it('emits method=native once when the native share sheet resolves', async () => {
        // Arrange
        const share = vi.fn().mockResolvedValue(undefined);
        setViewport({ width: 390, share });
        render(
            <ShareButtons
                {...BASE_PROPS}
                analytics={ANALYTICS}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

        // Assert
        await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
        await waitFor(() => expectSingleShare('native'));
    });

    it('emits nothing when the native share is cancelled', async () => {
        // Arrange
        const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
        setViewport({ width: 390, share });
        render(
            <ShareButtons
                {...BASE_PROPS}
                analytics={ANALYTICS}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

        // Assert
        await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
        expect(trackEventMock).not.toHaveBeenCalled();
    });

    it('emits method=copy once when the link is copied', async () => {
        // Arrange
        render(
            <ShareButtons
                {...BASE_PROPS}
                analytics={ANALYTICS}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

        // Act
        fireEvent.click(screen.getByRole('menuitem', { name: /copiar enlace/i }));

        // Assert
        await waitFor(() => expectSingleShare('copy'));
    });

    it('emits method=network once when a network intent link is clicked', () => {
        // Arrange
        render(
            <ShareButtons
                {...BASE_PROPS}
                analytics={ANALYTICS}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

        // Act
        fireEvent.click(screen.getByRole('menuitem', { name: /whatsapp/i }));

        // Assert
        expectSingleShare('network');
    });

    it('emits nothing without the analytics prop (events and posts unchanged)', async () => {
        // Arrange
        render(
            <ShareButtons
                {...BASE_PROPS}
                campaign="event"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /compartir/i }));

        // Act
        fireEvent.click(screen.getByRole('menuitem', { name: /whatsapp/i }));
        fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
        fireEvent.click(screen.getByRole('menuitem', { name: /copiar enlace/i }));

        // Assert
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
        expect(trackEventMock).not.toHaveBeenCalled();
    });
});

describe('ShareButtons — appearance="icon" (HOS-2579)', () => {
    beforeEach(() => {
        trackEventMock.mockClear();
        setViewport({ width: 1280 });
    });

    it('renders an icon-only trigger with an accessible name and the icon class', () => {
        // Arrange / Act
        const { container } = render(
            <ShareButtons
                {...BASE_PROPS}
                appearance="icon"
            />
        );

        // Assert
        const trigger = screen.getByRole('button', { name: 'Compartir' });
        expect(trigger.textContent).toBe('');
        expect(trigger.querySelector('[data-testid="share-icon"]')).not.toBeNull();
        expect(container.firstElementChild?.className).toContain('icon');
        expect(container.firstElementChild?.className).not.toContain('iconOverlay');
    });

    it('opens the share actions as a labelled group, like the overlay variant', () => {
        // Arrange
        render(
            <ShareButtons
                {...BASE_PROPS}
                appearance="icon"
                analytics={ANALYTICS}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

        // Assert
        expect(screen.getByRole('group', { name: 'Compartir' })).toBeInTheDocument();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
