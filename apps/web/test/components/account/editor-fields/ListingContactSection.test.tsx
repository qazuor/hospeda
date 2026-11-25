/**
 * @file ListingContactSection.test.tsx
 * @description The one contact section both owner editors render (HOS-2497).
 *
 * Ports the behaviour the two retired sections pinned (listing
 * `ContactSection` and accommodation `ContactInfoSection`): the phone pair is
 * recomposed into one stored string, the landline is optional (HOS-2042), the
 * WhatsApp visibility opens on its default (HOS-2557), and every control has a
 * visible label and the editor's field id.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    type ContactChannel,
    ListingContactSection,
    type ListingContactSectionProps
} from '@/components/account/editor-fields/ListingContactSection';
import { buildFieldId } from '@/lib/forms/build-field-id';

const SUFFIXES = { phone: 'number', landlinePhone: 'number', whatsapp: 'number' } as const;

function channel(name: string, value = '', error?: string): ContactChannel {
    return { name, value, onChange: vi.fn(), error };
}

function renderSection(overrides: Partial<ListingContactSectionProps> = {}) {
    const props: ListingContactSectionProps = {
        locale: 'es',
        idPrefix: 'acc',
        suffixes: SUFFIXES,
        helpId: 'section:accommodation.contacto',
        phone: channel('phone'),
        landline: channel('landlinePhone'),
        email: channel('email'),
        ...overrides
    };
    render(<ListingContactSection {...props} />);
    return props;
}

describe('ListingContactSection', () => {
    it('renders one kit Section with a visible label for every channel', () => {
        // Arrange + Act
        renderSection({
            whatsapp: channel('whatsapp'),
            website: channel('website')
        });

        // Assert
        const section = screen.getByRole('region', { name: 'Datos de contacto' });
        expect(section).toHaveAttribute('data-help', 'section:accommodation.contacto');
        expect(screen.getByLabelText('Teléfono')).toHaveAttribute('id', 'acc-phone-number');
        expect(screen.getByLabelText(/Teléfono fijo/)).toHaveAttribute(
            'id',
            'acc-landlinePhone-number'
        );
        expect(screen.getByLabelText('WhatsApp')).toHaveAttribute('id', 'acc-whatsapp-number');
        expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'acc-email');
        expect(screen.getByLabelText(/Sitio web/)).toHaveAttribute('id', 'acc-website');
    });

    it('marks the landline optional (HOS-2042)', () => {
        renderSection();

        expect(screen.getByText('Teléfono fijo').closest('label')).toHaveTextContent('(opcional)');
    });

    it('splits a stored phone into country and number', () => {
        renderSection({ phone: channel('phone', '+54 9 343 1111111') });

        expect(screen.getByLabelText('Teléfono')).toHaveValue('9 343 1111111');
        expect(document.getElementById('acc-phone-country')).toHaveAccessibleName(/Argentina/);
    });

    it('recomposes the number with the dial code on edit', () => {
        const phone = channel('phone');
        renderSection({ phone });

        fireEvent.change(screen.getByLabelText('Teléfono'), {
            target: { value: '9 343 2222222' }
        });

        expect(phone.onChange).toHaveBeenCalledWith('+5493432222222');
    });

    it('recomposes the stored phone when only the country changes', () => {
        const phone = channel('phone', '+54 9 343 1111111');
        renderSection({ phone });

        fireEvent.click(document.getElementById('acc-phone-country') as HTMLElement);
        fireEvent.mouseDown(screen.getByRole('option', { name: /Uruguay/ }));

        expect(phone.onChange).toHaveBeenCalledWith('+59893431111111');
    });

    it('clears the phone entirely instead of saving a bare dial code', () => {
        const phone = channel('phone', '+54 9 343 1111111');
        renderSection({ phone });

        fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '' } });

        expect(phone.onChange).toHaveBeenCalledWith('');
    });

    it('reports a typed landline on the landline channel only', () => {
        const phone = channel('phone');
        const landline = channel('landlinePhone');
        renderSection({ phone, landline });

        fireEvent.change(screen.getByLabelText(/Teléfono fijo/), {
            target: { value: '3442 45-2345' }
        });

        expect(landline.onChange).toHaveBeenCalledWith('+543442452345');
        expect(phone.onChange).not.toHaveBeenCalled();
    });

    it('shows each error on its own control', () => {
        renderSection({
            landline: channel('landlinePhone', '', 'Teléfono inválido'),
            email: channel('email', '', 'Email inválido')
        });

        expect(screen.getByLabelText(/Teléfono fijo/)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Teléfono')).not.toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(/Email inválido/);
    });

    it('reports email and website edits', () => {
        const email = channel('email');
        const website = channel('website');
        renderSection({ email, website });

        fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
        fireEvent.change(screen.getByLabelText(/Sitio web/), {
            target: { value: 'https://x.com' }
        });

        expect(email.onChange).toHaveBeenCalledWith('a@b.com');
        expect(website.onChange).toHaveBeenCalledWith('https://x.com');
    });

    it('renders no WhatsApp, visibility or website control unless passed', () => {
        renderSection();

        expect(screen.queryByLabelText('WhatsApp')).toBeNull();
        expect(screen.queryByRole('group', { name: /WhatsApp/ })).toBeNull();
        expect(screen.queryByLabelText(/Sitio web/)).toBeNull();
    });

    it('never uses a placeholder as the only name of a control', () => {
        renderSection({ whatsapp: channel('whatsapp'), website: channel('website') });

        for (const input of screen.getAllByRole('textbox')) {
            expect(input).not.toHaveAttribute('placeholder');
            expect(input.id).not.toBe('');
        }
    });

    describe('WhatsApp visibility (HOS-2256, HOS-2557)', () => {
        const visibility = (value = '') => ({
            name: 'whatsappVisibility',
            value,
            onChange: vi.fn()
        });

        it('opens on the public default while no choice is stored', () => {
            renderSection({ whatsapp: channel('whatsapp'), whatsappVisibility: visibility() });

            const group = screen.getByRole('group', { name: 'Quién ve el botón de WhatsApp' });
            expect(within(group).getByRole('radio', { name: 'Todas las personas' })).toBeChecked();
            expect(group).toHaveTextContent(/cualquiera puede copiarlo/);
        });

        it('carries the field id on the first radio for focus-on-error', () => {
            renderSection({ whatsapp: channel('whatsapp'), whatsappVisibility: visibility() });

            expect(screen.getByRole('radio', { name: 'Todas las personas' })).toHaveAttribute(
                'id',
                buildFieldId({ prefix: 'acc', name: 'whatsappVisibility' })
            );
        });

        it('shows the signed-in hint and reports the picked mode', () => {
            const control = visibility('LOGGED_IN_ONLY');
            renderSection({ whatsapp: channel('whatsapp'), whatsappVisibility: control });

            const group = screen.getByRole('group', { name: 'Quién ve el botón de WhatsApp' });
            expect(group).toHaveTextContent(/solo lo ven las personas que iniciaron sesión/);
            expect(group).not.toHaveTextContent(/cualquiera puede copiarlo/);

            fireEvent.click(within(group).getByRole('radio', { name: 'Todas las personas' }));
            expect(control.onChange).toHaveBeenCalledWith('PUBLIC');
        });
    });

    it.each([
        ['en', 'Contact details', 'Landline'],
        ['pt', 'Dados de contato', 'Telefone fixo']
    ] as const)('renders its labels in %s', (locale, title, landline) => {
        renderSection({ locale });

        expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
        expect(screen.getByText(landline)).toBeInTheDocument();
    });
});
