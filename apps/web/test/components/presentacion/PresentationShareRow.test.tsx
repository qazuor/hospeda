/**
 * @file PresentationShareRow.test.tsx
 * @description HOS-2359 §6.D.3 (AC-19): the per-presentation share row on the
 * `/presentacion/` index. Every action hands out that presentation's `/go/` short
 * link for its own channel; nothing in the row is per-user.
 *
 * Copy feedback is an inline `role="status"` message, not a toast:
 * `StandaloneLayout` deliberately renders no `ToastViewport`, so a toast would
 * never be seen on this page.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PresentationShareRow } from '../../../src/components/presentacion/PresentationShareRow.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}));

vi.mock('../../../src/components/presentacion/PresentationShareRow.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@repo/icons', () => ({
    WhatsappIcon: () => <svg data-testid="whatsapp-icon" />,
    FacebookIcon: () => <svg data-testid="facebook-icon" />,
    XIcon: () => <svg data-testid="x-icon" />,
    TelegramIcon: () => <svg data-testid="telegram-icon" />,
    CopyIcon: () => <svg data-testid="copy-icon" />
}));

const SITE = 'https://hospeda.com.ar';
const PRESENTATION = {
    slug: 'alojamientos',
    name: 'Alojamientos',
    headline: 'Publicá tu alojamiento en Hospeda'
} as const;

function renderRow() {
    return render(
        <PresentationShareRow
            presentation={PRESENTATION}
            siteUrl={SITE}
            locale="es"
        />
    );
}

describe('PresentationShareRow', () => {
    beforeEach(() => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
            writable: true,
            configurable: true
        });
    });

    it.each([
        ['WhatsApp', `https://wa.me/?text=`, 'aloj-wa'],
        ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=', 'aloj-fb'],
        ['X', 'https://twitter.com/intent/tweet?url=', 'aloj-x'],
        ['Telegram', 'https://t.me/share/url?url=', 'aloj-tg']
    ])('the %s action opens the network intent with its own short link', (label, prefix, slug) => {
        // Arrange
        renderRow();
        const group = screen.getByRole('group');

        // Act
        const link = within(group).getByRole('link', { name: new RegExp(label, 'i') });

        // Assert
        const href = link.getAttribute('href') ?? '';
        expect(href.startsWith(prefix)).toBe(true);
        expect(href).toContain(encodeURIComponent(`${SITE}/go/${slug}/`));
        expect(href).not.toContain('utm_');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('shows the copy short link as visible text, without the scheme', () => {
        renderRow();

        expect(screen.getByText('hospeda.com.ar/go/aloj-link/')).toBeInTheDocument();
    });

    it('copies the copy-channel short link and confirms it inline', async () => {
        renderRow();

        fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${SITE}/go/aloj-link/`);
        });
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado');
        });
    });

    it('reports a failed copy inline', async () => {
        vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
        renderRow();

        fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('No se pudo copiar el enlace');
        });
    });

    it('renders exactly five actions', () => {
        renderRow();
        const group = screen.getByRole('group');

        expect(within(group).getAllByRole('link')).toHaveLength(4);
        expect(within(group).getAllByRole('button')).toHaveLength(1);
    });
});
