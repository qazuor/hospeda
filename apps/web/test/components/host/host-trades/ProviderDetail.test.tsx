/**
 * @file ProviderDetail.test.tsx
 * @description Regression for the provider detail contact (HOS-2472): the
 * «Contactar» button opens a dialog with the provider's contact data as a real
 * link, and the data list shows the provider's facts.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProviderDetail } from '../../../../src/components/host/host-trades/ProviderDetail.client';

const provider = {
    name: 'Plomería Don Juan',
    contact: '+54 3442 567890',
    benefit: '10% de descuento',
    is24h: false,
    scheduleText: 'Lunes a viernes 9 a 18',
    categories: [{ slug: 'plomeria', nameI18n: { es: 'Plomería' } }]
} as unknown as Parameters<typeof ProviderDetail>[0]['provider'];

function renderDetail(overrides: Partial<typeof provider> = {}) {
    return render(
        <ProviderDetail
            locale="es"
            provider={{ ...provider, ...overrides }}
            registerUsageHref="/es/mi-cuenta/directorio-proveedores/juan/registrar-uso/"
        />
    );
}

describe('ProviderDetail', () => {
    it('lists the provider data in a description list with category pills', () => {
        const { container } = renderDetail();

        expect(container.querySelector('dl')).not.toBeNull();
        expect(screen.getByText('Plomería')).toBeInTheDocument();
        expect(screen.getByText('Lunes a viernes 9 a 18')).toBeInTheDocument();
        expect(screen.getByText('10% de descuento')).toBeInTheDocument();
    });

    it('opens the contact dialog from the Contactar button with a real tel link', async () => {
        const user = userEvent.setup();
        renderDetail();

        await user.click(screen.getByRole('button', { name: 'Contactar' }));

        const dialog = await screen.findByRole('dialog', { name: 'Contactar a Plomería Don Juan' });
        const link = within(dialog).getByRole('link', { name: /Llamar/ });
        expect(link).toHaveAttribute('href', 'tel:+543442567890');
    });

    it('offers an e-mail provider a mailto link', async () => {
        const user = userEvent.setup();
        renderDetail({ contact: 'juan@example.com' });

        await user.click(screen.getByRole('button', { name: 'Contactar' }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByRole('link', { name: /correo/ })).toHaveAttribute(
            'href',
            'mailto:juan@example.com'
        );
    });

    it('shows 24h availability instead of the schedule text', () => {
        renderDetail({ is24h: true });
        expect(screen.getByText('Disponible 24hs')).toBeInTheDocument();
        expect(screen.queryByText('Lunes a viernes 9 a 18')).toBeNull();
    });

    it('links the benefit to the register-usage page', () => {
        renderDetail();
        expect(screen.getByRole('link', { name: 'Registrar uso del beneficio' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/directorio-proveedores/juan/registrar-uso/'
        );
    });
});
