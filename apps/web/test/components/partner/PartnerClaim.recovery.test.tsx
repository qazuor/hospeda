import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../../src/lib/i18n';
import { PENDING_ACTION_STORAGE_KEY } from '../../../src/lib/pending-action';
import {
    mocks,
    PARTNER_ID,
    PATH,
    renderClaim,
    SECRET,
    setAuthenticated,
    setFragment,
    useClaimFixture
} from './partner-claim-fixture';

describe('PartnerClaim recovery', () => {
    useClaimFixture();

    it.each([
        ['', 'Cómo reclamar un Partner', 'info'],
        ['#partner=invalid', 'El enlace no es válido', 'warning']
    ])('offers recovery for fragment %j without looking up a claim', (fragment, heading, tone) => {
        window.history.replaceState(null, '', `${PATH}${fragment}`);

        renderClaim();

        expect(screen.getByRole('region', { name: heading })).toHaveAttribute('data-tone', tone);
        expect(screen.getByRole('link', { name: 'Contactanos' })).toHaveAttribute(
            'href',
            '/es/contacto/'
        );
        expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute(
            'href',
            '/es/'
        );
        expect(mocks.lookup).not.toHaveBeenCalled();
    });

    it.each([
        { name: 'fragment without secret', fragment: `partner=${PARTNER_ID}` },
        { name: 'non-UUID partner id', fragment: `partner=not-a-uuid&secret=${SECRET}` }
    ])('does not call the API for a $name', async ({ fragment }) => {
        setAuthenticated(true);
        setFragment(fragment);

        renderClaim();

        expect(await screen.findByText('El enlace no es válido')).toBeInTheDocument();
        expect(mocks.checkClaim).not.toHaveBeenCalled();
        expect(mocks.claim).not.toHaveBeenCalled();
    });

    it('shows not-found on a 404 check', async () => {
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.checkClaim.mockResolvedValue({ ok: false, error: { status: 404, message: 'x' } });

        renderClaim();

        expect(await screen.findByText('El enlace no es válido')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reclamar el Partner' })).toBeNull();
    });

    it('shows the generic error on a network failure', async () => {
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.checkClaim.mockRejectedValue(new Error('network'));

        renderClaim();

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mocks.claim).not.toHaveBeenCalled();
    });

    it('returns to sign-in and re-saves the pending action after a 401', async () => {
        setAuthenticated(true);
        setFragment(`partner=${PARTNER_ID}&secret=${SECRET}`);
        mocks.claim.mockResolvedValue({
            ok: false,
            error: { status: 401, message: 'unauthorized' }
        });

        renderClaim();
        await userEvent.click(await screen.findByRole('button', { name: 'Reclamar el Partner' }));

        expect(
            await screen.findByText('Iniciá sesión para reclamar el Partner.')
        ).toBeInTheDocument();
        expect(window.sessionStorage.getItem(PENDING_ACTION_STORAGE_KEY)).not.toBeNull();
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('keeps the application wording out of the %s account recovery copy', (locale) => {
        const { t } = createTranslations(locale);
        for (const key of [
            'partners.claim.emailMismatch',
            'partners.claim.wrongAccount'
        ] as const) {
            expect(t(key)).not.toMatch(/solicitud|application|solicita[cç][aã]o/i);
        }
    });
});
