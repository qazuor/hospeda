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

async function publish() {
    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByRole('button', { name: 'Publicar de nuevo' }));
    await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
}

describe('PublishButton one-address rule (HOS-1810)', () => {
    it('maps 409 DUPLICATE_LOCATION to the explanatory message, not the generic error', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'ALREADY_EXISTS',
                reason: 'DUPLICATE_LOCATION',
                message: 'Another published listing of yours already occupies this address'
            }
        });
        await publish();
        expect(await screen.findByText(/ya tiene una ficha publicada tuya/i)).toBeInTheDocument();
        expect(screen.queryByText('Error genérico')).toBeNull();
    });

    it('keeps the generic error for another 409', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 409, code: 'ALREADY_EXISTS', message: 'Listing state changed' }
        });
        await publish();
        expect(await screen.findByText('Error genérico')).toBeInTheDocument();
    });
});
