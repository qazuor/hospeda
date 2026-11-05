/**
 * @file PartnerApplication.test.tsx
 * @description PP1 form behavior tests (AC:V7:15).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PartnerApplication } from '../../../src/components/partner/PartnerApplication.client';

const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));

vi.mock('@/lib/api/endpoints', () => ({ partnerApplicationApi: { submit } }));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string) =>
            ({
                'alliance-leads.partnerApplication.title': 'Postulate como partner',
                'alliance-leads.partnerApplication.emailLabel': 'Correo electrónico',
                'alliance-leads.partnerApplication.emailHelp':
                    'Te vamos a escribir a esta dirección para responderte sobre la postulación.',
                'alliance-leads.partnerApplication.submit': 'Enviar postulación',
                'alliance-leads.partnerApplication.sending': 'Enviando postulación…',
                'alliance-leads.partnerApplication.success':
                    'Gracias. Recibimos tu correo y te escribiremos con una respuesta.',
                'alliance-leads.partnerApplication.error':
                    'No pudimos enviar la postulación. Intentá de nuevo más tarde.',
                'alliance-leads.partnerApplication.unavailable':
                    'El formulario no está disponible en este momento. Probá de nuevo más tarde.'
            })[key] ?? key
    })
}));
vi.mock('../../../src/components/partner/PartnerApplication.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) })
}));

let resolveTurnstile: ((token: string) => void) | undefined;

function renderForm(siteKey: string | undefined = 'site-key') {
    resolveTurnstile = undefined;
    window.turnstile = {
        render: (_target, options) => {
            resolveTurnstile = options.callback;
            return 'widget';
        },
        remove: vi.fn()
    };
    return render(
        <PartnerApplication
            locale="es"
            turnstileSiteKey={siteKey}
        />
    );
}

function completeForm(email = 'persona@example.com') {
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
    act(() => resolveTurnstile?.('valid-turnstile-token'));
}

describe('PartnerApplication (AC:V7:15)', () => {
    beforeEach(() => {
        submit.mockReset().mockResolvedValue({ ok: true, data: { submitted: true } });
        resolveTurnstile = undefined;
        delete window.turnstile;
    });

    it('submits only the email and Turnstile token, with real Spanish i18n copy', async () => {
        renderForm();
        completeForm('persona@example.com');
        fireEvent.submit(
            screen.getByRole('button', { name: 'Enviar postulación' }).closest('form')!
        );
        await waitFor(() => {
            expect(submit).toHaveBeenCalledWith({
                email: 'persona@example.com',
                cfTurnstileToken: 'valid-turnstile-token'
            });
        });
    });

    it('keeps submit disabled until Turnstile has supplied a token', () => {
        renderForm();
        fireEvent.change(screen.getByLabelText('Correo electrónico'), {
            target: { value: 'persona@example.com' }
        });
        expect(screen.getByRole('button', { name: 'Enviar postulación' })).toBeDisabled();
    });

    it('does not call the client when the honeypot is filled and simulates success', async () => {
        renderForm();
        completeForm();
        fireEvent.change(document.querySelector('[name="_hp"]') as HTMLInputElement, {
            target: { value: 'bot value' }
        });
        fireEvent.submit(
            screen.getByRole('button', { name: 'Enviar postulación' }).closest('form')!
        );
        expect(submit).not.toHaveBeenCalled();
        expect(await screen.findByRole('status')).toHaveTextContent(
            'Gracias. Recibimos tu correo y te escribiremos con una respuesta.'
        );
    });

    it.each([409, 403, 429])('uses the same generic error for HTTP %s', async (status) => {
        submit.mockResolvedValue({ ok: false, error: { status, message: 'server detail' } });
        renderForm();
        completeForm();
        fireEvent.click(screen.getByRole('button', { name: 'Enviar postulación' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos enviar la postulación. Intentá de nuevo más tarde.'
        );
    });

    it('does not render a sendable form without a site key', () => {
        renderForm('');
        expect(screen.getByRole('status')).toHaveTextContent(
            'El formulario no está disponible en este momento. Probá de nuevo más tarde.'
        );
        expect(screen.queryByRole('button')).toBeNull();
    });
});
