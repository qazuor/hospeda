/**
 * @file PublishButton.test.tsx
 * @description Regression tests for the publish action on a property card
 * (H-94 / H-99).
 *
 * This island had no tests at all, which is part of how both defects survived:
 *
 * - **H-94** — every `400 VALIDATION_ERROR` was mapped onto one fixed sentence,
 *   "Faltan datos de capacidad (huéspedes, habitaciones o baños)". Measured in
 *   production against a draft holding `{capacity: 11, bedrooms: 3, minNights: 1}`
 *   and no bathrooms: the message named three fields, two of which were filled
 *   in, and omitted the only one missing.
 * - **H-99** — Publish was offered to an owner with no subscription with the
 *   same prominence as Edit and Delete, and its confirmation promised the
 *   listing would "aparecer en el sitio, visible para los turistas".
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';

const publishMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: publishMock }
}));

/** Props with everything wired for the happy path; tests override what they test. */
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
        hasActivePlan: true,
        choosePlanLabel: 'Elegir plan de anfitrión',
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PublishButton — no plan, no publish offer (H-99)', () => {
    it('offers the plan instead of the publish button', () => {
        // Arrange / Act
        render(<PublishButton {...props({ hasActivePlan: false })} />);

        // Assert — the page above this grid already says a plan is needed; the
        // button used to ignore that and offer publishing anyway.
        expect(screen.getByText('Elegir plan de anfitrión')).toBeInTheDocument();
        expect(screen.queryByText('Publicar')).not.toBeInTheDocument();
    });

    it('never promises the listing will go live when it cannot', async () => {
        // Arrange
        render(<PublishButton {...props({ hasActivePlan: false })} />);

        // Assert — the confirmation copy is unreachable, so the promise is
        // never made. Reaching it required a click that no longer exists.
        expect(screen.queryByText('Va a aparecer en el sitio.')).not.toBeInTheDocument();
        await waitFor(() => expect(publishMock).not.toHaveBeenCalled());
    });

    it('still offers publishing to an owner who has a plan', () => {
        // Arrange / Act
        render(<PublishButton {...props()} />);

        // Assert
        expect(screen.getByText('Publicar')).toBeInTheDocument();
    });
});

describe('PublishButton — the rejection names real fields (H-94)', () => {
    /** Clicks through Publish → Sí, publicar. */
    async function confirmPublish() {
        const user = userEvent.setup();
        await user.click(screen.getByText('Publicar'));
        await user.click(screen.getByText('Sí, publicar'));
    }

    it('names bathrooms when bathrooms is what the server rejected', async () => {
        // Arrange — the exact production rejection.
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                reason: 'PUBLISH_REQUIREMENTS_MISSING:bathrooms'
            }
        });
        render(<PublishButton {...props()} />);

        // Act
        await confirmPublish();

        // Assert
        await waitFor(() => {
            expect(screen.getByText('Para publicar falta completar: baños.')).toBeInTheDocument();
        });
    });

    it('does not claim guests or bedrooms are missing when they are not', async () => {
        // Arrange
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                reason: 'PUBLISH_REQUIREMENTS_MISSING:bathrooms'
            }
        });
        render(<PublishButton {...props()} />);

        // Act
        await confirmPublish();

        // Assert — the whole of H-94: being sent to fix a field that already
        // holds 11 is what made the host conclude the site was broken.
        await waitFor(() => {
            const banner = screen.getByRole('alert');
            expect(banner.textContent).not.toContain('huéspedes');
            expect(banner.textContent).not.toContain('habitaciones');
        });
    });

    it('lists every missing field when several are missing', async () => {
        // Arrange
        publishMock.mockResolvedValue({
            ok: false,
            error: {
                status: 400,
                code: 'VALIDATION_ERROR',
                reason: 'PUBLISH_REQUIREMENTS_MISSING:bathrooms,mainImage'
            }
        });
        render(<PublishButton {...props()} />);

        // Act
        await confirmPublish();

        // Assert
        await waitFor(() => {
            expect(
                screen.getByText('Para publicar falta completar: baños, la foto principal.')
            ).toBeInTheDocument();
        });
    });

    it('stays vague rather than lying when the server sends no usable reason', async () => {
        // Arrange — an older API build, or some other 400. The old code called
        // this "capacidad incompleta" regardless.
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 400, code: 'VALIDATION_ERROR' }
        });
        render(<PublishButton {...props()} />);

        // Act
        await confirmPublish();

        // Assert — no field is named, and none is falsely accused.
        await waitFor(() => {
            const banner = screen.getByRole('alert');
            expect(banner.textContent).toContain('Para publicar falta completar');
            expect(banner.textContent).not.toContain('baños');
        });
    });

    it('sends the owner to the plans page on a subscription rejection', async () => {
        // Arrange — must not be read as a missing-field rejection.
        publishMock.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'FORBIDDEN', message: 'subscription_required' }
        });
        render(<PublishButton {...props()} />);

        // Act
        await confirmPublish();

        // Assert
        await waitFor(() => {
            expect(screen.getByText('Ver planes')).toBeInTheDocument();
        });
    });
});
