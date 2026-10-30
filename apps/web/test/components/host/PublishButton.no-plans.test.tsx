import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';

const publishMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

beforeEach(() => vi.clearAllMocks());

describe('PublishButton no plans (TEST:V8a:4)', () => {
    it('shows the no-plans message after the canonical publish rejection without a purchase link', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 403, message: 'no_plans_available' }
        });
        const user = userEvent.setup();
        render(
            <PublishButton
                listingId="listing-1"
                vertical="accommodation"
                locale="es"
                label="Publicar"
                confirmTitle="Confirmar"
                confirmNote="Nota"
                confirmYes="Sí, publicar"
                confirmNo="Cancelar"
                errorText="Error"
                subscriptionRequiredMessage="Necesitás un plan"
                subscriptionRequiredCta="Ver planes"
                missingRequirementsMessage="Faltan {{fields}}"
                missingRequirementsCta="Editar"
                affordance={{
                    kind: 'covered',
                    canPublish: true,
                    startsTrial: false,
                    trialDays: null
                }}
                checkFailedText="No pudimos comprobar"
                confirmTrialNote="Trial"
                choosePlanLabel="Elegir plan"
            />
        );
        await user.click(screen.getByRole('button', { name: 'Publicar' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        const message = await screen.findByTestId('publish-no-plans');
        expect(message).toHaveTextContent(/esta vertical no tiene planes disponibles/i);
        expect(message).toHaveTextContent(/sigue sin publicar/i);
        expect(message.querySelector('a, button')).toBeNull();
        expect(message).not.toHaveTextContent(/suscribite/i);
    });

    // HOS-1668 C-1: NO_PLANS_AVAILABLE is known before the click, so the card
    // says it up front (row 29) instead of offering Publish.
    it('shows the no-plans message up front for the no-plans affordance, with no button or link', () => {
        render(
            <PublishButton
                listingId="listing-1"
                vertical="accommodation"
                locale="es"
                label="Publicar"
                confirmTitle="Confirmar"
                confirmNote="Nota"
                confirmYes="Sí, publicar"
                confirmNo="Cancelar"
                errorText="Error"
                subscriptionRequiredMessage="Necesitás un plan"
                subscriptionRequiredCta="Ver planes"
                missingRequirementsMessage="Faltan {{fields}}"
                missingRequirementsCta="Editar"
                affordance={{
                    kind: 'noPlans',
                    canPublish: false,
                    startsTrial: false,
                    trialDays: null
                }}
                checkFailedText="No pudimos comprobar"
                confirmTrialNote="Trial"
                choosePlanLabel="Elegir plan"
            />
        );
        const message = screen.getByTestId('publish-no-plans');
        expect(message).toHaveTextContent(/esta vertical no tiene planes disponibles/i);
        expect(message).toHaveTextContent(/sigue sin publicar/i);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(document.body).not.toHaveTextContent(/suscribite/i);
        expect(publishMock).not.toHaveBeenCalled();
    });
});
