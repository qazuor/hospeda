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
                accommodationId="listing-1"
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
                canPublish
                confirmTrialNote="Trial"
                startsTrial={false}
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
});
