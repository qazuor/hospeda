import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';

const publishMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

beforeEach(() => vi.clearAllMocks());

const renderButton = () =>
    render(
        <PublishButton
            listingId="listing-1"
            vertical="accommodation"
            locale="es"
            label="Publicar de nuevo"
            confirmTitle="Confirmar"
            confirmNote="Nota"
            confirmYes="Sí, publicar"
            confirmNo="Cancelar"
            errorText="Error genérico"
            subscriptionRequiredMessage="Necesitás un plan"
            subscriptionRequiredCta="Ver planes"
            missingRequirementsMessage="Faltan {{fields}}"
            missingRequirementsCta="Editar"
            affordance={{ kind: 'covered', canPublish: true, startsTrial: false, trialDays: null }}
            checkFailedText="No pudimos comprobar"
            confirmTrialNote="Trial"
            choosePlanLabel="Elegir plan"
        />
    );

describe('PublishButton plan cap (HOS-1977 review)', () => {
    it('answers 403 LIMIT_REACHED with the cap message and a plans link, not the generic error', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'LIMIT_REACHED', message: 'Listing limit reached' }
        });
        const user = userEvent.setup();
        renderButton();
        await user.click(screen.getByRole('button', { name: 'Publicar de nuevo' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        const notice = await screen.findByTestId('publish-limit-reached');
        expect(notice).toHaveTextContent(/alcanzaste el límite de publicaciones/i);
        expect(notice).toHaveTextContent(/Despublicá otra ficha o mejorá tu plan/);
        expect(screen.getByRole('link', { name: 'Mejorar mi plan' })).toHaveAttribute(
            'href',
            expect.stringContaining('/es/')
        );
        expect(screen.queryByText('Error genérico')).toBeNull();
    });

    it('keeps the generic error for any other failure', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const user = userEvent.setup();
        renderButton();
        await user.click(screen.getByRole('button', { name: 'Publicar de nuevo' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        expect(await screen.findByText('Error genérico')).toBeInTheDocument();
        expect(screen.queryByTestId('publish-limit-reached')).toBeNull();
    });
});
