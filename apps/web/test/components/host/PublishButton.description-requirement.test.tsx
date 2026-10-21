import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';

const publishMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

const props = {
    vertical: 'accommodation' as const,
    listingId: 'acc-1',
    locale: 'es' as const,
    label: 'Publicar',
    confirmTitle: '¿Publicar?',
    confirmNote: 'Va a aparecer en el sitio.',
    confirmYes: 'Sí, publicar',
    confirmNo: 'Cancelar',
    errorText: 'No se pudo publicar.',
    subscriptionRequiredMessage: 'Necesitás un plan.',
    subscriptionRequiredCta: 'Ver planes',
    missingRequirementsMessage: 'Para publicar falta completar: {{fields}}.',
    missingRequirementsCta: 'Completar en el editor',
    affordance: { kind: 'covered', canPublish: true, startsTrial: false, trialDays: null } as const,
    checkFailedText: 'No pudimos comprobarlo.',
    confirmTrialNote: 'Trial',
    choosePlanLabel: 'Elegir plan'
};

beforeEach(() => vi.clearAllMocks());

describe('TEST:1722:3 PublishButton description requirement', () => {
    it('names the description and links to the editor after a publish rejection', async () => {
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                reason: 'PUBLISH_REQUIREMENTS_MISSING:description'
            }
        });
        const user = userEvent.setup();
        render(<PublishButton {...props} />);
        await user.click(screen.getByRole('button', { name: 'Publicar' }));
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Para publicar falta completar: la descripción.'
            );
            expect(screen.getByRole('link', { name: 'Completar en el editor' })).toHaveAttribute(
                'href',
                expect.stringContaining('/editar/')
            );
        });
    });
});
