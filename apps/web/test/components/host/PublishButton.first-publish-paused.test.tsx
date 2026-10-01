/**
 * @file PublishButton.first-publish-paused.test.tsx
 * @description Admin-paused new signups on the property card's Publish action.
 *
 * A host's FIRST publish starts a trial, so it is paused while new signups are
 * frozen. The card then shows the shared "publishing new listings is paused —
 * your listing stays a draft" notice: never the Publish button (it would fail)
 * and never the plans link (the checkout it leads to is paused too). A stale
 * verdict that lets the click through shows the same notice on the API's 409.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';

const publishMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

vi.mock('@/components/billing/PaidSignupsPausedNotice.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

/** The shipped Spanish copy (packages/i18n/src/locales/es/billing.json). */
const ES_PAUSED_BODY =
    'Por el momento pausamos la publicación de fichas nuevas. Tu ficha queda guardada como borrador y vas a poder publicarla cuando se reanuden.';

function props(overrides: Record<string, unknown> = {}) {
    return {
        accommodationId: 'acc-1',
        locale: 'es' as const,
        label: 'Publicar',
        confirmTitle: '¿Publicar este alojamiento?',
        confirmNote: 'Va a aparecer en el sitio.',
        confirmYes: 'Sí, publicar',
        confirmNo: 'Cancelar',
        errorText: 'No se pudo publicar.',
        subscriptionRequiredMessage: 'Necesitás un plan activo.',
        subscriptionRequiredCta: 'Ver planes',
        missingRequirementsMessage: 'Para publicar falta completar: {{fields}}.',
        missingRequirementsCta: 'Completar en el editor',
        canPublish: true,
        startsTrial: false,
        confirmTrialNote: 'Al publicar arranca tu prueba gratis.',
        choosePlanLabel: 'Elegir plan de anfitrión',
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PublishButton — first publish paused by admin-frozen signups', () => {
    it('shows the paused notice instead of Publish or the plans link', () => {
        // Arrange / Act — what the eligibility endpoint answers while frozen
        render(
            <PublishButton
                {...props({ canPublish: false, startsTrial: false, firstPublishPaused: true })}
            />
        );

        // Assert
        expect(screen.getByTestId('publish-paused-notice')).toHaveTextContent(ES_PAUSED_BODY);
        expect(screen.queryByText('Publicar')).not.toBeInTheDocument();
        expect(screen.queryByText('Elegir plan de anfitrión')).not.toBeInTheDocument();
    });

    it('keeps Publish for an owner whose publish is not paused', () => {
        // Arrange / Act
        render(<PublishButton {...props({ firstPublishPaused: false })} />);

        // Assert
        expect(screen.getByText('Publicar')).toBeInTheDocument();
        expect(screen.queryByTestId('publish-paused-notice')).not.toBeInTheDocument();
    });

    it('shows the paused notice when a stale verdict reaches the frozen API', async () => {
        // Arrange
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'NEW_PAID_SIGNUPS_FROZEN',
                reason: 'FIRST_PUBLISH_PAUSED',
                message: 'Publishing new listings is temporarily paused.'
            }
        });
        const user = userEvent.setup();
        render(<PublishButton {...props({ startsTrial: true })} />);

        // Act
        await user.click(screen.getByText('Publicar'));
        await user.click(screen.getByText('Sí, publicar'));

        // Assert
        await waitFor(() => {
            expect(screen.getByTestId('publish-paused-notice')).toHaveTextContent(ES_PAUSED_BODY);
        });
    });
});
