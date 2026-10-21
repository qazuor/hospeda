import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishButton } from '@/components/host/PublishButton.client';
import type { PublishAffordance } from '@/lib/publish/subscribe-button';

const accommodationPublish = vi.hoisted(() => vi.fn());
const verticalPublish = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { publish: accommodationPublish },
    publishApi: { publish: verticalPublish }
}));

const TRIAL = { kind: 'publish', canPublish: true, startsTrial: true, trialDays: 30 } as const;
const COVERED = { kind: 'covered', canPublish: true, startsTrial: false, trialDays: null } as const;
const UNKNOWN = {
    kind: 'unknown',
    canPublish: false,
    startsTrial: false,
    trialDays: null
} as const;

function props(
    vertical: 'gastronomy' | 'experience',
    affordance: PublishAffordance = TRIAL,
    overrides: Record<string, unknown> = {}
) {
    return {
        vertical,
        listingId: 'listing-1',
        locale: 'es' as const,
        label: 'Publicar',
        confirmTitle: '¿Publicar?',
        confirmNote: 'Se verá públicamente.',
        confirmYes: 'Sí, publicar',
        confirmNo: 'Cancelar',
        errorText: 'Error',
        subscriptionRequiredMessage: 'Suscripción requerida',
        subscriptionRequiredCta: 'Ver planes',
        missingRequirementsMessage: 'Faltan datos: {{fields}}',
        missingRequirementsCta: 'Editar',
        affordance,
        checkFailedText: 'No pudimos comprobar.',
        confirmTrialNote: 'Al publicar arranca tu prueba gratis de 30 días.',
        choosePlanLabel: 'Elegir plan',
        ...overrides
    };
}

async function confirm(vertical: 'gastronomy' | 'experience', affordance = TRIAL) {
    const user = userEvent.setup();
    render(<PublishButton {...props(vertical, affordance)} />);
    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
}

beforeEach(() => {
    vi.clearAllMocks();
    verticalPublish.mockResolvedValue({ ok: true, data: {} });
});

describe('PublishButton listing verticals (TEST:1729:2, TEST:1729:3)', () => {
    it.each([
        'gastronomy',
        'experience'
    ] as const)('publishes %s and only announces a real trial', async (vertical) => {
        const user = userEvent.setup();
        render(<PublishButton {...props(vertical)} />);
        await user.click(screen.getByRole('button', { name: 'Publicar' }));
        expect(screen.getByText(/prueba gratis/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Sí, publicar' }));
        expect(verticalPublish).toHaveBeenCalledWith({ vertical, id: 'listing-1' });
        expect(accommodationPublish).not.toHaveBeenCalled();
    });

    it.each([
        'gastronomy',
        'experience'
    ] as const)('hides trial for %s when covered', async (vertical) => {
        const user = userEvent.setup();
        render(<PublishButton {...props(vertical, COVERED)} />);
        await user.click(screen.getByRole('button', { name: 'Publicar' }));
        expect(screen.queryByText(/prueba gratis/)).not.toBeInTheDocument();
    });

    it.each([
        ['gastronomy', '/es/planes/gastronomia/precios/'],
        ['experience', '/es/planes/experiencias/precios/']
    ] as const)('uses %s pricing for server subscription rejection', async (vertical, href) => {
        verticalPublish.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'FORBIDDEN', message: 'subscription_required' }
        });
        await confirm(vertical, COVERED);
        const notice = await screen.findByTestId('publish-subscribe-to-publish');
        expect(notice).toHaveTextContent('Suscribite para publicar');
        expect(notice).toHaveTextContent(
            vertical === 'gastronomy' ? 'suscripción de gastronomía' : 'suscripción de experiencias'
        );
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', href);
    });

    it('shows no plans without a purchase action', async () => {
        verticalPublish.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'FORBIDDEN', message: 'no_plans_available' }
        });
        await confirm('experience', COVERED);
        expect(await screen.findByTestId('publish-no-plans')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows frozen signups notice', async () => {
        verticalPublish.mockResolvedValue({
            ok: false,
            error: { status: 409, code: 'NEW_PAID_SIGNUPS_FROZEN' }
        });
        await confirm('experience', COVERED);
        expect(await screen.findByTestId('publish-paused-notice')).toBeInTheDocument();
    });

    it.each([
        ['gastronomy', '/es/mi-cuenta/comercio/gastronomy/listing-1/editar/'],
        ['experience', '/es/mi-cuenta/comercio/experience/listing-1/editar/']
    ] as const)('routes an unrecognized %s validation error to its vertical editor', async (vertical, href) => {
        verticalPublish.mockResolvedValue({
            ok: false,
            error: { status: 400, code: 'VALIDATION_ERROR' }
        });
        await confirm(vertical, COVERED);
        const banner = await screen.findByRole('alert');
        expect(banner).toHaveTextContent('Faltan datos:');
        expect(banner).not.toHaveTextContent(/baños|huéspedes|habitaciones/i);
        expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', href);
    });

    it.each([
        UNKNOWN,
        { kind: 'checkout', canPublish: false, startsTrial: false, trialDays: null } as const
    ])('fails closed for unresolved or checkout affordance', (affordance) => {
        render(<PublishButton {...props('gastronomy', affordance)} />);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
