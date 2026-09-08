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
 *
 * ## The H-99 suite was rewritten, not deleted (HOS-1183)
 *
 * Its three tests asserted `hasActivePlan: false` hides the button, and they
 * were correct under the premise of their time: HOS-171 had moved the trial
 * onto the MercadoPago preapproval the checkout creates, so "no plan" and
 * "cannot publish" were the same sentence.
 *
 * HOS-1012 reverted that premise — the trial is a local row again, granted at
 * publish — and the sentences came apart. The prop is now the server's own
 * verdict, and the tests below assert the SAME protection against the state
 * that still deserves it: never offer publishing that cannot succeed. What
 * changed is which owner that is.
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
        canPublish: true,
        startsTrial: false,
        confirmTrialNote: 'Al publicar arranca tu prueba gratis de 30 días. Sin tarjeta.',
        choosePlanLabel: 'Elegir plan de anfitrión',
        ...overrides
    };
}

/** The trial line, asserted both present and absent — see TRIAL_NOTE's uses. */
const TRIAL_NOTE = 'Al publicar arranca tu prueba gratis de 30 días. Sin tarjeta.';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PublishButton — never offer what the server would refuse (H-99, narrowed by HOS-1183)', () => {
    it('offers the plan instead of the publish button when the server would refuse', () => {
        // Arrange / Act
        render(<PublishButton {...props({ canPublish: false })} />);

        // Assert — the protection H-99 introduced, unchanged. What narrowed is
        // its trigger: it now fires on the server's verdict, not on "no plan
        // loaded".
        expect(screen.getByText('Elegir plan de anfitrión')).toBeInTheDocument();
        expect(screen.queryByText('Publicar')).not.toBeInTheDocument();
    });

    it('never promises the listing will go live when it cannot', async () => {
        // Arrange
        render(<PublishButton {...props({ canPublish: false })} />);

        // Assert — the confirmation copy is unreachable, so the promise is
        // never made. Reaching it required a click that no longer exists.
        expect(screen.queryByText('Va a aparecer en el sitio.')).not.toBeInTheDocument();
        await waitFor(() => expect(publishMock).not.toHaveBeenCalled());
    });

    it('offers publishing to an owner who has a plan', () => {
        // Arrange / Act
        render(<PublishButton {...props()} />);

        // Assert
        expect(screen.getByText('Publicar')).toBeInTheDocument();
    });

    it('offers publishing to an owner with NO plan but an intact trial — the HOS-1183 bug', () => {
        // Arrange / Act — `first_publish`: no subscription loaded, so the old
        // `hasActivePlan` boolean was false and this owner got a plans link.
        // The server publishes them and starts their trial.
        render(<PublishButton {...props({ canPublish: true, startsTrial: true })} />);

        // Assert
        expect(screen.getByText('Publicar')).toBeInTheDocument();
        expect(screen.queryByText('Elegir plan de anfitrión')).not.toBeInTheDocument();
    });
});

describe('PublishButton — the trial is announced where it is real (HOS-1183 D-2)', () => {
    /** Opens the confirm step. */
    async function openConfirm() {
        const user = userEvent.setup();
        await user.click(screen.getByText('Publicar'));
    }

    it('announces the trial on the confirm step when publishing starts one', async () => {
        // Arrange — the presence half of the pair. Publishing starts a 30-day
        // clock by the owner's own action; not saying so is what later produces
        // "my trial was consumed without warning".
        render(<PublishButton {...props({ canPublish: true, startsTrial: true })} />);

        // Act
        await openConfirm();

        // Assert
        expect(screen.getByText(TRIAL_NOTE)).toBeInTheDocument();
    });

    it('says nothing about a trial to an owner who is already paying', async () => {
        // Arrange — `has_active_sub`. The absence half; its sibling above
        // asserts the identical string IS rendered, so a typo in the selector
        // cannot make both pass.
        render(<PublishButton {...props({ canPublish: true, startsTrial: false })} />);

        // Act
        await openConfirm();

        // Assert — and the rest of the confirm copy is what it always was.
        expect(screen.queryByText(TRIAL_NOTE)).not.toBeInTheDocument();
        expect(screen.getByText('¿Publicar este alojamiento?')).toBeInTheDocument();
        expect(screen.getByText('Va a aparecer en el sitio.')).toBeInTheDocument();
    });

    it('never promises free days to an owner whose trial is spent', () => {
        // Arrange / Act — `subscription_required`. The one state where a
        // free-run promise is a lie: the trial is gone, and a checkout will not
        // grant another one either.
        render(<PublishButton {...props({ canPublish: false, startsTrial: false })} />);

        // Assert
        expect(screen.queryByText(TRIAL_NOTE)).not.toBeInTheDocument();
        expect(document.body.textContent).not.toContain('gratis');
        expect(document.body.textContent).not.toContain('Sin tarjeta');
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
